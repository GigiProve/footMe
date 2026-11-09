/**
 * Modello del Centro Shortlist (DAS-REV-24).
 *
 * I nomi concettuali della task e il modello reale del repository non
 * coincidono, e §2 chiede di «mantenere le convenzioni del progetto e
 * rendere esplicita la mappatura». Eccola, una volta sola:
 *
 *   | task              | repository                               |
 *   | ----------------- | ---------------------------------------- |
 *   | Shortlist         | `club_shortlists`                        |
 *   | type CUSTOM       | `list_type = 'custom'`                   |
 *   | type POSITION     | `list_type = 'position'`                 |
 *   | position_id       | `position_id` → `recruiting_ads.id`      |
 *   | ShortlistEntry    | `club_shortlist_entries`                 |
 *   | person_id         | `player_profile_id`                      |
 *   | application_id    | `application_id` → `recruiting_applications` |
 *   | origine creazione | `created_source` (profile/application/event/unknown) |
 *   | Society           | `clubs`                                  |
 *   | Position          | `recruiting_ads`                         |
 *
 * `position_shortlist_entries` di DAS-REV-22 non è più una tabella: è una
 * vista sul core unico, tenuta per i consumatori già scritti (§26).
 */

/** §16: i due tipi, e nient'altro. */
export type ShortlistKind = "position" | "custom";

/** §17: i sei stati interni, con le enum reali del repository. */
export type ShortlistEvaluationStatus =
  | "da_valutare"
  | "interessante"
  | "da_contattare"
  | "contattato"
  | "non_prioritario"
  | "scartato";

/** §17: tre valori **oppure non impostata**. */
export type ShortlistPriority = "alta" | "media" | "bassa";

/**
 * §19: origine di nascita, distinta dalla relazione Application corrente.
 * DAS-REV-31 §10: `event` si aggiunge alle origini esistenti — la entry è
 * nata dal percorso partecipanti → profilo di un evento della Società.
 */
export type ShortlistCreatedSource = "profile" | "application" | "event" | "unknown";

/**
 * Snapshot storico dell'evento d'origine (DAS-REV-31 §10, §12).
 *
 * Titolo e data sono quelli **della creazione** e non si aggiornano più.
 * `eventId` arriva soltanto se oggi l'actor può aprire il dettaglio
 * dell'evento: lo snapshot non concede accesso all'evento (§12).
 */
export type ShortlistSourceEvent = {
  /** Giorno civile dell'evento, `YYYY-MM-DD`, già nel suo fuso. */
  date: string | null;
  eventId: string | null;
  timezone: string | null;
  title: string;
};

/**
 * Capacità effettive dell'actor sulla Society operativa (§5, §22).
 *
 * Sei facoltà distinte perché §5 le vuole distinte: «consultare, creare liste
 * personalizzate, aggiungere profili, scrivere note interne, modificare
 * valutazione/priorità e rimuovere profili».
 */
export type ShortlistCapabilities = {
  canAddNotes: boolean;
  canAddProfiles: boolean;
  canCreateLists: boolean;
  canEditStatus: boolean;
  canRemoveProfiles: boolean;
  canView: boolean;
};

/** Testata del centro: identità Society e capacità (§5, §23). */
export type ShortlistCenterHeader = ShortlistCapabilities & {
  accessVerifiedAt: number;
  clubId: string;
  clubIsVerified: boolean;
  clubLogoUrl: string | null;
  clubName: string;
  dataRevision: number;
  /** §6 screen 06: «Ambito: Primavera». `null` = intera Società. */
  scopeLabel: string | null;
};

/**
 * Riga di «Per posizione» (§9).
 *
 * Nessun campo di valutazione, priorità o nota: §9 — «Non mostrare POSITION,
 * ID, priorità, stati valutazione, note, conteggi separati per provenienza o
 * data dell'ultima attività.»
 */
