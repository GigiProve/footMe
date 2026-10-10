/**
 * Accesso ai dati della Rete societaria (DAS-REV-11).
 *
 * Nessuna regola di dominio vive qui. Capability, scope, equivalenza,
 * duplicati, versioni e transizioni li decide il backend — §26: «Applicare
 * controlli server-side a ogni operazione, anche se il client nasconde il
 * pulsante». Questo file traduce soltanto le righe in tipi e gli errori in
 * codici stabili; la copy italiana sta in `network-presentation.ts`.
 */
import { supabase } from "../../lib/supabase";
import type {
  EligibleSociety,
  InvitePublicContext,
  InviteResolveContext,
  IssuedInvite,
  LinkEligibility,
  NetworkCapability,
  NetworkHeader,
  NetworkListPage,
  NetworkRequestItem,
  NetworkRequestsPage,
  PendingInviteItem,
  RelationshipAction,
  RelationshipType,
  RelationshipView,
  SocietySummary,
} from "./network-types";
import { NETWORK_CAPABILITIES } from "./network-types";

/**
 * Codici applicativi sollevati dalle RPC. Sono stringhe stabili e non
 * messaggi: §29 descrive la copy, e il database non deve conoscerla.
 */
export type NetworkErrorCode =
  | "NETWORK_NOT_AUTHORIZED"
  | "RELATIONSHIP_NOT_FOUND"
  | "RELATIONSHIP_SELF_LINK"
  | "RELATIONSHIP_TARGET_INVALID"
  | "RELATIONSHIP_TYPE_INVALID"
  | "RELATIONSHIP_ROLE_REQUIRED"
  | "RELATIONSHIP_ROLE_NOT_APPLICABLE"
  | "RELATIONSHIP_ALREADY_ACTIVE"
  | "RELATIONSHIP_EXCLUSIVITY_CONFLICT"
  | "RELATIONSHIP_NOT_ACTIVE"
  | "RELATIONSHIP_DECISION_INVALID"
  | "REQUEST_ALREADY_PENDING"
  | "REQUEST_ALREADY_HANDLED"
  | "PROPOSAL_CHANGED"
  | "INVITE_INVALID"
  | "INVITE_EXPIRED"
  | "INVITE_REVOKED"
  | "INVITE_ALREADY_RESOLVED"
  | "OPERATION_CONTENT_CHANGED"
  | "RATE_LIMIT"
  | "UNKNOWN";

export class NetworkOperationError extends Error {
  code: NetworkErrorCode;
  /** `REQUEST_ALREADY_PENDING:<id>` porta con sé la richiesta da riaprire. */
  relationshipId: string | null;

  constructor(
    code: NetworkErrorCode,
    message?: string,
    relationshipId: string | null = null,
  ) {
    super(message ?? code);
    this.code = code;
    this.name = "NetworkOperationError";
    this.relationshipId = relationshipId;
  }
}

const KNOWN_CODES: NetworkErrorCode[] = [
  "NETWORK_NOT_AUTHORIZED",
  "RELATIONSHIP_NOT_FOUND",
  "RELATIONSHIP_SELF_LINK",
  "RELATIONSHIP_TARGET_INVALID",
  "RELATIONSHIP_TYPE_INVALID",
  "RELATIONSHIP_ROLE_REQUIRED",
  "RELATIONSHIP_ROLE_NOT_APPLICABLE",
  "RELATIONSHIP_ALREADY_ACTIVE",
  "RELATIONSHIP_EXCLUSIVITY_CONFLICT",
  "RELATIONSHIP_NOT_ACTIVE",
  "RELATIONSHIP_DECISION_INVALID",
  "REQUEST_ALREADY_PENDING",
  "REQUEST_ALREADY_HANDLED",
  "PROPOSAL_CHANGED",
  "INVITE_INVALID",
  "INVITE_EXPIRED",
  "INVITE_REVOKED",
  "INVITE_ALREADY_RESOLVED",
  "OPERATION_CONTENT_CHANGED",
  "RATE_LIMIT",
];

export function toNetworkError(error: unknown): NetworkOperationError {
  if (error instanceof NetworkOperationError) {
    return error;
  }

  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error ?? "");

  const match = KNOWN_CODES.find((code) => message.includes(code));

  if (match === "REQUEST_ALREADY_PENDING") {
    const id = message.split("REQUEST_ALREADY_PENDING:")[1]?.trim() ?? null;
    return new NetworkOperationError(match, message, id || null);
  }

  return new NetworkOperationError(match ?? "UNKNOWN", message);
}

