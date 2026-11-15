/**
 * Accesso dati del Repost (HOM-10 §32–§44, §63, §66–§69, §128–§131, §225–§229,
 * §234–§238): le tre RPC del contratto e il mapping snake_case → camelCase. È
 * l'unico ponte tra le forme grezze (`Wire*`) e i tipi dei componenti.
 *
 *  • `fetch_repost_state` — il contenuto è ripostabile dal viewer? Quali identità
 *    possono farlo e quali hanno già un Simple Repost attivo? Più lo snapshot
 *    dell'originale per la card del composer. Le capability le rivaluta SEMPRE il
 *    server (§35): questa lettura serve a disegnare, non a decidere;
 *  • `repost_content` — il Simple Repost. Idempotente per `operationKey` (§69,
 *    §234) e per unicità attiva (§68, §236: `already_reposted` è lo stato canonico);
 *  • `remove_repost` — idempotente: la seconda chiamata è `not_found` e il client la
 *    tratta come riuscita (§238).
 *
 * Il Post con testo NON passa da qui: usa `submit_content` del composer con
 * `reference` nel payload (§86, §235). Gli esiti di business (`content_unavailable`,
 * `forbidden`) sono stati, non eccezioni: l'utente li vede con una frase sua (§229).
 */

import { supabase } from "../../lib/supabase";
import { snapshotToPreview } from "../share/share-presentation";
import type { ComposerIdentityType } from "../post-composer/composer-types";
import type {
  RemoveRepostOutcome,
  RepostContentRef,
  RepostIdentity,
  RepostOutcome,
  RepostResult,
  RepostState,
  WireRepostIdentity,
  WireRepostState,
} from "./repost-types";

const IDENTITY_TYPES: readonly ComposerIdentityType[] = ["person", "society", "media"];

const DEFAULT_CONTEXT: Record<ComposerIdentityType, string> = {
  media: "Media",
  person: "Profilo personale",
  society: "Società",
};

const REPOST_OUTCOMES: readonly RepostOutcome[] = [
  "created",
  "already_reposted",
  "content_unavailable",
  "forbidden",
];

const REMOVE_OUTCOMES: readonly RemoveRepostOutcome[] = ["removed", "not_found", "forbidden"];

function unwrapRow<T>(data: unknown): T | null {
  const row = Array.isArray(data) ? data[0] : data;
  return typeof row === "object" && row !== null ? (row as T) : null;
}

/** `null` se la riga non ha identità riconoscibile: non si mostra a metà. */
export function mapRepostIdentity(wire: Partial<WireRepostIdentity> | null | undefined): RepostIdentity | null {
  const type = IDENTITY_TYPES.find((candidate) => candidate === wire?.identity_type);

  if (!wire || !type || !wire.identity_id) {
    return null;
  }

  return {
    avatarUrl: wire.avatar_url ?? null,
    // §35: senza la capability dal server non c'è nulla; mai un default permissivo.
    canPublishPost: wire.can_publish_post === true,
    canRepost: wire.can_repost === true,
    canSchedule: wire.can_schedule_content === true,
    contextLabel: wire.context_label?.trim() || DEFAULT_CONTEXT[type],
    hasSimpleRepost: wire.has_simple_repost === true,
    id: wire.identity_id,
    isVerified: wire.is_verified === true,
    name: wire.display_name ?? "",
    type,
  };
}

export function mapRepostState(wire: Partial<WireRepostState> | null | undefined): RepostState {
  const preview = wire?.snapshot ? snapshotToPreview(wire.snapshot) : null;

  return {
    identities: (wire?.identities ?? [])
      .map(mapRepostIdentity)
      .filter((identity): identity is RepostIdentity => identity !== null),
    preview,
    // Ripostabile solo se il server lo dice: un campo assente non è un sì.
    repostable: wire?.repostable === true,
  };
}

export function mapRepostResult(raw: unknown): RepostResult {
  const row = unwrapRow<{ status?: string | null; repost_id?: string | null }>(raw);
  const status = REPOST_OUTCOMES.find((candidate) => candidate === row?.status);

  if (!status) {
    throw new Error("repost_content: risposta inattesa");
  }

  return { repostId: row?.repost_id ?? null, status };
}

export function mapRemoveOutcome(raw: unknown): RemoveRepostOutcome {
  const row = unwrapRow<{ status?: string | null }>(raw);
  const status = REMOVE_OUTCOMES.find((candidate) => candidate === row?.status);

  if (!status) {
    throw new Error("remove_repost: risposta inattesa");
  }

  return status;
}

/** §32–§44: stato Repost del contenuto per il viewer. */
export async function fetchRepostState(ref: RepostContentRef): Promise<RepostState> {
  const { data, error } = await supabase.rpc("fetch_repost_state", {
    p_content_id: ref.contentId,
    p_content_type: ref.contentType,
  });

  if (error) {
    throw error;
  }

  return mapRepostState(unwrapRow<WireRepostState>(data));
}

export type RepostContentInput = {
  /** §234: stabile per l'azione; doppio tap e retry la riusano. */
  operationKey: string;
  identityType: ComposerIdentityType;
  identityId: string;
  ref: RepostContentRef;
};

/** §63, §225: crea il Simple Repost. L'input malformato (22023) è un errore, non uno stato. */
export async function repostContent(input: RepostContentInput): Promise<RepostResult> {
  const { data, error } = await supabase.rpc("repost_content", {
    p_content_id: input.ref.contentId,
    p_content_type: input.ref.contentType,
    p_identity_id: input.identityId,
    p_identity_type: input.identityType,
    p_operation_key: input.operationKey,
  });

  if (error) {
    throw error;
  }

  return mapRepostResult(data);
}

export type RemoveRepostInput = {
  identityType: ComposerIdentityType;
  identityId: string;
  ref: RepostContentRef;
};

/** §128–§131: rimuove il solo Simple Repost; l'originale non cambia (§131). */
export async function removeRepost(input: RemoveRepostInput): Promise<RemoveRepostOutcome> {
  const { data, error } = await supabase.rpc("remove_repost", {
    p_content_id: input.ref.contentId,
    p_content_type: input.ref.contentType,
    p_identity_id: input.identityId,
    p_identity_type: input.identityType,
  });

  if (error) {
    throw error;
  }

  return mapRemoveOutcome(data);
}
