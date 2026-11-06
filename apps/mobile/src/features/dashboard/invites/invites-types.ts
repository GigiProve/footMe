/**
 * Modello del Centro Inviti e richieste (DAS-REV-19).
 *
 * I nomi seguono il dominio della specifica — Invitation, richiesta,
 * incarico, ambito — e non le colonne SQL. La traduzione avviene una volta
 * sola, in `invites-service.ts`.
 *
 * Nessun tipo qui porta recapiti, email o profili interi: §12 vieta di
 * mostrarli nelle righe e §41 di farli viaggiare nei payload.
 */

/** Tipologia professionale eleggibile a un incarico sportivo (§17). */
export type InviteProfileType = "player" | "coach" | "staff" | "director";

/** §9: un solo team_id canonico, oppure l'intera società con team nullo. */
export type InviteScopeType = "team" | "society";

/** Le due tab del Centro. Non ce ne sono altre (§12). */
export type InvitesTab = "sent" | "received";

/** Le due sezioni interne. Non ce ne sono altre (§12). */
export type InvitesSection = "pending" | "recent";

/**
 * Stato operativo mostrato in riga.
 *
 * `approved` esiste solo per le richieste: il modello canonico le risolve
 * diventando una membership attiva, e chiamarla "accettata" la confonderebbe
 * con un invito (§15).
 */
export type InviteRecordState =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled"
  | "approved"
  /**
   * DAS-REV-20 §25: la proposta è stata **soddisfatta da un altro percorso**
   * — tipicamente un link di squadra che ha creato lo stesso incarico.
   *
   * Non è un'accettazione del destinatario né un'approvazione di un
   * amministratore: §25 vieta di «fingere ACCEPTED dall'invito originale o
   * APPROVED da un amministratore che non ha compiuto quell'azione». È
   * terminale e non azionabile.
   */
  | "superseded";

/** Composizione del Centro: che cosa l'actor può leggere e fare (§12). */
export type InvitesCenter = {
  /** Millisecondi: la finestra di accesso si confronta con `Date.now()`. */
  accessVerifiedAt: number;
  canCancel: boolean;
  canInvite: boolean;
  canViewRequests: boolean;
  canViewSent: boolean;
  clubId: string;
  clubIsVerified: boolean;
  clubLogoUrl: string | null;
  clubName: string;
  dataRevision: number;
  /** `null` quando la sezione non è leggibile. Mai 0 (§12, §38). */
  requestsPendingCount: number | null;
  /** "Primavera" oppure "3 squadre" quando l'actor ha un perimetro ridotto. */
  scopeLabel: string | null;
  sentPendingCount: number | null;
};

/** Riga del Centro, identica per le due tab (§12). */
export type InviteRow = {
  avatarUrl: string | null;
  /** Nome della squadra, oppure "Intera società". Mai una riga vuota. */
  contextLabel: string | null;
  id: string;
  /** `true` solo per una richiesta non ancora letta da **questo** actor. */
  isUnread: boolean;
  kind: "invite" | "request";
  personName: string;
  personProfileId: string;
  roleLabel: string;
  scopeType: InviteScopeType;
  state: InviteRecordState;
  /** created_at sui pending, resolved_at sui risolti (§13). */
  stateAt: string | null;
  teamId: string | null;
  teamIsInactive: boolean;
};

export type InvitesPage = {
  hasMore: boolean;
  nextCursor: string | null;
  rows: InviteRow[];
};

/**
 * Filtro di ambito (§14, §40).
 *
 * `all` non è "tutte le squadre esistenti": è l'assenza di restrizione, e
 * comprende anche gli incarichi societari autorizzati. `teams` è un insieme
 * esplicito, che per costruzione **non** comprende quelli societari.
 */
export type InvitesFilter =
  | { kind: "all" }
  | { kind: "teams"; teamIds: string[] };

export type InviteFilterTeam = {
  isInactive: boolean;
  label: string;
  teamId: string;
};

/** Voce del catalogo condiviso dei ruoli proponibili (§20, §21). */
export type AssignmentRole = {
  /** Richiede un testo libero: è la voce "Altro ruolo…". */
  isCustom: boolean;
  label: string;
  profileType: InviteProfileType;
  roleId: string;
};

export type AssignmentRoleCatalog = {
  customRoleMax: number;
  roles: AssignmentRole[];
};

export type AssignableTeam = {
  category: string | null;
  label: string;
  teamId: string;
};

/** Persona trovata dalla ricerca del passo 1 (§17). */
export type InviteCandidate = {
  avatarUrl: string | null;
  city: string | null;
  fullName: string;
  profileId: string;
  profileType: InviteProfileType;
  /** Contesto professionale pubblico, quando esiste davvero. */
  specialty: string | null;
};

export type InviteCandidatePage = {
  rows: InviteCandidate[];
  total: number;
};

/** Dettaglio dell'invito inviato, lato Società (§26). */
export type SentInviteDetail = {
  canCancel: boolean;
  clubId: string;
  clubIsVerified: boolean;
  clubLogoUrl: string | null;
  clubName: string;
  contextLabel: string | null;
  createdAt: string | null;
  inviteId: string;
  personAvatarUrl: string | null;
  personName: string;
  personProfileId: string;
  profileType: InviteProfileType;
  resolvedAt: string | null;
  revision: number;
  roleLabel: string;
  scopeType: InviteScopeType;
  state: InviteRecordState;
  teamId: string | null;
  teamIsInactive: boolean;
};

/** Dettaglio della richiesta ricevuta (§15). Consultazione, non gestione. */
export type ReceivedRequestDetail = {
  clubId: string;
  clubIsVerified: boolean;
  clubLogoUrl: string | null;
  clubName: string;
  contextLabel: string | null;
  createdAt: string | null;
  isUnread: boolean;
  personAvatarUrl: string | null;
  personName: string;
  personProfileId: string;
  requestId: string;
  resolvedAt: string | null;
  roleLabel: string;
  scopeType: InviteScopeType;
  state: InviteRecordState;
  teamId: string | null;
};

/**
 * La proposta come la vede il destinatario (§28, §33).
 *
 * `assignmentActive` distingue «accettato e incarico corrente» da «accettato
 * e incarico successivamente terminato»: senza, la schermata affermerebbe
 * che un vecchio rapporto è ancora attivo.
 */
export type MyInvite = {
  assignmentActive: boolean;
  canRespond: boolean;
  clubCity: string | null;
  clubId: string;
  clubIsVerified: boolean;
  clubLogoUrl: string | null;
  clubName: string;
  contextLabel: string | null;
  createdAt: string | null;
  inviteId: string;
  profileType: InviteProfileType;
  resolvedAt: string | null;
  revision: number;
  roleLabel: string;
  scopeType: InviteScopeType;
  state: InviteRecordState;
  teamId: string | null;
  teamName: string | null;
};

export type InviteMutationResult = {
  alreadyApplied: boolean;
  assignmentId: string | null;
  inviteId: string;
  resolvedAt: string | null;
  revision: number;
  state: InviteRecordState;
};

/** Proposta in compilazione. Vive nel composer, non in un contesto globale. */
export type InviteDraft = {
  customRole: string;
  person: InviteCandidate | null;
  roleId: string | null;
  scopeType: InviteScopeType;
  teamId: string | null;
  teamLabel: string | null;
};
