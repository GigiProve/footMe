/**
 * Modello dei Link di invito (DAS-REV-20).
 *
 * I nomi seguono il dominio della specifica — link, redemption, incarico,
 * categoria autorizzata — e non le colonne SQL. La traduzione avviene una
 * volta sola, in `join-links-service.ts`.
 *
 * Due misure distinte attraversano tutto il modulo (§27): `completedUses`
 * conta gli ingressi storici e non scende mai, `activePeople` conta le
 * persone con l'incarico ancora attivo. Confonderle è il modo più rapido
 * per far sembrare liberato un posto che è stato consumato.
 */

/** Categoria autorizzata sul link (§12). Gli stessi quattro tipi canonici. */
export type JoinProfileType = "player" | "coach" | "staff" | "director";

/** Le due tab del centro. Non ce ne sono altre (§10). */
export type JoinLinksTab = "active" | "revoked";

/** Stato manuale. Il lifecycle minimo è ACTIVE → REVOKED, terminale (§9). */
export type JoinLinkStatus = "active" | "revoked";

/**
 * Disponibilità derivata (§9).
 *
 * Scadenza e limite **non** sono revoche: un link scaduto resta `active` e
 * resta nella tab Attivi. La precedenza di visualizzazione è quella del
 * server — revoca, struttura, scadenza, limite — ma il dettaglio mostra
 * comunque tutti i vincoli, perché correggerne uno solo può non bastare.
 */
export type JoinLinkAvailability =
  | "available"
  | "expired"
  | "limit_reached"
  | "structure"
  | "revoked";

/** Composizione del centro: che cosa l'actor può leggere e fare (§10). */
export type JoinLinksCenter = {
  /** Millisecondi: la finestra di accesso si confronta con `Date.now()`. */
  accessVerifiedAt: number;
  activeCount: number;
  canCreate: boolean;
  canManage: boolean;
  canRemoveRole: boolean;
  canRevoke: boolean;
  canViewPeople: boolean;
  clubId: string;
  clubIsVerified: boolean;
  clubLogoUrl: string | null;
  clubName: string;
  revokedCount: number;
  /** "Primavera" oppure "3 squadre" quando il perimetro è ridotto. */
  scopeLabel: string | null;
};

/** Riga del centro (§10). Nessun URL grezzo, nessun contatore di aperture. */
export type JoinLinkRow = {
  allowedProfileTypes: JoinProfileType[];
  availability: JoinLinkAvailability;
  /** Persone attualmente collegate: non è il consumo del limite (§10). */
  activePeople: number;
  completedUses: number;
  createdAt: string | null;
  id: string;
  maxRedemptions: number | null;
  revokedAt: string | null;
  status: JoinLinkStatus;
  teamId: string;
  teamName: string;
};

export type JoinLinksPage = {
  hasMore: boolean;
  nextCursor: string | null;
  rows: JoinLinkRow[];
};

/** Squadra su cui l'actor può emettere un link (§11). */
export type JoinLinkTeam = {
  category: string | null;
  id: string;
  label: string;
};

/** Dettaglio del link, disponibile o disattivato (§28, §32). */
export type JoinLinkDetail = {
  accessVerifiedAt: number;
  activePeople: number;
  allowedExecutiveRoles: string[];
  allowedProfileTypes: JoinProfileType[];
  availability: JoinLinkAvailability;
  /** §39: non si deduce dal solo stato ACTIVE. */
  canShare: boolean;
  canManage: boolean;
  canRemoveRole: boolean;
  canRevoke: boolean;
  canViewPeople: boolean;
  clubId: string;
  clubIsVerified: boolean;
  clubLogoUrl: string | null;
  clubName: string;
  completedUses: number;
  createdAt: string | null;
  executiveCustomRoleName: string | null;
  /** Data concordata, nel fuso memorizzato sul link (§15). */
  expiresOn: string | null;
  id: string;
  maxRedemptions: number | null;
  revision: number;
  revokedAt: string | null;
  status: JoinLinkStatus;
  teamId: string;
  teamName: string;
};

/** Materiale di condivisione, recuperato solo con capability (§18). */
export type JoinLinkShare = {
  allowedProfileTypes: JoinProfileType[];
  clubName: string;
  id: string;
  teamName: string;
  token: string;
};

