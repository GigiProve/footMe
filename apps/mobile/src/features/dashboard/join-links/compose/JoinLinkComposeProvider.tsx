/**
 * Stato del composer dei Link di invito (§11, §12, §15, §16, §17).
 *
 * «Prima di Genera link non esiste un record»: qui non c'è nessuna chiamata
 * di rete, solo una bozza locale. `JoinLinkDraft` (vedi `join-links-types.ts`)
 * vive in uno stato React finché il passo Riepilogo non chiama
 * `createJoinLink`.
 *
 * L'`operationKey` combina un nonce di sessione — nato una volta sola con
 * `newJoinSessionNonce()` — con un'impronta del contenuto corrente: «Stesso
 * submit e stesso payload restituiscono lo stesso link; un payload differente
 * con la stessa sessione produce una chiave diversa» (§17, §25). Un doppio
 * tap su "Genera link" resta la stessa operazione; correggere un campo e
 * ritornare al riepilogo ne crea una nuova, perché quella è davvero
 * un'altra richiesta.
 *
 * §12: cambiare le categorie togliendo "director" scarta `executiveRoleIds`
 * e `customExecutiveRole` dal payload sottomesso. Tornare indietro e
 * riselezionare Dirigenti può recuperare i valori locali: non sono persi,
 * sono soltanto "non ancora rivalidati" fino al passo Ruoli.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { newJoinSessionNonce, operationKeyOf } from "../operation-key";
import type { JoinLinkDraft, JoinProfileType } from "../join-links-types";

type ComposeContextValue = {
  draft: JoinLinkDraft;
  isDirty: boolean;
  /** Chiave idempotente del payload corrente (§17, §25). */
  operationKey: string;
  reset: () => void;
  setCustomExecutiveRole: (value: string) => void;
  setExecutiveRoleIds: (ids: string[]) => void;
  setExpiresOn: (value: string | null) => void;
  setMaxRedemptions: (value: number | null) => void;
  setProfileTypes: (types: JoinProfileType[]) => void;
  setTeam: (input: { label: string; teamId: string }) => void;
};

const EMPTY: JoinLinkDraft = {
  customExecutiveRole: "",
  executiveRoleIds: [],
  expiresOn: null,
  maxRedemptions: null,
  profileTypes: [],
  teamId: null,
  teamLabel: null,
};

const ComposeContext = createContext<ComposeContextValue | null>(null);

export function JoinLinkComposeProvider({
  children,
  initialTeamId,
}: {
  children: ReactNode;
  /** Team dal parametro di route, quando il composer parte da un contesto noto. */
  initialTeamId?: string | null;
}) {
  const [draft, setDraft] = useState<JoinLinkDraft>(() => ({
    ...EMPTY,
    teamId: initialTeamId ?? null,
  }));
  const [isDirty, setDirty] = useState(false);
  /* Impurità lecita solo nell'inizializzatore: un nonce nuovo a ogni render
     renderebbe inutile la chiave idempotente. */
  const [nonce] = useState(newJoinSessionNonce);

  const setTeam = useCallback((input: { label: string; teamId: string }) => {
    setDirty(true);
    setDraft((current) => ({
      ...current,
      teamId: input.teamId,
      teamLabel: input.label,
    }));
  }, []);

  const setProfileTypes = useCallback((types: JoinProfileType[]) => {
    setDirty(true);
    setDraft((current) => ({ ...current, profileTypes: types }));
  }, []);

  const setExecutiveRoleIds = useCallback((ids: string[]) => {
    setDirty(true);
    setDraft((current) => ({ ...current, executiveRoleIds: ids }));
  }, []);

  const setCustomExecutiveRole = useCallback((value: string) => {
    setDirty(true);
    setDraft((current) => ({ ...current, customExecutiveRole: value }));
  }, []);

  const setExpiresOn = useCallback((value: string | null) => {
    setDirty(true);
    setDraft((current) => ({ ...current, expiresOn: value }));
  }, []);

  const setMaxRedemptions = useCallback((value: number | null) => {
    setDirty(true);
    setDraft((current) => ({ ...current, maxRedemptions: value }));
  }, []);

  const reset = useCallback(() => {
    setDraft({ ...EMPTY, teamId: initialTeamId ?? null });
    setDirty(false);
  }, [initialTeamId]);

  /**
   * §12: la quota dirigenziale esce dalla firma — e quindi dalla chiave e
   * dal payload di creazione — quando "director" non è tra le categorie
   * selezionate, anche se i valori locali sopravvivono nella bozza per un
   * eventuale ritorno al passo Ruoli.
   */
  const operationKey = useMemo(
    () => {
      const hasDirector = draft.profileTypes.includes("director");
      const roleIds = hasDirector ? draft.executiveRoleIds : [];
      const customRole = hasDirector
        ? draft.customExecutiveRole.trim().toLowerCase()
        : "";

      return operationKeyOf(
        nonce,
        [
          draft.teamId ?? "",
          [...draft.profileTypes].sort().join(","),
          [...roleIds].sort().join(","),
          customRole,
          draft.expiresOn ?? "",
          draft.maxRedemptions ?? "",
        ].join("|"),
      );
    },
    [
      draft.customExecutiveRole,
      draft.executiveRoleIds,
      draft.expiresOn,
      draft.maxRedemptions,
      draft.profileTypes,
      draft.teamId,
      nonce,
    ],
  );

  const value = useMemo<ComposeContextValue>(
    () => ({
      draft,
      isDirty,
      operationKey,
      reset,
      setCustomExecutiveRole,
      setExecutiveRoleIds,
      setExpiresOn,
      setMaxRedemptions,
      setProfileTypes,
      setTeam,
    }),
    [
      draft,
      isDirty,
      operationKey,
      reset,
      setCustomExecutiveRole,
      setExecutiveRoleIds,
      setExpiresOn,
      setMaxRedemptions,
      setProfileTypes,
      setTeam,
    ],
  );

  return (
    <ComposeContext.Provider value={value}>{children}</ComposeContext.Provider>
  );
}

export function useJoinLinkCompose(): ComposeContextValue {
  const value = useContext(ComposeContext);

  if (!value) {
    throw new Error(
      "useJoinLinkCompose deve stare dentro JoinLinkComposeProvider",
    );
  }

  return value;
}
