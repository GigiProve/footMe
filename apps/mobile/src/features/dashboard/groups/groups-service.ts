/**
 * Accesso ai dati dei Gruppi operativi (DAS-REV-32 §26).
 *
 * Nessuna regola di autorizzazione vive qui: scope, eleggibilità, minimo e
 * massimo li decidono le RPC a ogni chiamata (§8: «Applica i controlli
 * server-side»). Il client rispedisce i cursori senza interpretarli.
 *
 * Gli errori arrivano come codici stabili e diventano `GroupsError`; la copy
 * sta in `groups-copy.ts` e lo step di ritorno in `groups-presentation.ts`.
 */
import * as ImagePicker from "expo-image-picker";

import { supabase } from "../../../lib/supabase";
import {
  DashboardTimeoutError,
  classifyDashboardError,
  suggestsOffline,
} from "../state/error-classification";
import { MODULE_TIMEOUT_MS, withTimeout } from "../state/retry-policy";
import {
  DEFAULT_GROUP_LIMITS,
  NO_GROUP_CAPABILITIES,
  type ArchivedGroupRow,
  type ArchivedGroupsPage,
  type CreateGroupInput,
  type CreateGroupResult,
  type EligiblePeoplePage,
  type EligiblePerson,
  type GroupAvatarRef,
  type GroupCapabilities,
  type GroupCommandResult,
  type GroupCreateContext,
  type GroupEligiblePage,
  type GroupLeavePath,
  type GroupLimits,
  type GroupManagement,
  type GroupMember,
  type GroupMemberRole,
  type GroupMembersPage,
  type GroupTeamOptions,
  type GroupTeamsLookup,
  type HandoverCandidate,
  type HandoverCandidatesPage,
  type SocietyGroupDetail,
  type SocietyGroupRow,
  type SocietyGroupsPage,
} from "./groups-types";

export const GROUP_AVATAR_BUCKET = "society-group-avatars";
export const GROUPS_PAGE_SIZE = 30;
export const PEOPLE_PAGE_SIZE = 40;

export type GroupsErrorCode =
  | "SOCIETY_GROUPS_NOT_AUTHORIZED"
  | "SOCIETY_GROUP_NOT_FOUND"
  | "SOCIETY_GROUP_TEAM_UNAVAILABLE"
  | "SOCIETY_GROUP_PEOPLE_REQUIRED"
  | "SOCIETY_GROUP_PEOPLE_UNAVAILABLE"
  | "SOCIETY_GROUP_TOO_MANY_PEOPLE"
  | "SOCIETY_GROUP_INVALID"
  | "OPERATION_CONTENT_CHANGED"
  // DAS-REV-33 §25: gestione e lifecycle
  | "SOCIETY_GROUP_ARCHIVED"
  | "SOCIETY_GROUP_DELETED"
  | "SOCIETY_GROUP_FORBIDDEN"
  | "SOCIETY_GROUP_HANDOVER_NOT_REQUIRED"
  | "SOCIETY_GROUP_LAST_ADMIN"
  | "SOCIETY_GROUP_LEAVE_ONLY_PERSON"
  | "SOCIETY_GROUP_LEAVE_REQUIRES_HANDOVER"
  | "SOCIETY_GROUP_NOT_MEMBER"
  | "SOCIETY_GROUP_PERIOD_ENDED"
  | "SOCIETY_GROUP_REACTIVATE_REQUIRES_ADMIN"
  | "SOCIETY_GROUP_TARGETS_UNAVAILABLE"
  | "SOCIETY_GROUP_VERSION_CONFLICT"
  | "NETWORK"
  | "TIMEOUT"
  | "UNKNOWN";

/* Il primo codice contenuto nel messaggio vince: nessuno è prefisso di un
   altro, salvo SOCIETY_GROUP_* rispetto a SOCIETY_GROUPS_*, che non si
   contengono a vicenda. */
