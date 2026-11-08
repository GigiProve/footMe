/**
 * Derivazioni pure del Centro Shortlist (§9, §11, §30).
 *
 * Qui vivono le decisioni che §11 descrive a parole e che una schermata non
 * deve poter sbagliare: quale vuoto mostrare, con quale copy, e con quale
 * CTA. Sono le regole più facili da violare in un `if` dentro il render —
 * e le uniche che QA015 e QA016 verificano direttamente.
 */
import type {
  ShortlistApplicationState,
  ShortlistCapabilities,
  ShortlistCreatedSource,
  ShortlistEvaluationStatus,
  ShortlistFilters,
  ShortlistPriority,
  ShortlistPriorityFilter,
} from "./shortlist-types";

/** §30: stringhe localizzate in un posto solo. */
export const SHORTLIST_COPY = {
  title: "Shortlist",
  /** §8: la descrizione della riga in Aree di gestione. */
  moduleDescription: "Profili selezionati e valutazioni interne",

  /** §9: le due sezioni, in quest'ordine. */
  positionsSection: "Per posizione",
  customSection: "Liste personalizzate",

  /** §10: metadato neutro. */
  positionClosed: "Posizione chiusa",

  /** §9. */
  createCustom: "Crea lista personalizzata",

  /** §11, screen 04. */
  positionsEmpty: "Nessun profilo ancora selezionato per le posizioni.",
  /** §11, variante senza CUSTOM. */
  customEmpty: "Nessuna lista personalizzata",

  /** §11, screen 05. */
  globalEmptyTitle: "Nessuna shortlist",
  globalEmptyBoth:
    "Aggiungi profili dalle candidature o crea una lista personalizzata.",
  globalEmptyCreateOnly:
    "Crea una lista personalizzata per organizzare i profili.",
  globalEmptyAddOnly: "Aggiungi profili dalle candidature per ritrovarli qui.",
  globalEmptyReadOnly:
    "Le liste accessibili compariranno qui quando saranno disponibili.",

  /** §12, screen 08. */
  errorTitle: "Impossibile caricare le shortlist",
  errorBody: "Riprova tra poco.",
  retry: "Riprova",
  refreshError: "Non è stato possibile aggiornare le shortlist. Riprova.",

  /** §27. */
  offlineStale: "Sei offline · Dati non aggiornati",
  offlineTitle: "Sei offline",
  offlineBody: "Connettiti a Internet per caricare le shortlist.",
  mutationOffline: "Connessione assente. Riprova quando sei online.",

  /** §22, deep link non disponibile. */
  unavailableTitle: "Contenuto non disponibile",
  /* DAS-REV-27 §18, screen 11: la stessa frase per inesistente, revocata,
     privata o eliminata — senza dire perché. */
  unavailableBody: "Questo contenuto non è disponibile.",
  backToDashboard: "Torna alla Dashboard",

  /** §30, errori contestuali. */
  addError: "Non è stato possibile aggiungere il profilo alla shortlist. Riprova.",
  withdrawn: "La candidatura è stata ritirata.",
  conflict: "I dati sono cambiati. Aggiorna e riprova.",
  revoked: "Non hai più accesso a questa sezione.",

  /** §14, metadati leggeri del pool. */
  fromApplication: "Da candidatura",
  fromProfile: "Aggiunto dal profilo",

  /* ----- DAS-REV-25 ----------------------------------------------------
     §4: «Centralizza le stringhe localizzate.» Tutto ciò che la 25 mostra
     a schermo vive qui, compresi i messaggi d'errore, che §28 detta parola
     per parola. */

  /** §9: le due righe sorelle del dettaglio Position. */
  positionRowTitle: "Shortlist",
  /** §9: label neutra della bozza nel centro. */
  draftLabel: "Bozza",

  /** §13: il controllo compatto dei filtri. */
  filterAll: "Tutti i profili",
  filterActive: "Filtri attivi",
  filterTitle: "Filtra shortlist",
  filterPriority: "Priorità",
  filterStatus: "Stato",
  filterNoPriority: "Senza priorità",
  filterReset: "Azzera",
  filterApply: "Applica filtri",
  filterClear: "Azzera filtri",

  /** §15: la scheda interna. */
  entryTitle: "Profilo in shortlist",
  entryInShortlistFor: "In shortlist per",
  entryEvaluation: "Valutazione",
  entryPriority: "Priorità",
  entryStatus: "Stato",
  entryNote: "Nota interna",
  entryNoteEmpty: "Nessuna nota aggiunta.",
  entryNoteHelper: "Visibile solo agli utenti autorizzati della Società.",
  entryOrigin: "Origine",
  entryViewApplication: "Vedi candidatura ›",
  entryApplicationWithdrawn: "Candidatura ritirata",
  entryApplicationReceived: "Candidatura ricevuta",
  entryEdit: "Modifica valutazione",
  entryOpenProfile: "Apri profilo completo",
  entryRemove: "Rimuovi da questa shortlist",

  /** §17: l'editor. */
  editorTitle: "Modifica valutazione",
  editorCancel: "Annulla",
  editorPriority: "Priorità",
  editorPriorityNone: "Nessuna",
  editorStatus: "Stato",
  editorNote: "Nota interna",
  editorNoteHelper:
    "Questa nota è visibile solo agli utenti autorizzati della Società.",
  editorSave: "Salva modifiche",
  statusSheetTitle: "Stato della valutazione",
  statusSheetHelper: "Lo stato è una valutazione interna.",
  statusSheetConfirm: "Conferma",

  /** §11: lo sheet dal dettaglio candidatura. */
  sheetOpenActions: "In shortlist, apri azioni",
  sheetSeeInShortlist: "Vedi nella shortlist",
  sheetEdit: "Modifica valutazione",
  sheetRemove: "Rimuovi dalla shortlist",

  /** §21: la conferma di rimozione. */
  removeTitle: "Rimuovere dalla shortlist?",
  removeCancel: "Annulla",
  removeConfirm: "Rimuovi",
  removeDone: "Profilo rimosso dalla shortlist.",

  /** §19, §20. */
  saveDone: "Valutazione aggiornata.",
  saveError: "Non è stato possibile salvare la valutazione. Riprova.",
  saveConflict:
    "La valutazione è stata modificata da un altro utente. Rivedi i dati prima di salvare.",
  noteTooLong: "La nota supera la lunghezza massima consentita.",
  exitTitle: "Uscire senza salvare?",
  exitBody: "Le modifiche effettuate andranno perse.",
  exitStay: "Continua a modificare",
  exitLeave: "Esci senza salvare",

  /** §28: vuoti, errori e offline del pool. */
  poolEmptyTitle: "Nessun profilo in shortlist",
  poolEmptyBody: "I profili selezionati per questa posizione compariranno qui.",
  poolFilteredEmptyTitle: "Nessun profilo trovato",
  poolFilteredEmptyBody: "Prova a modificare o azzerare i filtri.",
  poolErrorTitle: "Impossibile caricare la shortlist",
  poolRefreshError: "Non è stato possibile aggiornare la shortlist. Riprova.",
  poolOfflineBody: "Connettiti a Internet per caricare la shortlist.",
  entryErrorBody: "Non è stato possibile caricare il profilo in shortlist. Riprova.",
  removeError: "Non è stato possibile rimuovere il profilo dalla shortlist. Riprova.",
  entryGone: "Questo profilo non è più presente nella shortlist.",
  scopeUndefinedTitle: "Ambito non ancora definito",
  scopeUndefinedBody:
    "Completa squadra o ambito della posizione per usare la shortlist.",
} as const;

