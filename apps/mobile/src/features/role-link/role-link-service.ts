/**
 * Accesso ai dati del collegamento Persona–Società (§8, §47).
 *
 * Nessuna regola di dominio vive qui. Chi può leggere, chi può approvare,
 * quale squadra è assegnabile, se un incarico è ancora modificabile: lo
 * decide il backend, che §8 obbliga a verificare «sessione, actor, identità
 * operativa, società, persona, risorsa, stato, capability e ambito
 * applicabile» a ogni chiamata.
 *
 * Il client non costruisce mai un `person_id`: §8 — «Il person_id delle
 * azioni personali deriva dalla sessione; non fidarti di un person_id
 * arbitrario nel payload». Le funzioni personali di questo file non hanno
 * nemmeno il parametro.
 */
import { supabase } from "../../lib/supabase";
import type {
  AssignmentEndResult,
  AssignmentMutationResult,
  MyRoleRequest,
  MyRoleRequestSummary,
  MySocietyLink,
  MySocietyRow,
  RelationshipEndResult,
  RoleAssignmentDetail,
  RoleAssignmentRow,
  RoleCatalog,
  RoleIdentity,
  RoleLinkBlock,
  RoleLinkBlockState,
  RoleProfileType,
  RoleRequestMutationResult,
  RoleRequestStatus,
  RoleScopeType,
  RoleTeamOption,
  SocietyAssignmentDetail,
  SocietyPersonLink,
  SocietyRoleRequest,
  SocietyWideMember,
} from "./role-link-types";

/**
 * Codici applicativi sollevati dalle RPC. Stringhe stabili, non messaggi:
 * §45 tiene la copy nel livello di presentazione, perché lo stesso codice
 * compare in schermate diverse con parole diverse.
 *
 * Due portano un payload dopo i due punti — l'ID del record che la UI deve
 * aprire invece di ripetere l'errore (§16).
 */
export type RoleLinkErrorCode =
  | "ASSIGNMENT_ALREADY_PRESENT"
  | "ASSIGNMENT_CUSTOM_ROLE_REQUIRED"
  | "ASSIGNMENT_CUSTOM_ROLE_TOO_LONG"
  | "ASSIGNMENT_NOT_ACTIVE"
  | "ASSIGNMENT_NOT_AUTHORIZED"
  | "ASSIGNMENT_NOT_FOUND"
  | "ASSIGNMENT_PROFILE_INVALID"
  | "ASSIGNMENT_RESTORE_NOT_AVAILABLE"
  | "ASSIGNMENT_RESTORE_TEAM_UNAVAILABLE"
  | "ASSIGNMENT_REVISION_CONFLICT"
  | "ASSIGNMENT_ROLE_INVALID"
  | "ASSIGNMENT_SCOPE_INVALID"
  | "ASSIGNMENT_TEAM_REQUIRED"
  | "ASSIGNMENT_TEAM_UNAVAILABLE"
  | "OPERATION_CONTENT_CHANGED"
  | "ROLE_LINK_CLUB_NOT_FOUND"
  | "ROLE_LINK_COMPOSITION_CHANGED"
  | "ROLE_LINK_NOT_ACTIVE"
  | "ROLE_LINK_NOT_AUTHORIZED"
  | "ROLE_LINK_NOT_FOUND"
  | "ROLE_LINK_REMOVE_NOT_AUTHORIZED"
  | "ROLE_LINK_USE_LEAVE"
  | "ROLE_REQUEST_ALREADY_ASSIGNED"
  | "ROLE_REQUEST_DUPLICATE"
  | "ROLE_REQUEST_INVITE_EXISTS"
  | "ROLE_REQUEST_NOT_AUTHORIZED"
  | "ROLE_REQUEST_NOT_FOUND"
  | "ROLE_REQUEST_PROFILE_INVALID"
  | "ROLE_REQUEST_REVISION_CONFLICT"
  | "ROLE_REQUEST_ROLE_INVALID"
  | "ROLE_REQUEST_SCOPE_INVALID"
  | "ROLE_REQUEST_TEAM_REQUIRED"
  | "ROLE_REQUEST_TEAM_UNAVAILABLE"
  | "TEAM_NOT_ACTIVE"
  | "UNKNOWN";