const SERVER_CODES: readonly GroupsErrorCode[] = [
  "SOCIETY_GROUPS_NOT_AUTHORIZED",
  "SOCIETY_GROUP_NOT_FOUND",
  "SOCIETY_GROUP_TEAM_UNAVAILABLE",
  "SOCIETY_GROUP_PEOPLE_REQUIRED",
  "SOCIETY_GROUP_PEOPLE_UNAVAILABLE",
  "SOCIETY_GROUP_TOO_MANY_PEOPLE",
  "SOCIETY_GROUP_INVALID",
  "OPERATION_CONTENT_CHANGED",
  "SOCIETY_GROUP_ARCHIVED",
  "SOCIETY_GROUP_DELETED",
  "SOCIETY_GROUP_FORBIDDEN",
  "SOCIETY_GROUP_HANDOVER_NOT_REQUIRED",
  "SOCIETY_GROUP_LAST_ADMIN",
  "SOCIETY_GROUP_LEAVE_ONLY_PERSON",
  "SOCIETY_GROUP_LEAVE_REQUIRES_HANDOVER",
  "SOCIETY_GROUP_NOT_MEMBER",
  "SOCIETY_GROUP_PERIOD_ENDED",
  "SOCIETY_GROUP_REACTIVATE_REQUIRES_ADMIN",
  "SOCIETY_GROUP_TARGETS_UNAVAILABLE",
  "SOCIETY_GROUP_VERSION_CONFLICT",
];

export class GroupsError extends Error {
  code: GroupsErrorCode;
  /**
   * `name_required`, `avatar_invalid`, … per SOCIETY_GROUP_INVALID;
   * `OTHER_ADMIN` / `ARCHIVED` / `NOT_ADMIN` per HANDOVER_NOT_REQUIRED.
   */
  field: string | null;
  /** ID non più eleggibili (PEOPLE_UNAVAILABLE, TARGETS_UNAVAILABLE): già noti al client. */
  personIds: string[];
  /** TARGETS_UNAVAILABLE: gli ID ancora validi, dal `details` della risposta (§13, §19). */
  validIds: string[];

  constructor(
    code: GroupsErrorCode,
    options: { field?: string | null; message?: string; personIds?: string[]; validIds?: string[] } = {},
  ) {
    super(options.message ?? code);
    this.code = code;
    this.field = options.field ?? null;
    this.personIds = options.personIds ?? [];
    this.validIds = options.validIds ?? [];
    this.name = "GroupsError";
  }

  /** §24: un rifiuto di permesso non è un errore di rete. */
  get isAuthorization(): boolean {
    return this.code === "SOCIETY_GROUPS_NOT_AUTHORIZED" || this.code === "SOCIETY_GROUP_NOT_FOUND";
  }

  /**
   * DAS-REV-33 §26: la conversazione non è più raggiungibile da chi la
   * guardava (eliminata, periodo chiuso, fuori scope). Si smette di mostrarla.
   */
  get isAccessLost(): boolean {
    return (
      this.isAuthorization ||
      this.code === "SOCIETY_GROUP_DELETED" ||
      this.code === "SOCIETY_GROUP_NOT_MEMBER"
    );
  }

  /** §23: esito sconosciuto, la richiesta può essere arrivata. */
  get isTransport(): boolean {
    return this.code === "NETWORK" || this.code === "TIMEOUT";
  }
}

function messageOf(error: unknown): string {
  return typeof error === "object" && error !== null && "message" in error
    ? String((error as { message: unknown }).message)
    : String(error ?? "");
}

function detailsOf(error: unknown): string {
  return typeof error === "object" && error !== null && "details" in error
    ? String((error as { details: unknown }).details ?? "")
    : "";
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

export function toGroupsError(error: unknown): GroupsError {
  if (error instanceof GroupsError) {
    return error;
  }

  if (error instanceof DashboardTimeoutError) {
    return new GroupsError("TIMEOUT");
  }

  const message = messageOf(error);
  const code = SERVER_CODES.find((candidate) => message.includes(candidate));

  if (code === "SOCIETY_GROUP_INVALID") {
    const field = /SOCIETY_GROUP_INVALID:([a-z_]+)/.exec(message)?.[1] ?? null;

    return new GroupsError(code, { field, message });
  }

  if (code === "SOCIETY_GROUP_PEOPLE_UNAVAILABLE") {
    const tail = message.split("SOCIETY_GROUP_PEOPLE_UNAVAILABLE")[1] ?? "";

    return new GroupsError(code, { message, personIds: tail.match(UUID) ?? [] });
  }

  /* §13, §19: gli ID non validi viaggiano nel messaggio, quelli ancora validi
     in `details`. */
  if (code === "SOCIETY_GROUP_TARGETS_UNAVAILABLE") {
    const tail = message.split("SOCIETY_GROUP_TARGETS_UNAVAILABLE")[1] ?? "";

    return new GroupsError(code, {
      message,
      personIds: tail.match(UUID) ?? [],
      validIds: detailsOf(error).match(UUID) ?? [],
    });
  }

  if (code === "SOCIETY_GROUP_HANDOVER_NOT_REQUIRED") {
    return new GroupsError(code, { field: detailsOf(error).trim() || null, message });
  }

  if (code) {
    return new GroupsError(code, { message });
  }

  const category = classifyDashboardError(error);

  if (category === "timeout") {
    return new GroupsError("TIMEOUT", { message });
  }

  if (suggestsOffline(category)) {
    return new GroupsError("NETWORK", { message });
  }

  return new GroupsError("UNKNOWN", { message });
}

export async function groupsRpc<T>(name: string, params: Record<string, unknown>): Promise<T> {
  let result: { data: unknown; error: unknown };

  try {
    result = await withTimeout(
      supabase.rpc(name, params) as unknown as Promise<{ data: unknown; error: unknown }>,
      MODULE_TIMEOUT_MS,
      () => new DashboardTimeoutError(name),
    );
  } catch (error) {
    throw toGroupsError(error);
  }

  if (result.error) {
    throw toGroupsError(result.error);
  }

  return result.data as T;
}

// ── Mapper (righe RPC grezze → tipi) ─────────────────────────────────────────

type Raw = Record<string, unknown>;

const text = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const int = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && /^-?\d+$/.test(value)) return Number(value);
  return 0;
};

