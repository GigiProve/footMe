/**
 * Derivazioni pure del governo delle CUSTOM (DAS-REV-27).
 *
 * Qui vivono le regole testabili che le schermate applicano: sintesi
 * d'accesso (§9), validazione del draft accessi (§11), patch dei soli campi
 * modificati (§14), avviso d'impatto del cambio ambito (§14), menu secondo
 * capability (§8), instradamento del recupero (§19) e copy degli errori
 * (§24). Nessuna di queste funzioni decide un permesso: lo leggono dal read
 * model del server.
 */
import type {
  AccessChoice,
  CustomAccessMode,
  CustomShortlistDetail,
  ListPatch,
  RecoverableList,
  ScopePreview,
} from "./custom-shortlist-types";

/** §24: copy canoniche della 27. */
export const CUSTOM_COPY = {
  /* §9 — sintesi d'accesso */
  accessSoloTu: "Solo tu",
  accessShared: "Condivisa",
  accessScope: "Persone autorizzate dell'ambito",
  /* §5 screen 05 */
  manageTitle: "Gestisci lista",
  manageLabel: "Gestisci lista",
  editList: "Modifica lista",
  manageAccess: "Gestisci accesso",
  deleteList: "Elimina lista",
  /* §13 — Gestisci accesso */
  accessTitle: "Gestisci accesso",
  owner: "Proprietario",
  accessSection: "Accesso alla lista",
  soloIo: "Solo io",
  soloIoHelper: "La lista sarà visibile solo a te.",
  shareSpecific: "Condividi con persone specifiche",
  shareHelper: "Le persone scelte vedranno la lista secondo i propri permessi.",
  scopeFirst: "Scegli prima l'ambito per vedere le persone disponibili.",
  legacyAccess:
    "Oggi la lista è visibile alle persone autorizzate dell'ambito. Scegli come gestirla.",
  saveAccess: "Salva accesso",
  noPeopleTitle: "Nessuna persona disponibile",
  noPeopleBody: "Nessun collaboratore ha accesso a questo ambito. Puoi mantenere la lista Solo io.",
  selectAtLeastOne: "Seleziona almeno una persona oppure scegli Solo io.",
  peopleLoadError: "Impossibile caricare gli accessi. Riprova.",
  accessSaveError: "Impossibile aggiornare l'accesso. Riprova.",
  accessUpdated: "Accesso aggiornato",
  ineligible:
    "Alcune persone non sono più disponibili. Controlla la selezione e salva di nuovo.",
  conflict: "La lista è stata modificata nel frattempo. Ricarica per vedere i dati aggiornati.",
  reload: "Ricarica",
  /* §14 — Modifica lista */
  editTitle: "Modifica lista",
  cancel: "Annulla",
  saveChanges: "Salva modifiche",
  editError: "Impossibile salvare le modifiche. Riprova.",
  changesSaved: "Modifiche salvate",
  scopeImpactGeneric: "Alcune persone potrebbero non avere più accesso con il nuovo ambito.",
  ownerScopeBlocked:
    "Il proprietario non avrebbe accesso al nuovo ambito. Scegli un altro ambito.",
  /* §16 — Elimina lista */
  deleteTitle: "Eliminare questa lista?",
  deleteError: "Impossibile eliminare la lista. Riprova.",
  deleted: "Lista eliminata",
  /* §19 — recupero */
  menuRecover: "Recupera liste",
  recoveryTitle: "Recupero lista",
  recoveryListTitle: "Liste da recuperare",
  ownerToReassign: "Proprietario da riassegnare",
  ownerInvalidBody: "Il proprietario attuale non può più gestire questa lista.",
  assignNewOwner: "Assegna nuovo proprietario",
  chooseOwnerHelper: "Scegli una persona autorizzata della Società.",
  assignOwner: "Assegna proprietario",
  noneToRecover: "Nessuna lista da recuperare",
  noneToRecoverBody: "Le liste con un proprietario non più valido compariranno qui.",
  noOwnerCandidatesBody:
    "Nessuna persona della Società ha accesso a questo ambito. La lista resta conservata.",
  recoveryError: "Impossibile aggiornare il proprietario. Riprova.",
  ownerUpdated: "Proprietario aggiornato",
  ownerReturned: "Il proprietario può di nuovo gestire la lista: nessuna riassegnazione necessaria.",
  /* §24 — vuoto CUSTOM */
  emptyBody: "I profili aggiunti a questa lista compariranno qui.",
  offline: "Connessione assente. Riprova quando sei online.",
} as const;

