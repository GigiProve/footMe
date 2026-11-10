/**
 * Tipi del dominio Gruppi operativi (DAS-REV-32).
 *
 * §4: un gruppo è **una** Conversation GROUP; qui ci sono solo le due
 * proiezioni che la Dashboard legge — amministrativa (Centro, dettaglio) e
 * lookup di eleggibilità (step 2). La proiezione conversazionale (header
 * chat, Inbox) resta nel modulo Messaggi.
 *
 * §26: nessun campo chat nel DTO amministrativo — niente body, mittente,
 * unread, mute o attività. I tipi non hanno nemmeno lo spazio per metterli.
 */

/** Limiti centrali letti dal server (§14, §19): il client non ne tiene copie. */
export type GroupLimits = {
  avatarMaxBytes: number;
  avatarMimeTypes: string[];
  maxPeople: number;
  minPeople: number;
  nameMax: number;
};

export const DEFAULT_GROUP_LIMITS: GroupLimits = {
  avatarMaxBytes: 5 * 1024 * 1024,
  avatarMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  maxPeople: 256,
  minPeople: 2,
  nameMax: 80,
};

/** Riga del Centro (§10). `teamId === null` = contesto Società. */
export type SocietyGroupRow = {
  avatarPath: string | null;
  conversationId: string;
  name: string;
  peopleCount: number;
  teamId: string | null;
  teamName: string | null;
};

export type SocietyGroupsPage = {
  canCreate: boolean;
  items: SocietyGroupRow[];
  limits: GroupLimits;
  nextCursor: string | null;
};

/** Dettaglio amministrativo (§11). */
export type SocietyGroupDetail = {
  adminCount: number;
  avatarPath: string | null;
  /** Membership corrente del viewer: unica fonte di «Apri conversazione». */
  canOpenConversation: boolean;
  /** Gestione successiva (DAS-REV-33): `false` finché non esiste. */
  canManage: boolean;
  clubId: string;
  clubName: string;
  conversationId: string;
  name: string;
  peopleCount: number;
  status: "active" | "archived";
  teamId: string | null;
  teamName: string | null;
};

/** Società in cui l'actor può creare (§12). */
export type GroupCreateContext = {
  clubId: string;
  clubName: string;
  isVerified: boolean;
  logoUrl: string | null;
};

export type GroupTeamOption = {
  teamId: string;
  teamName: string;
};

export type GroupTeamsLookup = {
  canCreateWithoutTeam: boolean;
  limits: GroupLimits;
  teams: GroupTeamOption[];
};

/** Persona eleggibile (§17): solo dati nominativi e di contesto. */
export type EligiblePerson = {
  avatarUrl: string | null;
  fullName: string;
  /** Ha un incarico attivo nella squadra di contesto (§18). */
  inTeam: boolean;
  profileId: string;
  roleLabel: string | null;
};

export type EligiblePeoplePage = {
  items: EligiblePerson[];
  nextCursor: string | null;
  /** Persone eleggibili della squadra di contesto, creator escluso (§19). */
  teamTotal: number;
};

/** Origine del wizard: solo navigazione e analytics (§12). */
export type GroupComposeOrigin = "dashboard" | "messages";

export type CreateGroupInput = {
  avatarAssetId: string | null;
  clubId: string;
  name: string;
  operationKey: string;
  personIds: string[];
  source: GroupComposeOrigin;
  teamId: string | null;
};

export type CreateGroupResult = {
  conversationId: string;
  replayed: boolean;
};

export type GroupAvatarRef = {
  assetId: string;
  path: string;
};

// ── Gestione e lifecycle (DAS-REV-33) ───────────────────────────────────────

/** Da dove si apre Info gruppo (§9): solo navigazione e analytics, mai logica. */
export type GroupManageOrigin = "dashboard" | "messages";

/**
 * Le 13 capability del server (§5). Il client non le deriva da una stringa di
 * ruolo: nasconde ciò che il server non concede, non lo disabilita.
 */
export type GroupCapabilities = {
  canAccessConversation: boolean;
  canArchive: boolean;
  canDelete: boolean;
  canEditAvatar: boolean;
  canEditName: boolean;
  canEditTeam: boolean;
  canLeave: boolean;
  canManageAdmins: boolean;
  canManagePeople: boolean;
  canReactivate: boolean;
  canRecover: boolean;
  canViewInfo: boolean;
  canViewPeople: boolean;
};