const ERROR_CODES: readonly RoleLinkErrorCode[] = [
  "ASSIGNMENT_ALREADY_PRESENT",
  "ASSIGNMENT_CUSTOM_ROLE_REQUIRED",
  "ASSIGNMENT_CUSTOM_ROLE_TOO_LONG",
  "ASSIGNMENT_NOT_ACTIVE",
  "ASSIGNMENT_NOT_AUTHORIZED",
  "ASSIGNMENT_NOT_FOUND",
  "ASSIGNMENT_PROFILE_INVALID",
  "ASSIGNMENT_RESTORE_NOT_AVAILABLE",
  "ASSIGNMENT_RESTORE_TEAM_UNAVAILABLE",
  "ASSIGNMENT_REVISION_CONFLICT",
  "ASSIGNMENT_ROLE_INVALID",
  "ASSIGNMENT_SCOPE_INVALID",
  "ASSIGNMENT_TEAM_REQUIRED",
  "ASSIGNMENT_TEAM_UNAVAILABLE",
  "OPERATION_CONTENT_CHANGED",
  "ROLE_LINK_CLUB_NOT_FOUND",
  "ROLE_LINK_COMPOSITION_CHANGED",
  "ROLE_LINK_NOT_ACTIVE",
  "ROLE_LINK_NOT_AUTHORIZED",
  "ROLE_LINK_NOT_FOUND",
  "ROLE_LINK_REMOVE_NOT_AUTHORIZED",
  "ROLE_LINK_USE_LEAVE",
  "ROLE_REQUEST_ALREADY_ASSIGNED",
  "ROLE_REQUEST_DUPLICATE",
  "ROLE_REQUEST_INVITE_EXISTS",
  "ROLE_REQUEST_NOT_AUTHORIZED",
  "ROLE_REQUEST_NOT_FOUND",
  "ROLE_REQUEST_PROFILE_INVALID",
  "ROLE_REQUEST_REVISION_CONFLICT",
  "ROLE_REQUEST_ROLE_INVALID",
  "ROLE_REQUEST_SCOPE_INVALID",
  "ROLE_REQUEST_TEAM_REQUIRED",
  "ROLE_REQUEST_TEAM_UNAVAILABLE",
  "TEAM_NOT_ACTIVE",
] as const;

export class RoleLinkError extends Error {
  code: RoleLinkErrorCode;

  /**
   * §16: due casi non sono errori da mostrare ma destinazioni da aprire —
   * «Apri la richiesta esistente; non duplicarla» e «Visualizza invito».
   * L'ID del record viaggia con il codice, non in un secondo round-trip.
   */
  recordId: string | null;

  constructor(code: RoleLinkErrorCode, message?: string, recordId?: string | null) {
    super(message ?? code);
    this.code = code;
    this.name = "RoleLinkError";
    this.recordId = recordId ?? null;
  }
}

export function toRoleLinkError(error: unknown): RoleLinkError {
  if (error instanceof RoleLinkError) {
    return error;
  }

  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error ?? "");

  /* I codici più lunghi per primi: `ROLE_LINK_NOT_AUTHORIZED` contiene
     `ROLE_LINK_NOT_...` e un ordine arbitrario li confonderebbe. */
  const matched = [...ERROR_CODES]
    .sort((a, b) => b.length - a.length)
    .find((code) => message.includes(code));

  if (!matched) {
    return new RoleLinkError("UNKNOWN", message);
  }

  const withId = new RegExp(`${matched}:([0-9a-fA-F-]{36})`).exec(message);

  return new RoleLinkError(matched, message, withId?.[1] ?? null);
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);

  if (error) throw toRoleLinkError(error);

  return data as T;
}

type RawRecord = Record<string, unknown>;

function rows(value: unknown): RawRecord[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is RawRecord => !!item && typeof item === "object",
      )
    : [];
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function bool(value: unknown): boolean {
  return value === true;
}

function integer(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value)) return Number(value);

  return fallback;
}

const PROFILE_TYPES: readonly RoleProfileType[] = [
  "player",
  "coach",
  "staff",
  "director",
];

