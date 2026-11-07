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
 *   | origine creazione | `created_source` (profile/application/unknown) |
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

/** §19: origine di nascita, distinta dalla relazione Application corrente. */
export type ShortlistCreatedSource = "profile" | "application" | "unknown";

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
  clubId: string;
  isClosed: boolean;
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
  createdSource: ShortlistCreatedSource;
  currentTeam: string | null;
  entryId: string;
  evaluationStatus: ShortlistEvaluationStatus;
  hasApplication: boolean | null;
  name: string;
  personId: string;
  /** §14: «priorità soltanto se presente». */
  priority: ShortlistPriority | null;
  revision: number;
  role: string | null;
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
  | "network"
  | "notAuthorized"
  | "notFound"
  | "withdrawn";

export class ShortlistError extends Error {
  readonly kind: ShortlistErrorKind;

  constructor(kind: ShortlistErrorKind, message?: string) {
    super(message ?? kind);
    this.kind = kind;
    this.name = "ShortlistError";
  }
}