export function mapLimits(raw: unknown): GroupLimits {
  const row = (raw ?? {}) as Raw;

  return {
    avatarMaxBytes: int(row.avatarMaxBytes) || DEFAULT_GROUP_LIMITS.avatarMaxBytes,
    avatarMimeTypes: Array.isArray(row.avatarMimeTypes)
      ? row.avatarMimeTypes.filter((entry): entry is string => typeof entry === "string")
      : DEFAULT_GROUP_LIMITS.avatarMimeTypes,
    maxPeople: int(row.maxPeople) || DEFAULT_GROUP_LIMITS.maxPeople,
    minPeople: int(row.minPeople) || DEFAULT_GROUP_LIMITS.minPeople,
    nameMax: int(row.nameMax) || DEFAULT_GROUP_LIMITS.nameMax,
  };
}

export function mapGroupRow(row: Raw): SocietyGroupRow {
  return {
    avatarPath: text(row.avatar_path),
    conversationId: String(row.conversation_id),
    name: String(row.name ?? ""),
    peopleCount: int(row.people_count),
    teamId: text(row.team_id),
    teamName: text(row.team_name),
  };
}

export function mapGroupsPage(raw: Raw | null | undefined): SocietyGroupsPage {
  const row = raw ?? {};

  return {
    canCreate: row.can_create === true,
    items: Array.isArray(row.items) ? (row.items as Raw[]).map(mapGroupRow) : [],
    limits: mapLimits(row.limits),
    nextCursor: text(row.next_cursor),
  };
}

export function mapGroupDetail(row: Raw): SocietyGroupDetail {
  return {
    adminCount: int(row.admin_count),
    avatarPath: text(row.avatar_path),
    canManage: row.can_manage === true,
    canOpenConversation: row.can_open_conversation === true,
    clubId: String(row.club_id),
    clubName: String(row.club_name ?? ""),
    conversationId: String(row.conversation_id),
    name: String(row.name ?? ""),
    peopleCount: int(row.people_count),
    status: row.status === "archived" ? "archived" : "active",
    teamId: text(row.team_id),
    teamName: text(row.team_name),
  };
}

export function mapPerson(row: Raw): EligiblePerson {
  return {
    avatarUrl: text(row.avatar_url),
    fullName: String(row.full_name ?? ""),
    inTeam: row.in_team === true,
    profileId: String(row.profile_id),
    roleLabel: text(row.role_label),
  };
}

// ── Letture ─────────────────────────────────────────────────────────────────

export async function fetchSocietyGroupsPage(input: {
  clubId: string;
  cursor: string | null;
  limit?: number;
  query: string;
}): Promise<SocietyGroupsPage> {
  const raw = await groupsRpc<Raw>("fetch_society_groups_page", {
    p_club_id: input.clubId,
    p_cursor: input.cursor,
    p_limit: input.limit ?? GROUPS_PAGE_SIZE,
    p_query: input.query.trim() || null,
  });

  return mapGroupsPage(raw);
}