function profileType(value: unknown): RoleProfileType | null {
  const raw = text(value);

  return raw && (PROFILE_TYPES as readonly string[]).includes(raw)
    ? (raw as RoleProfileType)
    : null;
}

function scopeType(value: unknown): RoleScopeType {
  return text(value) === "society" ? "society" : "team";
}

const REQUEST_STATES: readonly RoleRequestStatus[] = [
  "pending",
  "approved",
  "declined",
  "cancelled",
  "superseded",
];

/**
 * §48: «Un client meno recente non deve tradurre uno stato sconosciuto in
 * PENDING azionabile.» Uno stato non riconosciuto diventa `superseded` —
 * terminale e non azionabile — e non `pending`.
 */
function requestStatus(value: unknown): RoleRequestStatus {
  const raw = text(value);

  return raw && (REQUEST_STATES as readonly string[]).includes(raw)
    ? (raw as RoleRequestStatus)
    : "superseded";
}

const BLOCK_STATES: readonly RoleLinkBlockState[] = [
  "ineligible",
  "none",
  "pending",
  "pending_many",
  "active",
];

// ── Screen 01: blocco contestuale ────────────────────────────────────────

export async function fetchRoleLinkBlock(
  clubId: string,
): Promise<RoleLinkBlock | null> {
  const data = await rpc<unknown>("fetch_society_role_link_state", {
    p_club_id: clubId,
  });
  const row = rows(data)[0];

  if (!row) return null;

  const raw = text(row.state);

  return {
    activeCount: integer(row.active_count, 0),
    activeSummary: text(row.active_summary),
    canRequest: bool(row.can_request),
    clubCity: text(row.club_city),
    clubIsVerified: bool(row.club_is_verified),
    clubLogoUrl: text(row.club_logo_url),
    clubName: text(row.club_name) ?? "",
    clubRegion: text(row.club_region),
    pendingCount: integer(row.pending_count, 0),
    requestContext: text(row.request_context),
    requestId: text(row.request_id),
    requestRoleLabel: text(row.request_role_label),
    state:
      raw && (BLOCK_STATES as readonly string[]).includes(raw)
        ? (raw as RoleLinkBlockState)
        : "ineligible",
  };
}

// ── Screen 02-05: materiali del form ─────────────────────────────────────

export async function fetchRoleIdentities(): Promise<RoleIdentity[]> {
  const data = await rpc<unknown>("fetch_role_request_identities", {});

  return rows(data)
    .map((row) => {
      const type = profileType(row.profile_type);

      return type ? { label: text(row.label) ?? type, profileType: type } : null;
    })
    .filter((item): item is RoleIdentity => item !== null);
}

export async function fetchRoleTeams(clubId: string): Promise<RoleTeamOption[]> {
  const data = await rpc<unknown>("fetch_role_request_teams", {
    p_club_id: clubId,
  });

  return rows(data)
    .map((row) => {
      const id = text(row.team_id);

      return id
        ? {
            category: text(row.category),
            label: text(row.label) ?? "",
            teamId: id,
          }
        : null;
    })
    .filter((item): item is RoleTeamOption => item !== null);
}

/**
 * Catalogo condiviso dei ruoli (§9).
 *
 * È la RPC di DAS-REV-19: §9 vieta «un secondo elenco di ruoli per la
 * gestione», quindi non ne esiste una nuova.
 */
export async function fetchRoleCatalog(): Promise<RoleCatalog> {
  const data = await rpc<unknown>("fetch_club_assignment_roles", {});
  const list = rows(data);

  return {
    customRoleMax: integer(list[0]?.custom_role_max, 60),
    roles: list
      .map((row) => {
        const id = text(row.role_id);
        const type = profileType(row.profile_type);

        return id && type
          ? {
              isCustom: bool(row.is_custom),
              label: text(row.label) ?? "",
              profileType: type,
              roleId: id,
            }
          : null;
      })
      .filter((item): item is RoleCatalog["roles"][number] => item !== null),
  };
}

// ── Screen 06-08: richiesta personale ────────────────────────────────────

