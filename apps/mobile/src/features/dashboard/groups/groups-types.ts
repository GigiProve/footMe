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
