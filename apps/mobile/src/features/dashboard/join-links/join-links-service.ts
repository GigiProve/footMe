/**
 * Accesso ai dati dei Link di invito (§39, §40, §43).
 *
 * Nessuna regola di dominio vive qui. Chi può emettere un link, quale
 * squadra è ammessa, se un token è ancora redimibile, quale categoria il
 * profilo può scegliere: lo decide il backend, che §8 obbliga a rivalidare
 * «sessione, actor, Society corrente, capability pertinente, Team e ambito»
 * a ogni chiamata. Questo file traduce righe in tipi e scarta ciò che non sa
 * leggere.
 *
 * «La validazione del frontend non è una barriera di sicurezza» (§43): le
 * funzioni di controllo in `join-links-presentation.ts` servono a scrivere
 * un errore vicino al campo, non a proteggere il dominio.
 */
import { supabase } from "../../../lib/supabase";
import { DashboardTimeoutError } from "../state/error-classification";
import { MODULE_TIMEOUT_MS, withTimeout } from "../state/retry-policy";
import type {
  JoinAssignmentRole,
  JoinAssignmentRoleCatalog,
  JoinContext,
  JoinContextState,
  JoinLinkAvailability,
  JoinLinkDetail,
  JoinLinkMutationResult,
  JoinLinkPeoplePage,
  JoinLinkPerson,
  JoinLinkPersonDetail,
  JoinLinkPublicContext,
  JoinLinkRow,
  JoinLinkShare,
  JoinLinkStatus,
  JoinLinkTeam,
  JoinLinksCenter,
  JoinLinksPage,
  JoinLinksTab,
  JoinProfileType,
  JoinRedeemResult,
} from "./join-links-types";

/**
 * Codici applicativi sollevati dalle RPC. Sono stringhe stabili, non
 * messaggi: §41 vieta che «i codici tecnici compaiano nella UI», e la copy
 * vive nel livello di presentazione perché lo stesso codice compare in
 * schermate diverse con parole diverse.
 */
export type JoinLinksErrorCode =
  | "JOIN_LINKS_CENTER_NOT_AUTHORIZED"
  | "JOIN_LINKS_CURSOR_INVALID"
  | "JOIN_LINKS_NOT_AUTHORIZED"
  | "JOIN_LINK_ASSIGNMENT_NOT_FOUND"
  | "JOIN_LINK_CATEGORIES_REQUIRED"
  | "JOIN_LINK_CATEGORY_NOT_ALLOWED"
  | "JOIN_LINK_CONNECTION_ENDED"
  | "JOIN_LINK_CUSTOM_ROLE_REQUIRED"
  | "JOIN_LINK_CUSTOM_ROLE_TOO_LONG"
  | "JOIN_LINK_EXECUTIVE_ROLES_REQUIRED"
  | "JOIN_LINK_EXPIRY_INVALID"
  | "JOIN_LINK_LIMIT_BELOW_USAGE"
  | "JOIN_LINK_LIMIT_INVALID"
  | "JOIN_LINK_NOT_FOUND"
  | "JOIN_LINK_NOT_SHAREABLE"
  | "JOIN_LINK_PEOPLE_NOT_AUTHORIZED"
  | "JOIN_LINK_PROFILE_INCOMPATIBLE"
  | "JOIN_LINK_REENTRY_BLOCKED"
  | "JOIN_LINK_REMOVE_NOT_AUTHORIZED"
  | "JOIN_LINK_REVISION_CONFLICT"
  | "JOIN_LINK_REVOKED"
  | "JOIN_LINK_SHARE_NOT_AUTHORIZED"
  | "JOIN_LINK_ROLE_NOT_ALLOWED"
  | "JOIN_LINK_ROLE_UNAVAILABLE"
  | "JOIN_LINK_TEAM_INVALID"
  | "JOIN_LINK_UNAVAILABLE"
  | "OPERATION_CONTENT_CHANGED"
  | "RATE_LIMIT"
  | "TEAM_NOT_ACTIVE"
  | "UNKNOWN";