export const NO_GROUP_CAPABILITIES: GroupCapabilities = {
  canAccessConversation: false,
  canArchive: false,
  canDelete: false,
  canEditAvatar: false,
  canEditName: false,
  canEditTeam: false,
  canLeave: false,
  canManageAdmins: false,
  canManagePeople: false,
  canReactivate: false,
  canRecover: false,
  canViewInfo: false,
  canViewPeople: false,
};

export type GroupMemberRole = "admin" | "member";

/** Percorso di uscita che il server indica per il viewer (§18, §19). */
export type GroupLeavePath = "add_people_first" | "handover" | "ordinary";

/** Proiezione amministrativa per Info gruppo: nessun body, anteprima o unread (§25). */
export type GroupManagement = {
  adminCount: number;
  archivedAt: string | null;
  avatarPath: string | null;
  capabilities: GroupCapabilities;
  clubId: string;
  /** Check accanto al nome della Società, mai del gruppo (§6). `false` se il server non lo manda. */
  clubIsVerified: boolean;
  clubName: string;
  conversationId: string;
  createdAt: string | null;
  leavePath: GroupLeavePath | null;
  limits: GroupLimits;
  myPeriodId: string | null;
  myPeriodVersion: number | null;
  myRole: GroupMemberRole | null;
  name: string;
  peopleCount: number;
  status: "active" | "archived";
  teamId: string | null;
  teamName: string | null;
  version: number;
};

/** Riga di Persone (§12): ID, nome, avatar, ruolo professionale pubblico, ruolo GROUP. */
export type GroupMember = {
  avatarUrl: string | null;
  canDemote: boolean;
  canPromote: boolean;
  canRemove: boolean;
  fullName: string;
  isMe: boolean;
  memberRole: GroupMemberRole;
  /** Generazione osservata: va rimandata ai comandi (§15, §16). */
  periodId: string;
  periodVersion: number;
  profileId: string;
  roleLabel: string | null;
};

export type GroupMembersPage = {
  adminCount: number;
  capabilities: GroupCapabilities;
  items: GroupMember[];
  nextCursor: string | null;
  otherCount: number;
  peopleCount: number;
  status: "active" | "archived";
};

/** Eleggibili all'aggiunta (§13): stessa forma di step 2 della 32, più i conteggi del gruppo. */
export type GroupEligiblePage = EligiblePeoplePage & {
  activeCount: number;
  limits: GroupLimits;
};

export type GroupTeamOptions = {
  canClear: boolean;
  currentTeamId: string | null;
  teams: GroupTeamOption[];
};

export type ArchivedGroupRow = {
  adminCount: number;
  archivedAt: string | null;
  avatarPath: string | null;
  canDelete: boolean;
  canManage: boolean;
  conversationId: string;
  name: string;
  needsRecovery: boolean;
  peopleCount: number;
  teamId: string | null;
  teamName: string | null;
};

export type ArchivedGroupsPage = {
  items: ArchivedGroupRow[];
  nextCursor: string | null;
};

export type HandoverCandidate = {
  avatarUrl: string | null;
  fullName: string;
  periodId: string;
  profileId: string;
  roleLabel: string | null;
};

export type HandoverCandidatesPage = {
  items: HandoverCandidate[];
  nextCursor: string | null;
};

/**
 * Esito di un comando di gestione (§25). Un solo tipo per tutti: i campi che
 * un comando non restituisce hanno il valore neutro.
 */
export type GroupCommandResult = {
  added: number;
  addedIds: string[];
  alreadyActiveIds: string[];
  changed: boolean;
  deleted: boolean;
  memberRole: GroupMemberRole | null;
  /** Il periodo osservato era già chiuso: riconciliazione, nessun effetto (§18). */
  periodEnded: boolean;
  /** Il viewer ha oggi un altro periodo: l'uscita non si applica (§18). */
  periodChanged: boolean;
  periodId: string | null;
  periodVersion: number | null;
  promotedIds: string[];
  /** Stesso intento già eseguito: non è un secondo successo (§28). */
  replayed: boolean;
  status: "active" | "archived" | null;
  version: number | null;
};

export type GroupCommandName =
  | "add_people"
  | "archive"
  | "avatar"
  | "delete"
  | "demote"
  | "handover"
  | "leave"
  | "promote"
  | "reactivate"
  | "remove"
  | "rename"
  | "team";
