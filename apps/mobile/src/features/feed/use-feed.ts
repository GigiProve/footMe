/**
 * Query principale del Feed per una singola tab.
 *
 * Sequenza del §27 ("mostrare la cache, ripristinare la posizione, aggiornare
 * in background, evitare salti visivi") realizzata così:
 *
 *  1. `useFeedCache` legge il record locale una volta sola per profilo.
 *  2. La infinite query parte con `initialData` costruito dalla cache. Si usa
 *     `initialData` e NON `placeholderData`: placeholder non entra nella query
 *     cache e cambia identità quando arriva il fetch reale, il che romperebbe
 *     il prefisso congelato del punto 4.
 *  3. `initialDataUpdatedAt: 0` marca i dati come stale, così TanStack
 *     rifetcha la pagina 0 in background MENTRE gli elementi in cache restano a
 *     schermo. È il comportamento richiesto, non un effetto collaterale.
 *  4. `frozenCount` passato ad `arrangeFeedItems` mantiene invariato ciò che
 *     l'utente sta già guardando quando arriva una pagina nuova: senza questo
 *     l'alternanza riordinerebbe la lista sotto il dito.
 *
 * La query key esclude `asOf` (vive nel pageParam): se ci fosse, ogni refresh
 * forkerebbe una cache nuova invece di sostituire quella esistente.
 */

import { useCallback, useEffect, useRef } from "react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";

import { trackFeed } from "./feed-analytics";
import { arrangeFeedItems, mergeFeedPages } from "./feed-arrange";
import {
  loadFeedCache,
  saveFeedCacheScope,
  type CachedFeed,
  type FeedScrollState,
} from "./feed-cache";
import { FEED_QK } from "./feed-keys";
import { FEED_PAGE_SIZE, fetchHomeFeedPage } from "./feed-service";
import type { FeedItem, FeedPage, FeedPageParam, FeedScope } from "./feed-types";

export type FeedRefreshTrigger = "pull" | "new_content_banner";

export function useFeedCache(profileId: string) {
  return useQuery({
    enabled: !!profileId,
    gcTime: Infinity,
    queryFn: () => loadFeedCache(profileId),
    queryKey: FEED_QK.cache(profileId),
    staleTime: Infinity,
  });
}

const FIRST_PAGE_PARAM: FeedPageParam = { cursor: null, pageIndex: 0 };

export type UseFeedResult = {
  items: FeedItem[];
  asOf: string | null;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  isError: boolean;
  error: Error | null;
  hasAnySuccess: boolean;
  hydratedFromCache: boolean;
  savedScroll: FeedScrollState | null;
  loadNextPage: () => void;
  refresh: (trigger: FeedRefreshTrigger) => void;
  retry: () => void;
};