const ERROR_CODES: readonly JoinLinksErrorCode[] = [
  "JOIN_LINKS_CENTER_NOT_AUTHORIZED",
  "JOIN_LINKS_CURSOR_INVALID",
  "JOIN_LINKS_NOT_AUTHORIZED",
  "JOIN_LINK_ASSIGNMENT_NOT_FOUND",
  "JOIN_LINK_CATEGORIES_REQUIRED",
  "JOIN_LINK_CATEGORY_NOT_ALLOWED",
  "JOIN_LINK_CONNECTION_ENDED",
  "JOIN_LINK_CUSTOM_ROLE_REQUIRED",
  "JOIN_LINK_CUSTOM_ROLE_TOO_LONG",
  "JOIN_LINK_EXECUTIVE_ROLES_REQUIRED",
  "JOIN_LINK_EXPIRY_INVALID",
  "JOIN_LINK_LIMIT_BELOW_USAGE",
  "JOIN_LINK_LIMIT_INVALID",
  "JOIN_LINK_NOT_FOUND",
  "JOIN_LINK_NOT_SHAREABLE",
  "JOIN_LINK_PEOPLE_NOT_AUTHORIZED",
  "JOIN_LINK_PROFILE_INCOMPATIBLE",
  "JOIN_LINK_REENTRY_BLOCKED",
  "JOIN_LINK_REMOVE_NOT_AUTHORIZED",
  "JOIN_LINK_REVISION_CONFLICT",
  "JOIN_LINK_REVOKED",
  "JOIN_LINK_SHARE_NOT_AUTHORIZED",
  "JOIN_LINK_ROLE_NOT_ALLOWED",
  "JOIN_LINK_ROLE_UNAVAILABLE",
  "JOIN_LINK_TEAM_INVALID",
  "JOIN_LINK_UNAVAILABLE",
  "OPERATION_CONTENT_CHANGED",
  "RATE_LIMIT",
  "TEAM_NOT_ACTIVE",
] as const;

export class JoinLinksAccessError extends Error {
  code: JoinLinksErrorCode;

  /**
   * Dato strutturato che accompagna il codice. Oggi lo usa solo
   * `JOIN_LINK_LIMIT_BELOW_USAGE`, che §29 obbliga a rifiutare «con il nuovo
   * minimo» riletto al commit e non con il conteggio che il client aveva in
   * pagina.
   */
  detail: string | null;

  constructor(
    code: JoinLinksErrorCode,
    message?: string,
    detail?: string | null,
  ) {
    super(message ?? code);
    this.code = code;
    this.detail = detail ?? null;
    this.name = "JoinLinksAccessError";
  }
}

/**
 * L'errore è un rifiuto di autorizzazione? (§41)
 *
 * Serve a non presentare un guasto di rete come un permesso mancante, e a
 * non ritentare all'infinito un permesso mancante come fosse un guasto di
 * rete.
 */
const AUTHORIZATION_CODES: readonly JoinLinksErrorCode[] = [
  "JOIN_LINKS_CENTER_NOT_AUTHORIZED",
  "JOIN_LINKS_NOT_AUTHORIZED",
  "JOIN_LINK_PEOPLE_NOT_AUTHORIZED",
  "JOIN_LINK_REMOVE_NOT_AUTHORIZED",
  "JOIN_LINK_SHARE_NOT_AUTHORIZED",
];

export function isAuthorizationError(error: unknown): boolean {
  return (
    error instanceof JoinLinksAccessError &&
    AUTHORIZATION_CODES.includes(error.code)
  );
}

