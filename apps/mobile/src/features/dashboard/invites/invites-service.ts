/**
 * Accesso ai dati del Centro Inviti e richieste (§40, §41).
 *
 * Nessuna regola di dominio vive qui. Chi può leggere, chi può invitare,
 * quale Team è assegnabile, se una proposta è ancora accettabile: lo decide
 * il backend, che §8 obbliga a validare «sessione, actor autenticato,
 * società, membership, capability, scope, risorsa e stato corrente» a ogni
 * chiamata. Questo file traduce righe in tipi e scarta ciò che non sa
 * leggere.
 *
 * Il client non costruisce mai un payload di permessi né un destinatario:
 * §29 vuole che la risposta mandi «un riferimento all'invito, l'azione e i
 * soli metadata tecnici», e il modo di garantirlo è che il client non
 * possieda nemmeno la forma di nient'altro.
 */
import { supabase } from "../../../lib/supabase";
import { DashboardTimeoutError } from "../state/error-classification";
import { MODULE_TIMEOUT_MS, withTimeout } from "../state/retry-policy";
import type {
  AssignableTeam,
  AssignmentRole,
  AssignmentRoleCatalog,
  InviteCandidate,
  InviteCandidatePage,
  InviteFilterTeam,
  InviteMutationResult,
  InviteProfileType,
  InviteRecordState,
  InviteRow,
  InviteScopeType,
  InvitesCenter,
  InvitesFilter,
  InvitesPage,
  InvitesSection,
  InvitesTab,
  MyInvite,
  ReceivedRequestDetail,
  SentInviteDetail,
} from "./invites-types";

/**
 * Codici applicativi sollevati dalle RPC. Sono stringhe stabili, non
 * messaggi: §38 tiene la copy nel livello di presentazione, perché lo stesso
 * codice compare in schermate diverse con parole diverse.
 */
export type InvitesErrorCode =
  | "INVITES_CENTER_NOT_AUTHORIZED"
  | "INVITES_CURSOR_INVALID"
  | "INVITES_FILTER_INVALID"
  | "INVITES_FILTER_NOT_AUTHORIZED"
  | "INVITES_NOT_AUTHORIZED"
  | "INVITES_SECTION_INVALID"
  | "INVITE_ALREADY_ACCEPTED"
  | "INVITE_ALREADY_LINKED"
  | "INVITE_ALREADY_PENDING"
  | "INVITE_ALREADY_RESOLVED"
  | "INVITE_CUSTOM_ROLE_REQUIRED"
  | "INVITE_CUSTOM_ROLE_TOO_LONG"
  | "INVITE_NOT_ACCEPTABLE"
  | "INVITE_NOT_AVAILABLE"
  | "INVITE_RECIPIENT_INELIGIBLE"
  | "INVITE_RECIPIENT_INVALID"
  | "INVITE_REQUEST_PENDING"
  | "INVITE_REVISION_CONFLICT"
  | "INVITE_ROLE_UNAVAILABLE"
  | "INVITE_SCOPE_INVALID"
  | "INVITE_TEAM_UNAVAILABLE"
  | "OPERATION_CONTENT_CHANGED"
  | "RATE_LIMIT"
  | "REQUEST_NOT_AVAILABLE"
  | "TEAM_NOT_ACTIVE"
  | "UNKNOWN";

const ERROR_CODES: readonly InvitesErrorCode[] = [
  "INVITES_CENTER_NOT_AUTHORIZED",
  "INVITES_CURSOR_INVALID",
  "INVITES_FILTER_INVALID",
  "INVITES_FILTER_NOT_AUTHORIZED",
  "INVITES_NOT_AUTHORIZED",
  "INVITES_SECTION_INVALID",
  "INVITE_ALREADY_ACCEPTED",
  "INVITE_ALREADY_LINKED",
  "INVITE_ALREADY_PENDING",
  "INVITE_ALREADY_RESOLVED",
  "INVITE_CUSTOM_ROLE_REQUIRED",
  "INVITE_CUSTOM_ROLE_TOO_LONG",
  "INVITE_NOT_ACCEPTABLE",
  "INVITE_NOT_AVAILABLE",
  "INVITE_RECIPIENT_INELIGIBLE",
  "INVITE_RECIPIENT_INVALID",
  "INVITE_REQUEST_PENDING",
  "INVITE_REVISION_CONFLICT",
  "INVITE_ROLE_UNAVAILABLE",
  "INVITE_SCOPE_INVALID",
  "INVITE_TEAM_UNAVAILABLE",
  "OPERATION_CONTENT_CHANGED",
  "RATE_LIMIT",
  "REQUEST_NOT_AVAILABLE",
  "TEAM_NOT_ACTIVE",
] as const;

export class InvitesAccessError extends Error {
  code: InvitesErrorCode;

