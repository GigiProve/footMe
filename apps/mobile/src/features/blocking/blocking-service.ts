/**
 * Accesso dati di Blocca / Sblocca (HOM-12 §13, §166, §173–§175, §206–§207) → RPC
 * `block_identity`, `unblock_identity`, `fetch_profile_availability`,
 * `fetch_blocked_identities` (contratto §4).
 *
 * Il Block è un dominio separato da Unfollow, Non mi interessa e Segnala (§165–§170):
 * nessuna di queste RPC chiama le altre. Il server rivalida blocker, target e
 * capability a ogni chiamata (§13); qui solo il ponte snake_case → camelCase con
 * default sicuri: uno stato sconosciuto è un errore, mai un finto successo (§199).
 *
 * Se la forma reale dei payload differisce, l'allineamento è in questo file.
 */

import { supabase } from "../../lib/supabase";
import type {
  BlockIdentityRef,
  BlockIdentityType,
  BlockResult,
  BlockStatus,
  BlockedIdentitiesPage,
  BlockedIdentity,
  ProfileAvailability,
  ProfileAvailabilityState,
  UnblockStatus,
} from "./blocking-types";

type Raw = Record<string, unknown>;

const IDENTITY_TYPES: readonly BlockIdentityType[] = ["person", "society", "media"];
const BLOCK_STATUSES: readonly BlockStatus[] = [
  "blocked",
  "already_blocked",
  "not_allowed",
  "target_unavailable",
  "invalid",
];
const UNBLOCK_STATUSES: readonly UnblockStatus[] = ["unblocked", "not_blocked", "not_allowed"];
const AVAILABILITY_STATES: readonly ProfileAvailabilityState[] = [
  "available",
  "blocked_by_me",
  "unavailable",
];

export const BLOCKED_PAGE_SIZE = 30;

function isRecord(value: unknown): value is Raw {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapObject(data: unknown): Raw | null {
  const row = Array.isArray(data) ? data[0] : data;
  return isRecord(row) ? row : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function isBlockIdentityType(value: unknown): value is BlockIdentityType {
  return typeof value === "string" && IDENTITY_TYPES.includes(value as BlockIdentityType);
}

function mapRef(value: unknown): BlockIdentityRef | null {
  if (!isRecord(value) || !isBlockIdentityType(value.type) || typeof value.id !== "string") {
    return null;
  }
  return { id: value.id, type: value.type };
}

export function mapBlockResult(data: unknown): BlockResult {
  const row = unwrapObject(data);
  const status = row?.status;

  if (!BLOCK_STATUSES.includes(status as BlockStatus)) {
    throw new Error("block_identity: risposta non valida");
  }

  return { blockId: text(row?.block_id), status: status as BlockStatus };
}

export function mapUnblockStatus(data: unknown): UnblockStatus {
  const status = unwrapObject(data)?.status;

  if (!UNBLOCK_STATUSES.includes(status as UnblockStatus)) {
    throw new Error("unblock_identity: risposta non valida");
  }

  return status as UnblockStatus;
}

export function mapAvailability(data: unknown): ProfileAvailability {
  const row = unwrapObject(data);
  const state = row?.state;

  if (!AVAILABILITY_STATES.includes(state as ProfileAvailabilityState)) {
    // Mai un profilo «disponibile» per default: senza risposta valida non si mostra nulla (§177).
    throw new Error("fetch_profile_availability: risposta non valida");
  }

  return {
    blockId: text(row?.block_id),
    blocker: mapRef(row?.blocker),
    name: text(row?.name),
    state: state as ProfileAvailabilityState,
  };
}

export function mapBlockedIdentities(data: unknown): BlockedIdentitiesPage {
  const rows = Array.isArray(data) ? data : [];

  const items = rows.flatMap((row): BlockedIdentity[] => {
    if (
      !isRecord(row) ||
      typeof row.block_id !== "string" ||
      typeof row.identity_id !== "string" ||
      !isBlockIdentityType(row.identity_type) ||
      !isBlockIdentityType(row.blocker_type) ||
      typeof row.blocker_id !== "string"
    ) {
      // Una riga non interpretabile non fa cadere la lista (client più vecchio del backend).
      return [];
    }

    return [
      {
        avatarUrl: text(row.avatar_url),
        blockId: row.block_id,
        blockedAt: typeof row.blocked_at === "string" ? row.blocked_at : "",
        blockerId: row.blocker_id,
        blockerType: row.blocker_type,
        identityId: row.identity_id,
        identityType: row.identity_type,
        isVerified: row.is_verified === true,
        name: typeof row.name === "string" ? row.name : "",
        subtitle: text(row.subtitle),
      },
    ];
  });

  // Il cursore viaggia su ogni riga (`next_cursor`): vale quello dell'ultima.
  const last = rows[rows.length - 1];
  const cursor = isRecord(last) && isRecord(last.next_cursor) ? last.next_cursor : null;

  return { items, nextCursor: cursor };
}

export async function blockIdentity(input: {
  operationKey: string;
  blocker: BlockIdentityRef;
  target: BlockIdentityRef;
}): Promise<BlockResult> {
  const { data, error } = await supabase.rpc("block_identity", {
    p_blocker_id: input.blocker.id,
    p_blocker_type: input.blocker.type,
    p_operation_key: input.operationKey,
    p_target_id: input.target.id,
    p_target_type: input.target.type,
  });

  if (error) {
    throw error;
  }

  return mapBlockResult(data);
}

export async function unblockIdentity(input: {
  blocker: BlockIdentityRef;
  target: BlockIdentityRef;
}): Promise<UnblockStatus> {
  const { data, error } = await supabase.rpc("unblock_identity", {
    p_blocker_id: input.blocker.id,
    p_blocker_type: input.blocker.type,
    p_target_id: input.target.id,
    p_target_type: input.target.type,
  });

  if (error) {
    throw error;
  }

  return mapUnblockStatus(data);
}

/** Il cancello server dei profili (§173–§175): si chiama PRIMA di caricare il profilo. */
export async function fetchProfileAvailability(
  target: BlockIdentityRef,
): Promise<ProfileAvailability> {
  const { data, error } = await supabase.rpc("fetch_profile_availability", {
    p_target_id: target.id,
    p_target_type: target.type,
  });

  if (error) {
    throw error;
  }

  return mapAvailability(data);
}

export async function fetchBlockedIdentities(
  cursor: Record<string, unknown> | null,
  limit = BLOCKED_PAGE_SIZE,
): Promise<BlockedIdentitiesPage> {
  const { data, error } = await supabase.rpc("fetch_blocked_identities", {
    p_cursor: cursor,
    p_limit: limit,
  });

  if (error) {
    throw error;
  }

  return mapBlockedIdentities(data);
}