export function toJoinLinksError(error: unknown): JoinLinksAccessError {
  if (error instanceof JoinLinksAccessError) {
    return error;
  }

  /* Un timeout non è un rifiuto autorizzativo: il primo si ritenta, il
     secondo no. Confonderli produce il comportamento sbagliato su entrambi. */
  if (error instanceof DashboardTimeoutError) {
    throw error;
  }

  const record =
    typeof error === "object" && error !== null
      ? (error as Record<string, unknown>)
      : {};

  const message =
    "message" in record ? String(record.message) : String(error ?? "");
  const detail =
    typeof record.details === "string" && record.details.length > 0
      ? record.details
      : null;

  /* I codici più lunghi per primi: `JOIN_LINK_CUSTOM_ROLE_TOO_LONG` contiene
     `JOIN_LINK_CUSTOM_ROLE_...` e un ordine arbitrario li confonderebbe. */
  const matched = [...ERROR_CODES]
    .sort((a, b) => b.length - a.length)
    .find((code) => message.includes(code));

  return new JoinLinksAccessError(matched ?? "UNKNOWN", message, detail);
}

type RawRecord = Record<string, unknown>;

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function bool(value: unknown): boolean {
  return value === true;
}

/** `null` resta `null`: un dato non leggibile non è uno zero (§10). */
function count(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    return Number(value);
  }

  return null;
}

function integer(value: unknown, fallback: number): number {
  return count(value) ?? fallback;
}

const PROFILE_TYPES: readonly JoinProfileType[] = [
  "player",
  "coach",
  "staff",
  "director",
];

function profileType(value: unknown): JoinProfileType | null {
  const raw = text(value);

  return raw && (PROFILE_TYPES as readonly string[]).includes(raw)
    ? (raw as JoinProfileType)
    : null;
}

