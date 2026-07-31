/**
 * Modulo di primo accesso "Personalizza il tuo Feed" (§6).
 *
 * File separato dalla spina: il modulo ha un ciclo di vita proprio (viene
 * mostrato, completato o rinviato) e una sua query key, e non deve mai poter
 * bloccare il caricamento del Feed.
 *
 * Le 4 opzioni e il flag `is_derivable` arrivano dal server: il §7 vieta di
 * richiedere informazioni già presenti nel profilo, e quella verifica dipende
 * dal modello dati (posizione primaria, follow esistenti, ruolo), non dalla UI.
 */

import { supabase } from "../../lib/supabase";
import type {
  FeedIntro,
  FeedIntroOption,
  FeedIntroRow,
  FeedPreferenceKey,
} from "./feed-types";

const PREFERENCE_KEYS: readonly FeedPreferenceKey[] = [
  "wants_players",
  "wants_clubs",
  "wants_positions",
  "wants_local_media",
];

function asPreferenceKey(value: string): FeedPreferenceKey | null {
  return PREFERENCE_KEYS.includes(value as FeedPreferenceKey)
    ? (value as FeedPreferenceKey)
    : null;
}

function asIntroState(value: string | undefined): FeedIntro["state"] {
  return value === "completed" || value === "skipped" ? value : "pending";
}

export async function fetchMyFeedIntro(): Promise<FeedIntro> {
  const { data, error } = await supabase.rpc("fetch_my_feed_intro");

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as FeedIntroRow[];

  const options: FeedIntroOption[] = [];
  for (const row of rows) {
    const key = asPreferenceKey(row.pref_key);
    if (!key) {
      continue;
    }
    options.push({
      key,
      label: row.label,
      prefill: row.prefill === true,
      isDerivable: row.is_derivable === true,
    });
  }

  return {
    // Senza righe non c'è nulla da mostrare: meglio nascondere il modulo che
    // renderne uno vuoto.
    shouldShow: rows.length > 0 && rows[0].should_show === true,
    state: asIntroState(rows[0]?.intro_state),
    options,
  };
}

export async function setFeedPreferences(
  selected: readonly FeedPreferenceKey[],
): Promise<void> {
  const { error } = await supabase.rpc("set_feed_preferences", {
    p_wants_clubs: selected.includes("wants_clubs"),
    p_wants_local_media: selected.includes("wants_local_media"),
    p_wants_players: selected.includes("wants_players"),
    p_wants_positions: selected.includes("wants_positions"),
  });

  if (error) {
    throw error;
  }
}

export async function dismissFeedIntro(): Promise<void> {
  const { error } = await supabase.rpc("dismiss_feed_intro");

  if (error) {
    throw error;
  }
}