/**
 * §18: il limite della nota, **unico**, lo stesso che applica il server.
 *
 * «Il limite deve essere unico e disponibile a backend/client; non
 * assegnare numeri diversi ai due ingressi.» Il valore canonico è
 * `public.shortlist_note_max_length()`; questa costante ne è la copia
 * client, e il server resta l'autorità: oltre il limite risponde
 * `SHORTLIST_NOTE_TOO_LONG` anche se il client non lo avesse fermato.
 */
export const SHORTLIST_NOTE_MAX_LENGTH = 1000;

/**
 * §9, §30: «conteggio con singolare/plurale corretto», e §30 chiede
 * esplicitamente di gestire «0 profili, 1 profilo e quantità maggiori».
 */
export function profilesLabel(countValue: number): string {
  return countValue === 1 ? "1 profilo" : `${countValue} profili`;
}

/**
 * Sottotitolo di una riga: «Prima squadra · 3 profili» (§9).
 *
 * Uno scope assente non produce un separatore penzolante — una Position
 * storica può non averne uno leggibile, e §30 vieta di mostrare `null`.
 */
export function rowSubtitle(
  scopeLabel: string | null,
  countValue: number,
  isClosed = false,
): string {
  const parts = [scopeLabel, profilesLabel(countValue)].filter(
    (part): part is string => !!part && part.length > 0,
  );

  const base = parts.join(" · ");

  /* §10: «Mostra Posizione chiusa come metadato neutro.» Su una riga
     separata nel mockup; qui è il chiamante a decidere il layout, e questa
     funzione produce il testo annunciato dallo screen reader (§31). */
  return isClosed ? `${base}\n${SHORTLIST_COPY.positionClosed}` : base;
}

