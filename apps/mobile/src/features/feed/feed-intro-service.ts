/**
 * Stato di primo accesso del Feed (HOM-13 D1, §135–§146).
 *
 * File separato dalla spina: lo stato ha un ciclo di vita proprio (compare una volta,
 * si chiude con `acknowledge_feed_intro`) e una sua query key, e non deve mai poter
 * bloccare il caricamento del Feed. Sostituisce `feed-preferences-service`: le quattro
 * preferenze (`set_feed_preferences`, `dismiss_feed_intro`) sono DEPRECATE lato server e
 * non influenzano più il ranking, quindi il client non le chiama più.
 */

import { supabase } from "../../lib/supabase";
import { mapIntroRows } from "./feed-intro-presentation";
import type { FeedIntro, FeedIntroRow } from "./feed-types";

export async function fetchMyFeedIntro(): Promise<FeedIntro> {
  const { data, error } = await supabase.rpc("fetch_my_feed_intro");

  if (error) {
    throw error;
  }

  return mapIntroRows((Array.isArray(data) ? data : data ? [data] : []) as FeedIntroRow[]);
}

/** «Inizia» e l'accesso rapido (§143–§144): la stessa RPC, idempotente. */
export async function acknowledgeFeedIntro(): Promise<void> {
  const { error } = await supabase.rpc("acknowledge_feed_intro");

  if (error) {
    throw error;
  }
}
