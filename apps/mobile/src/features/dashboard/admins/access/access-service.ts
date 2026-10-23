/**
 * Accesso ai dati dell'accesso amministrativo (§6, §27).
 *
 * Riusa il wrapper RPC, la classificazione degli errori e i coercer di
 * `roles-service`: §6 chiede «un solo dominio autorizzativo», e due
 * traduttori di errore per lo stesso backend ne produrrebbero due.
 *
 * Nessuna funzione qui invia una capability. I comandi inviano riferimenti
 * — membership, ruolo, squadre, versione — e il backend ricalcola.
 */
import {
  RolesAccessError,
  asBool,
  asInteger,
  asStrings,
  asText,
  pageTotal,
  rolesRpc,
  type RawRecord,
} from "../../roles/roles-service";
import type { AreaLevel, AreaScopeKind } from "../../roles/roles-types";
import type {
  AdminAccessDetail,
  AdminEffectivePermissions,
  AdminInviteDetail,
  AdminInviteState,
  AdminScopeMode,
  OwnerCandidate,
  OwnerTransferResult,
  SavedScope,
  ScopeTeam,
} from "./access-types";

const LEVELS: readonly AreaLevel[] = ["none", "view", "manage", "custom"];

const INVITE_STATES: readonly AdminInviteState[] = [
  "accepted",
  "expired",
  "pending",
  "rejected",
  "revoked",
];

function scopeMode(value: unknown): AdminScopeMode {
  return value === "teams" ? "teams" : "society";
}

// ── Letture ─────────────────────────────────────────────────────────────────

export async function fetchAdminAccessDetail(input: {
  clubId: string;
  profileId: string;
}): Promise<AdminAccessDetail> {
  const raw = await rolesRpc<RawRecord[]>("fetch_society_admin_detail", {
    p_club_id: input.clubId,
    p_profile_id: input.profileId,
  });

  const row = Array.isArray(raw) ? raw[0] : null;

  if (!row) {
    throw new RolesAccessError("ADMIN_MEMBERSHIP_NOT_FOUND");
  }

  return {
    accessVerifiedAt: row.access_verified_at
      ? new Date(String(row.access_verified_at)).getTime()
      : Date.now(),
    activatedAt: asText(row.activated_at),
    avatarUrl: asText(row.avatar_url),
    canChangeRole: asBool(row.can_change_role),
    canChangeScope: asBool(row.can_change_scope),
    canRevoke: asBool(row.can_revoke),
    canTransferOwner: asBool(row.can_transfer_owner),
    canViewPermissions: asBool(row.can_view_permissions),
    fullName: asText(row.full_name) ?? "",
    isOwner: asBool(row.is_owner),
    isSelf: asBool(row.is_self),
    membershipId: asText(row.membership_id),
    profileId: asText(row.profile_id) ?? input.profileId,
    roleId: asText(row.role_id),
    roleIsNamed: asBool(row.role_is_named),
    roleLabel: asText(row.role_label) ?? "Accesso personalizzato",
    scopeLabel: asText(row.scope_label),
    scopeMode: scopeMode(row.scope_mode),
    status: asText(row.status) ?? "active",
    teamIds: asStrings(row.team_ids),
    teamNames: asStrings(row.team_names),
    version: asInteger(row.version, 0),
  };
}

export async function fetchAdminEffectivePermissions(input: {
  clubId: string;
  profileId: string;
}): Promise<AdminEffectivePermissions> {
  const raw = await rolesRpc<RawRecord[]>("fetch_society_admin_permissions", {
    p_club_id: input.clubId,
    p_profile_id: input.profileId,
  });

  const rows = Array.isArray(raw) ? raw : [];
  const first = rows[0];

  return {
    areas: rows.flatMap((row) => {
      const areaId = asText(row.area_id);
      const areaLabel = asText(row.area_label);
      const level = asText(row.level);

      if (!areaId || !areaLabel || !LEVELS.includes(level as AreaLevel)) {
        return [];
      }

      return [
        {
          areaId,
          areaLabel,
          controlLabels: asStrings(row.control_labels),
          level: level as AreaLevel,
          scopeKind: (row.area_scope_kind === "society"
            ? "society"
            : "team") as AreaScopeKind,
        },
      ];
    }),
    catalogRevision: asInteger(first?.catalog_revision, 1),
    isOwner: asBool(first?.is_owner),
    scopeLabel: asText(first?.scope_label),
    scopeMode: scopeMode(first?.scope_mode),
  };
}

