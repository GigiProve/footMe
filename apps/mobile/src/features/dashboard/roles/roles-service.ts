/**
 * Accesso ai dati di Ruoli e permessi (§6, §27).
 *
 * Nessuna regola di dominio vive qui. Chi può leggere i ruoli, chi può
 * crearli, quale bundle è concedibile, se una dipendenza è obbligatoria: lo
 * decide il backend, che §6 obbliga a verificare «sessione, actor, Society,
 * membership attiva quando richiesta, capability dell'operazione, risorsa
 * target, ambito rilevante e protezioni Owner» a ogni chiamata.
 *
 * Il comando di salvataggio invia **id di controllo**. §13 vieta
 * «l'iniezione di Team ID nel ruolo o di ownership nei bundle»: il modo di
 * garantirlo è che il client non possieda nemmeno la forma di un payload di
 * capability.
 */
import { supabase } from "../../../lib/supabase";
import { DashboardTimeoutError } from "../state/error-classification";
import { MODULE_TIMEOUT_MS, withTimeout } from "../state/retry-policy";
import type {
  PermissionArea,
  PermissionCatalog,
  PermissionControl,
  RoleDetail,
  RoleRow,
  RolesCenter,
  SavedRole,
} from "./roles-types";

/**
 * Codici applicativi sollevati dalle RPC. Sono stringhe stabili, non
 * messaggi: la copy vive nel livello di presentazione, perché lo stesso
 * codice compare in schermate diverse con parole diverse (§29).
 */
export type RolesErrorCode =
  | "ADMIN_ACCESS_NOT_AUTHENTICATED"
  | "ADMIN_ACCESS_NOT_AUTHORIZED"
  | "ADMIN_INVITE_NOT_AUTHORIZED"
  | "ADMIN_INVITE_REVISION_CONFLICT"
  | "ADMIN_INVITE_UNAVAILABLE"
  | "ADMIN_MEMBERSHIP_NOT_FOUND"
  | "ADMIN_OWNER_PROTECTED"
  | "ADMIN_ROLE_NOT_GRANTABLE"
  | "ADMIN_ROLE_UNAVAILABLE"
  | "ADMIN_SCOPE_EMPTY"
  | "ADMIN_SCOPE_INVALID"
  | "ADMIN_SCOPE_NOT_GRANTABLE"
  | "ADMIN_TEAM_UNAVAILABLE"
  | "ADMIN_VERSION_CONFLICT"
  | "ADMIN_DETAIL_NOT_AUTHORIZED"
  | "OWNER_CANDIDATE_INVALID"
  | "OWNER_CHANGED"
  | "OWNER_LEGACY_CONFIG_REQUIRED"
  | "OWNER_TRANSFER_NOT_AUTHENTICATED"
  | "OPERATION_CONTENT_CHANGED"
  | "OWNER_TRANSFER_NOT_AUTHORIZED"
  | "ROLE_ARCHIVED"
  | "ROLE_CATALOG_CHANGED"
  | "ROLE_IMPACT_CHANGED"
  | "ROLE_NAME_DUPLICATE"
  | "ROLE_NAME_INVALID"
  | "ROLE_NAME_RESERVED"
  | "ROLE_NOT_FOUND"
  | "ROLE_PERMISSION_NOT_GRANTABLE"
  | "ROLE_STILL_IN_USE"
  | "ROLE_VERSION_CONFLICT"
  | "ROLES_NOT_AUTHENTICATED"
  | "ROLES_NOT_AUTHORIZED"
  | "UNKNOWN";

const ERROR_CODES: readonly RolesErrorCode[] = [
  "ADMIN_ACCESS_NOT_AUTHENTICATED",
  "ADMIN_ACCESS_NOT_AUTHORIZED",
  "ADMIN_INVITE_NOT_AUTHORIZED",
  "ADMIN_INVITE_REVISION_CONFLICT",
  "ADMIN_INVITE_UNAVAILABLE",
  "ADMIN_MEMBERSHIP_NOT_FOUND",
  "ADMIN_OWNER_PROTECTED",
  "ADMIN_ROLE_NOT_GRANTABLE",
  "ADMIN_ROLE_UNAVAILABLE",
  "ADMIN_SCOPE_EMPTY",
  "ADMIN_SCOPE_INVALID",
  "ADMIN_SCOPE_NOT_GRANTABLE",
  "ADMIN_TEAM_UNAVAILABLE",
  "ADMIN_VERSION_CONFLICT",
  "ADMIN_DETAIL_NOT_AUTHORIZED",
  "OWNER_CANDIDATE_INVALID",
  "OWNER_CHANGED",
  "OWNER_LEGACY_CONFIG_REQUIRED",
  "OWNER_TRANSFER_NOT_AUTHENTICATED",
  "OPERATION_CONTENT_CHANGED",
  "OWNER_TRANSFER_NOT_AUTHORIZED",
  "ROLE_ARCHIVED",
  "ROLE_CATALOG_CHANGED",
  "ROLE_IMPACT_CHANGED",
  "ROLE_NAME_DUPLICATE",
  "ROLE_NAME_INVALID",
  "ROLE_NAME_RESERVED",
  "ROLE_NOT_FOUND",
  "ROLE_PERMISSION_NOT_GRANTABLE",
  "ROLE_STILL_IN_USE",
  "ROLE_VERSION_CONFLICT",
  "ROLES_NOT_AUTHENTICATED",
  "ROLES_NOT_AUTHORIZED",
] as const;