export function useFeed({
  scope,
  profileId,
  cache,
  isCacheReady,
}: {
  scope: FeedScope;
  profileId: string;
  cache: CachedFeed | null | undefined;
  isCacheReady: boolean;
}): UseFeedResult {
  const queryClient = useQueryClient();
  const cachedScope = cache?.scopes[scope] ?? null;

  // Catturati una volta sola: servono a decidere se un offset salvato è ancora
  // applicabile, e devono riflettere il momento del mount, non lo stato attuale.
  const hydratedFromCacheRef = useRef<boolean | null>(null);
  const savedScrollRef = useRef<FeedScrollState | null>(null);
  if (hydratedFromCacheRef.current === null && isCacheReady) {
    hydratedFromCacheRef.current = (cachedScope?.items.length ?? 0) > 0;
    savedScrollRef.current = cachedScope?.scroll ?? null;
  }

  const initialData: InfiniteData<FeedPage, FeedPageParam> | undefined =
    cachedScope && cachedScope.items.length > 0
      ? {
          pageParams: [FIRST_PAGE_PARAM],
          pages: [
            {
              asOf: cachedScope.updatedAt,
              isLastPage: false,
              items: cachedScope.items,
              nextCursor: null,
              pageIndex: 0,
            },
          ],
        }
      : undefined;

  const query = useInfiniteQuery({
    enabled: !!profileId && isCacheReady,
    getNextPageParam: (lastPage): FeedPageParam | undefined =>
      lastPage.isLastPage || !lastPage.nextCursor
        ? undefined
        : { cursor: lastPage.nextCursor, pageIndex: lastPage.pageIndex + 1 },
    initialData,
    // Stale per costruzione: la cache si mostra subito e si aggiorna dietro.
    initialDataUpdatedAt: 0,
    initialPageParam: FIRST_PAGE_PARAM,
    queryFn: ({ pageParam }) =>
      fetchHomeFeedPage({ pageParam, pageSize: FEED_PAGE_SIZE, scope }),
    queryKey: FEED_QK.feed(scope, profileId),
  });

  const pages = query.data?.pages ?? [];

  /** Lunghezza di ciò che l'utente sta già guardando (vedi punto 4 in testa). */
  const frozenCountRef = useRef(0);
  const items = arrangeFeedItems(mergeFeedPages(pages), {
    frozenCount: frozenCountRef.current,
  });

  useEffect(() => {
    frozenCountRef.current = items.length;
  }, [items.length]);

  const asOf = pages[0]?.asOf ?? null;

  // Persistenza della prima pagina: è ciò che rende istantanea la prossima
  // apertura della Home. Best-effort, mai bloccante.
  const lastPersistedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!profileId || !query.isSuccess || pages.length === 0) {
      return;
    }

    const stamp = `${query.dataUpdatedAt}:${pages.length}`;
    if (lastPersistedRef.current === stamp) {
      return;
    }
    lastPersistedRef.current = stamp;

    void saveFeedCacheScope(profileId, scope, {
      items,
      pageCount: pages.length,
      updatedAt: new Date().toISOString(),
    });
  }, [items, pages.length, profileId, query.dataUpdatedAt, query.isSuccess, scope]);

  const loadNextPage = useCallback(() => {
    // Questa singola guardia è ciò che rende refresh e paginazione mutuamente
    // esclusivi, quindi nessuna pagina si sovrappone a un refresh in corso.
    if (!query.hasNextPage || query.isFetchingNextPage || query.isRefetching) {
      return;
    }

    trackFeed({ name: "feed_page_load", page: pages.length, scope });
    void query.fetchNextPage();
  }, [pages.length, query, scope]);

  const refresh = useCallback(
    (trigger: FeedRefreshTrigger) => {
      trackFeed({ name: "feed_refresh", scope, trigger });

      // Il refresh è avviato dall'utente e ricostruisce la lista: il prefisso
      // congelato va rilasciato, altrimenti l'alternanza non toccherebbe più
      // nulla. Il refresh in background invece lo conserva (non passa da qui).
      frozenCountRef.current = 0;

      // Si tronca alla pagina 0 prima di rifetchare: `refetch()` su una infinite
      // query rifetcherebbe TUTTE le pagine in parallelo, con i cursori della
      // sessione precedente.
      queryClient.setQueryData<InfiniteData<FeedPage, FeedPageParam>>(
        FEED_QK.feed(scope, profileId),
        (previous) =>
          previous && previous.pages.length > 1
            ? {
                pageParams: [FIRST_PAGE_PARAM],
                pages: previous.pages.slice(0, 1),
              }
            : previous,
      );

      void query.refetch();
    },
    [profileId, query, queryClient, scope],
  );

  const retry = useCallback(() => {
    void query.refetch();
  }, [query]);

  return {
    asOf,
    error: query.error as Error | null,
    hasAnySuccess: query.isSuccess,
    hasNextPage: query.hasNextPage,
    hydratedFromCache: hydratedFromCacheRef.current === true,
    isError: query.isError,
    // Skeleton solo quando non c'è davvero nulla da mostrare: con elementi in
    // cache la schermata non deve mai essere sostituita da un loader (§15).
    isInitialLoading: query.isLoading && items.length === 0,
    isFetchingNextPage: query.isFetchingNextPage,
    isRefreshing: query.isRefetching && !query.isFetchingNextPage,
    items,
    loadNextPage,
    refresh,
    retry,
    savedScroll: savedScrollRef.current,
  };
}