export async function fetchScopeTeams(clubId: string): Promise<ScopeTeam[]> {
  const raw = await rolesRpc<RawRecord[]>("fetch_society_assignable_teams", {
    p_club_id: clubId,
  });

  const rows = Array.isArray(raw) ? raw : [];

  return rows.flatMap((row) => {
    const teamId = asText(row.team_id);
    const name = asText(row.name);

    if (!teamId || !name) {
      return [];
    }

    return [
      {
        category: asText(row.category),
        logoUrl: asText(row.logo_url),
        name,
        teamId,
        teamType: asText(row.team_type),
      },
    ];
  });
}

export async function fetchAdminInviteDetail(input: {
  clubId: string;
  inviteId: string;
}): Promise<AdminInviteDetail> {
  const raw = await rolesRpc<RawRecord[]>(
    "fetch_society_admin_invite_detail",
    { p_club_id: input.clubId, p_invite_id: input.inviteId },
  );

  const row = Array.isArray(raw) ? raw[0] : null;

  if (!row) {
    throw new RolesAccessError("ADMIN_INVITE_UNAVAILABLE");
  }

  const state = asText(row.state);

  return {
    avatarUrl: asText(row.avatar_url),
    canCancel: asBool(row.can_cancel),
    createdAt: asText(row.created_at),
    emailDisplay: asText(row.email_display),
    expiresAt: asText(row.expires_at),
    fullName: asText(row.full_name),
    inviteId: asText(row.invite_id) ?? input.inviteId,
    membershipProfileId: asText(row.membership_profile_id),
    profileId: asText(row.profile_id),
    recipientKind: row.recipient_kind === "email" ? "email" : "member",
    revision: asInteger(row.revision, 1),
    roleLabel: asText(row.role_label) ?? "",
    scopeLabel: asText(row.scope_label),
    state: INVITE_STATES.includes(state as AdminInviteState)
      ? (state as AdminInviteState)
      : "revoked",
  };
}

export async function fetchOwnerCandidates(input: {
  clubId: string;
  limit?: number;
  offset?: number;
}): Promise<{ rows: OwnerCandidate[]; total: number }> {
  const raw = await rolesRpc<RawRecord[]>("fetch_society_owner_candidates", {
    p_club_id: input.clubId,
    p_limit: input.limit ?? 20,
    p_offset: input.offset ?? 0,
  });

  const rows = Array.isArray(raw) ? raw : [];

  return {
    rows: rows.flatMap((row) => {
      const profileId = asText(row.profile_id);
      const fullName = asText(row.full_name);

      if (!profileId || !fullName) {
        return [];
      }

      return [
        {
          avatarUrl: asText(row.avatar_url),
          fullName,
          profileId,
          roleLabel: asText(row.role_label) ?? "Accesso personalizzato",
          scopeLabel: asText(row.scope_label),
        },
      ];
    }),
    total: pageTotal(rows, rows.length),
  };
}

// ── Comandi ─────────────────────────────────────────────────────────────────

export async function assignAdminRole(input: {
  clubId: string;
  expectedVersion: number;
  idempotencyKey: string;
  profileId: string;
  roleId: string;
}): Promise<{ roleId: string; roleLabel: string; version: number }> {
  const raw = await rolesRpc<RawRecord[]>("assign_society_admin_role", {
    p_club_id: input.clubId,
    p_expected_version: input.expectedVersion,
    p_idempotency_key: input.idempotencyKey,
    p_profile_id: input.profileId,
    p_role_id: input.roleId,
  });

  const row = Array.isArray(raw) ? raw[0] : null;

  if (!row) {
    throw new RolesAccessError("UNKNOWN");
  }

  return {
    roleId: asText(row.role_id) ?? input.roleId,
    roleLabel: asText(row.role_label) ?? "",
    version: asInteger(row.version, input.expectedVersion + 1),
  };
}

