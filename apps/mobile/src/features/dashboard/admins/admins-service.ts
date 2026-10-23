/**
 * Accesso ai dati del Centro Amministratori (DAS-REV-13 §21, §23).
 *
 * Nessuna regola di dominio vive qui. Chi può leggere gli attivi, chi può
 * invitare, quale ruolo è assegnabile, se un invito è ancora valido: lo
 * decide il backend, che §23 obbliga a verificare «autenticazione, Society,
 * accesso dell'actor, capability effettiva, scope e stato della risorsa» a
 * ogni chiamata. Questo file traduce righe in tipi e scarta ciò che non sa
 * leggere.
 *
 * Nessuna funzione qui costruisce un payload di permessi: §11 vieta di
 * «accettare capability arbitrarie nel payload per concedere accesso», e il
 * modo di garantirlo è che il client non ne possieda nemmeno la forma.
 */
import { supabase } from "../../../lib/supabase";
import { DashboardTimeoutError } from "../state/error-classification";
import { MODULE_TIMEOUT_MS, withTimeout } from "../state/retry-policy";
import type {
  AdminCandidate,
  AdminCandidateStatus,
  AdminCenter,
  AdminInviteBinding,
  AdminInviteBindingState,
  AdminInvitePublic,
  AdminInviteRow,
  AdminPage,
  AdminRespondResult,
  AdminRow,
  AdminScopeMode,
  AssignableRole,
  AssignableTeam,
  CreatedAdminInvite,
  MyAdminInvite,
  MyAdminInviteState,
  ResharedAdminInvite,
} from "./admins-types";

/**
 * Codici applicativi sollevati dalle RPC. Sono stringhe stabili, non
 * messaggi: §30 tiene la copy nel livello di presentazione, perché lo stesso
 * codice compare in schermate diverse con parole diverse.
 */
export type AdminErrorCode =
  | "ADMIN_CENTER_NOT_AUTHORIZED"
  | "ADMIN_INVITE_ALREADY_ADMIN"
  | "ADMIN_INVITE_ALREADY_PENDING"
  | "ADMIN_INVITE_EMAIL_INVALID"
  | "ADMIN_INVITE_GRANTOR_UNAUTHORIZED"
  | "ADMIN_INVITE_NOT_AUTHENTICATED"
  | "ADMIN_INVITE_NOT_AUTHORIZED"
  | "ADMIN_INVITE_PROPOSAL_CHANGED"
  | "ADMIN_INVITE_RECIPIENT_INVALID"
  | "ADMIN_INVITE_REVISION_CONFLICT"
  | "ADMIN_INVITE_ROLE_UNAVAILABLE"
  | "ADMIN_INVITE_SCOPE_INVALID"
  | "ADMIN_INVITE_TEAM_UNAVAILABLE"
  | "ADMIN_INVITE_UNAVAILABLE"
  | "OPERATION_CONTENT_CHANGED"
  | "RATE_LIMIT"
  | "UNKNOWN";

const ERROR_CODES: readonly AdminErrorCode[] = [
  "ADMIN_CENTER_NOT_AUTHORIZED",
  "ADMIN_INVITE_ALREADY_ADMIN",
  "ADMIN_INVITE_ALREADY_PENDING",
  "ADMIN_INVITE_EMAIL_INVALID",
  "ADMIN_INVITE_GRANTOR_UNAUTHORIZED",
  "ADMIN_INVITE_NOT_AUTHENTICATED",
  "ADMIN_INVITE_NOT_AUTHORIZED",
  "ADMIN_INVITE_PROPOSAL_CHANGED",
  "ADMIN_INVITE_RECIPIENT_INVALID",
  "ADMIN_INVITE_REVISION_CONFLICT",
  "ADMIN_INVITE_ROLE_UNAVAILABLE",
  "ADMIN_INVITE_SCOPE_INVALID",
  "ADMIN_INVITE_TEAM_UNAVAILABLE",
  "ADMIN_INVITE_UNAVAILABLE",
  "OPERATION_CONTENT_CHANGED",
  "RATE_LIMIT",
] as const;

export class AdminAccessError extends Error {
  code: AdminErrorCode;

  constructor(code: AdminErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = "AdminAccessError";
  }
}

