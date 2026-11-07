/**
 * Modello del Centro Candidature ricevute (DAS-REV-22).
 *
 * I tre concetti che §4 obbliga a tenere separati e che il vecchio schermo
 * `announcements?focus=applications` mescolava:
 *
 *   · **Application**  la relazione persona ↔ Position, una sola corrente;
 *   · **submission**   l'invio corrente, con la sua data e la sua revisione;
 *   · **lettura**      il fatto che *questo* actor abbia consultato *quella*
 *                      revisione.
 *
 * «Nuova» appartiene al terzo, non al primo: §8 — «Nuova identifica una
 * submission corrente da consultare, non una fase della selezione.» Per
 * questo qui non esiste nessun campo che somigli a Selezionato, Rifiutato o
 * Archiviata, e `status` ha due soli valori utili ai lettori.
 */

/** §24: lo stato corrente della candidatura, nel vocabolario dei lettori. */
export type ApplicationState = "active" | "withdrawn";

/** Lifecycle della Position, distinto dallo stato della candidatura (§7). */
export type ApplicationAdStatus = "published" | "closed";

/** §12: due tab, mai una terza. «Non aggiungere un terzo tab Archivio.» */
export type ApplicationsTab = "new" | "all";

/** Le quattro tipologie professionali di §17. */
export type ApplicantProfileType =
  | "player"
  | "coach"
  | "staff"
  | "director";

/** §6: TEAM oppure SOCIETY. Un `teamId` nullo non significa SOCIETY. */
export type ApplicationPositionScope = "society" | "team";

export type ApplicationsCenter = {
  accessVerifiedAt: number;
  /** §20: capacità distinta dalla consultazione. */
  canAddShortlist: boolean;
  canView: boolean;
  clubId: string;
  clubIsVerified: boolean;
  clubLogoUrl: string | null;
  clubName: string;
  dataRevision: number;
  /**
   * §9: conteggi dell'**intero scope** dell'actor, non dei filtri della
   * vista. `null` quando la capability manca: «Non inventare un count zero
   * in presenza di errore, dato assente o capability mancante.»
   */
  newCount: number | null;
  scopeLabel: string | null;
  totalCount: number | null;
};

/**
 * Una riga della lista (§12). Contiene esattamente ciò che la riga mostra:
 * §12 vieta «età, peso, altezza, piede, statistiche, tutta la carriera,
 * pulsanti Messaggio/Shortlist o contatti direttamente nella row».
 */
export type ApplicationRow = {
  adId: string;
  adStatus: ApplicationAdStatus;
  id: string;
  /** §13: indicatore discreto, accompagnato sempre da testo esplicito. */
  isNew: boolean;
  /**
   * §7: la data della submission corrente. `null` su un record legacy senza
   * testimonianza affidabile — §32 vieta di inventarla.
   */
  latestSubmittedAt: string | null;
  personAvatarUrl: string | null;
  personId: string;
  personName: string;
  personRole: ApplicantProfileType | null;
  /**
   * §16: la situazione professionale corrente risolta dal profilo. `null`
   * quando il profilo non determina un contesto univoco — e `null` **non**
   * è «Svincolato».
   */
  personSituation: string | null;
  positionScope: ApplicationPositionScope;
  roleLabel: string;
  state: ApplicationState;
  submissionRevision: number;
  targetRole: ApplicantProfileType | null;
  teamId: string | null;
  teamLabel: string | null;
  /** §13: il fatto del ritiro è separato dalla data della submission. */
  withdrawnAt: string | null;
};

/** §23: il contesto fissato quando si entra dalla singola Position. */
export type ApplicationPositionContext = {
  adId: string;
  group: "active" | "closed";
  roleLabel: string;
  scope: ApplicationPositionScope;
  status: ApplicationAdStatus;
  targetRole: ApplicantProfileType | null;
  teamId: string | null;
  teamLabel: string | null;
};

export type ApplicationsFilter = {
  adIds: string[];
  teamIds: string[];
};

export const EMPTY_APPLICATIONS_FILTER: ApplicationsFilter = {
  adIds: [],
  teamIds: [],
};

export type ApplicationsPage = {
  asOf: string | null;
  /** §14, §26: i filtri **effettivi**, normalizzati dal server sullo scope. */
  effectiveFilter: ApplicationsFilter;
  filteredNew: number | null;
  /**
   * Righe che **potrebbero** essere nuove: attive su una Position PUBLISHED,
   * lette o no. §27 lo richiede per non affermare che siano state tutte
   * consultate quando in Tutte ci sono solo ritirate e posizioni chiuse.
   */
  filteredOperative: number | null;
  filteredTotal: number | null;
  hasMore: boolean;
  nextCursor: string | null;
  positionContext: ApplicationPositionContext | null;
  rows: ApplicationRow[];
};

/** Opzione di una delle due dimensioni del filtro (§14). */
export type ApplicationFilterOption =
  | { kind: "team"; label: string; teamId: string }
  | {
      adId: string;
      group: "active" | "closed";
      kind: "position";
      label: string;
      sublabel: string | null;
      teamId: string | null;
    };

/**
 * Il dettaglio (§15, §26). Identità, contesto storico dell'invio e capacità:
 * i blocchi professionali e la carriera arrivano dal profilo canonico, con
 * una lettura separata — §16 vieta «un secondo profilo».
 */
export type ApplicationDetail = {
  accessVerifiedAt: number;
  adId: string;
  adStatus: ApplicationAdStatus;
  /** §20: l'aggiunta richiede la capacità **e** una candidatura attiva. */
  canAddShortlist: boolean;
  /** §22: nascosta quando la Società corrente non può scrivere. */
  canMessage: boolean;
  clubId: string;
  clubIsVerified: boolean;
  clubLogoUrl: string | null;
  clubName: string;
  createdAt: string | null;
  dataRevision: number;
  group: "active" | "closed";
  id: string;
  /** §20: già in shortlist, da questo o da un altro percorso. */
  inShortlist: boolean;
  isNew: boolean;
  latestSubmittedAt: string | null;
  personAvatarUrl: string | null;
  personId: string;
  personName: string;
  personRole: ApplicantProfileType | null;
  personSituation: string | null;
  positionScope: ApplicationPositionScope;
  /** §24: la deadline superata è distinta dalla chiusura. */
  receivingClosed: boolean;
  roleLabel: string;
  /** §19: la stagione dello snapshot, solo per una ricerca chiusa. */
  seasonLabel: string | null;
  state: ApplicationState;
  submissionRevision: number;
  targetRole: ApplicantProfileType | null;
  teamId: string | null;
  teamLabel: string | null;
  withdrawnAt: string | null;
};

export type MarkReadResult = {
  id: string;
  isNew: boolean;
  /**
   * `false` quando la revisione inviata non era più quella corrente. §8:
   * non è un errore, è «una lettura arrivata tardi» — il client riconcilia
   * senza falsificare il contatore.
   */
  marked: boolean;
  submissionRevision: number;
};

export type ShortlistAddResult = {
  adId: string;
  /** §20: una entry già esistente viene riconosciuta, non duplicata. */
  already: boolean;
  entryId: string;
  personId: string;
};
