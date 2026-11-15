/**
 * Accesso dati della Condivisione (HOM-09): le tre RPC del contratto e il
 * mapping snake_case → camelCase. È l'unico ponte tra le forme grezze e i tipi
 * dei componenti.
 *
 *  • `search_share_recipients` — lista unica (§46), cursore (§74), dedup
 *    DIRECT/persona e filtri su blocchi, privacy e account lato server (§209);
 *  • `send_content_share` — un solo batch, un esito per destinazione (§125,
 *    §140, §226). Lo snapshot lo costruisce il server (§100), mai il client;
 *  • `record_content_share_event` — Copia link riuscito ed apertura dello share
 *    sheet esterno; mai un «completato» (§202–§203).
 *
 * Il mapping è difensivo sui valori mancanti ma non inventa nulla: una riga
 * senza chiave o tipo noto viene scartata, un esito senza `delivery_key` pure.
 */

import { supabase } from "../../lib/supabase";
import type { FeedContentType } from "../feed/feed-types";
import {
  type RawShareRecipient,
  type SendContentShareInput,
  type ShareDeliveryOutcome,
  type ShareEventKind,
  type ShareRecipient,
  type ShareRecipientKind,
  type ShareRecipientsPage,
  type ShareSendResult,
  type ShareSendStatus,
} from "./share-types";

export const SHARE_RECIPIENTS_PAGE_SIZE = 20;

const RECIPIENT_KINDS: readonly ShareRecipientKind[] = [
  "direct",
  "group",
  "person",
  "club",
  "media",
];

/** `null` se la riga non ha chiave o tipo riconoscibili: non si mostra a metà. */
export function mapShareRecipient(raw: RawShareRecipient | null | undefined): ShareRecipient | null {
  if (!raw || !raw.recipient_key || !raw.display_name) {
    return null;
  }

  const kind = RECIPIENT_KINDS.find((candidate) => candidate === raw.kind);

  if (!kind) {
    return null;
  }

  return {
    // `available` assente = selezionabile; solo `false` esplicito lo chiude.
    // Una Società senza `profile_id` (titolare) non ha a chi consegnare: si chiude
    // anche lato client, così non nasce una selezione destinata a fallire (§121).
    available: raw.available !== false && !(kind === "club" && !raw.profile_id),
    avatarUrl: raw.avatar_url ?? null,
    clubId: raw.club_id ?? null,
    contextLabel: raw.context_label?.trim() || null,
    conversationId: raw.conversation_id ?? null,
    displayName: raw.display_name,
    groupAvatarPath: raw.group_avatar_path ?? null,
    isVerified: raw.is_verified === true,
    key: raw.recipient_key,
    kind,
    participantCount: typeof raw.participant_count === "number" ? raw.participant_count : null,
    profileId: raw.profile_id ?? null,
    role: raw.role ?? null,
  };
}

export function mapShareRecipientsPage(raw: unknown): ShareRecipientsPage {
  const payload = (raw ?? {}) as { items?: RawShareRecipient[] | null; next_cursor?: string | null };
  const items = (payload.items ?? [])
    .map(mapShareRecipient)
    .filter((item): item is ShareRecipient => item !== null);

  return { items, nextCursor: payload.next_cursor ?? null };
}

export async function fetchShareRecipients(input: {
  cursor: string | null;
  limit?: number;
  query: string;
}): Promise<ShareRecipientsPage> {
  const { data, error } = await supabase.rpc("search_share_recipients", {
    p_cursor: input.cursor,
    p_limit: input.limit ?? SHARE_RECIPIENTS_PAGE_SIZE,
    p_query: input.query.trim(),
  });

  if (error) {
    throw error;
  }

  return mapShareRecipientsPage(data);
}

type RawOutcome = {
  conversation_id?: string | null;
  delivery_key?: string | null;
  message_id?: string | null;
  ok?: boolean | null;
  retryable?: boolean | null;
};

const SEND_STATUSES: readonly ShareSendStatus[] = ["ok", "partial", "failed", "content_unavailable"];

export function mapShareOutcome(raw: RawOutcome | null | undefined): ShareDeliveryOutcome | null {
  if (!raw?.delivery_key) {
    return null;
  }

  const ok = raw.ok === true;

  return {
    conversationId: raw.conversation_id ?? null,
    deliveryKey: raw.delivery_key,
    messageId: raw.message_id ?? null,
    ok,
    // Un esito riuscito non si ritenta; un fallimento senza flag è ritentabile
    // solo se il server lo dice: nel dubbio non si propone un «Riprova» inutile (§216).
    retryable: ok ? false : raw.retryable === true,
  };
}

export function mapShareSendResult(raw: unknown): ShareSendResult {
  const payload = (raw ?? {}) as { outcomes?: RawOutcome[] | null; status?: string | null };
  const outcomes = (payload.outcomes ?? [])
    .map(mapShareOutcome)
    .filter((outcome): outcome is ShareDeliveryOutcome => outcome !== null);
  const declared = SEND_STATUSES.find((status) => status === payload.status);

  if (declared) {
    return { outcomes, status: declared };
  }

  // Stato sconosciuto: lo si ricava dagli esiti, mai dal silenzio.
  const okCount = outcomes.filter((outcome) => outcome.ok).length;
  const status: ShareSendStatus =
    outcomes.length > 0 && okCount === outcomes.length ? "ok" : okCount > 0 ? "partial" : "failed";

  return { outcomes, status };
}

/**
 * §125: un'unica chiamata per il batch, non N richieste governate dal client
 * (§225). Il testo è privato (§91): viaggia nel solo corpo della RPC.
 */
export async function sendContentShare(input: SendContentShareInput): Promise<ShareSendResult> {
  const { data, error } = await supabase.rpc("send_content_share", {
    p_batch_id: input.batchId,
    p_content_id: input.contentId,
    p_content_type: input.contentType,
    p_destinations: input.destinations,
    p_text: input.text.trim(),
  });

  if (error) {
    throw error;
  }

  return mapShareSendResult(data);
}

/**
 * Copia link riuscito / share sheet esterno aperto (D4). Idempotente su
 * `eventId`; il chiamante non aspetta e non mostra errori: è metrica, non
 * funzione.
 */
export async function recordContentShareEvent(input: {
  contentId: string;
  contentType: FeedContentType;
  eventId: string;
  kind: ShareEventKind;
}): Promise<void> {
  const { error } = await supabase.rpc("record_content_share_event", {
    p_content_id: input.contentId,
    p_content_type: input.contentType,
    p_event_id: input.eventId,
    p_kind: input.kind,
  });

  if (error) {
    throw error;
  }
}