  constructor(code: InvitesErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = "InvitesAccessError";
  }
}

export function toInvitesError(error: unknown): InvitesAccessError {
  if (error instanceof InvitesAccessError) {
    return error;
  }

  /* Un timeout non è un rifiuto autorizzativo: §37 vieta di ritentare
     all'infinito il secondo e impone di ritentare il primo. Confonderli
     produrrebbe esattamente il comportamento sbagliato su entrambi. */
  if (error instanceof DashboardTimeoutError) {
    throw error;
  }

  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error ?? "");

  /* I codici più lunghi vanno confrontati per primi: `INVITE_ALREADY_PENDING`
     contiene `INVITE_ALREADY_...` e un ordine arbitrario li confonderebbe. */
  const matched = [...ERROR_CODES]
    .sort((a, b) => b.length - a.length)
    .find((code) => message.includes(code));

  return new InvitesAccessError(matched ?? "UNKNOWN", message);
}

type RawRecord = Record<string, unknown>;

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function bool(value: unknown): boolean {
  return value === true;
}

/** `null` resta `null` (§12): un dato non leggibile non è uno zero. */
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

const PROFILE_TYPES: readonly InviteProfileType[] = [
  "player",
  "coach",
  "staff",
  "director",
];

function profileType(value: unknown): InviteProfileType | null {
  const raw = text(value);

  return raw && (PROFILE_TYPES as readonly string[]).includes(raw)
    ? (raw as InviteProfileType)
    : null;
}

function scopeType(value: unknown): InviteScopeType {
  return text(value) === "society" ? "society" : "team";
}

const STATES: readonly InviteRecordState[] = [
  "pending",
  "accepted",
  "declined",
  "cancelled",
  "approved",
  "superseded",
];

function recordState(value: unknown): InviteRecordState | null {
  const raw = text(value);

  return raw && (STATES as readonly string[]).includes(raw)
    ? (raw as InviteRecordState)
    : null;
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
    throw toInvitesError(error);
  }

  return data as T;
}

// ── Composizione del Centro ─────────────────────────────────────────────────

export async function fetchInvitesCenter(clubId: string): Promise<InvitesCenter> {
  const rows = await rpc<RawRecord[]>("fetch_society_invites_center", {
    p_club_id: clubId,
  });

  const row = Array.isArray(rows) ? rows[0] : null;

  if (!row) {
    throw new InvitesAccessError("INVITES_CENTER_NOT_AUTHORIZED");
  }

  return {
    accessVerifiedAt: row.access_verified_at
      ? new Date(String(row.access_verified_at)).getTime()
      : Date.now(),
    canCancel: bool(row.can_cancel),
    canInvite: bool(row.can_invite),
    canViewRequests: bool(row.can_view_requests),
    canViewSent: bool(row.can_view_sent),
    clubId: text(row.club_id) ?? clubId,
    clubIsVerified: bool(row.club_is_verified),
    clubLogoUrl: text(row.club_logo_url),
    clubName: text(row.club_name) ?? "",
    dataRevision: integer(row.data_revision, 0),
    requestsPendingCount: count(row.requests_pending_count),
    scopeLabel: text(row.scope_label),
    sentPendingCount: count(row.sent_pending_count),
  };
}

export async function fetchInviteFilterTeams(
  clubId: string,
): Promise<InviteFilterTeam[]> {
  const raw = await rpc<RawRecord[]>("fetch_society_invite_filter_teams", {
    p_club_id: clubId,
  });

  return (Array.isArray(raw) ? raw : []).flatMap((row) => {
    const teamId = text(row.team_id);

    return teamId
      ? [
          {
            isInactive: bool(row.is_inactive),
            label: text(row.label) ?? "",
            teamId,
          },
        ]
      : [];
  });
}

// ── Pagina ──────────────────────────────────────────────────────────────────

export const INVITES_PAGE_SIZE = 20;

function mapRow(row: RawRecord): InviteRow | null {
  const id = text(row.record_id);
  const state = recordState(row.state);
  const kind = text(row.record_kind);
  const personProfileId = text(row.person_profile_id);

  if (!id || !state || !personProfileId || (kind !== "invite" && kind !== "request")) {
    return null;
  }

  return {
    avatarUrl: text(row.person_avatar_url),
    contextLabel: text(row.context_label),
    id,
    isUnread: bool(row.is_unread),
    kind,
    personName: text(row.person_name) ?? "",
    personProfileId,
    roleLabel: text(row.role_label) ?? "",
    scopeType: scopeType(row.scope_type),
    state,
    stateAt: text(row.state_at),
    teamId: text(row.team_id),
    teamIsInactive: bool(row.team_is_inactive),
  };
}