export async function fetchSocietyGroupDetail(clubId: string, conversationId: string): Promise<SocietyGroupDetail> {
  const raw = await groupsRpc<Raw | null>("fetch_society_group_detail", {
    p_club_id: clubId,
    p_conversation_id: conversationId,
  });

  if (!raw) {
    throw new GroupsError("SOCIETY_GROUP_NOT_FOUND");
  }

  return mapGroupDetail(raw);
}

export async function fetchGroupCreateContexts(): Promise<GroupCreateContext[]> {
  const rows = await groupsRpc<Raw[] | null>("fetch_society_group_create_contexts", {});

  return (rows ?? []).map((row) => ({
    clubId: String(row.club_id),
    clubName: String(row.club_name ?? ""),
    isVerified: row.is_verified === true,
    logoUrl: text(row.logo_url),
  }));
}

export async function fetchGroupTeams(clubId: string): Promise<GroupTeamsLookup> {
  const raw = (await groupsRpc<Raw | null>("fetch_society_group_teams", { p_club_id: clubId })) ?? {};

  return {
    canCreateWithoutTeam: raw.can_create_without_team === true,
    limits: mapLimits(raw.limits),
    teams: Array.isArray(raw.teams)
      ? (raw.teams as Raw[]).map((team) => ({
          teamId: String(team.team_id),
          teamName: String(team.team_name ?? ""),
        }))
      : [],
  };
}

export async function fetchEligiblePeoplePage(input: {
  clubId: string;
  cursor: string | null;
  limit?: number;
  query: string;
  teamId: string | null;
}): Promise<EligiblePeoplePage> {
  const raw =
    (await groupsRpc<Raw | null>("fetch_society_group_people_page", {
      p_club_id: input.clubId,
      p_cursor: input.cursor,
      p_limit: input.limit ?? PEOPLE_PAGE_SIZE,
      p_query: input.query.trim() || null,
      p_team_id: input.teamId,
    })) ?? {};

  return {
    items: Array.isArray(raw.items) ? (raw.items as Raw[]).map(mapPerson) : [],
    nextCursor: text(raw.next_cursor),
    teamTotal: int(raw.team_total),
  };
}

/** §19: tutti gli ID della squadra, oltre la pagina caricata. */
export async function fetchTeamPeopleIds(clubId: string, teamId: string): Promise<string[]> {
  const ids = await groupsRpc<unknown[] | null>("fetch_society_group_team_people_ids", {
    p_club_id: clubId,
    p_team_id: teamId,
  });

  return (ids ?? []).filter((id): id is string => typeof id === "string");
}

// ── Comando ─────────────────────────────────────────────────────────────────

/** §21: il client manda solo contenuto; creator, ruoli, tipo e stato li deriva il server. */
export async function createSocietyGroup(input: CreateGroupInput): Promise<CreateGroupResult> {
  const raw = await groupsRpc<Raw | null>("create_society_group", {
    p_avatar_asset_id: input.avatarAssetId,
    p_club_id: input.clubId,
    p_name: input.name,
    p_operation_key: input.operationKey,
    p_person_ids: input.personIds,
    p_source: input.source,
    p_team_id: input.teamId,
  });

  const conversationId = text(raw?.conversation_id);

  if (!conversationId) {
    throw new GroupsError("UNKNOWN");
  }

  return { conversationId, replayed: raw?.replayed === true };
}

// ── Avatar (§16) ────────────────────────────────────────────────────────────

export type GroupAvatarErrorCode =
  | "permission_denied"
  | "camera_denied"
  | "avatar_format"
  | "avatar_too_large"
  | "upload_failed";

export class GroupAvatarError extends Error {
  code: GroupAvatarErrorCode;

  constructor(code: GroupAvatarErrorCode) {
    super(code);
    this.code = code;
    this.name = "GroupAvatarError";
  }
}

export type PickedGroupAvatar = {
  height: number | null;
  mimeType: string;
  size: number | null;
  uri: string;
  width: number | null;
};

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function avatarMimeOf(asset: { fileName?: string | null; mimeType?: string | null; uri: string }): string | null {
  const declared = asset.mimeType?.toLowerCase() ?? null;

  if (declared) {
    return declared === "image/jpg" ? "image/jpeg" : declared;
  }

  const name = (asset.fileName ?? asset.uri).toLowerCase();

  if (/\.jpe?g$/.test(name)) return "image/jpeg";
  if (/\.png$/.test(name)) return "image/png";
  if (/\.webp$/.test(name)) return "image/webp";

  return null;
}

