/**
 * Conteggio commenti in blocco per le liste dei profili (HOM-08 §1, §3, §210–§214).
 *
 * I commenti hanno un dominio solo (`content_comments`, tabella chiusa ai
 * client). Le liste dei profili (Tribuna Tifoso e Media, articoli Media, media
 * Società e Tifoso) non passano dal Feed e non hanno `comments_count` nel
 * payload: leggono il numero da `fetch_comment_counts`, una chiamata per tipo di
 * contenuto e per lista (max 100 id per chiamata, blocchi in parallelo). Il
 * conteggio è quello VISIBILE al viewer, la stessa definizione di Feed e
 * dettaglio, e semina `comment-count-store` con la regola di freschezza di
 * HOM-07 (`fetchedAt` preso PRIMA della richiesta): carta e dettaglio non
 * divergono.
 *
 * Un guasto non fa fallire la lista: si registra e si omette (id assente = 0,
 * nessun seme), così una cella già aggiornata dal dettaglio non viene azzerata.
 */

import { supabase } from "../../lib/supabase";
import { commentCountStore } from "../comments/comment-count-store";
import { likeItemKey } from "../interactions/like-store";

/** Tetto per chiamata, lo stesso che applica la RPC. */
export const COMMENT_COUNTS_BATCH = 100;

export type CommentCountContentType =
  | "club_media"
  | "media_profile"
  | "fan_tribuna"
  | "media_tribuna"
  | "fan_media";

type CountRow = { content_id?: unknown; comments_count?: unknown };

function toCount(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

async function fetchBatch(contentType: string, ids: string[]): Promise<CountRow[]> {
  const { data, error } = await supabase.rpc("fetch_comment_counts", {
    p_content_ids: ids,
    p_content_type: contentType,
  });

  if (error) {
    throw error;
  }

  return (Array.isArray(data) ? data : []) as CountRow[];
}

/**
 * `Map<id, count>` per gli id richiesti (un id assente dalla risposta vale 0).
 * In caso di errore la mappa è vuota e nulla viene seminato.
 */
export async function fetchCommentCounts(
  contentType: CommentCountContentType,
  contentIds: readonly string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const ids = Array.from(new Set(contentIds.filter((id) => id.length > 0)));

  if (ids.length === 0) {
    return counts;
  }

  // Istante PRIMA della richiesta: un seme più vecchio di ciò che lo store sa già è ignorato.
  // Stessa regola per l'utente: se logout o cambio account svuotano lo store mentre
  // la richiesta è in volo, la risposta è dell'utente di prima e non si semina.
  const fetchedAt = Date.now();
  const epoch = commentCountStore.epoch();
  const batches: string[][] = [];
  for (let start = 0; start < ids.length; start += COMMENT_COUNTS_BATCH) {
    batches.push(ids.slice(start, start + COMMENT_COUNTS_BATCH));
  }

  try {
    const results = await Promise.all(batches.map((batch) => fetchBatch(contentType, batch)));
    if (commentCountStore.epoch() !== epoch) {
      return counts;
    }
    const received = new Map<string, number>();
    for (const row of results.flat()) {
      if (typeof row.content_id === "string") {
        received.set(row.content_id, toCount(row.comments_count));
      }
    }

    for (const id of ids) {
      const count = received.get(id) ?? 0;
      counts.set(id, count);
      commentCountStore.seed(likeItemKey(contentType, id), count, fetchedAt);
    }
  } catch (error) {
    console.warn("[comments] fetch_comment_counts failed", error);
    counts.clear();
  }

  return counts;
}