export async function fetchInvitesPage(input: {
  clubId: string;
  cursor?: string | null;
  filter: InvitesFilter;
  limit?: number;
  section: InvitesSection;
  tab: InvitesTab;
}): Promise<InvitesPage> {
  const limit = input.limit ?? INVITES_PAGE_SIZE;

  const rows = await rpc<RawRecord[]>("fetch_society_invites_page", {
    p_club_id: input.clubId,
    p_cursor: input.cursor ?? null,
    p_limit: limit,
    p_scope_mode: input.filter.kind === "teams" ? "teams" : "all",
    p_section: input.section,
    p_tab: input.tab,
    p_team_ids: input.filter.kind === "teams" ? input.filter.teamIds : null,
  });

  const list = Array.isArray(rows) ? rows : [];
  const last = list[list.length - 1];

  return {
    /* Una pagina piena **può** avere un seguito; una pagina corta no. §13
       vieta di dedurre la fine dall'assenza di un cursore, che il server
       emette su ogni riga. */
    hasMore: list.length >= limit,
    nextCursor: last ? text(last.next_cursor) : null,
    rows: list
      .map(mapRow)
      .filter((row): row is InviteRow => row !== null),
  };
}

// ── Composer ────────────────────────────────────────────────────────────────

export async function fetchAssignmentRoles(): Promise<AssignmentRoleCatalog> {
  const raw = await rpc<RawRecord[]>("fetch_club_assignment_roles", {});
  const list = Array.isArray(raw) ? raw : [];

  const roles: AssignmentRole[] = list.flatMap((row) => {
    const roleId = text(row.role_id);
    const type = profileType(row.profile_type);

    return roleId && type
      ? [
          {
            isCustom: bool(row.is_custom),
            label: text(row.label) ?? "",
            profileType: type,
            roleId,
          },
        ]
      : [];
  });

  return {
    /* Il limite viene dal catalogo, non da una costante del client: due
       numeri diversi fanno un form che accetta ciò che la RPC rifiuta. */
    customRoleMax: integer(list[0]?.custom_role_max, 60),
    roles,
  };
}

export async function fetchAssignableTeams(
  clubId: string,
): Promise<AssignableTeam[]> {
  const raw = await rpc<RawRecord[]>("fetch_member_invite_assignable_teams", {
    p_club_id: clubId,
  });

  return (Array.isArray(raw) ? raw : []).flatMap((row) => {
    const teamId = text(row.team_id);

    return teamId
      ? [
          {
            category: text(row.category),
            label: text(row.label) ?? "",
            teamId,
          },
        ]
      : [];
  });
}

export async function searchInviteCandidates(input: {
  clubId: string;
  limit?: number;
  offset?: number;
  query: string;
}): Promise<InviteCandidatePage> {
  const raw = await rpc<RawRecord[]>("search_society_member_candidates", {
    p_club_id: input.clubId,
    p_limit: input.limit ?? 20,
    p_offset: input.offset ?? 0,
    p_query: input.query,
  });

  const list = Array.isArray(raw) ? raw : [];

  const rows: InviteCandidate[] = list.flatMap((row) => {
    const profileId = text(row.profile_id);
    const type = profileType(row.profile_type);
    const fullName = text(row.full_name);

    return profileId && type && fullName
      ? [
          {
            avatarUrl: text(row.avatar_url),
            city: text(row.city),
            fullName,
            profileId,
            profileType: type,
            specialty: text(row.specialty),
          },
        ]
      : [];
  });

  return {
    rows,
    total: count(list[0]?.total_count) ?? rows.length,
  };
}

// ── Dettagli ────────────────────────────────────────────────────────────────

export async function fetchSentInvite(
  inviteId: string,
): Promise<SentInviteDetail> {
  const raw = await rpc<RawRecord[]>("fetch_society_member_invite", {
    p_invite_id: inviteId,
  });

  const row = Array.isArray(raw) ? raw[0] : null;
  const state = row ? recordState(row.state) : null;

  if (!row || !state) {
    throw new InvitesAccessError("INVITE_NOT_AVAILABLE");
  }

  return {
    canCancel: bool(row.can_cancel),
    clubId: text(row.club_id) ?? "",
    clubIsVerified: bool(row.club_is_verified),
    clubLogoUrl: text(row.club_logo_url),
    clubName: text(row.club_name) ?? "",
    contextLabel: text(row.context_label),
    createdAt: text(row.created_at),
    inviteId: text(row.invite_id) ?? inviteId,
    personAvatarUrl: text(row.person_avatar_url),
    personName: text(row.person_name) ?? "",
    personProfileId: text(row.person_profile_id) ?? "",
    profileType: profileType(row.profile_type) ?? "player",
    resolvedAt: text(row.resolved_at),
    revision: integer(row.revision, 1),
    roleLabel: text(row.role_label) ?? "",
    scopeType: scopeType(row.scope_type),
    state,
    teamId: text(row.team_id),
    teamIsInactive: bool(row.team_is_inactive),
  };
}

