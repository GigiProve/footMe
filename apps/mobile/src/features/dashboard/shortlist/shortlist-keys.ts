/**
 * Query key del Centro Shortlist (§28).
 *
 * «Cache scoped almeno a utente, Society, contesto di accesso/revisione
 * permessi, schema/configurazione rilevante.»
 *
 * L'actor è il primo segmento come nel pack Candidature, e per la stessa
 * ragione: il perimetro è **per actor**, non per Society. Due amministratori
 * della stessa Società con ambiti diversi vedono due centri diversi, e una
 * cache condivisa mostrerebbe all'uno le liste dell'altro — esattamente ciò
 * che §22 vieta.
 */

export const SHORTLIST_QK = {
  /** Testata e capacità: §12 vuole l'header noto prima dei dati. */
  header: (actorId: string, clubId: string) =>
    ["society-shortlist-header", actorId, clubId] as const,
  /** Gruppo «Per posizione», cursore proprio (§24). */
  positionGroup: (actorId: string, clubId: string) =>
    ["society-shortlist-position-group", actorId, clubId] as const,
  /** Gruppo «Liste personalizzate», cursore proprio (§24). */
  customGroup: (actorId: string, clubId: string) =>
    ["society-shortlist-custom-group", actorId, clubId] as const,
  /** Contesto di una lista, per id oppure per Position (§25). */
  context: (actorId: string, ref: string) =>
    ["society-shortlist-context", actorId, ref] as const,
  /** Entry di una lista. */
  pool: (actorId: string, shortlistId: string) =>
    ["society-shortlist-pool", actorId, shortlistId] as const,
  /**
   * Stella e appartenenza alla Position: §28 — «Query della lista includono
   * il riferimento canonico; quelle della stella il contesto organizzativo.»
   */
  membership: (actorId: string, clubId: string, scope: string) =>
    ["society-shortlist-membership", actorId, clubId, scope] as const,
} as const;

/**
 * Prefissi da invalidare dopo una mutazione del dominio (§28).
 *
 * Elencati e non dedotti da una substring: un `startsWith("society-")`
 * invaliderebbe anche i centri degli altri pack.
 */
export const SHORTLIST_QK_PREFIXES = [
  "society-shortlist-position-group",
  "society-shortlist-custom-group",
  "society-shortlist-context",
  "society-shortlist-pool",
  "society-shortlist-membership",
] as const;

/**
 * Chiavi **di altri domini** che una mutazione Shortlist tocca (§28).
 *
 * `shortlists` / `shortlist-membership-flags` sono quelle del modulo legacy
 * `features/shortlist`, che continua a servire il selector dal profilo e la
 * stella su Cerca: condividono il core, quindi condividono le invalidazioni.
 * `society-application-detail` porta `inShortlist`.
 */
export const SHORTLIST_CROSS_PREFIXES = [
  "shortlists",
  "shortlist-membership-flags",
  "shortlist-memberships",
  "shortlist-entries",
  "society-application-detail",
] as const;