/** Riga della lista Persone collegate (§33). */
export type JoinLinkPerson = {
  assignmentId: string;
  avatarUrl: string | null;
  connectedAt: string | null;
  /**
   * DAS-REV-21 §39: «Nei lettori gestionali necessari mostra il contesto
   * attuale quando differisce dall'origine; non presentare un Allenatore
   * della Primavera come ancora membro della Prima squadra.»
   *
   * È il Team (o l'ambito societario) dell'incarico **corrente** della
   * linea, che una modifica può aver spostato altrove rispetto al link.
   */
  contextLabel: string | null;
  personName: string;
  profileId: string;
  roleLabel: string;
};

export type JoinLinkPeoplePage = {
  hasMore: boolean;
  nextCursor: string | null;
  rows: JoinLinkPerson[];
  /** Conta l'insieme autorizzato, non le righe caricate (§33). */
  totalCount: number;
};

/** Dettaglio contestuale della persona (§34). */
export type JoinLinkPersonDetail = {
  accessVerifiedAt: number;
  assignmentId: string;
  avatarUrl: string | null;
  canRemoveRole: boolean;
  clubIsVerified: boolean;
  clubLogoUrl: string | null;
  clubName: string;
  connectedAt: string | null;
  /** Il contesto attuale dell'incarico, che può differire dall'origine (§39). */
  contextLabel: string | null;
  isActive: boolean;
  personName: string;
  profileId: string;
  roleLabel: string;
  /** Audience del link da cui è entrata: l'origine è un dato, non un'ipotesi. */
  sourceAllowedProfileTypes: JoinProfileType[];
  sourceTeamName: string;
  teamId: string;
  teamName: string;
};

/** Bozza locale del composer. Prima di Genera link non esiste un record (§11). */
export type JoinLinkDraft = {
  customExecutiveRole: string;
  executiveRoleIds: string[];
  /** `null` = Nessuna scadenza, che è il default reale (§15). */
  expiresOn: string | null;
  /** `null` = Nessun limite, che si salva come null e non come zero (§15). */
  maxRedemptions: number | null;
  profileTypes: JoinProfileType[];
  teamId: string | null;
  teamLabel: string | null;
};

/** Esito di una mutazione gestionale. */
export type JoinLinkMutationResult = {
  alreadyApplied: boolean;
  linkId: string;
  revision: number | null;
  /** Presente solo alla creazione: è l'URL da condividere (§17). */
  token: string | null;
};

/* ------------------------------------------------------------------ */
/* Percorso del destinatario                                          */
/* ------------------------------------------------------------------ */

/** Contesto pubblico della landing. Solo ciò che è divulgabile (§19). */
export type JoinLinkPublicContext = {
  allowedProfileTypes: JoinProfileType[];
  clubIsVerified: boolean;
  clubLogoUrl: string | null;
  clubName: string;
  state: "valid" | "unavailable";
  teamName: string;
};

/**
 * Stato del percorso per la PERSON autenticata (§21, §26, §36).
 *
 * I motivi di blocco restano distinti perché i copy lo sono: una rimozione
 * societaria e uno scollegamento volontario non si raccontano allo stesso
 * modo, e nessuno dei due è «invito non più disponibile».
 */
export type JoinContextState =
  | "valid"
  | "unavailable"
  | "incompatible_profile"
  | "already_connected"
  | "blocked_removed"
  | "blocked_ended";

export type JoinContext = {
  allowedExecutiveRoles: string[];
  allowedProfileTypes: JoinProfileType[];
  clubId: string | null;
  clubIsVerified: boolean;
  clubLogoUrl: string | null;
  clubName: string | null;
  /** Ruolo già attivo, quando il collegamento era stato completato. */
  currentRoleLabel: string | null;
  /** Categorie del link che il profilo reale può davvero usare (§21). */
  eligibleProfileTypes: JoinProfileType[];
  executiveCustomRoleName: string | null;
  linkId: string | null;
  personAvatarUrl: string | null;
  personName: string | null;
  state: JoinContextState;
  teamId: string | null;
  teamName: string | null;
};

/** Esito della conferma (§24, §26). */
export type JoinRedeemResult = {
  alreadyApplied: boolean;
  assignmentId: string | null;
  outcome: "completed" | "already_connected";
  roleLabel: string | null;
};

/** Voce del catalogo ruoli condiviso, letta dal server (§13, §14). */
export type JoinAssignmentRole = {
  id: string;
  isCustom: boolean;
  label: string;
  profileType: JoinProfileType;
};

export type JoinAssignmentRoleCatalog = {
  customRoleMax: number;
  roles: JoinAssignmentRole[];
};
