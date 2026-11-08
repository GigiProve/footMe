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
  /**
   * Una pagina del pool (DAS-REV-25 §27).
   *
   * «Per il pool includi filtri normalizzati e cursore.» La chiave passa
   * dalla **normalizzazione**, quindi due selezioni che il server tratta
   * allo stesso modo — ordine diverso, duplicati, tutti i valori di una
   * dimensione — condividono una sola voce di cache invece di produrne due
   * con lo stesso contenuto.
   */
  pool: (actorId: string, shortlistId: string, filters = "*#*") =>
    ["society-shortlist-pool", actorId, shortlistId, filters] as const,
  /** Scheda interna della membership (§15). */
  entry: (actorId: string, entryId: string) =>
    ["society-shortlist-entry", actorId, entryId] as const,
  /**
   * Riepilogo della membership vista dalla candidatura (§11).
   *
   * Chiave propria e non `entry`: lo sheet legge una proiezione più
   * stretta — senza nota — e condividere la cache con la scheda intera
   * significherebbe o servire allo sheet dati che non ha chiesto, o
   * svuotare la scheda ogni volta che lo sheet si apre.
   */
  applicationEntry: (actorId: string, applicationId: string) =>
    ["society-shortlist-application-entry", actorId, applicationId] as const,
  /**
   * Stella e appartenenza alla Position: §28 — «Query della lista includono
   * il riferimento canonico; quelle della stella il contesto organizzativo.»
   */
  membership: (actorId: string, clubId: string, scope: string) =>
    ["society-shortlist-membership", actorId, clubId, scope] as const,
  /**
   * DAS-REV-26 §26: «Chiavi private almeno con account, Society, persona …
   * Non utilizzare una cache di stella globale per person_id.» Le tre letture
   * del profilo portano actor, Società operativa e persona; il selector
   * anche il gruppo, perché i due gruppi falliscono e paginano da soli (§11).
   */
  profileState: (actorId: string, clubId: string, personId: string) =>
    ["society-shortlist-profile-state", actorId, clubId, personId] as const,
  profileMemberships: (actorId: string, clubId: string, personId: string) =>
    ["society-shortlist-profile-memberships", actorId, clubId, personId] as const,
  profileDestinations: (
    actorId: string,
    clubId: string,
    personId: string,
    group: "position" | "custom",
  ) =>
    ["society-shortlist-profile-destinations", actorId, clubId, personId, group] as const,
  /** §17: ambiti autorizzati del form CUSTOM, per ingresso. */
  scopeOptions: (actorId: string, clubId: string, withAdd: boolean) =>
    ["society-shortlist-scope-options", actorId, clubId, withAdd ? "add" : "create"] as const,
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
  "society-shortlist-entry",
  "society-shortlist-application-entry",
  "society-shortlist-membership",
  "society-shortlist-profile-state",
  "society-shortlist-profile-memberships",
  "society-shortlist-profile-destinations",
  "society-shortlist-scope-options",
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
  /* DAS-REV-25 §27: «Rimozione → … row Position». Il dettaglio gestionale
     porta il conteggio della riga sorella Shortlist, quindi una mutazione
     del pool lo invalida come invalida il centro. */
  "society-position-detail",
  "shortlists",
  "shortlist-membership-flags",
  "shortlist-memberships",
  "shortlist-entries",
  "society-application-detail",
] as const;