export type ShortlistPositionRow = {
  /** §10: metadato neutro, non un badge d'allarme. */
  isClosed: boolean;
  /**
   * DAS-REV-25 §9: «Se una DRAFT persistita possiede entry accessibili,
   * includila nella sezione Per posizione con label neutra Bozza.»
   */
  isDraft: boolean;
  positionId: string;
  profilesCount: number;
  /** §9: «Team o scope canonico». Può mancare su una Position storica. */
  scopeLabel: string | null;
  shortlistId: string;
  /** §9: titolo derivato dalla Position, mai editabile qui. */
  title: string;
};

/** Riga di «Liste personalizzate» (§9). */
export type ShortlistCustomRow = {
  name: string;
  profilesCount: number;
  scopeLabel: string;
  shortlistId: string;
};

/** Una pagina di un gruppo: §24 vuole cursori indipendenti per gruppo. */
export type ShortlistGroupPage<TRow> = {
  nextCursor: string | null;
  rows: TRow[];
};

/** Contesto della lista aperta (§14, §23). */
export type ShortlistContext = {
  canAddNotes: boolean;
  canAddProfiles: boolean;
  canEditStatus: boolean;
  canRemoveProfiles: boolean;
  /**
   * DAS-REV-25 §8: il catalogo distingue «Leggere note interne» da
   * «Visualizzare la shortlist», quindi la lettura non è implicita.
   */
  canViewNotes: boolean;
  clubId: string;
  isClosed: boolean;
  /** DAS-REV-25 §9: label neutra **Bozza**, che `isClosed` non esprime. */
  isDraft: boolean;
  kind: ShortlistKind;
  positionId: string | null;
  profilesCount: number;
  scopeLabel: string | null;
  /** `null` quando la Position non ha ancora un contenitore (§25). */
  shortlistId: string | null;
  title: string;
};

/**
 * Riga del pool misto (§14, screen 11).
 *
 * `hasApplication` è **tri-stato**: `null` significa «non autorizzato a
 * saperlo», e §22 vieta di trasformarlo in «non si è candidato».
 */
export type ShortlistPoolRow = {
  avatarUrl: string | null;
  /**
   * DAS-REV-25 §16: relazione **corrente** con la candidatura, distinta
   * dall'origine. `null` significa «non autorizzato a saperlo», e §16 vieta
   * di tradurlo in «non si è candidato».
   */
  applicationState: ShortlistApplicationState;
  createdSource: ShortlistCreatedSource;
  situation: string | null;
  entryId: string;
  evaluationStatus: ShortlistEvaluationStatus;
  name: string;
  /**
   * DAS-REV-25 §12: «eventuale anteprima della nota in una sola riga». È il
   * server a troncarla: la riga non riceve mai il testo integrale.
   */
  notePreview: string | null;
  personId: string;
  primaryPosition: string | null;
  /** §14: «priorità soltanto se presente». */
  priority: ShortlistPriority | null;
  revision: number;
  role: string | null;
};

/** DAS-REV-25 §16: `null` = non autorizzato a conoscere la relazione. */
export type ShortlistApplicationState = "active" | "none" | "withdrawn" | null;

/**
 * DAS-REV-25 §13: la priorità assente è un valore filtrabile.
 *
 * «Senza priorità seleziona null, non Bassa.» Nel filtro viaggia come
 * `"none"`, nell'editor è «Nessuna» e nel dettaglio un trattino: tre
 * rappresentazioni dello stesso `null`.
 */
export type ShortlistPriorityFilter = ShortlistPriority | "none";

/** DAS-REV-25 §13: due dimensioni, OR interno e AND fra di esse. */
export type ShortlistFilters = {
  priorities: readonly ShortlistPriorityFilter[];
  statuses: readonly ShortlistEvaluationStatus[];
};

/**
 * Una pagina del pool (§14, §25).
 *
 * `total` e `filtered` arrivano dal backend e non dalla lunghezza di
 * `rows`: §14 — «Questi numeri non sono il conteggio del batch già
 * caricato.»
 */
