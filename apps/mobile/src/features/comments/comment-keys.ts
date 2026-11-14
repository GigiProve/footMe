/**
 * Query key dei Commenti (HOM-08 §117–§118, §130, §135, §141).
 *
 * Ogni dimensione che la cache deve distinguere sta nella chiave: tipo e id del
 * contenuto (lo stesso uuid non basta), l'ordinamento (il ranking è del server,
 * due ordinamenti sono due liste), il viewer (visibilità, blocchi e capability
 * sono per utente: nessuna lista passa da un account all'altro).
 */

import type { CommentSort } from "./comment-types";

export const COMMENTS_QK = {
  all: ["comments"] as const,
  context: (contentType: string, contentId: string, viewerId: string) =>
    ["comments", "context", contentType, contentId, viewerId] as const,
  replies: (rootCommentId: string, viewerId: string) =>
    ["comments", "replies", rootCommentId, viewerId] as const,
  roots: (contentType: string, contentId: string, sort: CommentSort, viewerId: string) =>
    ["comments", "roots", contentType, contentId, sort, viewerId] as const,
  updates: (contentType: string, contentId: string, viewerId: string, since: string) =>
    ["comments", "updates", contentType, contentId, viewerId, since] as const,
};