export async function fetchReceivedRequest(
  requestId: string,
): Promise<ReceivedRequestDetail> {
  const raw = await rpc<RawRecord[]>("fetch_society_member_request", {
    p_request_id: requestId,
  });

  const row = Array.isArray(raw) ? raw[0] : null;
  const state = row ? recordState(row.state) : null;

  if (!row || !state) {
    throw new InvitesAccessError("REQUEST_NOT_AVAILABLE");
  }

  return {
    clubId: text(row.club_id) ?? "",
    clubIsVerified: bool(row.club_is_verified),
    clubLogoUrl: text(row.club_logo_url),
    clubName: text(row.club_name) ?? "",
    contextLabel: text(row.context_label),
    createdAt: text(row.created_at),
    isUnread: bool(row.is_unread),
    personAvatarUrl: text(row.person_avatar_url),
    personName: text(row.person_name) ?? "",
    personProfileId: text(row.person_profile_id) ?? "",
    requestId: text(row.request_id) ?? requestId,
    resolvedAt: text(row.resolved_at),
    roleLabel: text(row.role_label) ?? "",
    scopeType: scopeType(row.scope_type),
    state,
    teamId: text(row.team_id),
  };
}

export async function markRequestRead(requestId: string): Promise<void> {
  await rpc<null>("mark_society_member_request_read", {
    p_request_id: requestId,
  });
}

export async function fetchMyInvite(inviteId: string): Promise<MyInvite> {
  const raw = await rpc<RawRecord[]>("fetch_my_member_invite", {
    p_invite_id: inviteId,
  });

  const row = Array.isArray(raw) ? raw[0] : null;

  if (!row) {
    throw new InvitesAccessError("INVITE_NOT_AVAILABLE");
  }

  return {
    assignmentActive: bool(row.assignment_active),
    canRespond: bool(row.can_respond),
    clubCity: text(row.club_city),
    clubId: text(row.club_id) ?? "",
    clubIsVerified: bool(row.club_is_verified),
    clubLogoUrl: text(row.club_logo_url),
    clubName: text(row.club_name) ?? "",
    contextLabel: text(row.context_label),
    createdAt: text(row.created_at),
    inviteId: text(row.invite_id) ?? inviteId,
    profileType: profileType(row.profile_type) ?? "player",
    resolvedAt: text(row.resolved_at),
    revision: integer(row.revision, 1),
    roleLabel: text(row.role_label) ?? "",
    scopeType: scopeType(row.scope_type),
    state: recordState(row.state) ?? 'pending',
    teamId: text(row.team_id),
    teamName: text(row.team_name),
  };
}

// ── Comandi ─────────────────────────────────────────────────────────────────

function mutationResult(
  data: unknown,
  fallbackId: string,
): InviteMutationResult {
  const row = (data ?? {}) as RawRecord;

  return {
    alreadyApplied: bool(row.already_applied),
    assignmentId: text(row.assignment_id),
    inviteId: text(row.invite_id) ?? fallbackId,
    resolvedAt: text(row.resolved_at),
    revision: integer(row.revision, 1),
    state: recordState(row.status) ?? "pending",
  };
}

export async function createMemberInvite(input: {
  clubId: string;
  customRole: string | null;
  operationKey: string;
  profileId: string;
  roleId: string;
  scopeType: InviteScopeType;
  teamId: string | null;
}): Promise<InviteMutationResult> {
  const data = await rpc<unknown>("create_society_member_invite", {
    p_club_id: input.clubId,
    p_custom_role: input.customRole,
    p_idempotency_key: input.operationKey,
    p_profile_id: input.profileId,
    p_role_id: input.roleId,
    p_scope_type: input.scopeType,
    p_team_id: input.teamId,
  });

  return mutationResult(data, "");
}

export async function cancelMemberInvite(input: {
  inviteId: string;
  operationKey: string;
  revision: number;
}): Promise<InviteMutationResult> {
  const data = await rpc<unknown>("cancel_society_member_invite", {
    p_expected_revision: input.revision,
    p_idempotency_key: input.operationKey,
    p_invite_id: input.inviteId,
  });

  return mutationResult(data, input.inviteId);
}

export async function respondToMemberInvite(input: {
  accept: boolean;
  inviteId: string;
  operationKey: string;
  revision: number;
}): Promise<InviteMutationResult> {
  const data = await rpc<unknown>("respond_to_member_invite", {
    p_accept: input.accept,
    p_expected_revision: input.revision,
    p_idempotency_key: input.operationKey,
    p_invite_id: input.inviteId,
  });

  return mutationResult(data, input.inviteId);
}