export async function createRoleRequest(input: {
  clubId: string;
  customRole: string | null;
  operationKey: string;
  profileType: RoleProfileType;
  roleId: string;
  scopeType: RoleScopeType;
  teamId: string | null;
}): Promise<RoleRequestMutationResult> {
  const data = await rpc<RawRecord>("create_role_confirmation_request", {
    p_club_id: input.clubId,
    p_custom_role: input.customRole,
    p_idempotency_key: input.operationKey,
    p_profile_type: input.profileType,
    p_role_id: input.roleId,
    p_scope_type: input.scopeType,
    p_team_id: input.scopeType === "team" ? input.teamId : null,
  });

  return mapRequestMutation(data, "");
}

export async function fetchMyRoleRequest(
  requestId: string,
): Promise<MyRoleRequest | null> {
  const data = await rpc<unknown>("fetch_my_role_request", {
    p_request_id: requestId,
  });
  const row = rows(data)[0];

  if (!row) return null;

  return {
    canCancel: bool(row.can_cancel),
    clubCity: text(row.club_city),
    clubId: text(row.club_id) ?? "",
    clubIsVerified: bool(row.club_is_verified),
    clubLogoUrl: text(row.club_logo_url),
    clubName: text(row.club_name) ?? "",
    clubRegion: text(row.club_region),
    contextLabel: text(row.context_label),
    createdAt: text(row.created_at),
    profileType: profileType(row.profile_type),
    requestId: text(row.request_id) ?? requestId,
    resolvedAt: text(row.resolved_at),
    revision: integer(row.revision, 1),
    roleLabel: text(row.role_label) ?? "",
    scopeType: scopeType(row.scope_type),
    status: requestStatus(row.status),
    teamId: text(row.team_id),
    teamUnavailable: bool(row.team_unavailable),
  };
}

export async function fetchMyClubRoleRequests(
  clubId: string,
): Promise<MyRoleRequestSummary[]> {
  const data = await rpc<unknown>("fetch_my_club_role_requests", {
    p_club_id: clubId,
  });

  return rows(data)
    .map((row) => {
      const id = text(row.request_id);

      return id
        ? {
            contextLabel: text(row.context_label),
            createdAt: text(row.created_at),
            requestId: id,
            roleLabel: text(row.role_label) ?? "",
            status: requestStatus(row.status),
          }
        : null;
    })
    .filter((item): item is MyRoleRequestSummary => item !== null);
}

export async function cancelMyRoleRequest(input: {
  expectedRevision: number;
  operationKey: string;
  requestId: string;
}): Promise<RoleRequestMutationResult> {
  const data = await rpc<RawRecord>("cancel_my_role_request", {
    p_expected_revision: input.expectedRevision,
    p_idempotency_key: input.operationKey,
    p_request_id: input.requestId,
  });

  return mapRequestMutation(data, input.requestId);
}

// ── Screen 10-12: decisione societaria ───────────────────────────────────

export async function fetchSocietyRoleRequest(
  requestId: string,
): Promise<SocietyRoleRequest | null> {
  const data = await rpc<unknown>("fetch_society_role_request", {
    p_request_id: requestId,
  });
  const row = rows(data)[0];

  if (!row) return null;

  return {
    canResolve: bool(row.can_resolve),
    canViewPerson: bool(row.can_view_person),
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
    profileType: profileType(row.profile_type),
    requestId: text(row.request_id) ?? requestId,
    resolvedAt: text(row.resolved_at),
    revision: integer(row.revision, 1),
    roleLabel: text(row.role_label) ?? "",
    scopeType: scopeType(row.scope_type),
    status: requestStatus(row.status),
    teamId: text(row.team_id),
    teamUnavailable: bool(row.team_unavailable),
  };
}

export async function markSocietyRoleRequestRead(
  requestId: string,
): Promise<void> {
  await rpc<unknown>("mark_society_role_request_read", {
    p_request_id: requestId,
  });
}

export async function approveRoleRequest(input: {
  expectedRevision: number;
  operationKey: string;
  requestId: string;
}): Promise<RoleRequestMutationResult & { contextLabel: string | null; personName: string | null; roleLabel: string | null }> {
  const data = await rpc<RawRecord>("approve_role_request", {
    p_expected_revision: input.expectedRevision,
    p_idempotency_key: input.operationKey,
    p_request_id: input.requestId,
  });

  return {
    ...mapRequestMutation(data, input.requestId),
    contextLabel: text(data?.context_label),
    personName: text(data?.person_name),
    roleLabel: text(data?.role_label),
  };
}