export const EVALUATION_LABELS: Record<ShortlistEvaluationStatus, string> = {
  contattato: "Contattato",
  da_contattare: "Da contattare",
  da_valutare: "Da valutare",
  interessante: "Interessante",
  non_prioritario: "Non prioritario",
  scartato: "Scartato",
};

export const PRIORITY_LABELS: Record<ShortlistPriority, string> = {
  alta: "Alta",
  bassa: "Bassa",
  media: "Media",
};

/**
 * Etichetta della priorità nel contesto giusto (§12, §15, §17).
 *
 * Lo stesso `null` ha tre rappresentazioni, e la 25 le fissa tutte: nella
 * lista si **omette**, nel dettaglio è un trattino neutro, nel filtro è
 * «Senza priorità» e nell'editor «Nessuna». Non sono valori diversi.
 */
export function priorityLabel(value: ShortlistPriority | null): string | null {
  return value ? PRIORITY_LABELS[value] : null;
}

/**
 * Riga «Valutazione» del pool e del dettaglio: «Alta · Interessante» (§12).
 *
 * §12: «priorità soltanto se non nulla». Senza priorità resta il solo
 * stato — «Da valutare» — e non compare un separatore penzolante.
 */
export function evaluationLine(input: {
  evaluationStatus: ShortlistEvaluationStatus;
  priority: ShortlistPriority | null;
}): string {
  return [priorityLabel(input.priority), EVALUATION_LABELS[input.evaluationStatus]]
    .filter((part): part is string => !!part)
    .join(" · ");
}

/**
 * L'unica dicitura di origine/candidatura della riga (§12, §16).
 *
 * §16 impone quattro cose insieme, e questa funzione è il posto in cui non
 * possono contraddirsi:
 *
 *   · `applicationState === null` significa «non autorizzato a saperlo», e
 *     allora **niente** può essere detto sulla candidatura — né che c'è, né
 *     che manca: «Non affermare "Non si è candidato"»;
 *   · l'origine `application` rivelerebbe proprio quella relazione, quindi
 *     a un actor non autorizzato arriva già come `unknown` dal server e
 *     qui non produce dicitura;
 *   · una candidatura **ritirata** si dice con la label neutra, che non è
 *     l'origine: §16 — «Il collegamento attuale all'Application è distinto
 *     dall'origine»;
 *   · una candidatura arrivata **dopo** un inserimento dal profilo si vede:
 *     §16 — «Non deve continuare a suggerire falsamente che manca una
 *     candidatura solo perché l'origine è PROFILE.»
 *
 * Una sola dicitura per riga: §16 — «senza moltiplicare i badge della riga».
 */
