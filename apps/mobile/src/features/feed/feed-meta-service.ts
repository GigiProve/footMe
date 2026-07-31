/**
 * Metadati del Feed: nuovi contenuti disponibili (§19) e stato dei "seguiti"
 * per distinguere i due stati vuoti del §14.
 */

import { supabase } from "../../lib/supabase";
import type {
  FeedFollowingStateRow,
  FeedScope,
  FeedUpdatesRow,
} from "./feed-types";

export type FeedUpdates = {
  newItemsCount: number;
  newestPublishedAt: string | null;
  previewAvatarUrls: string[];
};

/**
 * `since` DEVE essere l'`as_of` della sessione, non il `published_at`
 * dell'ultimo elemento caricato: con il bucket di ordinamento l'ultimo
 * elemento caricato non è il più recente in assoluto. L'RPC clampa il conteggio
 * a 100.
 */
export async function fetchHomeFeedUpdates(
  scope: FeedScope,
  since: string,
): Promise<FeedUpdates> {
  const { data, error } = await supabase.rpc("fetch_home_feed_updates", {
    p_since: since,
    p_tab: scope,
  });

  if (error) {
    throw error;
  }

  const row = ((data ?? []) as FeedUpdatesRow[])[0];

  return {
    newItemsCount: Number(row?.new_items_count ?? 0),
    newestPublishedAt: row?.newest_published_at ?? null,
    previewAvatarUrls: row?.preview_avatar_urls ?? [],
  };
}

export type FeedFollowingState = {
  followsNobody: boolean;
  hasPublishedContent: boolean;
  followedProfilesCount: number;
  followedClubsCount: number;
};

export async function fetchHomeFollowingState(): Promise<FeedFollowingState> {
  const { data, error } = await supabase.rpc("fetch_home_following_state");

  if (error) {
    throw error;
  }

  const row = ((data ?? []) as FeedFollowingStateRow[])[0];
  const profiles = Number(row?.followed_profiles_count ?? 0);
  const clubs = Number(row?.followed_clubs_count ?? 0);

  return {
    followsNobody: profiles === 0 && clubs === 0,
    hasPublishedContent: row?.has_published_content === true,
    followedProfilesCount: profiles,
    followedClubsCount: clubs,
  };
}