export function toAdminError(error: unknown): AdminAccessError {
  if (error instanceof AdminAccessError) {
    return error;
  }

  /* Un timeout non è un rifiuto autorizzativo: §27 vieta di ritentare
     all'infinito il secondo e impone di ritentare il primo. Confonderli
     produrrebbe esattamente il comportamento sbagliato su entrambi. */
  if (error instanceof DashboardTimeoutError) {
    throw error;
  }

  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error ?? "");

  const matched = ERROR_CODES.find((code) => message.includes(code));

  return new AdminAccessError(matched ?? "UNKNOWN", message);
}

type RawRecord = Record<string, unknown>;

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function bool(value: unknown): boolean {
  return value === true;
}

/** `null` resta `null` (§7.3): un dato non leggibile non è uno zero. */
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
    throw toAdminError(error);
  }

  return data as T;
}

// ── Composizione del centro ─────────────────────────────────────────────────

export async function fetchAdminCenter(clubId: string): Promise<AdminCenter> {
  const rows = await rpc<RawRecord[]>("fetch_society_admin_center", {
    p_club_id: clubId,
  });

  const row = Array.isArray(rows) ? rows[0] : null;

  if (!row) {
    throw new AdminAccessError("ADMIN_CENTER_NOT_AUTHORIZED");
  }

  return {
    accessVerifiedAt: row.access_verified_at
      ? new Date(String(row.access_verified_at)).getTime()
      : Date.now(),
    adminsCount: count(row.admins_count),
    canInvite: bool(row.can_invite),
    canOpenRoles: bool(row.can_open_roles),
    canViewAdmins: bool(row.can_view_admins),
    canViewInvites: bool(row.can_view_invites),
    clubId: text(row.club_id) ?? clubId,
    clubIsVerified: bool(row.club_is_verified),
    clubLogoUrl: text(row.club_logo_url),
    clubName: text(row.club_name) ?? "",
    dataRevision: integer(row.data_revision, 0),
    invitesPendingCount: count(row.invites_pending_count),
    scopeLabel: text(row.scope_label),
  };
}

// ── Liste ───────────────────────────────────────────────────────────────────

/**
 * §21: «Le liste includono metadata sufficienti per correlare count, pagine e
 * revisione.» Il totale arriva dal server su ogni riga: contare la pagina
 * darebbe un numero diverso dal conteggio dell'hub.
 */
function pageTotal(rows: RawRecord[], fallback: number): number {
  const first = rows[0];

  return first ? (count(first.total_count) ?? fallback) : 0;
}

export async function fetchAdmins(input: {
  clubId: string;
  limit?: number;
  offset?: number;
}): Promise<AdminPage<AdminRow>> {
  const raw = await rpc<RawRecord[]>("fetch_society_admins_page", {
    p_club_id: input.clubId,
    p_limit: input.limit ?? 20,
    p_offset: input.offset ?? 0,
  });

  const rows = Array.isArray(raw) ? raw : [];

  return {
    rows: rows.flatMap((row) => {
      const profileId = text(row.profile_id);
      const fullName = text(row.full_name);

      if (!profileId || !fullName) {
        return [];
      }

      return [
        {
          avatarUrl: text(row.avatar_url),
          fullName,
          isOwner: bool(row.is_owner),
          profileId,
          roleLabel: text(row.role_label) ?? "Accesso personalizzato",
          scopeLabel: text(row.scope_label),
        },
      ];
    }),
    total: pageTotal(rows, rows.length),
  };
}

export async function fetchAdminInvites(input: {
  clubId: string;
  limit?: number;
  offset?: number;
}): Promise<AdminPage<AdminInviteRow>> {
  const raw = await rpc<RawRecord[]>("fetch_society_admin_invites_page", {
    p_club_id: input.clubId,
    p_limit: input.limit ?? 20,
    p_offset: input.offset ?? 0,
  });

  const rows = Array.isArray(raw) ? raw : [];

  return {
    rows: rows.flatMap((row) => {
      const inviteId = text(row.invite_id);
      const kind = text(row.recipient_kind);

      if (!inviteId || (kind !== "member" && kind !== "email")) {
        return [];
      }

      return [
        {
          avatarUrl: text(row.avatar_url),
          createdAt: text(row.created_at) ?? "",
          emailDisplay: text(row.email_display),
          expiresAt: text(row.expires_at) ?? "",
          fullName: text(row.full_name),
          inviteId,
          profileId: text(row.profile_id),
          recipientKind: kind,
          revision: integer(row.revision, 1),
          roleLabel: text(row.role_label) ?? "",
          scopeLabel: text(row.scope_label),
        },
      ];
    }),
    total: pageTotal(rows, rows.length),
  };
}