export function originLine(input: {
  applicationState: ShortlistApplicationState;
  createdSource: ShortlistCreatedSource;
}): string | null {
  if (input.applicationState === "withdrawn") {
    return SHORTLIST_COPY.entryApplicationWithdrawn;
  }

  if (input.applicationState === "active" && input.createdSource === "profile") {
    return SHORTLIST_COPY.entryApplicationReceived;
  }

  if (input.createdSource === "application") {
    return SHORTLIST_COPY.fromApplication;
  }

  if (input.createdSource === "profile") {
    return SHORTLIST_COPY.fromProfile;
  }

  return null;
}

/**
 * Le righe di una persona nel pool, nell'ordine del PNG (screen 02).
 *
 * Identità e situazione le compone la schermata con gli helper canonici del
 * profilo; qui vivono le tre righe che appartengono alla **membership** e
 * che §12 descrive una per una.
 */
export function poolRowLines(row: {
  applicationState: ShortlistApplicationState;
  createdSource: ShortlistCreatedSource;
  evaluationStatus: ShortlistEvaluationStatus;
  notePreview: string | null;
  priority: ShortlistPriority | null;
}): { evaluation: string; note: string | null; origin: string | null } {
  return {
    evaluation: evaluationLine(row),
    /* §12: «La nota è facoltativa: nessuna riga vuota o grande placeholder
       se manca.» E senza lettura note il server non manda nemmeno
       l'anteprima, quindi non c'è niente da nascondere nel tree. */
    note: row.notePreview,
    origin: originLine(row),
  };
}

/**
 * §14: «La UI mostra 3 profili senza restrizioni e 1 di 3 profili o
 * 0 di 3 profili con restrizioni.»
 *
 * I due numeri arrivano dal backend. Questa funzione non li calcola: decide
 * soltanto quale dei due formati usare, e quel formato dipende dai filtri
 * **applicati**, non dalla differenza fra i numeri — una lista in cui tutte
 * e tre le entry soddisfano il filtro mostra comunque «3 di 3 profili».
 */
export function poolCountLabel(input: {
  filtered: number;
  filtersApplied: boolean;
  total: number;
}): string {
  return input.filtersApplied
    ? `${input.filtered} di ${profilesLabel(input.total)}`
    : profilesLabel(input.total);
}

/** §13: «Tutti i profili ▾» oppure «Filtri attivi ▾». */
export function filterControlLabel(filtersApplied: boolean): string {
  return filtersApplied ? SHORTLIST_COPY.filterActive : SHORTLIST_COPY.filterAll;
}

export const ALL_PRIORITY_FILTERS: readonly ShortlistPriorityFilter[] = [
  "alta",
  "media",
  "bassa",
  "none",
];

export const ALL_EVALUATION_STATUSES: readonly ShortlistEvaluationStatus[] = [
  "da_valutare",
  "interessante",
  "da_contattare",
  "contattato",
  "non_prioritario",
  "scartato",
];

export const EMPTY_FILTERS: ShortlistFilters = { priorities: [], statuses: [] };

export const PRIORITY_FILTER_LABELS: Record<ShortlistPriorityFilter, string> = {
  alta: "Alta",
  bassa: "Bassa",
  media: "Media",
  none: SHORTLIST_COPY.filterNoPriority,
};

/**
 * §13: «Normalizza selezioni duplicate e ordine dei valori nella
 * query/cache. La selezione di tutti i valori ammessi in una dimensione
 * equivale a nessuna restrizione e può essere normalizzata al set vuoto.»
 *
 * La stessa regola gira anche sul server (`shortlist_filter_normalize`):
 * qui serve perché la chiave di cache e il cursore devono essere identici
 * per due selezioni equivalenti, altrimenti due richieste che il server
 * tratta allo stesso modo occuperebbero due slot di cache diversi.
 */
function normalizeDimension<T extends string>(
  values: readonly T[],
  allowed: readonly T[],
): T[] {
  const unique = allowed.filter((value) => values.includes(value));

  return unique.length === allowed.length ? [] : unique;
}