export async function updateAdminScope(input: {
  clubId: string;
  expectedVersion: number;
  idempotencyKey: string;
  profileId: string;
  scopeMode: AdminScopeMode;
  teamIds: string[];
}): Promise<SavedScope> {
  const raw = await rolesRpc<RawRecord[]>("update_society_admin_scope", {
    p_club_id: input.clubId,
    p_expected_version: input.expectedVersion,
    p_idempotency_key: input.idempotencyKey,
    p_profile_id: input.profileId,
    p_scope_mode: input.scopeMode,
    p_team_ids: input.scopeMode === "teams" ? input.teamIds : [],
  });

  const row = Array.isArray(raw) ? raw[0] : null;

  if (!row) {
    throw new RolesAccessError("UNKNOWN");
  }

  return {
    membershipId: asText(row.membership_id) ?? "",
    scopeLabel: asText(row.scope_label),
    scopeMode: scopeMode(row.scope_mode),
    teamIds: asStrings(row.team_ids),
    version: asInteger(row.version, input.expectedVersion + 1),
  };
}

export async function revokeAdminAccess(input: {
  clubId: string;
  expectedVersion: number;
  idempotencyKey: string;
  profileId: string;
}): Promise<{ status: string; version: number }> {
  const raw = await rolesRpc<RawRecord[]>("revoke_society_admin", {
    p_club_id: input.clubId,
    p_expected_version: input.expectedVersion,
    p_idempotency_key: input.idempotencyKey,
    p_profile_id: input.profileId,
  });

  const row = Array.isArray(raw) ? raw[0] : null;

  if (!row) {
    throw new RolesAccessError("UNKNOWN");
  }

  return {
    status: asText(row.status) ?? "revoked",
    version: asInteger(row.version, input.expectedVersion + 1),
  };
}

export async function cancelAdminInvite(input: {
  clubId: string;
  expectedRevision: number;
  idempotencyKey: string;
  inviteId: string;
}): Promise<{ membershipProfileId: string | null; state: AdminInviteState }> {
  const raw = await rolesRpc<RawRecord[]>("cancel_society_admin_invite", {
    p_club_id: input.clubId,
    p_expected_revision: input.expectedRevision,
    p_idempotency_key: input.idempotencyKey,
    p_invite_id: input.inviteId,
  });

  const row = Array.isArray(raw) ? raw[0] : null;

  if (!row) {
    throw new RolesAccessError("ADMIN_INVITE_UNAVAILABLE");
  }

  const state = asText(row.state);

  return {
    membershipProfileId: asText(row.membership_profile_id),
    state: INVITE_STATES.includes(state as AdminInviteState)
      ? (state as AdminInviteState)
      : "revoked",
  };
}

export async function transferOwnership(input: {
  clubId: string;
  expectedVersion?: number | null;
  idempotencyKey: string;
  legacyRoleId?: string | null;
  legacyScopeMode?: AdminScopeMode | null;
  legacyTeamIds?: string[] | null;
  newOwnerId: string;
}): Promise<OwnerTransferResult> {
  const raw = await rolesRpc<RawRecord[]>("transfer_society_ownership", {
    p_club_id: input.clubId,
    p_expected_version: input.expectedVersion ?? null,
    p_idempotency_key: input.idempotencyKey,
    p_legacy_role_id: input.legacyRoleId ?? null,
    p_legacy_scope_mode: input.legacyScopeMode ?? null,
    p_legacy_team_ids: input.legacyTeamIds ?? null,
    p_new_owner_id: input.newOwnerId,
  });

  const row = Array.isArray(raw) ? raw[0] : null;

  if (!row) {
    throw new RolesAccessError("UNKNOWN");
  }

  return {
    newOwnerId: asText(row.new_owner_id) ?? input.newOwnerId,
    ownershipVersion: asInteger(row.ownership_version, 0),
    previousOwnerId: asText(row.previous_owner_id) ?? "",
  };
}