// ── Composer ────────────────────────────────────────────────────────────────

const CANDIDATE_STATUSES: readonly AdminCandidateStatus[] = [
  "already_admin",
  "already_invited",
  "eligible",
] as const;

export async function searchAdminCandidates(input: {
  clubId: string;
  limit?: number;
  offset?: number;
  query: string;
}): Promise<AdminPage<AdminCandidate>> {
  const raw = await rpc<RawRecord[]>("search_society_admin_candidates", {
    p_club_id: input.clubId,
    p_limit: input.limit ?? 20,
    p_offset: input.offset ?? 0,
    p_query: input.query,
  });

  const rows = Array.isArray(raw) ? raw : [];

  return {
    rows: rows.flatMap((row) => {
      const profileId = text(row.profile_id);
      const fullName = text(row.full_name);
      const status = text(row.admin_status);

      if (
        !profileId ||
        !fullName ||
        !CANDIDATE_STATUSES.includes(status as AdminCandidateStatus)
      ) {
        return [];
      }

      return [
        {
          adminRole: text(row.admin_role),
          avatarUrl: text(row.avatar_url),
          fullName,
          profileId,
          role: text(row.role),
          status: status as AdminCandidateStatus,
        },
      ];
    }),
    total: pageTotal(rows, rows.length),
  };
}

export async function fetchAssignableRoles(
  clubId: string,
): Promise<AssignableRole[]> {
  const raw = await rpc<RawRecord[]>("fetch_society_assignable_roles", {
    p_club_id: clubId,
  });

  return (Array.isArray(raw) ? raw : []).flatMap((row) => {
    const roleId = text(row.role_id);
    const name = text(row.name);

    if (!roleId || !name) {
      return [];
    }

    return [
      {
        configVersion: integer(row.config_version, 1),
        name,
        permissions: Array.isArray(row.permissions)
          ? row.permissions.filter(
              (key): key is string => typeof key === "string",
            )
          : [],
        roleId,
      },
    ];
  });
}

export async function fetchAssignableTeams(
  clubId: string,
): Promise<AssignableTeam[]> {
  const raw = await rpc<RawRecord[]>("fetch_society_assignable_teams", {
    p_club_id: clubId,
  });

  return (Array.isArray(raw) ? raw : []).flatMap((row) => {
    const teamId = text(row.team_id);
    const name = text(row.name);

    if (!teamId || !name) {
      return [];
    }

    return [
      {
        category: text(row.category),
        name,
        teamId,
        teamType: text(row.team_type),
      },
    ];
  });
}

// ── Comandi ─────────────────────────────────────────────────────────────────

export async function createAdminInvite(input: {
  clubId: string;
  email?: string | null;
  idempotencyKey: string;
  profileId?: string | null;
  roleId: string;
  scopeMode: AdminScopeMode;
  teamIds: string[];
}): Promise<CreatedAdminInvite> {
  const raw = await rpc<RawRecord[]>("create_society_admin_invite", {
    p_club_id: input.clubId,
    p_email: input.email ?? null,
    p_idempotency_key: input.idempotencyKey,
    p_profile_id: input.profileId ?? null,
    p_role_id: input.roleId,
    p_scope_mode: input.scopeMode,
    p_team_ids: input.scopeMode === "teams" ? input.teamIds : null,
  });

  const row = Array.isArray(raw) ? raw[0] : null;
  const inviteId = row ? text(row.invite_id) : null;

  if (!row || !inviteId) {
    throw new AdminAccessError("UNKNOWN");
  }

  return {
    expiresAt: text(row.expires_at) ?? "",
    inviteId,
    recipientKind: text(row.recipient_kind) === "email" ? "email" : "member",
    revision: integer(row.revision, 1),
    token: text(row.token),
  };
}

