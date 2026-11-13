/**
 * Query key del Feed in un posto solo, così invalidazioni e patch ottimistiche
 * non divergono.
 *
 * La key della infinite query ESCLUDE `asOf`: quello vive nel `pageParam`. Se
 * finisse nella key, ogni pull-to-refresh forkerebbe una nuova cache invece di
 * sostituire quella esistente, e la lista lampeggerebbe a ogni aggiornamento.
 */

import type { FeedContentType, FeedScope } from "./feed-types";

export const FEED_QK = {
  cache: (profileId: string) => ["feed-cache", profileId] as const,
  feed: (scope: FeedScope, profileId: string) => ["feed", scope, profileId] as const,
  followingState: (profileId: string) => ["feed-following-state", profileId] as const,
  intro: (profileId: string) => ["feed-intro", profileId] as const,
  suggestedClubs: (profileId: string) => ["feed-suggested-clubs", profileId] as const,
  suggestedProfiles: (profileId: string) =>
    ["feed-suggested-profiles", profileId] as const,
  updates: (scope: FeedScope, profileId: string) =>
    ["feed-updates", scope, profileId] as const,
  /** HOM-02: il dettaglio di un post persona, patchato insieme al Feed dal Like. */
  postDetail: (postId: string) => ["feed-post-detail", postId] as const,
  /**
   * HOM-03 §104: Mi piace e commenti del dettaglio `/content/[type]/[id]`.
   * Tipo e id insieme: lo stesso uuid non identifica un contenuto da solo.
   */
  interaction: (contentType: FeedContentType, postId: string) =>
    ["feed-interaction", contentType, postId] as const,
};
