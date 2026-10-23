/**
 * Modello del Centro Amministratori (DAS-REV-13).
 *
 * I nomi seguono il dominio della specifica — actor, Society, PERSON,
 * membership, invito, ruolo, ambito — e non le colonne SQL. La traduzione
 * avviene una volta sola, in `admins-service.ts`.
 *
 * Nessun tipo qui porta capability granulari o email dei pending: §21 vieta
 * di «caricare tutte le capability granulari, email o dati personali di tutti
 * gli amministratori per mostrare il centro».
 */
// `role` resta la stringa canonica del dominio: l'etichetta italiana la
// produce `formatRole` (profile-display-helpers), unica fonte di quei testi.

/** Composizione del centro: che cosa l'actor può leggere e fare (§7.3). */
export type AdminCenter = {
  /** Millisecondi: la finestra di accesso si confronta con `Date.now()`. */
  accessVerifiedAt: number;
  /** `null` quando la sezione non è leggibile. Mai 0 (§7.3, §25). */
  adminsCount: number | null;
  canInvite: boolean;
  canOpenRoles: boolean;
  canViewAdmins: boolean;
  canViewInvites: boolean;
  clubId: string;
  clubIsVerified: boolean;
  clubLogoUrl: string | null;
  clubName: string;
  dataRevision: number;
  invitesPendingCount: number | null;
  /** "Ambito: Primavera" quando l'actor opera su un perimetro ridotto. */
  scopeLabel: string | null;
};

/** Riga di un amministratore attivo (§7.1). */
export type AdminRow = {
  avatarUrl: string | null;
  fullName: string;
  isOwner: boolean;
  profileId: string;
  roleLabel: string;
  scopeLabel: string | null;
};

/**
 * Riga di un invito ancora valido (§7.2).
 *
 * `recipientKind` non è uno stato dell'invito: distingue solo il canale, e
 * da esso dipende l'etichetta — "Invito inviato" contro "Link pronto".
 */
export type AdminInviteRow = {
  avatarUrl: string | null;
  createdAt: string;
  emailDisplay: string | null;
  expiresAt: string;
  fullName: string | null;
  inviteId: string;
  profileId: string | null;
  recipientKind: "member" | "email";
  revision: number;
  roleLabel: string;
  scopeLabel: string | null;
};

export type AdminPage<TRow> = {
  rows: TRow[];
  total: number;
};

/** Stato amministrativo di una persona rispetto alla Società (§8). */
export type AdminCandidateStatus =
  | "already_admin"
  | "already_invited"
  | "eligible";

export type AdminCandidate = {
  /** Ruolo amministrativo nella Società, se già amministratore. */
  adminRole: string | null;
  avatarUrl: string | null;
  fullName: string;
  profileId: string;
  /** Ruolo pubblico del profilo: lo formatta `formatRole`, non il backend. */
  role: string | null;
  status: AdminCandidateStatus;
};

export type AssignableRole = {
  configVersion: number;
  name: string;
  /** Chiavi reali di `club_member_permissions`. Nessuna è inventata (§28). */
  permissions: string[];
  roleId: string;
};

export type AssignableTeam = {
  category: string | null;
  name: string;
  teamId: string;
  teamType: string | null;
};

export type AdminScopeMode = "society" | "teams";

/** Proposta in compilazione. Vive nel composer, non in un contesto globale. */
export type AdminInviteDraft = {
  email: string;
  roleId: string | null;
  scopeMode: AdminScopeMode;
  teamIds: string[];
};

export type CreatedAdminInvite = {
  expiresAt: string;
  inviteId: string;
  recipientKind: "member" | "email";
  revision: number;
  /** Presente solo per il percorso esterno: l'invito interno non ha link. */
  token: string | null;
};

export type ResharedAdminInvite = {
  emailDisplay: string | null;
  expiresAt: string;
  inviteId: string;
  roleLabel: string;
  scopeLabel: string | null;
  token: string;
};

/** Stato della landing pubblica (§13). */
export type AdminInvitePublic =
  | {
      clubIsVerified: boolean;
      clubLogoUrl: string | null;
      clubName: string;
      roleLabel: string;
      scopeLabel: string | null;
      state: "valid";
    }
  | { state: "unavailable" };

/**
 * Esito della risoluzione del token dopo l'autenticazione (§14, §15).
 *
 * `needs_verified_email` non è un errore tecnico: è la condizione in cui il
 * destinatario esterno non ha (ancora) un indirizzo verificato corrispondente,
 * e §15 vieta di attivare l'accesso senza quella prova.
 */
export type AdminInviteBindingState =
  | "accepted"
  | "already_admin"
  | "expired"
  | "needs_verified_email"
  | "rejected"
  | "revoked"
  | "unavailable"
  | "valid"
  | "wrong_account";

export type AdminInviteBinding = {
  inviteId: string | null;
  state: AdminInviteBindingState;
};

/** Stato dell'invito letto dal destinatario (§16, §25). */
export type MyAdminInviteState =
  | "accepted"
  | "expired"
  | "pending"
  | "rejected"
  | "revoked";

export type MyAdminInvite = {
  clubId: string;
  clubIsVerified: boolean;
  clubLogoUrl: string | null;
  clubName: string;
  expiresAt: string;
  inviteId: string;
  /** L'accesso è attivo **adesso**: un accepted storico non lo prova (§25). */
  membershipActive: boolean;
  revision: number;
  roleLabel: string;
  scopeLabel: string | null;
  state: MyAdminInviteState;
};

export type AdminRespondResult = {
  clubId: string;
  inviteId: string;
  membershipId: string | null;
  state: "accepted" | "rejected" | MyAdminInviteState;
};
