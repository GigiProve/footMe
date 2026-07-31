/**
 * Moduli discovery come query INDIPENDENTI: è il cuore del §23.
 *
 * Ogni modulo ha la sua query key e il suo retry (il client condiviso ha già
 * `retry: 1`). Un modulo che fallisce mostra la propria riga di errore con
 * "Riprova" dentro il proprio slot; la spina e gli altri moduli non se ne
 * accorgono. Non esiste alcun punto in cui un errore di modulo possa propagarsi
 * al Feed.
 */

import { useQuery } from "@tanstack/react-query";

import { FEED_QK } from "./feed-keys";
import {
  fetchHomeSuggestedClubs,
  fetchHomeSuggestedProfiles,
} from "./feed-suggestions-service";

export function useSuggestedProfiles(profileId: string) {
  return useQuery({
    enabled: !!profileId,
    queryFn: () => fetchHomeSuggestedProfiles(),
    queryKey: FEED_QK.suggestedProfiles(profileId),
  });
}

export function useSuggestedClubs(profileId: string) {
  return useQuery({
    enabled: !!profileId,
    queryFn: () => fetchHomeSuggestedClubs(),
    queryKey: FEED_QK.suggestedClubs(profileId),
  });
}
