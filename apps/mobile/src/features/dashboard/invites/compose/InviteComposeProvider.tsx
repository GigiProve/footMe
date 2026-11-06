/**
 * Stato del composer a tre passi (§16).
 *
 * «Non creare un Invitation PENDING all'apertura, alla ricerca, al cambio
 * passo o al tap Continua. Il form può conservare uno stato locale non
 * inviato … Il solo comando finale Invia invito crea la proposta
 * persistente.» Qui non esiste nessuna chiamata di rete: è uno stato locale,
 * e lo resta.
 *
 * I passi sono route separate dello stesso Stack, non un indice in stato:
 * il back fra i passi deve ripristinare la schermata precedente con i suoi
 * dati, e una schermata condizionale non lo farebbe.
 *
 * `nonce` nasce una volta sola per sessione di composizione: combinato con
 * l'impronta della proposta produce la chiave idempotente di §25 — stessa
 * proposta, stessa chiave anche dopo dieci render; proposta diversa, chiave
 * diversa.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { newInviteSessionNonce, operationKeyOf } from "../operation-key";
import type {
  InviteCandidate,
  InviteDraft,
  InviteScopeType,
} from "../invites-types";

type ComposeContextValue = {
  draft: InviteDraft;
  isDirty: boolean;
  /** Chiave idempotente della proposta corrente (§25, §37). */
  operationKey: string;
  reset: () => void;
  setPerson: (person: InviteCandidate) => void;
  setRole: (input: { isCustom: boolean; roleId: string }) => void;
  setCustomRole: (value: string) => void;
  setScope: (scope: InviteScopeType) => void;
  setTeam: (input: { label: string; teamId: string }) => void;
};

const EMPTY: InviteDraft = {
  customRole: "",
  person: null,
  roleId: null,
  scopeType: "team",
  teamId: null,
  teamLabel: null,
};

const ComposeContext = createContext<ComposeContextValue | null>(null);

export function InviteComposeProvider({
  children,
  initialTeamId,
}: {
  children: ReactNode;
  /** Team canonico preimpostato dal dettaglio squadra (§16). */
  initialTeamId?: string | null;
}) {
  const [draft, setDraft] = useState<InviteDraft>(() => ({
    ...EMPTY,
    teamId: initialTeamId ?? null,
  }));
  const [isDirty, setDirty] = useState(false);
  /* Impurità lecita solo nell'inizializzatore: un nonce nuovo a ogni render
     renderebbe inutile la chiave idempotente. */
  const [nonce] = useState(newInviteSessionNonce);

  const setPerson = useCallback((person: InviteCandidate) => {
    setDirty(true);
    setDraft((current) => {
      if (current.person?.profileId === person.profileId) {
        return current;
      }

      /**
       * §16: «Se cambia il destinatario o la sua tipologia professionale,
       * rivalida la proposta e rimuovi soltanto i dati divenuti
       * incompatibili; non mantenere custom role Staff su un nuovo
       * Calciatore.»
       *
       * La squadra sopravvive — è compatibile con qualunque tipologia — il
       * ruolo e il suo testo libero no, perché i cataloghi sono per
       * tipologia.
       */
      const compatible = current.person?.profileType === person.profileType;

      return {
        ...current,
        customRole: compatible ? current.customRole : "",
        person,
        roleId: compatible ? current.roleId : null,
        /* Calciatore e Allenatore non hanno ambito societario (§19). */
        scopeType:
          person.profileType === "player" || person.profileType === "coach"
            ? "team"
            : current.scopeType,
      };
    });
  }, []);

  const setRole = useCallback((input: { isCustom: boolean; roleId: string }) => {
    setDirty(true);
    setDraft((current) => ({
      ...current,
      /* §20: «Non conservare valori contraddittori quando si cambia
         scelta.» Un ruolo noto non porta con sé il testo di un Altro. */
      customRole: input.isCustom ? current.customRole : "",
      roleId: input.roleId,
    }));
  }, []);

  const setCustomRole = useCallback((value: string) => {
    setDirty(true);
    setDraft((current) => ({ ...current, customRole: value }));
  }, []);

  const setScope = useCallback((scope: InviteScopeType) => {
    setDirty(true);
    setDraft((current) => ({
      ...current,
      scopeType: scope,
      /* §21: «Il passaggio a SOCIETY elimina il Team non più pertinente dal
         payload; il ritorno a TEAM richiede una selezione valida.» */
      teamId: scope === "society" ? null : current.teamId,
      teamLabel: scope === "society" ? null : current.teamLabel,
    }));
  }, []);

  const setTeam = useCallback((input: { label: string; teamId: string }) => {
    setDirty(true);
    setDraft((current) => ({
      ...current,
      scopeType: "team",
      teamId: input.teamId,
      teamLabel: input.label,
    }));
  }, []);

  const reset = useCallback(() => {
    setDraft({ ...EMPTY, teamId: initialTeamId ?? null });
    setDirty(false);
  }, [initialTeamId]);

  const operationKey = useMemo(
    () =>
      operationKeyOf(
        nonce,
        [
          draft.person?.profileId ?? "",
          draft.roleId ?? "",
          draft.customRole.trim().toLowerCase(),
          draft.scopeType,
          draft.teamId ?? "",
        ].join("|"),
      ),
    [draft, nonce],
  );

  const value = useMemo<ComposeContextValue>(
    () => ({
      draft,
      isDirty,
      operationKey,
      reset,
      setCustomRole,
      setPerson,
      setRole,
      setScope,
      setTeam,
    }),
    [
      draft,
      isDirty,
      operationKey,
      reset,
      setCustomRole,
      setPerson,
      setRole,
      setScope,
      setTeam,
    ],
  );

  return (
    <ComposeContext.Provider value={value}>{children}</ComposeContext.Provider>
  );
}

export function useInviteCompose(): ComposeContextValue {
  const value = useContext(ComposeContext);

  if (!value) {
    throw new Error("useInviteCompose deve stare dentro InviteComposeProvider");
  }

  return value;
}
