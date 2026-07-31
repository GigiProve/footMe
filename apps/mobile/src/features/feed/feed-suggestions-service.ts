/**
 * Moduli discovery del Feed: "Persone che potresti conoscere" (§11) e società
 * consigliate.
 *
 * La spina emette righe segnaposto senza entità; le entità arrivano da qui.
 * È esattamente questa separazione che rende possibile il §23: una richiesta
 * di modulo che fallisce rifiuta solo la propria promise, e il resto della Home
 * resta a schermo. `fetchFeedDiscoveryModules` usa `Promise.allSettled` per
 * questo: `Promise.all` propagherebbe il primo errore e porterebbe giù entrambi
 * i moduli.
 */

import { supabase } from "../../lib/supabase";
import type {
  FeedSuggestedClubRow,
  FeedSuggestedProfileRow,
} from "./feed-types";

/** §11: massimo tre righe compatte nel modulo. Si chiede un po' di margine. */
export const FEED_SUGGESTION_ROWS = 3;
const FEED_SUGGESTION_FETCH_LIMIT = 6;

export async function fetchHomeSuggestedProfiles(
  limit = FEED_SUGGESTION_FETCH_LIMIT,
): Promise<FeedSuggestedProfileRow[]> {
  const { data, error } = await supabase.rpc("fetch_home_suggested_profiles", {
    p_limit: limit,
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as FeedSuggestedProfileRow[];
}

export async function fetchHomeSuggestedClubs(
  limit = FEED_SUGGESTION_FETCH_LIMIT,
): Promise<FeedSuggestedClubRow[]> {
  const { data, error } = await supabase.rpc("fetch_home_suggested_clubs", {
    p_limit: limit,
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as FeedSuggestedClubRow[];
}