export function sharedWithLabel(count: number): string {
  return count === 1 ? "Condivisa con 1 persona" : `Condivisa con ${count} persone`;
}

/**
 * §9: «Per owner: Solo tu oppure Condivisa con N persone, escludendo
 * l'owner. Per collaboratore: Condivisa, senza … il loro numero.»
 */
export function accessSummary(
  detail: Pick<CustomShortlistDetail, "accessMode" | "isOwner" | "sharedCount">,
): { icon: "lock-closed-outline" | "people-outline"; label: string } {
  if (detail.accessMode === "scope") {
    return { icon: "people-outline", label: CUSTOM_COPY.accessScope };
  }

  if (detail.accessMode === "owner_only") {
    return { icon: "lock-closed-outline", label: CUSTOM_COPY.accessSoloTu };
  }

  if (detail.isOwner && detail.sharedCount !== null) {
    return detail.sharedCount > 0
      ? { icon: "people-outline", label: sharedWithLabel(detail.sharedCount) }
      : { icon: "lock-closed-outline", label: CUSTOM_COPY.accessSoloTu };
  }

  return { icon: "people-outline", label: CUSTOM_COPY.accessShared };
}

/** Il radio iniziale: una lista storica 'scope' non preseleziona nulla (§25). */
export function initialChoice(mode: CustomAccessMode): AccessChoice | null {
  return mode === "scope" ? null : mode;
}

/**
 * §11: «SHARED scelto esplicitamente con zero persone è invalido … Non
 * convertire silenziosamente la scelta dell'utente.» Nessuna scelta è
 * invalida solo per una lista storica che non ne ha una.
 */
export function validateAccessDraft(draft: {
  choice: AccessChoice | null;
  selected: readonly string[];
}): string | null {
  if (draft.choice === "shared" && draft.selected.length === 0) {
    return CUSTOM_COPY.selectAtLeastOne;
  }

  return null;
}

export function accessSubmittable(draft: {
  choice: AccessChoice | null;
  selected: readonly string[];
}): boolean {
  return draft.choice !== null && validateAccessDraft(draft) === null;
}

const sortedKey = (ids: readonly string[]) => [...new Set(ids)].sort().join(",");

/** §24: un draft invariato esce senza conferma. */
export function accessDirty(
  initial: { choice: AccessChoice | null; selected: readonly string[] },
  draft: { choice: AccessChoice | null; selected: readonly string[] },
): boolean {
  if (initial.choice !== draft.choice) {
    return true;
  }

  return draft.choice === "shared" && sortedKey(initial.selected) !== sortedKey(draft.selected);
}

export function toggleSelection(selected: readonly string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
}

/**
 * §11, Q27-09: dopo un rifiuto per eligibility si conservano soltanto le
 * scelte ancora presenti fra gli eleggibili riletti — mai un azzeramento,
 * mai un'aggiunta.
 */
export function reconcileSelection(selected: readonly string[], eligible: readonly string[]): string[] {
  const allowed = new Set(eligible);
  return selected.filter((id) => allowed.has(id));
}

type ListDraft = { description: string; name: string; teamId: string | null };

/** §14: «CTA Salva modifiche con patch dei soli campi modificati». */
export function editPatch(original: ListDraft, draft: ListDraft): ListPatch {
  const patch: ListPatch = {};
  const name = draft.name.trim();
  const description = draft.description.trim();

  if (name !== original.name.trim()) {
    patch.name = name;
  }

  if (description !== (original.description ?? "").trim()) {
    patch.description = description.length > 0 ? description : null;
  }

  if (draft.teamId !== original.teamId) {
    patch.team_id = draft.teamId;
  }

  return patch;
}

export function editDirty(original: ListDraft, draft: ListDraft): boolean {
  return Object.keys(editPatch(original, draft)).length > 0;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) {
    return names[0] ?? "";
  }

  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