/** Controllo anticipato con i limiti del server: solo per dirlo subito. */
export function avatarPrecheck(
  picked: Pick<PickedGroupAvatar, "mimeType" | "size">,
  limits: Pick<GroupLimits, "avatarMaxBytes" | "avatarMimeTypes">,
): GroupAvatarErrorCode | null {
  if (!limits.avatarMimeTypes.includes(picked.mimeType)) {
    return "avatar_format";
  }

  if (picked.size !== null && picked.size > limits.avatarMaxBytes) {
    return "avatar_too_large";
  }

  return null;
}

/**
 * Picker e crop standard dell'app (`expo-image-picker`, `allowsEditing`,
 * quadrato come gli avatar profilo). `null` = annullato, non un errore.
 * DAS-REV-33 §10: «Scatta foto» usa lo stesso crop e gli stessi controlli;
 * un permesso negato non blocca la consultazione, solo quella scelta.
 */
export async function pickGroupAvatar(source: "camera" | "library" = "library"): Promise<PickedGroupAvatar | null> {
  const permission =
    source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new GroupAvatarError(source === "camera" ? "camera_denied" : "permission_denied");
  }

  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [1, 1],
          mediaTypes: ["images"],
          quality: 0.85,
        })
      : await ImagePicker.launchImageLibraryAsync({
          allowsEditing: true,
          allowsMultipleSelection: false,
          aspect: [1, 1],
          mediaTypes: ["images"],
          quality: 0.85,
        });

  const asset = result.canceled ? null : result.assets[0];

  if (!asset) {
    return null;
  }

  const mimeType = avatarMimeOf(asset);

  if (!mimeType) {
    throw new GroupAvatarError("avatar_format");
  }

  return {
    height: asset.height || null,
    mimeType,
    size: asset.fileSize ?? null,
    uri: asset.uri,
    width: asset.width || null,
  };
}

/** UUID v4: l'ID dell'asset è anche il nome del file (`<club>/<id>.<ext>`). */
export function createGroupAssetId(): string {
  const bytes = new Uint8Array(16);
  const cryptoApi = (globalThis as { crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array } }).crypto;

  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Carica e registra. Nessun gruppo viene creato qui (§16: «Non creare una
 * Conversation vuota per ottenere una cartella»): l'asset si collega solo
 * con la create.
 */
export async function uploadGroupAvatar(input: {
  clubId: string;
  limits: Pick<GroupLimits, "avatarMaxBytes" | "avatarMimeTypes">;
  picked: PickedGroupAvatar;
}): Promise<GroupAvatarRef> {
  const precheck = avatarPrecheck(input.picked, input.limits);

  if (precheck) {
    throw new GroupAvatarError(precheck);
  }

  const assetId = createGroupAssetId();
  const path = `${input.clubId}/${assetId}.${EXTENSIONS[input.picked.mimeType] ?? "jpg"}`;
  let body: ArrayBuffer;

  try {
    body = await (await fetch(input.picked.uri)).arrayBuffer();
  } catch {
    throw new GroupAvatarError("upload_failed");
  }

  if (body.byteLength > input.limits.avatarMaxBytes) {
    throw new GroupAvatarError("avatar_too_large");
  }

  const { error } = await supabase.storage.from(GROUP_AVATAR_BUCKET).upload(path, body, {
    contentType: input.picked.mimeType,
    upsert: false,
  });

  if (error) {
    throw new GroupAvatarError(/size|large/i.test(error.message) ? "avatar_too_large" : "upload_failed");
  }

  let registered: Raw | null;

  try {
    registered = await groupsRpc<Raw | null>("register_society_group_avatar", {
      p_asset_id: assetId,
      p_club_id: input.clubId,
      p_height: input.picked.height,
      p_width: input.picked.width,
    });
  } catch (rpcError) {
    const mapped = toGroupsError(rpcError);

    throw new GroupAvatarError(
      mapped.field === "avatar_format" ? "avatar_format" : mapped.field === "avatar_too_large" ? "avatar_too_large" : "upload_failed",
    );
  }

  const id = text(registered?.asset_id);
  const registeredPath = text(registered?.path);

  if (!id || !registeredPath) {
    throw new GroupAvatarError("upload_failed");
  }

  return { assetId: id, path: registeredPath };
}

/** URL firmato dell'avatar privato (bucket privato, §16). */
export async function fetchGroupAvatarUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(GROUP_AVATAR_BUCKET).createSignedUrl(path, 3600);

  if (error) {
    return null;
  }

  return data?.signedUrl ?? null;
}