export class RolesAccessError extends Error {
  code: RolesErrorCode;

  constructor(code: RolesErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = "RolesAccessError";
  }
}

export function toRolesError(error: unknown): RolesAccessError {
  if (error instanceof RolesAccessError) {
    return error;
  }

  /* Un timeout non è un rifiuto autorizzativo: §29 vieta di ritentare
     all'infinito il secondo e impone di ritentare il primo. */
  if (error instanceof DashboardTimeoutError) {
    throw error;
  }

  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error ?? "");

  const matched = ERROR_CODES.find((code) => message.includes(code));

  return new RolesAccessError(matched ?? "UNKNOWN", message);
}

type RawRecord = Record<string, unknown>;

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function bool(value: unknown): boolean {
  return value === true;
}

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

/** `text[]` di Postgres arriva come array JSON; tutto il resto è scartato. */
function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export async function rolesRpc<T>(
  name: string,
  params: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await withTimeout(
    supabase.rpc(name, params),
    MODULE_TIMEOUT_MS,
    () => new DashboardTimeoutError(name),
  );

  if (error) {
    throw toRolesError(error);
  }

  return data as T;
}

export function pageTotal(rows: RawRecord[], fallback: number): number {
  const first = rows[0];

  return first ? (count(first.total_count) ?? fallback) : 0;
}

export {
  bool as asBool,
  count as asCount,
  integer as asInteger,
  strings as asStrings,
  text as asText,
};
export type { RawRecord };

// ── Centro ──────────────────────────────────────────────────────────────────

export async function fetchRolesCenter(clubId: string): Promise<RolesCenter> {
  const rows = await rolesRpc<RawRecord[]>("fetch_society_roles_center", {
    p_club_id: clubId,
  });

  const row = Array.isArray(rows) ? rows[0] : null;

  if (!row) {
    throw new RolesAccessError("ROLES_NOT_AUTHORIZED");
  }

  return {
    accessVerifiedAt: row.access_verified_at
      ? new Date(String(row.access_verified_at)).getTime()
      : Date.now(),
    canCreateRole: bool(row.can_create_role),
    canEditRoles: bool(row.can_edit_roles),
    catalogRevision: integer(row.catalog_revision, 1),
    clubId: text(row.club_id) ?? clubId,
    clubIsVerified: bool(row.club_is_verified),
    clubLogoUrl: text(row.club_logo_url),
    clubName: text(row.club_name) ?? "",
    dataRevision: integer(row.data_revision, 0),
    rolesCount: integer(row.roles_count, 0),
  };
}

export async function fetchRoles(input: {
  clubId: string;
  limit?: number;
  offset?: number;
}): Promise<{ rows: RoleRow[]; total: number }> {
  const raw = await rolesRpc<RawRecord[]>("fetch_society_roles_page", {
    p_club_id: input.clubId,
    p_limit: input.limit ?? 20,
    p_offset: input.offset ?? 0,
  });

  const rows = Array.isArray(raw) ? raw : [];

  return {
    rows: rows.flatMap((row) => {
      const roleId = text(row.role_id);
      const name = text(row.name);

      if (!roleId || !name) {
        return [];
      }

      return [
        {
          adminsCount: integer(row.admins_count, 0),
          areasEnabled: integer(row.areas_enabled, 0),
          configVersion: integer(row.config_version, 1),
          isSystem: bool(row.is_system),
          name,
          roleId,
          version: integer(row.version, 1),
        },
      ];
    }),
    total: pageTotal(rows, rows.length),
  };
}

// ── Catalogo ────────────────────────────────────────────────────────────────

/**
 * Il catalogo arriva piatto — una riga per controllo — e viene ricomposto in
 * albero qui, una volta sola. §7 vieta di «duplicare enum fra i client»: la
 * forma dell'albero è una conseguenza dell'ordine del server, non una
 * seconda tassonomia.
 */