export type ShortlistPoolPage = {
  canEditStatus: boolean;
  canRemove: boolean;
  canViewApplications: boolean;
  canViewNotes: boolean;
  filtered: number;
  filtersApplied: boolean;
  nextCursor: string | null;
  rows: ShortlistPoolRow[];
  total: number;
};

/**
 * Scheda interna «Profilo in shortlist» (§15).
 *
 * `note` nullo e `canViewNotes` falso non sono la stessa cosa: §15 vieta di
 * usare «Nessuna nota aggiunta.» per una nota nascosta dai permessi.
 */
export type ShortlistEntryDetail = {
  addedByName: string | null;
  applicationId: string | null;
  applicationState: ShortlistApplicationState;
  avatarUrl: string | null;
  canEditNote: boolean;
  canEditStatus: boolean;
  canRemove: boolean;
  canViewApplications: boolean;
  canViewNotes: boolean;
  clubId: string;
  createdAt: string | null;
  createdSource: ShortlistCreatedSource;
  situation: string | null;
  /** DAS-REV-31 §12: presente solo per le entry nate da evento. */
  sourceEvent: ShortlistSourceEvent | null;
  entryId: string;
  evaluationStatus: ShortlistEvaluationStatus;
  isClosed: boolean;
  isDraft: boolean;
  name: string;
  note: string | null;
  personId: string;
  positionId: string | null;
  positionTitle: string;
  primaryPosition: string | null;
  priority: ShortlistPriority | null;
  revision: number;
  role: string | null;
  scopeLabel: string | null;
  shortlistId: string;
};

/**
 * Patch della valutazione (§18).
 *
 * «Campi presenti con null indicano una cancellazione esplicita ammessa;
 * campi omessi significano invariati.» Da cui i due flag espliciti: un
 * `priority: null` deve poter dire «togli la priorità», e con il solo
 * valore sarebbe indistinguibile da «non toccarla».
 */
export type ShortlistEvaluationPatch = {
  evaluationStatus?: ShortlistEvaluationStatus;
  note?: string | null;
  priority?: ShortlistPriority | null;
};

/** Esito del salvataggio: proiezione autorizzata, non un booleano (§19). */
export type ShortlistEvaluationOutcome = {
  entryId: string;
  evaluationStatus: ShortlistEvaluationStatus;
  priority: ShortlistPriority | null;
  replayed: boolean;
  revision: number;
};

/** Esito della rimozione, con quanto serve a riconciliare (§21, §22). */
export type ShortlistRemoveOutcome = {
  entryId: string;
  inAnyList: boolean;
  personId: string;
  positionId: string | null;
  profilesTotal: number;
  shortlistId: string;
};

/** §15, §23: due appartenenze distinte, mai confuse. */
export type ShortlistMembership = {
  inAnyList: boolean;
  inPositionList: boolean;
  personId: string;
};

/** Errori di dominio distinguibili internamente (§23). */
export type ShortlistErrorKind =
  | "conflict"
  | "descriptionTooLong"
  /* DAS-REV-31 §11: il contesto evento non è più una provenienza valida. */
  | "eventSourceUnavailable"
  | "gone"
  | "nameRequired"
  | "nameTooLong"
  | "network"
  | "noteTooLong"
  | "notAuthorized"
  | "notFound"
  /* DAS-REV-27 §11, §14, §19, §22: errori di governo della CUSTOM. */
  | "ownerIneligible"
  | "ownerScopeInvalid"
  | "ownerValid"
  | "scopeInvalid"
  | "scopeUndefined"
  | "shareEmpty"
  | "shareIneligible"
  | "staleCursor"
  | "versionConflict"
  | "withdrawn";

export class ShortlistError extends Error {
  readonly kind: ShortlistErrorKind;

  constructor(kind: ShortlistErrorKind, message?: string) {
    super(message ?? kind);
    this.kind = kind;
    this.name = "ShortlistError";
  }
}