/** Un valore non riconosciuto viene scartato, non tradotto in un default. */
function profileTypes(value: unknown): JoinProfileType[] {
  return Array.isArray(value)
    ? value
        .map((item) => profileType(item))
        .filter((item): item is JoinProfileType => item !== null)
    : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

const AVAILABILITIES: readonly JoinLinkAvailability[] = [
  "available",
  "expired",
  "limit_reached",
  "structure",
  "revoked",
];

/**
 * Una disponibilità sconosciuta diventa `structure`, cioè «non utilizzabile
 * per un motivo strutturale»: §9 vieta di inventare una revoca o una
 * scadenza, e trattare l'ignoto come disponibile sarebbe peggio.
 */
function availability(value: unknown): JoinLinkAvailability {
  const raw = text(value);

  return raw && (AVAILABILITIES as readonly string[]).includes(raw)
    ? (raw as JoinLinkAvailability)
    : "structure";
}

function linkStatus(value: unknown): JoinLinkStatus {
  return text(value) === "revoked" ? "revoked" : "active";
}

function millis(value: unknown): number {
  const raw = text(value);
  const parsed = raw ? Date.parse(raw) : Number.NaN;

  return Number.isFinite(parsed) ? parsed : Date.now();
}

async function rpc<T>(
  name: string,
  params: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await withTimeout(
    supabase.rpc(name, params),
    MODULE_TIMEOUT_MS,
    () => new DashboardTimeoutError(name),
  );

  if (error) {
    throw toJoinLinksError(error);
  }

  return data as T;
}

export const JOIN_LINKS_PAGE_SIZE = 20;

// ── Centro ──────────────────────────────────────────────────────────────────

export async function fetchJoinLinksCenter(
  clubId: string,
): Promise<JoinLinksCenter> {
  const rows = await rpc<RawRecord[]>("fetch_team_join_links_center", {
    p_club_id: clubId,
  });

  const row = Array.isArray(rows) ? rows[0] : null;

  /* §41: una risposta vuota è un rifiuto, non un centro senza dati. */
  if (!row) {
    throw new JoinLinksAccessError("JOIN_LINKS_CENTER_NOT_AUTHORIZED");
  }

  return {
    accessVerifiedAt: millis(row.access_verified_at),
    activeCount: integer(row.active_count, 0),
    canCreate: bool(row.can_create),
    canManage: bool(row.can_manage),
    canRemoveRole: bool(row.can_remove_role),
    canRevoke: bool(row.can_revoke),
    canViewPeople: bool(row.can_view_people),
    clubId: text(row.club_id) ?? clubId,
    clubIsVerified: bool(row.club_is_verified),
    clubLogoUrl: text(row.club_logo_url),
    clubName: text(row.club_name) ?? "",
    revokedCount: integer(row.revoked_count, 0),
    scopeLabel: text(row.scope_label),
  };
}

function toRow(raw: RawRecord): JoinLinkRow | null {
  const id = text(raw.link_id);
  const teamId = text(raw.team_id);

  if (!id || !teamId) {
    return null;
  }

  return {
    activePeople: integer(raw.active_people, 0),
    allowedProfileTypes: profileTypes(raw.allowed_profile_types),
    availability: availability(raw.availability),
    completedUses: integer(raw.completed_uses, 0),
    createdAt: text(raw.created_at),
    id,
    maxRedemptions: count(raw.max_redemptions),
    revokedAt: text(raw.revoked_at),
    status: linkStatus(raw.status),
    teamId,
    teamName: text(raw.team_name) ?? "",
  };
}

export async function fetchJoinLinksPage(input: {
  clubId: string;
  cursor?: string | null;
  limit?: number;
  tab: JoinLinksTab;
  /**
   * Contesto squadra di §37, quando si arriva da un impedimento alla
   * disattivazione. Il filtro è server-side: §8 avverte che «un filtro
   * client su una response fuori scope non è sufficiente».
   */
  teamId?: string | null;
}): Promise<JoinLinksPage> {
  const limit = input.limit ?? JOIN_LINKS_PAGE_SIZE;

  const rows = await rpc<RawRecord[]>("fetch_team_join_links_page", {
    p_club_id: input.clubId,
    p_cursor: input.cursor ?? null,
    p_limit: limit,
    p_tab: input.tab,
    p_team_id: input.teamId ?? null,
  });

  const list = Array.isArray(rows) ? rows : [];
  const last = list[list.length - 1];

  return {
    /* Una pagina piena può essere l'ultima: è il tentativo successivo a
       dirlo, non la presenza del cursore. */
    hasMore: list.length >= limit,
    nextCursor: last ? text(last.next_cursor) : null,
    rows: list
      .map((raw) => toRow(raw))
      .filter((row): row is JoinLinkRow => row !== null),
  };
}

export async function fetchJoinLinkTeams(
  clubId: string,
): Promise<JoinLinkTeam[]> {
  const rows = await rpc<RawRecord[]>("fetch_team_join_link_teams", {
    p_club_id: clubId,
  });

  return (Array.isArray(rows) ? rows : []).flatMap((raw) => {
    const id = text(raw.team_id);

    return id
      ? [{ category: text(raw.category), id, label: text(raw.label) ?? "" }]
      : [];
  });
}

// ── Dettaglio ───────────────────────────────────────────────────────────────

export async function fetchJoinLink(linkId: string): Promise<JoinLinkDetail> {
  const rows = await rpc<RawRecord[]>("fetch_team_join_link", {
    p_link_id: linkId,
  });

  const row = Array.isArray(rows) ? rows[0] : null;

  if (!row) {
    throw new JoinLinksAccessError("JOIN_LINK_NOT_FOUND");
  }

  return {
    accessVerifiedAt: millis(row.access_verified_at),
    activePeople: integer(row.active_people, 0),
    allowedExecutiveRoles: strings(row.allowed_executive_roles),
    allowedProfileTypes: profileTypes(row.allowed_profile_types),
    availability: availability(row.availability),
    canManage: bool(row.can_manage),
    canRemoveRole: bool(row.can_remove_role),
    canRevoke: bool(row.can_revoke),
    canShare: bool(row.can_share),
    canViewPeople: bool(row.can_view_people),
    clubId: text(row.club_id) ?? "",
    clubIsVerified: bool(row.club_is_verified),
    clubLogoUrl: text(row.club_logo_url),
    clubName: text(row.club_name) ?? "",
    completedUses: integer(row.completed_uses, 0),
    createdAt: text(row.created_at),
    executiveCustomRoleName: text(row.executive_custom_role_name),
    expiresOn: text(row.expires_on),
    id: text(row.link_id) ?? linkId,
    maxRedemptions: count(row.max_redemptions),
    revision: integer(row.revision, 1),
    revokedAt: text(row.revoked_at),
    status: linkStatus(row.status),
    teamId: text(row.team_id) ?? "",
    teamName: text(row.team_name) ?? "",
  };
}

/**
 * §18: «Lo share e il copy recuperano il link soltanto con capability valida
 * e disponibilità aggiornata. Non generare nuovo token a ogni tap.» La
 * chiamata è esplicita e separata dal dettaglio proprio perché non deve
 * partire da sola a ogni apertura della pagina.
 */
export async function fetchJoinLinkShare(
  linkId: string,
): Promise<JoinLinkShare> {
  const rows = await rpc<RawRecord[]>("fetch_team_join_link_share", {
    p_link_id: linkId,
  });

  const row = Array.isArray(rows) ? rows[0] : null;
  const token = row ? text(row.token) : null;

  if (!row || !token) {
    throw new JoinLinksAccessError("JOIN_LINK_NOT_SHAREABLE");
  }

  return {
    allowedProfileTypes: profileTypes(row.allowed_profile_types),
    clubName: text(row.club_name) ?? "",
    id: text(row.link_id) ?? linkId,
    teamName: text(row.team_name) ?? "",
    token,
  };
}

// ── Persone collegate ───────────────────────────────────────────────────────

function toPerson(raw: RawRecord): JoinLinkPerson | null {
  const assignmentId = text(raw.assignment_id);
  const profileId = text(raw.profile_id);

  if (!assignmentId || !profileId) {
    return null;
  }

  return {
    assignmentId,
    avatarUrl: text(raw.avatar_url),
    connectedAt: text(raw.connected_at),
    personName: text(raw.person_name) ?? "",
    profileId,
    roleLabel: text(raw.role_label) ?? "",
  };
}

export async function fetchJoinLinkPeoplePage(input: {
  cursor?: string | null;
  limit?: number;
  linkId: string;
}): Promise<JoinLinkPeoplePage> {
  const limit = input.limit ?? JOIN_LINKS_PAGE_SIZE;

  const rows = await rpc<RawRecord[]>("fetch_team_join_link_people_page", {
    p_cursor: input.cursor ?? null,
    p_limit: limit,
    p_link_id: input.linkId,
  });

  const list = Array.isArray(rows) ? rows : [];
  const last = list[list.length - 1];

  return {
    hasMore: list.length >= limit,
    nextCursor: last ? text(last.next_cursor) : null,
    rows: list
      .map((raw) => toPerson(raw))
      .filter((row): row is JoinLinkPerson => row !== null),
    /* §33: il count viene dall'insieme autorizzato, non dalle righe caricate.
       Senza righe non è zero: è «nessuna persona», che il server conferma. */
    totalCount: last ? integer(last.total_count, 0) : 0,
  };
}

export async function fetchJoinLinkPerson(input: {
  assignmentId: string;
  linkId: string;
}): Promise<JoinLinkPersonDetail> {
  const rows = await rpc<RawRecord[]>("fetch_team_join_link_person", {
    p_assignment_id: input.assignmentId,
    p_link_id: input.linkId,
  });

  const row = Array.isArray(rows) ? rows[0] : null;

  if (!row) {
    throw new JoinLinksAccessError("JOIN_LINK_ASSIGNMENT_NOT_FOUND");
  }

  return {
    accessVerifiedAt: millis(row.access_verified_at),
    assignmentId: text(row.assignment_id) ?? input.assignmentId,
    avatarUrl: text(row.avatar_url),
    canRemoveRole: bool(row.can_remove_role),
    clubIsVerified: bool(row.club_is_verified),
    clubLogoUrl: text(row.club_logo_url),
    clubName: text(row.club_name) ?? "",
    connectedAt: text(row.connected_at),
    isActive: text(row.status) === "active",
    personName: text(row.person_name) ?? "",
    profileId: text(row.profile_id) ?? "",
    roleLabel: text(row.role_label) ?? "",
    sourceAllowedProfileTypes: profileTypes(row.source_allowed_profile_types),
    sourceTeamName: text(row.source_team_name) ?? "",
    teamId: text(row.team_id) ?? "",
    teamName: text(row.team_name) ?? "",
  };
}

// ── Catalogo dei ruoli ──────────────────────────────────────────────────────

/**
 * §13 e §14: il catalogo è quello condiviso del prodotto. Non si duplica in
 * TypeScript, e le voci che il PNG non mostra restano disponibili.
 */
export async function fetchAssignmentRoles(): Promise<JoinAssignmentRoleCatalog> {
  const rows = await rpc<RawRecord[]>("fetch_club_assignment_roles", {});
  const list = Array.isArray(rows) ? rows : [];

  const roles = list.flatMap<JoinAssignmentRole>((raw) => {
    const id = text(raw.role_id);
    const type = profileType(raw.profile_type);

    return id && type
      ? [
          {
            id,
            isCustom: bool(raw.is_custom),
            label: text(raw.label) ?? id,
            profileType: type,
          },
        ]
      : [];
  });

  return {
    /* Il massimo è un valore del catalogo, non una costante del client. */
    customRoleMax: integer(list[0]?.custom_role_max, 60),
    roles,
  };
}

// ── Mutazioni gestionali ────────────────────────────────────────────────────

function mutationResult(
  data: unknown,
  fallbackId: string,
): JoinLinkMutationResult {
  const raw =
    typeof data === "object" && data !== null ? (data as RawRecord) : {};

  return {
    alreadyApplied: bool(raw.already_applied),
    linkId: text(raw.link_id) ?? fallbackId,
    revision: count(raw.revision),
    token: text(raw.token),
  };
}

export async function createJoinLink(input: {
  clubId: string;
  customExecutiveRole: string | null;
  executiveRoleIds: string[];
  expiresOn: string | null;
  maxRedemptions: number | null;
  operationKey: string;
  profileTypes: JoinProfileType[];
  teamId: string;
}): Promise<JoinLinkMutationResult> {
  const data = await rpc<unknown>("create_team_join_link", {
    p_club_id: input.clubId,
    p_custom_role: input.customExecutiveRole,
    p_executive_roles: input.executiveRoleIds,
    p_expires_on: input.expiresOn,
    p_idempotency_key: input.operationKey,
    p_max_redemptions: input.maxRedemptions,
    p_profile_types: input.profileTypes,
    p_team_id: input.teamId,
  });

  return mutationResult(data, "");
}

export async function updateJoinLinkExpiry(input: {
  expiresOn: string | null;
  linkId: string;
  operationKey: string;
  revision: number;
}): Promise<JoinLinkMutationResult> {
  const data = await rpc<unknown>("update_team_join_link_expiry", {
    p_expected_revision: input.revision,
    p_expires_on: input.expiresOn,
    p_idempotency_key: input.operationKey,
    p_link_id: input.linkId,
  });

  return mutationResult(data, input.linkId);
}

export async function updateJoinLinkLimit(input: {
  linkId: string;
  maxRedemptions: number | null;
  operationKey: string;
  revision: number;
}): Promise<JoinLinkMutationResult> {
  const data = await rpc<unknown>("update_team_join_link_limit", {
    p_expected_revision: input.revision,
    p_idempotency_key: input.operationKey,
    p_link_id: input.linkId,
    p_max_redemptions: input.maxRedemptions,
  });

  return mutationResult(data, input.linkId);
}

export async function revokeJoinLink(input: {
  linkId: string;
  operationKey: string;
  revision: number;
}): Promise<JoinLinkMutationResult> {
  const data = await rpc<unknown>("revoke_team_join_link", {
    p_expected_revision: input.revision,
    p_idempotency_key: input.operationKey,
    p_link_id: input.linkId,
  });

  return mutationResult(data, input.linkId);
}

export async function endJoinLinkAssignment(input: {
  assignmentId: string;
  linkId: string;
  operationKey: string;
}): Promise<{ alreadyApplied: boolean; assignmentId: string }> {
  const data = await rpc<unknown>("end_team_join_link_assignment", {
    p_assignment_id: input.assignmentId,
    p_idempotency_key: input.operationKey,
    p_link_id: input.linkId,
  });

  const raw =
    typeof data === "object" && data !== null ? (data as RawRecord) : {};

  return {
    alreadyApplied: bool(raw.already_applied),
    assignmentId: text(raw.assignment_id) ?? input.assignmentId,
  };
}

// ── Percorso del destinatario ───────────────────────────────────────────────

/**
 * Landing pubblica (§19).
 *
 * Il token sconosciuto e il link revocato tornano identici: il backend
 * conserva il motivo vero senza divulgarlo, e il client non ha modo di
 * distinguerli nemmeno volendo.
 */
export async function fetchJoinLinkPublicContext(
  token: string,
): Promise<JoinLinkPublicContext> {
  const rows = await rpc<RawRecord[]>("fetch_team_join_link_public", {
    p_token: token,
  });

  const row = Array.isArray(rows) ? rows[0] : null;

  if (!row) {
    return {
      allowedProfileTypes: [],
      clubIsVerified: false,
      clubLogoUrl: null,
      clubName: "",
      state: "unavailable",
      teamName: "",
    };
  }

  return {
    allowedProfileTypes: profileTypes(row.allowed_profile_types),
    clubIsVerified: bool(row.club_is_verified),
    clubLogoUrl: text(row.club_logo_url),
    clubName: text(row.club_name) ?? "",
    state: text(row.state) === "valid" ? "valid" : "unavailable",
    teamName: text(row.team_name) ?? "",
  };
}

const CONTEXT_STATES: readonly JoinContextState[] = [
  "valid",
  "unavailable",
  "incompatible_profile",
  "already_connected",
  "blocked_removed",
  "blocked_ended",
];

function contextState(value: unknown): JoinContextState {
  const raw = text(value);

  return raw && (CONTEXT_STATES as readonly string[]).includes(raw)
    ? (raw as JoinContextState)
    : "unavailable";
}

export async function resolveJoinContext(token: string): Promise<JoinContext> {
  const rows = await rpc<RawRecord[]>("resolve_team_join_context", {
    p_token: token,
  });

  const row = Array.isArray(rows) ? rows[0] : null;

  if (!row) {
    throw new JoinLinksAccessError("JOIN_LINK_UNAVAILABLE");
  }

  return {
    allowedExecutiveRoles: strings(row.allowed_executive_roles),
    allowedProfileTypes: profileTypes(row.allowed_profile_types),
    clubId: text(row.club_id),
    clubIsVerified: bool(row.club_is_verified),
    clubLogoUrl: text(row.club_logo_url),
    clubName: text(row.club_name),
    currentRoleLabel: text(row.current_role_label),
    eligibleProfileTypes: profileTypes(row.eligible_profile_types),
    executiveCustomRoleName: text(row.executive_custom_role_name),
    linkId: text(row.link_id),
    personAvatarUrl: text(row.person_avatar_url),
    personName: text(row.person_name),
    state: contextState(row.state),
    teamId: text(row.team_id),
    teamName: text(row.team_name),
  };
}

/**
 * L'unico consenso che crea il collegamento (§23).
 *
 * Il payload porta token, categoria, ruolo e chiave di idempotenza. Società,
 * squadra, persona, quota e capability non viaggiano: §39 li dichiara non
 * attendibili dal client, e il server li deriva dal contesto canonico.
 */
export async function redeemJoinLink(input: {
  customRole: string | null;
  operationKey: string;
  profileType: JoinProfileType;
  roleId: string;
  token: string;
}): Promise<JoinRedeemResult> {
  const data = await rpc<unknown>("redeem_team_join_link", {
    p_custom_role: input.customRole,
    p_idempotency_key: input.operationKey,
    p_profile_type: input.profileType,
    p_role_id: input.roleId,
    p_token: input.token,
  });

  const raw =
    typeof data === "object" && data !== null ? (data as RawRecord) : {};

  return {
    alreadyApplied: bool(raw.already_applied),
    assignmentId: text(raw.assignment_id),
    outcome:
      text(raw.outcome) === "already_connected"
        ? "already_connected"
        : "completed",
    roleLabel: text(raw.role_label),
  };
}