export async function fetchPermissionCatalog(
  clubId: string,
): Promise<PermissionCatalog> {
  const raw = await rolesRpc<RawRecord[]>("fetch_permission_catalog", {
    p_club_id: clubId,
  });

  const rows = Array.isArray(raw) ? raw : [];
  const areas = new Map<string, PermissionArea>();
  let revision = 1;

  for (const row of rows) {
    const areaId = text(row.area_id);
    const controlId = text(row.control_id);
    const areaLabel = text(row.area_label);
    const controlLabel = text(row.control_label);
    const bundle = text(row.control_bundle);

    if (
      !areaId ||
      !controlId ||
      !areaLabel ||
      !controlLabel ||
      (bundle !== "view" && bundle !== "manage")
    ) {
      continue;
    }

    revision = integer(row.catalog_revision, revision);

    const scopeKind = row.area_scope_kind === "society" ? "society" : "team";

    if (!areas.has(areaId)) {
      areas.set(areaId, {
        controls: [],
        description: text(row.area_description),
        id: areaId,
        label: areaLabel,
        scopeKind,
        sortOrder: integer(row.area_sort_order, 0),
      });
    }

    const control: PermissionControl = {
      bundle,
      helper: text(row.control_helper),
      id: controlId,
      isGrantable: bool(row.is_grantable),
      label: controlLabel,
      permissionKeys: strings(row.permission_keys),
      requires: strings(row.control_requires),
      sortOrder: integer(row.control_sort_order, 0),
    };

    areas.get(areaId)?.controls.push(control);
  }

  return {
    areas: [...areas.values()].sort((a, b) => a.sortOrder - b.sortOrder),
    revision,
  };
}

// ── Dettaglio e salvataggio ─────────────────────────────────────────────────

export async function fetchRoleDetail(input: {
  clubId: string;
  roleId: string;
}): Promise<RoleDetail> {
  const raw = await rolesRpc<RawRecord[]>("fetch_society_role_detail", {
    p_club_id: input.clubId,
    p_role_id: input.roleId,
  });

  const row = Array.isArray(raw) ? raw[0] : null;

  if (!row) {
    throw new RolesAccessError("ROLE_NOT_FOUND");
  }

  return {
    adminsCount: integer(row.admins_count, 0),
    areasEnabled: integer(row.areas_enabled, 0),
    canArchive: bool(row.can_archive),
    canEdit: bool(row.can_edit),
    catalogRevision: integer(row.catalog_revision, 1),
    configVersion: integer(row.config_version, 1),
    isActive: bool(row.is_active),
    isSystem: bool(row.is_system),
    name: text(row.name) ?? "",
    pendingInvites: integer(row.pending_invites, 0),
    permissionKeys: strings(row.permission_keys),
    roleId: text(row.role_id) ?? input.roleId,
    version: integer(row.version, 1),
  };
}

export async function saveRole(input: {
  catalogRevision: number;
  clubId: string;
  controlIds: string[];
  expectedImpact?: number | null;
  expectedVersion?: number | null;
  idempotencyKey: string;
  name: string;
  roleId?: string | null;
}): Promise<SavedRole> {
  const raw = await rolesRpc<RawRecord[]>("save_society_admin_role", {
    p_catalog_revision: input.catalogRevision,
    p_club_id: input.clubId,
    p_control_ids: input.controlIds,
    p_expected_impact: input.expectedImpact ?? null,
    p_expected_version: input.expectedVersion ?? null,
    p_idempotency_key: input.idempotencyKey,
    p_name: input.name,
    p_role_id: input.roleId ?? null,
  });

  const row = Array.isArray(raw) ? raw[0] : null;

  if (!row) {
    throw new RolesAccessError("UNKNOWN");
  }

  return {
    adminsCount: integer(row.admins_count, 0),
    changed: bool(row.changed),
    configVersion: integer(row.config_version, 1),
    name: text(row.name) ?? input.name,
    roleId: text(row.role_id) ?? "",
    version: integer(row.version, 1),
  };
}

export async function archiveRole(input: {
  clubId: string;
  expectedVersion?: number | null;
  idempotencyKey: string;
  roleId: string;
}): Promise<{ isActive: boolean; roleId: string; version: number }> {
  const raw = await rolesRpc<RawRecord[]>("archive_society_admin_role", {
    p_club_id: input.clubId,
    p_expected_version: input.expectedVersion ?? null,
    p_idempotency_key: input.idempotencyKey,
    p_role_id: input.roleId,
  });

  const row = Array.isArray(raw) ? raw[0] : null;

  if (!row) {
    throw new RolesAccessError("UNKNOWN");
  }

  return {
    isActive: bool(row.is_active),
    roleId: text(row.role_id) ?? input.roleId,
    version: integer(row.version, 1),
  };
}
