/**
 * Suggerimenti dello stato vuoto Seguiti (HOM-01.1 §37) — funzioni pure.
 *
 * Il §37 chiede "massimo 3–4 righe" che "possono includere persone, Society,
 * Media". Le due fonti esistono già (le stesse RPC dei moduli discovery di
 * Per te): qui si alternano, così le prime righe non sono tutte dello stesso
 * tipo. I Media sono profili con ruolo media, quindi arrivano dalla fonte
 * persone e non serve una terza query.
 *
 * Si parte da una Società quando c'è, come nel visual master; un tipo
 * esaurito lascia il posto all'altro invece di accorciare l'elenco.
 */

import type { FeedSuggestedClubRow, FeedSuggestedProfileRow } from "./feed-types";

export type FollowingSuggestion =
  | { kind: "club"; row: FeedSuggestedClubRow }
  | { kind: "profile"; row: FeedSuggestedProfileRow };

export function mixFollowingSuggestions(
  profiles: readonly FeedSuggestedProfileRow[] | undefined,
  clubs: readonly FeedSuggestedClubRow[] | undefined,
  limit: number,
): FollowingSuggestion[] {
  const people = profiles ?? [];
  const societies = clubs ?? [];
  const mixed: FollowingSuggestion[] = [];
  let p = 0;
  let c = 0;

  while (mixed.length < limit && (p < people.length || c < societies.length)) {
    const takeClub = mixed.length % 2 === 0 ? c < societies.length : p >= people.length;

    if (takeClub) {
      mixed.push({ kind: "club", row: societies[c] });
      c += 1;
    } else {
      mixed.push({ kind: "profile", row: people[p] });
      p += 1;
    }
  }

  return mixed;
}
