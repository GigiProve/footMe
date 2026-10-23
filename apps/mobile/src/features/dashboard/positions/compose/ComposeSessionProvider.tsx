/**
 * Stato della sessione di creazione (DAS-REV-16 §4, §10, §21, §27).
 *
 * Una sessione è «dall'apertura del composer alla prima pubblicazione o
 * all'uscita». Vive nel layout del flusso focalizzato perché le tre fasi
 * sono route diverse e §5 impone che «La Society rimane fissa per la
 * sessione di creazione».
 *
 * Cosa **non** sta qui, deliberatamente:
 *
 *   * i valori dei dettagli, che dopo la creazione vivono sul server e si
 *     leggono con `fetch_position_drafts` — §21 vieta un draft domain
 *     parallelo a Position;
 *   * la pubblicabilità, che è una derivazione del server (§6);
 *   * un autosave, che §21 esclude come requisito autonomo.
 *
 * Ci sta invece la proposta dello step 1 prima che esista un record: §21 —
 * «Non creare record server vuoti all'apertura del composer.»
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { PositionProfileType, PositionScope } from "./compose-types";
import type { ComposeOrigin } from "./compose-routes";

/** La proposta dello step 1, finché non diventa uno o più record. */
export type ComposeProposal = {
  /** Squadre aggiuntive del **batch**: altre ricerche, non lo stesso incarico. */
  additionalTeamIds: string[];
  customRoleName: string;
  primaryTeamId: string | null;
  profileType: PositionProfileType | null;
  roleId: string | null;
  scope: PositionScope;
};

export type ComposeSession = {
  /** ID creati dallo step 1, nell'ordine in cui il server li ha restituiti. */
  createdIds: string[];
  origin: ComposeOrigin;
  proposal: ComposeProposal;
  /** Selezione di pubblicazione dello step 3. Vuota al primo ingresso (§24). */
  selectedIds: string[];
};

type ComposeSessionValue = ComposeSession & {
  clearSelection: () => void;
  /** Chiave idempotente della creazione: cambia solo col cambiare della
   *  proposta, così un retry la riusa e un comando diverso no (§10). */
  createOperationKey: string;
  /** Vero quando esiste un buffer non ancora persistito (§27). */
  isDirty: boolean;
  markClean: () => void;
  markDirty: () => void;
  /** Chiave idempotente del publish, legata al set selezionato (§25). */
  publishOperationKey: string;
  setCreatedIds: (ids: string[]) => void;
  setProposal: (patch: Partial<ComposeProposal>) => void;
  setSelectedIds: (ids: string[]) => void;
  toggleSelected: (id: string) => void;
};

const ComposeSessionContext = createContext<ComposeSessionValue | null>(null);

const EMPTY_PROPOSAL: ComposeProposal = {
  additionalTeamIds: [],
  customRoleName: "",
  primaryTeamId: null,
  profileType: null,
  roleId: null,
  scope: "team",
};

/**
 * Chiave stabile per la durata di un tentativo logico (§10).
 *
 * Non `useMemo`: React ha il diritto di scartare un memo, e una chiave
 * rigenerata a sorpresa romperebbe la riconciliazione di un retry. Non una
 * `ref` scritta durante il render, che non è una lettura pura.
 *
 * La chiave è invece **derivata**: un nonce casuale per sessione — generato
 * una volta sola nell'inizializzatore di stato, dove l'impurità è lecita —
 * combinato con l'impronta di ciò che si sta chiedendo. Stessa proposta,
 * stessa chiave, anche dopo dieci render; proposta diversa, chiave diversa,
 * che è esattamente il contratto di §10.
 */
function useOperationKey(nonce: string, signature: string): string {
  return `${nonce}-${fingerprint(signature)}`;
}

/** djb2: basta a distinguere due proposte, e non deve resistere a un attacco. */
function fingerprint(value: string): string {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(index)) | 0;
  }

  return (hash >>> 0).toString(36);
}

export function ComposeSessionProvider({
  children,
  origin = "center",
  initialScope,
  initialTeamId,
}: {
  children: ReactNode;
  initialScope?: PositionScope;
  initialTeamId?: string | null;
  origin?: ComposeOrigin;
}) {
  const [proposal, setProposalState] = useState<ComposeProposal>(() => ({
    ...EMPTY_PROPOSAL,
    /* §5: «Un Team esplicitamente scelto nel Centro viene proposto nel
       composer.» Un ingresso senza Team non ne sceglie uno. */
    primaryTeamId: initialTeamId ?? null,
    scope: initialScope ?? "team",
  }));
  const [createdIds, setCreatedIdsState] = useState<string[]>([]);
  const [selectedIds, setSelectedIdsState] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  /* Il nonce nasce con la sessione e non cambia più: è ciò che rende la
     chiave idempotente irripetibile fra due sessioni e stabile dentro una. */
  const [sessionNonce] = useState(
    () =>
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
  );

  const createSignature = [
    proposal.profileType ?? "",
    proposal.roleId ?? "",
    proposal.customRoleName.trim(),
    proposal.scope,
    proposal.primaryTeamId ?? "",
    [...proposal.additionalTeamIds].sort().join(","),
  ].join("|");

  const createOperationKey = useOperationKey(
    sessionNonce,
    `create:${createSignature}`,
  );
  const publishOperationKey = useOperationKey(
    sessionNonce,
    `publish:${[...selectedIds].sort().join(",")}`,
  );

  const setProposal = useCallback((patch: Partial<ComposeProposal>) => {
    setProposalState((current) => ({ ...current, ...patch }));
  }, []);

  const setCreatedIds = useCallback((ids: string[]) => {
    setCreatedIdsState(ids);
  }, []);

  const setSelectedIds = useCallback((ids: string[]) => {
    setSelectedIdsState(ids);
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIdsState((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id],
    );
  }, []);

  const clearSelection = useCallback(() => setSelectedIdsState([]), []);
  const markDirty = useCallback(() => setIsDirty(true), []);
  const markClean = useCallback(() => setIsDirty(false), []);

  const value = useMemo<ComposeSessionValue>(
    () => ({
      clearSelection,
      createdIds,
      createOperationKey,
      isDirty,
      markClean,
      markDirty,
      origin,
      proposal,
      publishOperationKey,
      selectedIds,
      setCreatedIds,
      setProposal,
      setSelectedIds,
      toggleSelected,
    }),
    [
      clearSelection,
      createdIds,
      createOperationKey,
      isDirty,
      markClean,
      markDirty,
      origin,
      proposal,
      publishOperationKey,
      selectedIds,
      setCreatedIds,
      setProposal,
      setSelectedIds,
      toggleSelected,
    ],
  );

  return (
    <ComposeSessionContext.Provider value={value}>
      {children}
    </ComposeSessionContext.Provider>
  );
}

export function useComposeSession(): ComposeSessionValue {
  const value = useContext(ComposeSessionContext);

  if (!value) {
    throw new Error(
      "useComposeSession deve essere usato dentro ComposeSessionProvider.",
    );
  }

  return value;
}