export async function reshareAdminInvite(input: {
  clubId: string;
  inviteId: string;
}): Promise<ResharedAdminInvite> {
  const raw = await rpc<RawRecord[]>("reshare_society_admin_invite", {
    p_club_id: input.clubId,
    p_invite_id: input.inviteId,
  });

  const row = Array.isArray(raw) ? raw[0] : null;
  const token = row ? text(row.token) : null;

  if (!row || !token) {
    throw new AdminAccessError("ADMIN_INVITE_UNAVAILABLE");
  }

  return {
    emailDisplay: text(row.email_display),
    expiresAt: text(row.expires_at) ?? "",
    inviteId: text(row.invite_id) ?? input.inviteId,
    roleLabel: text(row.role_label) ?? "",
    scopeLabel: text(row.scope_label),
    token,
  };
}

// ── Percorso del destinatario ───────────────────────────────────────────────

/**
 * Landing pubblica (§13). Eseguibile senza sessione.
 *
 * Non riceve e non restituisce l'`invite_id`: la landing non è un accesso al
 * dominio, e il proseguimento passa sempre dal token.
 */
export async function fetchAdminInvitePublic(
  token: string,
): Promise<AdminInvitePublic> {
  const raw = await rpc<RawRecord[]>("fetch_admin_invite_public", {
    p_token: token,
  });

  const row = Array.isArray(raw) ? raw[0] : null;

  if (!row || text(row.state) !== "valid") {
    return { state: "unavailable" };
  }

  return {
    clubIsVerified: bool(row.club_is_verified),
    clubLogoUrl: text(row.club_logo_url),
    clubName: text(row.club_name) ?? "",
    roleLabel: text(row.role_label) ?? "",
    scopeLabel: text(row.scope_label),
    state: "valid",
  };
}

const BINDING_STATES: readonly AdminInviteBindingState[] = [
  "accepted",
  "already_admin",
  "expired",
  "needs_verified_email",
  "rejected",
  "revoked",
  "unavailable",
  "valid",
  "wrong_account",
] as const;

export async function resolveAdminInviteBinding(
  token: string,
): Promise<AdminInviteBinding> {
  const raw = await rpc<RawRecord[]>("resolve_admin_invite_binding", {
    p_token: token,
  });

  const row = Array.isArray(raw) ? raw[0] : null;
  const state = row ? text(row.state) : null;

  if (!state || !BINDING_STATES.includes(state as AdminInviteBindingState)) {
    return { inviteId: null, state: "unavailable" };
  }

  return {
    inviteId: text(row?.invite_id ?? null),
    state: state as AdminInviteBindingState,
  };
}

const MY_INVITE_STATES: readonly MyAdminInviteState[] = [
  "accepted",
  "expired",
  "pending",
  "rejected",
  "revoked",
] as const;

export async function fetchMyAdminInvite(
  inviteId: string,
): Promise<MyAdminInvite> {
  const raw = await rpc<RawRecord[]>("fetch_my_admin_invite", {
    p_invite_id: inviteId,
  });

  const row = Array.isArray(raw) ? raw[0] : null;
  const state = row ? text(row.state) : null;

  if (!row || !state || !MY_INVITE_STATES.includes(state as MyAdminInviteState)) {
    throw new AdminAccessError("ADMIN_INVITE_UNAVAILABLE");
  }

  return {
    clubId: text(row.club_id) ?? "",
    clubIsVerified: bool(row.club_is_verified),
    clubLogoUrl: text(row.club_logo_url),
    clubName: text(row.club_name) ?? "",
    expiresAt: text(row.expires_at) ?? "",
    inviteId: text(row.invite_id) ?? inviteId,
    membershipActive: bool(row.membership_active),
    revision: integer(row.revision, 1),
    roleLabel: text(row.role_label) ?? "",
    scopeLabel: text(row.scope_label),
    state: state as MyAdminInviteState,
  };
}

export async function respondToAdminInvite(input: {
  accept: boolean;
  idempotencyKey: string;
  inviteId: string;
  revision: number;
}): Promise<AdminRespondResult> {
  const raw = await rpc<RawRecord[]>("respond_to_admin_invite", {
    p_accept: input.accept,
    p_idempotency_key: input.idempotencyKey,
    p_invite_id: input.inviteId,
    p_revision: input.revision,
  });

  const row = Array.isArray(raw) ? raw[0] : null;
  const state = row ? text(row.state) : null;

  if (!row || !state) {
    throw new AdminAccessError("UNKNOWN");
  }

  return {
    clubId: text(row.club_id) ?? "",
    inviteId: text(row.invite_id) ?? input.inviteId,
    membershipId: text(row.membership_id),
    state: state as AdminRespondResult["state"],
  };
}
