/**
 * Convergenza del Follow fra le superfici (HOM-15 §175, §179; HOM-11 §62, §172–§173).
 *
 * Follow e Unfollow partono da cinque punti — Profilo, Cerca→Media, Cerca→Società,
 * suggerimenti del Feed, «Non seguire» da contenuto — e prima ognuno invalidava un suo
 * insieme di chiavi: lo stato restava diverso fra Feed, Suggested, Profilo e Cerca.
 * Questa è l'UNICA lista, chiamata da tutti dopo la conferma del server. Nessuno store
 * normalizzato: la verità resta del server, qui si dice solo chi deve rileggerla.
 *
 *  • contatori, liste Seguiti, flag Società, stato «segui qualcuno» del Feed, suggerimenti
 *    (il prefisso copre anche i moduli per sessione), lista Mi piace (`isFollowing` di ogni
 *    attore) e Cerca (`search-*`, lo stesso predicate del Block);
 *  • il Feed NON si rilegge subito: un refetch di Per te cambierebbe sessione e scroll
 *    (HOM-13 §227). Con `change` si ritocca `isFollowingAuthor` sulle pagine in cache e la
 *    query si marca stale (`refetchType: "none"`): la prossima lettura è quella del server;
 *  • un Follow confermato toglie la fonte dall'insieme di sessione di «Non seguire»: un
 *    dato server più nuovo la smentisce comunque (§173), qui non si aspetta il refetch.
 */

import type { InfiniteData, QueryClient } from "@tanstack/react-query";

import { isSearchQueryKey } from "../blocking/invalidate-block-caches";
import { FEED_QK } from "../feed/feed-keys";
import { patchAuthorFollowing } from "../feed/feed-signal-cache";
import type { FeedPage, FeedPageParam, FeedScope } from "../feed/feed-types";
import { LIKES_ROOT_KEY } from "../likes/likes-keys";
import { followSourceKey, type FollowSource } from "./follow-source";
import { unfollowedSourcesStore, type UnfollowedSourcesStore } from "./unfollowed-sources-store";

type FeedData = InfiniteData<FeedPage, FeedPageParam>;

const SCOPES: readonly FeedScope[] = ["per_te", "seguiti"];

/** Il cambio CONFERMATO dal server, quando il chiamante lo conosce. */
export type FollowChange = {
  source: Pick<FollowSource, "kind" | "id">;
  following: boolean;
};

export function invalidateFollowQueries(
  queryClient: QueryClient,
  viewerId: string,
  change?: FollowChange,
  store: UnfollowedSourcesStore = unfollowedSourcesStore,
): void {
  if (change) {
    for (const scope of SCOPES) {
      queryClient.setQueryData<FeedData>(FEED_QK.feed(scope, viewerId), (data) =>
        patchAuthorFollowing(data, change.source, change.following),
      );
    }
    if (change.following) {
      store.remove(followSourceKey(change.source));
    }
  }

  void queryClient.invalidateQueries({ queryKey: ["following-count"] });
  void queryClient.invalidateQueries({ queryKey: ["followed"] });
  void queryClient.invalidateQueries({ queryKey: ["followed-club-flags", viewerId] });
  void queryClient.invalidateQueries({ queryKey: FEED_QK.followingState(viewerId) });
  void queryClient.invalidateQueries({ queryKey: FEED_QK.suggestedProfiles(viewerId) });
  void queryClient.invalidateQueries({ queryKey: FEED_QK.suggestedClubs(viewerId) });
  for (const scope of SCOPES) {
    void queryClient.invalidateQueries({ queryKey: FEED_QK.feed(scope, viewerId), refetchType: "none" });
  }
  // §62: la lista dei Mi piace porta lo stato Follow di ogni attore (`isFollowing`).
  // Le card commento leggono `viewerFollowsAuthor` dalla pagina e l'insieme di sessione.
  void queryClient.invalidateQueries({ queryKey: [LIKES_ROOT_KEY] });
  void queryClient.invalidateQueries({ predicate: (query) => isSearchQueryKey(query.queryKey) });
}
