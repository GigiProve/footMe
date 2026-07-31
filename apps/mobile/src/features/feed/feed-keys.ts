/**
 * Query key del Feed in un posto solo, così invalidazioni e patch ottimistiche
 * non divergono.
 *
 * La key della infinite query ESCLUDE `asOf`: quello vive nel `pageParam`. Se
 * finisse nella key, ogni pull-to-refresh forkerebbe una nuova cache invece di
 * sostituire quella esistente, e la lista lampeggerebbe a ogni aggiornamento.
 */

import type { FeedScope } from "./feed-types";

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
};
