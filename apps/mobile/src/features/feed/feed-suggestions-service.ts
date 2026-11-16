/**
 * Moduli discovery del Feed: "Persone che potresti conoscere" (§11) e società
 * consigliate.
 *
 * La spina emette righe segnaposto senza entità; le entità arrivano da qui.
 * È esattamente questa separazione che rende possibile il §23 (HOM-13 §269–§271):
 * una richiesta di modulo che fallisce rifiuta solo la propria promise, e il
 * resto della Home resta a schermo.
 *
 * HOM-13 §4: `fetch_home_suggested_profiles(p_limit, p_module_index)` restituisce al
 * massimo 3 righe; `p_module_index` sceglie la fetta (0 = le prime 3, 1 = le successive).
 * ZERO righe = modulo omesso (candidati deboli): il client non riempie. Lo stesso vale
 * per «Scopri chi seguire» in Seguiti vuoto, che chiede senza indice.
 */

import { supabase } from "../../lib/supabase";
import type {
  FeedSuggestedClubRow,
  FeedSuggestedProfileRow,
} from "./feed-types";

/** §11: massimo tre righe compatte nel modulo. */
export const FEED_SUGGESTION_ROWS = 3;
const FEED_SUGGESTION_FETCH_LIMIT = 6;

export async function fetchHomeSuggestedProfiles(
  limit = FEED_SUGGESTION_FETCH_LIMIT,
  moduleIndex = 0,
  identity: { identityType: string | null; identityId: string | null } | null = null,
): Promise<FeedSuggestedProfileRow[]> {
  // HOM-13 D3: l'identità del modulo passa solo se completa; altrimenti il server usa la personale.
  const identityArgs =
    identity?.identityType && identity.identityId
      ? { p_identity_id: identity.identityId, p_identity_type: identity.identityType }
      : {};
  const { data, error } = await supabase.rpc("fetch_home_suggested_profiles", {
    p_limit: limit,
    p_module_index: moduleIndex,
    ...identityArgs,
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