export async function declineRoleRequest(input: {
  expectedRevision: number;
  operationKey: string;
  requestId: string;
}): Promise<RoleRequestMutationResult> {
  const data = await rpc<RawRecord>("decline_role_request", {
    p_expected_revision: input.expectedRevision,
    p_idempotency_key: input.operationKey,
    p_request_id: input.requestId,
  });

  return mapRequestMutation(data, input.requestId);
}

function mapRequestMutation(
  data: RawRecord | null,
  fallbackId: string,
): RoleRequestMutationResult {
  return {
    alreadyApplied: bool(data?.already_applied),
    assignmentId: text(data?.assignment_id),
    requestId: text(data?.request_id) ?? fallbackId,
    revision: integer(data?.revision, 1),
    status: requestStatus(data?.status),
  };
}

// ── Screen 13-15: Società e ruoli ────────────────────────────────────────

export async function fetchMySocieties(): Promise<MySocietyRow[]> {
  const data = await rpc<unknown>("fetch_my_societies", {});

  return rows(data)
    .map((row) => {
      const id = text(row.club_id);

      return id
        ? {
            activeCount: integer(row.active_count, 0),
            clubCity: text(row.club_city),
            clubId: id,
            clubIsVerified: bool(row.club_is_verified),
            clubLogoUrl: text(row.club_logo_url),
            clubName: text(row.club_name) ?? "",
            roleLines: Array.isArray(row.role_lines)
              ? row.role_lines.filter(
                  (line): line is string => typeof line === "string",
                )
              : [],
          }
        : null;
    })
    .filter((item): item is MySocietyRow => item !== null);
}

export async function fetchMySocietyLink(
  clubId: string,
): Promise<MySocietyLink | null> {
  const data = await rpc<unknown>("fetch_my_society_roles", {
    p_club_id: clubId,
  });
  const list = rows(data);
  const head = list[0];

  if (!head) return null;

  return {
    activeCount: integer(head.active_count, list.length),
    aggregateRevision: integer(head.aggregate_revision, 1),
    clubCity: text(head.club_city),
    clubId: text(head.club_id) ?? clubId,
    clubIsVerified: bool(head.club_is_verified),
    clubLogoUrl: text(head.club_logo_url),
    clubName: text(head.club_name) ?? "",
    membershipId: text(head.membership_id),
    roles: list
      .map(mapAssignmentRow)
      .filter((item): item is RoleAssignmentRow => item !== null),
  };
}

function mapAssignmentRow(row: RawRecord): RoleAssignmentRow | null {
  const id = text(row.assignment_id);

  return id
    ? {
        assignmentId: id,
        contextLabel: text(row.context_label),
        lineageId: text(row.lineage_id) ?? id,
        profileType: profileType(row.profile_type),
        revision: integer(row.revision, 1),
        roleLabel: text(row.role_label) ?? "",
        scopeType: scopeType(row.scope_type),
        teamId: text(row.team_id),
        teamIsInactive: bool(row.team_is_inactive),
      }
    : null;
}

export async function fetchMyAssignment(
  assignmentId: string,
): Promise<RoleAssignmentDetail | null> {
  const data = await rpc<unknown>("fetch_my_assignment", {
    p_assignment_id: assignmentId,
  });
  const row = rows(data)[0];

  return row ? mapAssignmentDetail(row, assignmentId) : null;
}

