/**
 * Riconciliazione delle fonti lasciate con il Follow reale (HOM-11 §62, §173).
 *
 * `unfollowedSourcesStore` vale solo finché il server non lo smentisce. Chi riceve dati
 * server — pagine del Feed, dettaglio di un Post, pagine di commenti — chiama queste
 * funzioni con l'istante in cui la richiesta è PARTITA (`fetchedAt`): se una fonte è
 * segnalata come SEGUITA da un dato più nuovo della rimozione confermata, l'utente l'ha
 * ri-seguita da un'altra superficie (profilo, Cerca, lista Mi piace) e la voce cade.
 * Un dato senza istante (`fetchedAt` assente) non smentisce mai nulla.
 */

import { authorSourceOfItem } from "../feed/feed-signal-cache";
import { isContentItem, type FeedItem } from "../feed/feed-types";
import { followKindOfIdentity, followSourceKey } from "./follow-source";
import { unfollowedSourcesStore, type UnfollowedSourcesStore } from "./unfollowed-sources-store";

/**
 * Elementi del Feed o di un dettaglio. L'autore è seguito se `isFollowingAuthor` (colonna
 * della spina o `viewer_follows_author`); il reposter di un Simple Repost lo è per costruzione
 * (HOM-10: i wrapper esistono solo in Seguiti, fra le fonti seguite).
 */
export function reconcileFollowFromItems(
  items: readonly FeedItem[],
  store: UnfollowedSourcesStore = unfollowedSourcesStore,
): void {
  if (store.size() === 0) {
    return;
  }

  for (const item of items) {
    const at = item.fetchedAt ?? 0;
    if (at <= 0 || !isContentItem(item)) {
      continue;
    }

    const author = authorSourceOfItem(item);
    if (author && item.isFollowingAuthor) {
      store.reconcile(followSourceKey(author), at);
    }
    if (item.repost) {
      const { identityId, identityType } = item.repost.reposter;
      store.reconcile(
        followSourceKey({ id: identityId, kind: followKindOfIdentity(identityType) }),
        at,
      );
    }
  }
}

/** Card commento: `viewerFollowsAuthor` vero = il server dice che l'autore è seguito. */
export function reconcileFollowFromComments(
  comments: readonly {
    author: { identityId: string; identityType: string } | null;
    viewerFollowsAuthor?: boolean;
  }[],
  fetchedAt: number,
  store: UnfollowedSourcesStore = unfollowedSourcesStore,
): void {
  if (store.size() === 0 || fetchedAt <= 0) {
    return;
  }

  for (const comment of comments) {
    if (comment.author && comment.viewerFollowsAuthor === true) {
      store.reconcile(
        followSourceKey({
          id: comment.author.identityId,
          kind: followKindOfIdentity(comment.author.identityType),
        }),
        fetchedAt,
      );
    }
  }
}