export function normalizeFilters(filters: ShortlistFilters): ShortlistFilters {
  return {
    priorities: normalizeDimension(filters.priorities, ALL_PRIORITY_FILTERS),
    statuses: normalizeDimension(filters.statuses, ALL_EVALUATION_STATUSES),
  };
}

/** §13: almeno una restrizione reale, dopo la normalizzazione. */
export function filtersAreActive(filters: ShortlistFilters): boolean {
  const normalized = normalizeFilters(filters);

  return normalized.priorities.length > 0 || normalized.statuses.length > 0;
}

/**
 * Chiave stabile di una selezione, per cache e cursore (§13, §27).
 *
 * Passa dalla normalizzazione, quindi due selezioni equivalenti — ordine
 * diverso, duplicati, tutti i valori di una dimensione — producono la
 * stessa chiave.
 */
export function filtersKey(filters: ShortlistFilters): string {
  const normalized = normalizeFilters(filters);

  return `${normalized.priorities.join(",") || "*"}#${
    normalized.statuses.join(",") || "*"
  }`;
}

/**
 * Quale superficie mostra il pool (§28).
 *
 * Tre stati che §28 vuole **distinti**, e che un singolo `rows.length === 0`
 * confonderebbe:
 *
 *   · `empty` — «Vuoto reale, dopo una lettura valida con totale 0»;
 *   · `filteredEmpty` — «totale maggiore di 0 e corrispondenze 0 … Non
 *     confonderlo con una lista senza membership»;
 *   · `rows` — tutto il resto.
 */
export type PoolSurface = "empty" | "filteredEmpty" | "rows";

export function poolPresentation(input: {
  filtersApplied: boolean;
  rowCount: number;
  total: number;
}): PoolSurface {
  if (input.total === 0) {
    return "empty";
  }

  if (input.rowCount === 0 && input.filtersApplied) {
    return "filteredEmpty";
  }

  return "rows";
}

/** §19, §28: la copy di un errore di salvataggio, per tipo di errore. */
export function saveErrorCopy(kind: string): string {
  switch (kind) {
    case "conflict":
      return SHORTLIST_COPY.saveConflict;
    case "noteTooLong":
      return SHORTLIST_COPY.noteTooLong;
    case "notAuthorized":
      return SHORTLIST_COPY.revoked;
    case "gone":
    case "notFound":
      return SHORTLIST_COPY.entryGone;
    default:
      return SHORTLIST_COPY.saveError;
  }
}

/** §21, §28: la copy di un errore di rimozione. */
export function removeErrorCopy(kind: string): string {
  switch (kind) {
    case "notAuthorized":
      return SHORTLIST_COPY.revoked;
    case "gone":
    case "notFound":
      return SHORTLIST_COPY.entryGone;
    default:
      return SHORTLIST_COPY.removeError;
  }
}

/**
 * §21: «{Nome} verrà rimosso da {titolo Position} · {scope leggibile}.»
 *
 * Lo scope può mancare su una Position storica, e in quel caso la frase non
 * porta un separatore vuoto.
 */
export function removeConfirmBody(input: {
  name: string;
  positionTitle: string;
  scopeLabel: string | null;
}): string {
  const destination = [input.positionTitle, input.scopeLabel]
    .filter((part): part is string => !!part && part.length > 0)
    .join(" · ");

  return `${input.name} verrà rimosso da ${destination}.`;
}

/** Stato complessivo del centro, con i due gruppi tenuti distinti (§27). */
export type GroupState = "loading" | "ready" | "error";

export type CenterPresentation =
  | { kind: "globalEmpty"; body: string; showCreate: boolean }
  | { kind: "globalError" }
  | { kind: "content" };