function mapAssignmentDetail(
  row: RawRecord,
  fallbackId: string,
): RoleAssignmentDetail {
  return {
    assignmentId: text(row.assignment_id) ?? fallbackId,
    canManage: bool(row.can_manage),
    clubId: text(row.club_id) ?? "",
    clubIsVerified: bool(row.club_is_verified),
    clubLogoUrl: text(row.club_logo_url),
    clubName: text(row.club_name) ?? "",
    contextLabel: text(row.context_label),
    customRoleName: text(row.custom_role_name),
    lineageId: text(row.lineage_id) ?? "",
    otherActiveCount: integer(row.other_active_count, 0),
    profileType: profileType(row.profile_type),
    profileTypeLabel: text(row.profile_type_label) ?? "",
    requestedId: text(row.requested_id) ?? fallbackId,
    revision: integer(row.revision, 1),
    roleId: text(row.role_id),
    roleLabel: text(row.role_label) ?? "",
    scopeType: scopeType(row.scope_type),
    status: text(row.status) === "ended" ? "ended" : "active",
    teamId: text(row.team_id),
    teamIsInactive: bool(row.team_is_inactive),
  };
}

// ── Screen 21-22: lato Società ───────────────────────────────────────────

export async function fetchSocietyPersonLink(
  clubId: string,
  profileId: string,
): Promise<SocietyPersonLink | null> {
  const data = await rpc<unknown>("fetch_society_person_link", {
    p_club_id: clubId,
    p_profile_id: profileId,
  });
  const list = rows(data);
  const head = list[0];

  if (!head) return null;

  return {
    aggregateRevision: integer(head.aggregate_revision, 1),
    canAdd: bool(head.can_add),
    canRemoveAll: bool(head.can_remove_all),
    canViewPerson: bool(head.can_view_person),
    clubId: text(head.club_id) ?? clubId,
    clubIsVerified: bool(head.club_is_verified),
    clubLogoUrl: text(head.club_logo_url),
    clubName: text(head.club_name) ?? "",
    isActive: bool(head.is_active),
    membershipId: text(head.membership_id),
    personAvatarUrl: text(head.person_avatar_url),
    personName: text(head.person_name) ?? "",
    personProfileId: text(head.person_profile_id) ?? profileId,
    /* Il LEFT JOIN della RPC produce una riga anche senza incarichi
       consultabili: una riga senza `assignment_id` non è un ruolo. */
    roles: list
      .map((row) => {
        const base = mapAssignmentRow(row);

        return base
          ? {
              ...base,
              canManage: bool(row.can_manage_row),
              canRemove: bool(row.can_remove_row),
            }
          : null;
      })
      .filter(
        (item): item is SocietyPersonLink["roles"][number] => item !== null,
      ),
    visibleCount: integer(head.visible_count, 0),
  };
}

export async function fetchSocietyAssignment(
  assignmentId: string,
): Promise<SocietyAssignmentDetail | null> {
  const data = await rpc<unknown>("fetch_society_assignment", {
    p_assignment_id: assignmentId,
  });
  const row = rows(data)[0];

  if (!row) return null;

  return {
    ...mapAssignmentDetail(row, assignmentId),
    canRemove: bool(row.can_remove),
    canRestore: bool(row.can_restore),
    changedByPerson: bool(row.changed_by_person),
    personAvatarUrl: text(row.person_avatar_url),
    personName: text(row.person_name) ?? "",
    personProfileId: text(row.person_profile_id) ?? "",
    previousContext: text(row.previous_context),
    previousRoleLabel: text(row.previous_role_label),
  };
}

/**
 * §32: le persone con un incarico **societario** attivo. L'Organico è per
 * squadra e non le contiene: senza questa lettura un Dirigente Intera
 * società non sarebbe raggiungibile da nessuna parte.
 */
export async function fetchSocietyWideMembers(
  clubId: string,
): Promise<SocietyWideMember[]> {
  const data = await rpc<unknown>("fetch_society_wide_members", {
    p_club_id: clubId,
  });

  return rows(data)
    .map((row) => {
      const id = text(row.profile_id);

      return id
        ? {
            activeCount: integer(row.active_count, 0),
            avatarUrl: text(row.avatar_url),
            personName: text(row.person_name) ?? "",
            profileId: id,
            roleLines: Array.isArray(row.role_lines)
              ? row.role_lines.filter(
                  (line): line is string => typeof line === "string",
                )
              : [],
          }
        : null;
    })
    .filter((item): item is SocietyWideMember => item !== null);
}

// ── Mutazioni condivise ──────────────────────────────────────────────────

