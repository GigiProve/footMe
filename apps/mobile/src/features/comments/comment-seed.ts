/**
 * Semina degli store da una pagina di commenti (HOM-08 §135, §209, §225; HOM-07 §141).
 *
 * Una pagina riempie DUE store con lo stesso istante `fetchedAt` — preso PRIMA della
 * richiesta: le entità nello store dei commenti e, per ogni commento attivo, la cella
 * del Mi piace (`likeItemKey("comment", id)`, HOM-07). Così il Mi piace del commento è
 * lo stesso dominio del Mi piace del contenuto, con la stessa regola di freschezza:
 * una pagina in cache non cancella un Mi piace messo dopo.
 */

import { reconcileFollowFromComments } from "../following/reconcile-follow";
import { likeItemKey, likeStore } from "../interactions/like-store";
import { commentStore } from "./comment-store";
import type { Comment } from "./comment-types";

export function seedLikesFromComments(comments: readonly Comment[], fetchedAt: number): void {
  for (const comment of comments) {
    if (comment.status === "active") {
      likeStore.seed(
        likeItemKey("comment", comment.id),
        { likedAs: comment.likedAs, likesCount: comment.likesCount },
        fetchedAt,
      );
    }
  }
}

export function seedCommentPage(comments: readonly Comment[], fetchedAt: number): void {
  commentStore.seed(comments, fetchedAt);
  seedLikesFromComments(comments, fetchedAt);
  // HOM-11 §173: un autore che il server dice di nuovo «seguito» smentisce un «Non seguire»
  // di sessione (ri-seguito da un'altra superficie).
  reconcileFollowFromComments(comments, fetchedAt);
}