// ── DAS-REV-33: mapper della gestione ───────────────────────────────────────

const flag = (value: unknown): boolean => value === true;

const uuidList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];

export function mapCapabilities(raw: unknown): GroupCapabilities {
  if (!raw || typeof raw !== "object") {
    return NO_GROUP_CAPABILITIES;
  }

  const row = raw as Raw;

  return {
    canAccessConversation: flag(row.can_access_conversation),
    canArchive: flag(row.can_archive),
    canDelete: flag(row.can_delete),
    canEditAvatar: flag(row.can_edit_avatar),
    canEditName: flag(row.can_edit_name),
    canEditTeam: flag(row.can_edit_team),
    canLeave: flag(row.can_leave),
    canManageAdmins: flag(row.can_manage_admins),
    canManagePeople: flag(row.can_manage_people),
    canReactivate: flag(row.can_reactivate),
    canRecover: flag(row.can_recover),
    canViewInfo: flag(row.can_view_info),
    canViewPeople: flag(row.can_view_people),
  };
}

const roleOf = (value: unknown): GroupMemberRole | null =>
  value === "admin" ? "admin" : value === "member" ? "member" : null;

const leavePathOf = (value: unknown): GroupLeavePath | null =>
  value === "ordinary" || value === "handover" || value === "add_people_first" ? (value as GroupLeavePath) : null;

export function mapGroupManagement(row: Raw): GroupManagement {
  return {
    adminCount: int(row.admin_count),
    archivedAt: text(row.archived_at),
    avatarPath: text(row.avatar_path),
    capabilities: mapCapabilities(row.capabilities),
    clubId: String(row.club_id),
    clubIsVerified: flag(row.club_is_verified),
    clubName: String(row.club_name ?? ""),
    conversationId: String(row.conversation_id),
    createdAt: text(row.created_at),
    leavePath: leavePathOf(row.leave_path),
    limits: mapLimits(row.limits),
    myPeriodId: text(row.my_period_id),
    myPeriodVersion: row.my_period_version == null ? null : int(row.my_period_version),
    myRole: roleOf(row.my_role),
    name: String(row.name ?? ""),
    peopleCount: int(row.people_count),
    status: row.status === "archived" ? "archived" : "active",
    teamId: text(row.team_id),
    teamName: text(row.team_name),
    version: int(row.version),
  };
}

export function mapGroupMember(row: Raw): GroupMember {
  return {
    avatarUrl: text(row.avatar_url),
    canDemote: flag(row.can_demote),
    canPromote: flag(row.can_promote),
    canRemove: flag(row.can_remove),
    fullName: String(row.full_name ?? ""),
    isMe: flag(row.is_me),
    memberRole: row.member_role === "admin" ? "admin" : "member",
    periodId: String(row.period_id),
    periodVersion: int(row.period_version),
    profileId: String(row.profile_id),
    roleLabel: text(row.role_label),
  };
}

export function mapMembersPage(raw: Raw | null | undefined): GroupMembersPage {
  const row = raw ?? {};

  return {
    adminCount: int(row.admin_count),
    capabilities: mapCapabilities(row.capabilities),
    items: Array.isArray(row.items) ? (row.items as Raw[]).map(mapGroupMember) : [],
    nextCursor: text(row.next_cursor),
    otherCount: int(row.other_count),
    peopleCount: int(row.people_count),
    status: row.status === "archived" ? "archived" : "active",
  };
}

export function mapArchivedRow(row: Raw): ArchivedGroupRow {
  return {
    adminCount: int(row.admin_count),
    archivedAt: text(row.archived_at),
    avatarPath: text(row.avatar_path),
    canDelete: flag(row.can_delete),
    canManage: flag(row.can_manage),
    conversationId: String(row.conversation_id),
    name: String(row.name ?? ""),
    needsRecovery: flag(row.needs_recovery),
    peopleCount: int(row.people_count),
    teamId: text(row.team_id),
    teamName: text(row.team_name),
  };
}

export function mapHandoverCandidate(row: Raw): HandoverCandidate {
  return {
    avatarUrl: text(row.avatar_url),
    fullName: String(row.full_name ?? ""),
    periodId: String(row.period_id),
    profileId: String(row.profile_id),
    roleLabel: text(row.role_label),
  };
}