export async function updateAssignment(input: {
  assignmentId: string;
  customRole: string | null;
  expectedRevision: number;
  operationKey: string;
  profileType: RoleProfileType;
  roleId: string;
  scopeType: RoleScopeType;
  teamId: string | null;
}): Promise<AssignmentMutationResult> {
  const data = await rpc<RawRecord>("update_member_assignment", {
    p_assignment_id: input.assignmentId,
    p_custom_role: input.customRole,
    p_expected_revision: input.expectedRevision,
    p_idempotency_key: input.operationKey,
    p_profile_type: input.profileType,
    p_role_id: input.roleId,
    p_scope_type: input.scopeType,
    p_team_id: input.scopeType === "team" ? input.teamId : null,
  });

  return mapAssignmentMutation(data, input.assignmentId);
}

export async function addAssignment(input: {
  clubId: string;
  customRole: string | null;
  operationKey: string;
  profileId: string | null;
  profileType: RoleProfileType;
  roleId: string;
  scopeType: RoleScopeType;
  teamId: string | null;
}): Promise<AssignmentMutationResult> {
  const data = await rpc<RawRecord>("add_member_assignment", {
    p_club_id: input.clubId,
    p_custom_role: input.customRole,
    p_idempotency_key: input.operationKey,
    /* Nullo per l'aggiunta personale: la persona è la sessione (§8). */
    p_profile_id: input.profileId,
    p_profile_type: input.profileType,
    p_role_id: input.roleId,
    p_scope_type: input.scopeType,
    p_team_id: input.scopeType === "team" ? input.teamId : null,
  });

  return mapAssignmentMutation(data, "");
}

export async function restoreAssignment(input: {
  assignmentId: string;
  expectedRevision: number;
  operationKey: string;
}): Promise<AssignmentMutationResult> {
  const data = await rpc<RawRecord>("restore_member_assignment", {
    p_assignment_id: input.assignmentId,
    p_expected_revision: input.expectedRevision,
    p_idempotency_key: input.operationKey,
  });

  return mapAssignmentMutation(data, input.assignmentId);
}

function mapAssignmentMutation(
  data: RawRecord | null,
  fallbackId: string,
): AssignmentMutationResult {
  return {
    assignmentId: text(data?.assignment_id) ?? fallbackId,
    changed: data?.changed !== false,
    contextLabel: text(data?.context_label),
    lineageId: text(data?.lineage_id) ?? "",
    revision: integer(data?.revision, 1),
    roleLabel: text(data?.role_label) ?? "",
  };
}

export async function endAssignment(input: {
  assignmentId: string;
  expectedRevision: number;
  operationKey: string;
}): Promise<AssignmentEndResult> {
  const data = await rpc<RawRecord>("end_member_assignment", {
    p_assignment_id: input.assignmentId,
    p_expected_revision: input.expectedRevision,
    p_idempotency_key: input.operationKey,
  });

  return {
    alreadyApplied: bool(data?.already_applied),
    assignmentId: text(data?.assignment_id) ?? input.assignmentId,
    contextLabel: text(data?.context_label),
    remainingActive: integer(data?.remaining_active, 0),
    roleLabel: text(data?.role_label) ?? "",
  };
}

export async function leaveSociety(input: {
  clubId: string;
  expectedRevision: number;
  operationKey: string;
}): Promise<RelationshipEndResult> {
  const data = await rpc<RawRecord>("leave_society", {
    p_club_id: input.clubId,
    p_expected_revision: input.expectedRevision,
    p_idempotency_key: input.operationKey,
  });

  return mapRelationshipEnd(data);
}

export async function removePersonFromSociety(input: {
  clubId: string;
  expectedRevision: number;
  operationKey: string;
  profileId: string;
}): Promise<RelationshipEndResult> {
  const data = await rpc<RawRecord>("remove_person_from_society", {
    p_club_id: input.clubId,
    p_expected_revision: input.expectedRevision,
    p_idempotency_key: input.operationKey,
    p_profile_id: input.profileId,
  });

  return mapRelationshipEnd(data);
}

function mapRelationshipEnd(data: RawRecord | null): RelationshipEndResult {
  return {
    alreadyApplied: bool(data?.already_applied),
    endedCount: integer(data?.ended_count, 0),
  };
}