/**
 * Quale superficie mostrare (§11, §12).
 *
 * Tre regole che non possono vivere sparse nel render:
 *
 *   · «Il vuoto globale richiede **entrambi** i gruppi risolti con successo e
 *     vuoti» — un gruppo in errore e l'altro vuoto non è un empty (QA016);
 *   · l'errore globale è solo quando **entrambi** falliscono: con uno dei due
 *     utilizzabile l'errore è locale (QA103);
 *   · la copy del vuoto globale si adatta alle capacità reali, e non propone
 *     azioni per cui mancano i permessi (QA015).
 */
export function centerPresentation(input: {
  capabilities: Pick<ShortlistCapabilities, "canAddProfiles" | "canCreateLists">;
  customCount: number;
  customState: GroupState;
  positionCount: number;
  positionState: GroupState;
}): CenterPresentation {
  if (input.positionState === "error" && input.customState === "error") {
    return { kind: "globalError" };
  }

  const bothResolved =
    input.positionState === "ready" && input.customState === "ready";

  if (bothResolved && input.positionCount === 0 && input.customCount === 0) {
    const { canAddProfiles, canCreateLists } = input.capabilities;

    if (canAddProfiles && canCreateLists) {
      return {
        body: SHORTLIST_COPY.globalEmptyBoth,
        kind: "globalEmpty",
        showCreate: true,
      };
    }

    if (canCreateLists) {
      return {
        body: SHORTLIST_COPY.globalEmptyCreateOnly,
        kind: "globalEmpty",
        showCreate: true,
      };
    }

    if (canAddProfiles) {
      return {
        body: SHORTLIST_COPY.globalEmptyAddOnly,
        kind: "globalEmpty",
        showCreate: false,
      };
    }

    return {
      body: SHORTLIST_COPY.globalEmptyReadOnly,
      kind: "globalEmpty",
      showCreate: false,
    };
  }

  return { kind: "content" };
}

/** §30: la copy contestuale di un errore di aggiunta. */
export function addErrorCopy(kind: string): string {
  switch (kind) {
    case "withdrawn":
      return SHORTLIST_COPY.withdrawn;
    case "conflict":
      return SHORTLIST_COPY.conflict;
    case "notAuthorized":
      return SHORTLIST_COPY.revoked;
    default:
      return SHORTLIST_COPY.addError;
  }
}

/**
 * L'origine **storica** della membership, nel dettaglio (§16).
 *
 * «created_source descrive come è nata la membership: Da candidatura oppure
 * Aggiunto dal profilo, quando il dato è noto. Una candidatura arrivata dopo
 * l'inserimento dal profilo non cambia quella origine.»
 *
 * Diversa da `originLine`, che la riga del pool usa per dire la relazione
 * **corrente**: §16 vuole entrambe, in due posti diversi — «Conserva l'audit
 * dell'origine nel dettaglio senza moltiplicare i badge della riga.»
 *
 * `unknown` non produce testo: §30 — «Per origini/date/autori storici
 * mancanti non inventare informazioni.» È anche il valore che il server
 * manda al posto di `application` quando quella dicitura rivelerebbe una
 * candidatura non accessibile (§16).
 */
export function originAuditLabel(
  createdSource: ShortlistCreatedSource,
): string | null {
  if (createdSource === "application") {
    return SHORTLIST_COPY.fromApplication;
  }

  if (createdSource === "profile") {
    return SHORTLIST_COPY.fromProfile;
  }

  return null;
}

/**
 * «Aggiunto da Marco Bianchi · 13 set 2026» (§15).
 *
 * §15: «Date e autore non vengono inventati quando assenti nei dati
 * precedenti; usa il fallback neutro canonico per un actor non più
 * disponibile.» Qui il fallback è l'**omissione** del nome: resta la data,
 * e l'autore non viene sostituito con il gestore corrente (QA065). Senza
 * nessuno dei due la riga non si disegna affatto.
 */
export function addedByLine(input: {
  addedByName: string | null;
  createdAtLabel: string | null;
}): string | null {
  const parts = [
    input.addedByName ? `Aggiunto da ${input.addedByName}` : null,
    input.createdAtLabel,
  ].filter((part): part is string => !!part && part.length > 0);

  return parts.length > 0 ? parts.join(" · ") : null;
}