export function mapCommandResult(raw: Raw | null | undefined): GroupCommandResult {
  const row = raw ?? {};

  return {
    added: int(row.added),
    addedIds: uuidList(row.added_ids),
    alreadyActiveIds: uuidList(row.already_active_ids),
    changed: flag(row.changed),
    deleted: flag(row.deleted),
    memberRole: roleOf(row.member_role),
    periodChanged: flag(row.period_changed),
    periodEnded: flag(row.period_ended),
    periodId: text(row.period_id),
    periodVersion: row.period_version == null ? null : int(row.period_version),
    promotedIds: uuidList(row.promoted_ids),
    replayed: flag(row.replayed),
    status: row.status === "archived" ? "archived" : row.status === "active" ? "active" : null,
    version: row.version == null ? null : int(row.version),
  };
}

// ── DAS-REV-33: letture ─────────────────────────────────────────────────────

type PagedInput = { conversationId: string; cursor: string | null; limit?: number; query: string };

export async function fetchGroupManagement(conversationId: string): Promise<GroupManagement> {
  const raw = await groupsRpc<Raw | null>("fetch_society_group_management", { p_conversation_id: conversationId });

  if (!raw) {
    throw new GroupsError("SOCIETY_GROUP_NOT_FOUND");
  }

  return mapGroupManagement(raw);
}

export async function fetchGroupMembersPage(input: PagedInput): Promise<GroupMembersPage> {
  const raw = await groupsRpc<Raw | null>("fetch_society_group_members_page", {
    p_conversation_id: input.conversationId,
    p_cursor: input.cursor,
    p_limit: input.limit ?? PEOPLE_PAGE_SIZE,
    p_query: input.query.trim() || null,
  });

  return mapMembersPage(raw);
}

export async function fetchGroupEligiblePage(input: PagedInput): Promise<GroupEligiblePage> {
  const raw =
    (await groupsRpc<Raw | null>("fetch_society_group_eligible_page", {
      p_conversation_id: input.conversationId,
      p_cursor: input.cursor,
      p_limit: input.limit ?? PEOPLE_PAGE_SIZE,
      p_query: input.query.trim() || null,
    })) ?? {};

  return {
    activeCount: int(raw.active_count),
    items: Array.isArray(raw.items) ? (raw.items as Raw[]).map(mapPerson) : [],
    limits: mapLimits(raw.limits),
    nextCursor: text(raw.next_cursor),
    teamTotal: int(raw.team_total),
  };
}

/** §13: «Seleziona tutti» della Squadra del gruppo, oltre la pagina caricata. */
export async function fetchGroupEligibleTeamIds(conversationId: string): Promise<string[]> {
  return uuidList(
    await groupsRpc<unknown[] | null>("fetch_society_group_eligible_team_ids", { p_conversation_id: conversationId }),
  );
}

export async function fetchGroupTeamOptions(conversationId: string): Promise<GroupTeamOptions> {
  const raw = (await groupsRpc<Raw | null>("fetch_society_group_team_options", { p_conversation_id: conversationId })) ?? {};

  return {
    canClear: flag(raw.can_clear),
    currentTeamId: text(raw.current_team_id),
    teams: Array.isArray(raw.teams)
      ? (raw.teams as Raw[]).map((team) => ({ teamId: String(team.team_id), teamName: String(team.team_name ?? "") }))
      : [],
  };
}

export async function fetchArchivedGroupsPage(input: {
  clubId: string;
  cursor: string | null;
  limit?: number;
  query: string;
}): Promise<ArchivedGroupsPage> {
  const raw =
    (await groupsRpc<Raw | null>("fetch_society_groups_archived_page", {
      p_club_id: input.clubId,
      p_cursor: input.cursor,
      p_limit: input.limit ?? GROUPS_PAGE_SIZE,
      p_query: input.query.trim() || null,
    })) ?? {};

  return {
    items: Array.isArray(raw.items) ? (raw.items as Raw[]).map(mapArchivedRow) : [],
    nextCursor: text(raw.next_cursor),
  };
}

export async function fetchHandoverCandidatesPage(input: PagedInput): Promise<HandoverCandidatesPage> {
  const raw =
    (await groupsRpc<Raw | null>("fetch_society_group_handover_candidates", {
      p_conversation_id: input.conversationId,
      p_cursor: input.cursor,
      p_limit: input.limit ?? PEOPLE_PAGE_SIZE,
      p_query: input.query.trim() || null,
    })) ?? {};

  return {
    items: Array.isArray(raw.items) ? (raw.items as Raw[]).map(mapHandoverCandidate) : [],
    nextCursor: text(raw.next_cursor),
  };
}

