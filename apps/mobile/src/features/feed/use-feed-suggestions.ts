/**
 * Moduli discovery come query INDIPENDENTI: è il cuore del §23 (HOM-13 §269–§271).
 *
 * Ogni modulo ha la sua query key e il suo retry (il client condiviso ha già
 * `retry: 1`). Un modulo che fallisce si NASCONDE (HOM-13: nessuna riga d'errore nel
 * Feed) e la spina e gli altri moduli non se ne accorgono; zero righe = modulo non
 * mostrato (§191). Non esiste alcun punto in cui un errore di modulo possa propagarsi
 * al Feed.
 *
 * `useFeedModuleRows` risolve in un colpo solo i moduli presenti nella lista:
 * un modulo Persone per ogni `module_index` della sessione (`fetch_home_suggested_profiles(3,
 * module_index)`), e UNA query condivisa per il carosello Società (`fetch_home_suggested_clubs`,
 * invariata). `useQueries` e non un hook per cella: i moduli sono righe di una FlatList.
 */

import { useQueries, useQuery } from "@tanstack/react-query";

import { FEED_QK } from "./feed-keys";
import {
  FEED_SUGGESTION_ROWS,
  fetchHomeSuggestedClubs,
  fetchHomeSuggestedProfiles,
} from "./feed-suggestions-service";
import type {
  FeedItem,
  FeedSuggestedClubRow,
  FeedSuggestedClubsItem,
  FeedSuggestedProfileRow,
  FeedSuggestedProfilesItem,
} from "./feed-types";

export type FeedModuleRows<T> = {
  rows: T[] | undefined;
  isLoading: boolean;
  isError: boolean;
  retry: () => void;
};

export type FeedModuleLookup = {
  profiles: (item: FeedSuggestedProfilesItem) => FeedModuleRows<FeedSuggestedProfileRow>;
  clubs: (item: FeedSuggestedClubsItem) => FeedModuleRows<FeedSuggestedClubRow>;
};

/** Seguiti vuoto («Scopri chi seguire», HOM-13 §236): senza indice di modulo. */
export function useSuggestedProfiles(profileId: string, enabled = true) {
  return useQuery({
    enabled: !!profileId && enabled,
    queryFn: () => fetchHomeSuggestedProfiles(),
    queryKey: FEED_QK.suggestedProfiles(profileId),
  });
}

export function useSuggestedClubs(profileId: string, enabled = true) {
  return useQuery({
    enabled: !!profileId && enabled,
    queryFn: () => fetchHomeSuggestedClubs(),
    queryKey: FEED_QK.suggestedClubs(profileId),
  });
}

const EMPTY: FeedModuleRows<never> = {
  isError: false,
  isLoading: false,
  retry: () => undefined,
  rows: undefined,
};

export function useFeedModuleRows(profileId: string, items: readonly FeedItem[]): FeedModuleLookup {
  const profileModules = items.filter(
    (item): item is FeedSuggestedProfilesItem => item.type === "suggested_profiles",
  );
  const hasClubsModule = items.some((item) => item.type === "suggested_clubs");

  const profileResults = useQueries({
    queries: profileModules.map((item) => ({
      enabled: !!profileId,
      queryFn: () =>
        fetchHomeSuggestedProfiles(FEED_SUGGESTION_ROWS, item.payload.moduleIndex, item.payload),
      queryKey: FEED_QK.suggestedProfilesModule(
        profileId,
        item.feedSessionId ?? "none",
        item.payload.moduleIndex,
      ),
    })),
  });

  const clubsQuery = useSuggestedClubs(profileId, hasClubsModule);

  return {
    clubs: () => ({
      isError: clubsQuery.isError,
      isLoading: clubsQuery.isLoading,
      retry: () => void clubsQuery.refetch(),
      rows: clubsQuery.data,
    }),
    profiles: (item) => {
      const index = profileModules.findIndex((candidate) => candidate.id === item.id);
      const result = index >= 0 ? profileResults[index] : undefined;
      if (!result) {
        return EMPTY;
      }
      return {
        isError: result.isError,
        isLoading: result.isLoading,
        retry: () => void result.refetch(),
        rows: result.data,
      };
    },
  };
}