type RawRecord = Record<string, unknown>;

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function count(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function bool(value: unknown): boolean {
  return value === true;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function mapSociety(value: unknown): SocietySummary {
  const row = (value ?? {}) as RawRecord;

  return {
    city: text(row.city),
    clubId: String(row.club_id ?? ""),
    isVerified: bool(row.is_verified),
    logoUrl: text(row.logo_url),
    name: text(row.name) ?? "",
    province: text(row.province),
    region: text(row.region),
  };
}

const ACTIONS: RelationshipAction[] = ["accept", "reject", "cancel", "end"];

export function mapRelationship(value: unknown): RelationshipView {
  const row = (value ?? {}) as RawRecord;

  return {
    acceptedAt: text(row.accepted_at),
    activeSentence: text(row.active_sentence),
    allowedActions: stringList(row.allowed_actions).filter(
      (action): action is RelationshipAction =>
        (ACTIONS as string[]).includes(action),
    ),
    cancelledAt: text(row.cancelled_at),
    clubA: mapSociety(row.club_a),
    clubB: mapSociety(row.club_b),
    counterpart: mapSociety(row.counterpart),
    counterpartRoleId: text(row.counterpart_role_id),
    counterpartRoleLabel: text(row.counterpart_role_label),
    draftSentence: text(row.draft_sentence),
    endedAt: text(row.ended_at),
    endedByClubId: text(row.ended_by_club_id),
    groupLabel: text(row.group_label),
    groupSort: typeof row.group_sort === "number" ? row.group_sort : 0,
    isDirectional: bool(row.is_directional),
    isPublic: bool(row.is_public),
    isRequester: bool(row.is_requester),
    proposalSentence: text(row.proposal_sentence),
    recipientClubId: String(row.recipient_club_id ?? ""),
    rejectedAt: text(row.rejected_at),
    relationshipId: String(row.relationship_id ?? ""),
    requestedAt: text(row.requested_at),
    requesterClubId: String(row.requester_club_id ?? ""),
    rowLabel: text(row.row_label),
    status: (text(row.status) ?? "pending") as RelationshipView["status"],
    typeDescription: text(row.type_description),
    typeId: String(row.type_id ?? ""),
    typeLabel: text(row.type_label) ?? "",
    version: typeof row.version === "number" ? row.version : 1,
    viewerClubId: String(row.viewer_club_id ?? ""),
    viewerRoleId: text(row.viewer_role_id),
    viewerRoleLabel: text(row.viewer_role_label),
    viewerSide: row.viewer_side === "b" ? "b" : "a",
  };
}

function mapInvite(value: unknown): PendingInviteItem {
  const row = (value ?? {}) as RawRecord;

  return {
    createdAt: text(row.created_at) ?? "",
    descriptiveName: text(row.descriptive_name),
    expiresAt: text(row.expires_at) ?? "",
    inviteId: String(row.invite_id ?? ""),
    inviterRoleId: text(row.inviter_role_id),
    isDirectional: bool(row.is_directional),
    state: (text(row.state) ?? "valid") as PendingInviteItem["state"],
    typeId: String(row.type_id ?? ""),
    typeLabel: text(row.type_label) ?? "",
    version: typeof row.version === "number" ? row.version : 1,
  };
}

export async function fetchNetworkHeader(clubId: string): Promise<NetworkHeader> {
  const { data, error } = await supabase
    .rpc("fetch_society_network", { p_club_id: clubId })
    .maybeSingle();

  if (error) throw toNetworkError(error);

  const row = (data ?? {}) as RawRecord;

  return {
    accessVerifiedAt: row.access_verified_at
      ? new Date(String(row.access_verified_at)).getTime()
      : Date.now(),
    activeRelationshipCount: count(row.active_relationship_count),
    capabilities: stringList(row.capabilities).filter(
      (key): key is NetworkCapability =>
        (NETWORK_CAPABILITIES as readonly string[]).includes(key),
    ),
    city: text(row.club_city),
    clubId: String(row.club_id ?? clubId),
    dataRevision: typeof row.data_revision === "number" ? row.data_revision : 0,
    distinctSocietyCount: count(row.distinct_society_count),
    historyCount: count(row.history_count),
    isVerified: bool(row.club_is_verified),
    logoUrl: text(row.club_logo_url),
    name: text(row.club_name) ?? "",
    openInvitesCount: count(row.open_invites_count),
    province: text(row.club_province),
    region: text(row.club_region),
    requestsReceivedCount: count(row.requests_received_count),
    requestsSentCount: count(row.requests_sent_count),
  };
}

export async function fetchNetworkPage(
  clubId: string,
  cursor: string | null,
  limit = 20,
): Promise<NetworkListPage> {
  const { data, error } = await supabase.rpc("fetch_society_network_page", {
    p_club_id: clubId,
    p_cursor: cursor,
    p_limit: limit,
  });

  if (error) throw toNetworkError(error);

  const rows = (data ?? []) as RawRecord[];

  return {
    items: rows.map((row) => mapRelationship(row.payload)),
    nextCursor:
      rows.length === limit ? text(rows[rows.length - 1]?.sort_key) : null,
  };
}

export async function fetchNetworkRequests(
  clubId: string,
  cursor: string | null,
  limit = 20,
): Promise<NetworkRequestsPage> {
  const { data, error } = await supabase.rpc("fetch_society_network_requests", {
    p_club_id: clubId,
    p_cursor: cursor,
    p_limit: limit,
  });

  if (error) throw toNetworkError(error);

  const rows = (data ?? []) as RawRecord[];

  const items: NetworkRequestItem[] = rows.map((row) => {
    if (row.item_kind === "invite") {
      return { invite: mapInvite(row.payload), kind: "invite" };
    }

    return {
      kind: row.item_kind === "received" ? "received" : "sent",
      relationship: mapRelationship(row.payload),
    } as NetworkRequestItem;
  });

  return {
    items,
    nextCursor:
      rows.length === limit ? text(rows[rows.length - 1]?.sort_key) : null,
  };
}

export async function fetchNetworkHistoryPage(
  clubId: string,
  cursor: string | null,
  limit = 20,
): Promise<NetworkListPage> {
  const { data, error } = await supabase.rpc(
    "fetch_society_network_history_page",
    { p_club_id: clubId, p_cursor: cursor, p_limit: limit },
  );

  if (error) throw toNetworkError(error);

  const rows = (data ?? []) as RawRecord[];

  return {
    items: rows.map((row) => mapRelationship(row.payload)),
    nextCursor:
      rows.length === limit ? text(rows[rows.length - 1]?.sort_key) : null,
  };
}

export async function fetchRelationshipDetail(
  relationshipId: string,
  clubId: string,
): Promise<RelationshipView> {
  const { data, error } = await supabase.rpc("fetch_society_relationship", {
    p_club_id: clubId,
    p_relationship_id: relationshipId,
  });

  if (error) throw toNetworkError(error);

  return mapRelationship(data);
}

export async function fetchRelationshipTypes(): Promise<RelationshipType[]> {
  const { data, error } = await supabase.rpc("fetch_society_relationship_types");

  if (error) throw toNetworkError(error);

  return ((data ?? []) as RawRecord[]).map((row) => ({
    activeTemplate: text(row.active_template) ?? "",
    description: text(row.description),
    draftTemplate: text(row.draft_template) ?? "",
    exclusivityGroup: text(row.exclusivity_group),
    id: String(row.id ?? ""),
    isDirectional: bool(row.is_directional),
    isSelectable: bool(row.is_selectable),
    label: text(row.label) ?? "",
    proposalTemplate: text(row.proposal_template) ?? "",
    roleAId: text(row.role_a_id),
    roleALabel: text(row.role_a_label),
    roleASection: text(row.role_a_section),
    roleBId: text(row.role_b_id),
    roleBLabel: text(row.role_b_label),
    roleBSection: text(row.role_b_section),
    rowTemplateA: text(row.row_template_a),
    rowTemplateB: text(row.row_template_b),
    rowTemplateSymmetric: text(row.row_template_symmetric),
    sortOrder: typeof row.sort_order === "number" ? row.sort_order : 0,
    symmetricSection: text(row.symmetric_section),
  }));
}

export async function fetchLinkEligibility(
  clubId: string,
  targetIds: string[],
): Promise<LinkEligibility[]> {
  if (targetIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase.rpc("fetch_society_link_eligibility", {
    p_club_id: clubId,
    p_target_ids: targetIds,
  });

  if (error) throw toNetworkError(error);

  return ((data ?? []) as RawRecord[]).map((row) => ({
    availableTypeIds: stringList(row.available_type_ids),
    blockingTypeIds: stringList(row.blocking_type_ids),
    relationshipId: text(row.relationship_id),
    society: row.society ? mapSociety(row.society) : null,
    state: (text(row.state) ?? "eligible") as LinkEligibility["state"],
    targetClubId: String(row.target_club_id ?? ""),
  }));
}

export async function createRelationshipRequest(input: {
  clubId: string;
  idempotencyKey: string;
  roleId: string | null;
  targetClubId: string;
  typeId: string;
}): Promise<RelationshipView> {
  const { data, error } = await supabase.rpc(
    "create_society_relationship_request",
    {
      p_club_id: input.clubId,
      p_idempotency_key: input.idempotencyKey,
      p_role_id: input.roleId,
      p_target_club_id: input.targetClubId,
      p_type_id: input.typeId,
    },
  );

  if (error) throw toNetworkError(error);

  return mapRelationship(data);
}

export async function decideRelationship(input: {
  clubId: string;
  decision: RelationshipAction;
  idempotencyKey: string;
  relationshipId: string;
  version: number | null;
}): Promise<RelationshipView> {
  const { data, error } = await supabase.rpc("decide_society_relationship", {
    p_club_id: input.clubId,
    p_decision: input.decision,
    p_idempotency_key: input.idempotencyKey,
    p_relationship_id: input.relationshipId,
    p_version: input.version,
  });

  if (error) throw toNetworkError(error);

  return mapRelationship(data);
}

export async function issueSocietyInvite(input: {
  clubId: string;
  descriptiveName: string | null;
  idempotencyKey: string;
  roleId: string | null;
  rotate?: boolean;
  typeId: string;
}): Promise<IssuedInvite> {
  const { data, error } = await supabase
    .rpc("issue_society_relationship_invite", {
      p_club_id: input.clubId,
      p_idempotency_key: input.idempotencyKey,
      p_name: input.descriptiveName,
      p_role_id: input.roleId,
      p_rotate: input.rotate ?? false,
      p_type_id: input.typeId,
    })
    .maybeSingle();

  if (error) throw toNetworkError(error);

  const row = (data ?? {}) as RawRecord;

  return {
    expiresAt: text(row.invite_expires_at) ?? "",
    inviteId: String(row.invite_id ?? ""),
    state: (text(row.invite_state) ?? "valid") as IssuedInvite["state"],
    token: text(row.invite_token),
    version: typeof row.invite_version === "number" ? row.invite_version : 1,
  };
}

export async function revokeSocietyInvite(
  inviteId: string,
  idempotencyKey: string,
): Promise<void> {
  const { error } = await supabase.rpc("revoke_society_relationship_invite", {
    p_idempotency_key: idempotencyKey,
    p_invite_id: inviteId,
  });

  if (error) throw toNetworkError(error);
}

export async function fetchInvitePublicContext(
  token: string,
): Promise<InvitePublicContext> {
  const { data, error } = await supabase.rpc("fetch_society_invite_public", {
    p_token: token,
  });

  if (error) throw toNetworkError(error);

  const row = (data ?? {}) as RawRecord;
  const state = text(row.state) ?? "invalid";

  if (state !== "valid") {
    return { state: state as Exclude<InvitePublicContext, { state: "valid" }>["state"] };
  }

  return {
    inviter: mapSociety(row.inviter),
    state: "valid",
    typeId: String(row.type_id ?? ""),
    typeLabel: text(row.type_label) ?? "",
  };
}

export async function fetchInviteResolveContext(
  token: string,
): Promise<InviteResolveContext> {
  const { data, error } = await supabase.rpc("fetch_society_invite_context", {
    p_token: token,
  });

  if (error) throw toNetworkError(error);

  const row = (data ?? {}) as RawRecord;
  const state = text(row.state) ?? "invalid";

  if (state === "resolved") {
    return {
      clubId: String(row.club_id ?? ""),
      relationshipId: text(row.relationship_id),
      state: "resolved",
    };
  }

  if (state !== "valid") {
    return {
      state: state as Exclude<
        InviteResolveContext,
        { state: "valid" } | { state: "resolved" }
      >["state"],
    };
  }

  const societies = Array.isArray(row.eligible_societies)
    ? (row.eligible_societies as RawRecord[])
    : [];

  return {
    descriptiveName: text(row.descriptive_name),
    eligibleSocieties: societies.map(
      (entry): EligibleSociety => ({
        ...mapSociety(entry),
        blocked: bool(entry.blocked),
        isSelf: bool(entry.is_self),
      }),
    ),
    inviter: mapSociety(row.inviter),
    isDirectional: bool(row.is_directional),
    state: "valid",
    typeId: String(row.type_id ?? ""),
    typeLabel: text(row.type_label) ?? "",
  };
}

export async function resolveSocietyInvite(input: {
  clubId: string;
  idempotencyKey: string;
  token: string;
}): Promise<RelationshipView> {
  const { data, error } = await supabase.rpc(
    "resolve_society_relationship_invite",
    {
      p_club_id: input.clubId,
      p_idempotency_key: input.idempotencyKey,
      p_token: input.token,
    },
  );

  if (error) throw toNetworkError(error);

  return mapRelationship(data);
}