/**
 * §14: «Per owner … Marco Bianchi non avrà più accesso con il nuovo
 * ambito. Per un gestore che può cambiare ambito ma non leggere ACL, usa
 * Alcune persone potrebbero non avere più accesso…, senza nomi o conteggi.»
 */
export function scopeImpactLine(preview: ScopePreview | null): string | null {
  if (!preview) {
    return null;
  }

  if (!preview.ownerValid) {
    return CUSTOM_COPY.ownerScopeBlocked;
  }

  if (preview.kind === "generic") {
    return CUSTOM_COPY.scopeImpactGeneric;
  }

  if (preview.kind === "named" && preview.losing && preview.losing.length > 0) {
    const names = preview.losing.map((p) => p.fullName);
    return names.length === 1
      ? `${names[0]} non avrà più accesso con il nuovo ambito.`
      : `${joinNames(names)} non avranno più accesso con il nuovo ambito.`;
  }

  return null;
}

/** §16: «Testo: {Nome lista} e le relative valutazioni interne verranno eliminate.» */
export function deleteBody(name: string): string {
  return `${name} e le relative valutazioni interne verranno eliminate.`;
}

export type ManageAction = "edit" | "access" | "delete";

/** §8: ogni voce solo con la capability effettiva; nessuna voce → nessun menu. */
export function manageActions(
  detail: Pick<CustomShortlistDetail, "canDelete" | "canEdit" | "canManageAccess">,
): ManageAction[] {
  const actions: ManageAction[] = [];

  if (detail.canEdit) actions.push("edit");
  if (detail.canManageAccess) actions.push("access");
  if (detail.canDelete) actions.push("delete");

  return actions;
}

/**
 * §19: «Con una lista può aprire direttamente lo screen 12; con più liste
 * usa un elenco semplice … Con zero risultati mostra Nessuna lista da
 * recuperare.»
 */
export function recoveryRoute(
  items: readonly RecoverableList[],
  hasMore: boolean,
): { kind: "empty" } | { kind: "direct"; shortlistId: string } | { kind: "list" } {
  if (items.length === 0) {
    return { kind: "empty" };
  }

  if (items.length === 1 && !hasMore) {
    return { kind: "direct", shortlistId: items[0].shortlistId };
  }

  return { kind: "list" };
}

export type GovernanceOp = "access" | "create" | "delete" | "edit" | "recovery";

const OP_ERROR: Record<GovernanceOp, string> = {
  access: CUSTOM_COPY.accessSaveError,
  create: "Impossibile creare la lista. Riprova.",
  delete: CUSTOM_COPY.deleteError,
  edit: CUSTOM_COPY.editError,
  recovery: CUSTOM_COPY.recoveryError,
};

/**
 * §24: «Non mostrare codici HTTP, stacktrace, ID tecnici o motivazioni
 * riservate.» Un errore di rete con la connessione assente ha la copy
 * offline; un conflitto la sua; tutto il resto la copy dell'operazione.
 */
export function governanceErrorCopy(kind: string, op: GovernanceOp, offline: boolean): string {
  if (offline && kind === "network") {
    return CUSTOM_COPY.offline;
  }

  if (kind === "versionConflict" || kind === "conflict") {
    return CUSTOM_COPY.conflict;
  }

  if (kind === "shareIneligible") {
    return CUSTOM_COPY.ineligible;
  }

  if (kind === "shareEmpty") {
    return CUSTOM_COPY.selectAtLeastOne;
  }

  if (kind === "ownerScopeInvalid") {
    return CUSTOM_COPY.ownerScopeBlocked;
  }

  if (kind === "ownerValid") {
    return CUSTOM_COPY.ownerReturned;
  }

  return OP_ERROR[op];
}

/**
 * §18: la risposta che significa «questa lista non è più tua da vedere»
 * (inesistente, eliminata, revocata, fuori scope) — da trattare come revoca:
 * dati rimossi e screen 11. Un `notAuthorized` su un comando dice invece che
 * manca la capability di quell'azione: la lista resta, il menu si rilegge.
 * Un errore di rete non è mai una revoca.
 */
export function isRevocation(kind: string): boolean {
  return kind === "notFound";
}
