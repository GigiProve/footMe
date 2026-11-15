/**
 * Query key del Repost (HOM-10 §239–§240, §289).
 *
 * Ogni dimensione che la cache deve distinguere sta nella chiave: il profilo (un
 * cambio utente non riusa lo stato di un altro) e la reference completa. Lo stato
 * Repost è per VIEWER e per CONTENUTO: `has_simple_repost` cambia a ogni identità
 * dell'utente, quindi non si condivide fra account.
 */

import type { FeedContentType } from "../feed/feed-types";

export const REPOST_ROOT_KEY = "repost-state";

export const REPOST_QK = {
  root: [REPOST_ROOT_KEY] as const,
  state: (profileId: string, contentType: FeedContentType, contentId: string) =>
    [REPOST_ROOT_KEY, profileId, contentType, contentId] as const,
} as const;