// ── DAS-REV-33: comandi ─────────────────────────────────────────────────────
//
// Ogni comando porta una chiave di idempotenza generata una volta per
// intenzione (`useGroupCommand`) e, dove esiste, la versione o il periodo
// osservati (§25): il server rivalida tutto al commit.

async function groupCommand(name: string, params: Record<string, unknown>): Promise<GroupCommandResult> {
  return mapCommandResult(await groupsRpc<Raw | null>(name, params));
}

export function renameGroup(input: {
  conversationId: string;
  expectedVersion: number;
  name: string;
  operationKey: string;
}): Promise<GroupCommandResult> {
  return groupCommand("society_group_rename", {
    p_conversation_id: input.conversationId,
    p_expected_version: input.expectedVersion,
    p_name: input.name,
    p_operation_key: input.operationKey,
  });
}

/** `assetId` null = rimuovi: il fallback deterministico, mai il logo Società (§10). */
export function setGroupAvatar(input: {
  assetId: string | null;
  conversationId: string;
  expectedVersion: number;
  operationKey: string;
}): Promise<GroupCommandResult> {
  return groupCommand("society_group_set_avatar", {
    p_asset_id: input.assetId,
    p_conversation_id: input.conversationId,
    p_expected_version: input.expectedVersion,
    p_operation_key: input.operationKey,
  });
}

export function setGroupTeam(input: {
  conversationId: string;
  expectedVersion: number;
  operationKey: string;
  teamId: string | null;
}): Promise<GroupCommandResult> {
  return groupCommand("society_group_set_team", {
    p_conversation_id: input.conversationId,
    p_expected_version: input.expectedVersion,
    p_operation_key: input.operationKey,
    p_team_id: input.teamId,
  });
}

type VersionedInput = { conversationId: string; expectedVersion: number; operationKey: string };

const versioned = (input: VersionedInput) => ({
  p_conversation_id: input.conversationId,
  p_expected_version: input.expectedVersion,
  p_operation_key: input.operationKey,
});

export const archiveGroup = (input: VersionedInput) => groupCommand("society_group_archive", versioned(input));
export const reactivateGroup = (input: VersionedInput) => groupCommand("society_group_reactivate", versioned(input));
export const deleteGroup = (input: VersionedInput) => groupCommand("society_group_delete", versioned(input));

export function addGroupPeople(input: {
  conversationId: string;
  operationKey: string;
  personIds: readonly string[];
}): Promise<GroupCommandResult> {
  return groupCommand("society_group_add_people", {
    p_conversation_id: input.conversationId,
    p_operation_key: input.operationKey,
    p_person_ids: [...input.personIds],
  });
}

/** §14: promozione/demozione sul periodo osservato, con la sua versione. */
export function setGroupMemberRole(input: {
  conversationId: string;
  expectedPeriodVersion: number;
  operationKey: string;
  periodId: string;
  role: GroupMemberRole;
}): Promise<GroupCommandResult> {
  return groupCommand("society_group_set_member_role", {
    p_conversation_id: input.conversationId,
    p_expected_period_version: input.expectedPeriodVersion,
    p_operation_key: input.operationKey,
    p_period_id: input.periodId,
    p_role: input.role,
  });
}

/** §15: vincolata al periodo osservato, non alla persona. */
export function removeGroupMember(input: {
  conversationId: string;
  operationKey: string;
  periodId: string;
}): Promise<GroupCommandResult> {
  return groupCommand("society_group_remove_member", {
    p_conversation_id: input.conversationId,
    p_operation_key: input.operationKey,
    p_period_id: input.periodId,
  });
}

export function leaveGroup(input: {
  conversationId: string;
  operationKey: string;
  periodId: string;
}): Promise<GroupCommandResult> {
  return groupCommand("society_group_leave", {
    p_conversation_id: input.conversationId,
    p_operation_key: input.operationKey,
    p_period_id: input.periodId,
  });
}

/** §19: promozione dei successori e uscita in un solo comando atomico. */
export function leaveGroupWithHandover(input: {
  conversationId: string;
  operationKey: string;
  periodId: string;
  successorIds: readonly string[];
}): Promise<GroupCommandResult> {
  return groupCommand("society_group_leave_with_handover", {
    p_conversation_id: input.conversationId,
    p_operation_key: input.operationKey,
    p_period_id: input.periodId,
    p_successor_ids: [...input.successorIds],
  });
}
