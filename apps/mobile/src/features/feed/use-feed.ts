/**
 * Query principale del Feed per una singola tab.
 *
 * Sequenza del §27 ("mostrare la cache, ripristinare la posizione, aggiornare
 * in background, evitare salti visivi") realizzata così:
 *
 *  1. `useFeedCache` legge il record locale una volta sola per profilo.
 *  2. La infinite query parte con `initialData` costruito dalla cache. Si usa
 *     `initialData` e NON `placeholderData`: placeholder non entra nella query
 *     cache e cambia identità quando arriva il fetch reale.
 *  3. `initialDataUpdatedAt: 0` marca i dati come stale, così TanStack
 *     rifetcha in background MENTRE gli elementi in cache restano a schermo.
 *
 * HOM-13 — Per te è una SESSIONE (§81–§97, §227–§228):
 *
 *  • il cursore è `feed_session_id` + `next_position` (`FeedPage.session`), mai un numero
 *    di pagina; l'ordine delle pagine già emesse non cambia (§83), il client non
 *    riordina nulla (§220);
 *  • pull-to-refresh e tap sulla pill = sessione NUOVA (`p_session_id` null, §92–§93);
 *    l'identità attiva Home passa SOLO alla creazione (contratto §1, D3);
 *  • il revalidate dalla cache RILEGGE la stessa sessione, con la stessa ampiezza già
 *    mostrata: stesso ordine, il server ricontrolla solo le esclusioni dure (§87–§88).
 *    Un breve background non ricostruisce nulla (§228); oltre
 *    `FEED_SESSION_RESUME_MAX_AGE_MS` la cache si mostra ma il Feed riparte da una
 *    sessione nuova;
 *  • `P0002` / `feed_session_expired` riparte da una sessione nuova nel service,
 *    in modo trasparente.
 *
 * La query key resta `FEED_QK.feed(scope, profileId)` (vedi feed-keys.ts per il motivo):
 * la sessione sta nei dati e nel `pageParam`. Dopo un refresh il `pageParam` della
 * pagina 0 descrive «sessione nuova»: `firstPageParamFor` lo riallinea alla sessione
 * appena creata, perché un refetch successivo non ne crei un'altra.
 */

import { useCallback, useEffect, useRef } from "react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";

import { hiddenTargetKey } from "../feed-feedback/feed-feedback-presentation";
import { hiddenContentStore } from "../feed-feedback/hidden-content-store";
import { interactionIdentityQuery } from "../interactions/use-interaction-identity";
import { trackFeed } from "./feed-analytics";
import { mergeFeedPages } from "./feed-arrange";
import { emitFeedEvent } from "./feed-events-service";
import { canonicalTargetOf } from "./feed-signal-cache";
import {
  loadFeedCache,
  saveFeedCacheScope,
  type CachedFeed,
  type FeedScrollState,
} from "./feed-cache";
import { FEED_QK } from "./feed-keys";
import { FEED_PAGE_SIZE, fetchHomeFeedPage, fetchHomeForYouPage } from "./feed-service";
import {
  cachedForYouPage,
  firstPageParamFor,
  isFirstParamStale,
  newForYouPageParam,
  nextForYouPageParam,
  toSessionIdentity,
  withSessionIdentity,
} from "./feed-session-presentation";
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
// Riferimento stabile: un `[]` nuovo a ogni render cambierebbe le dipendenze degli effetti.
const EMPTY_PAGES: FeedPage[] = [];

/** Il contenuto di questo elemento è nascosto con «Non mi interessa» in questa sessione? */
function isHiddenInSession(item: FeedItem): boolean {
  const target = canonicalTargetOf(item);
  return target !== null && hiddenContentStore.has(hiddenTargetKey(target.contentType, target.contentId));
}

export type UseFeedResult = {
  items: FeedItem[];
  asOf: string | null;
  /** HOM-13: la sessione Per te corrente (per la pill e per l'attribuzione). Null in Seguiti. */
  sessionId: string | null;
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

type FeedData = InfiniteData<FeedPage, FeedPageParam>;

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
  const isForYou = scope === "per_te";
  const cachedScope = cache?.scopes[scope] ?? null;

  // HOM-13 D3, HOM-07 §11: l'identità attiva Home è l'ultima identità Dashboard
  // autorizzata, già risolta dal dominio Mi piace. Serve solo a CREARE una sessione.
  const identityQuery = useQuery({
    ...interactionIdentityQuery(profileId),
    enabled: !!profileId && isForYou,
  });
  const identity = toSessionIdentity(identityQuery.data);
  const identityRef = useRef(identity);
  identityRef.current = identity;
  // Una sessione non si crea finché l'identità non è risolta (anche con errore: il
  // server ricade sulla personale); Seguiti non ne ha bisogno.
  const isIdentityReady = !isForYou || identityQuery.isFetched;

  // Catturati una volta sola: servono a decidere se un offset salvato è ancora
  // applicabile, e devono riflettere il momento del mount, non lo stato attuale.
  const hydratedFromCacheRef = useRef<boolean | null>(null);
  const savedScrollRef = useRef<FeedScrollState | null>(null);
  if (hydratedFromCacheRef.current === null && isCacheReady) {
    hydratedFromCacheRef.current = (cachedScope?.items.length ?? 0) > 0;
    savedScrollRef.current = cachedScope?.scroll ?? null;
  }

  let initialData: FeedData | undefined;
  if (cachedScope && cachedScope.items.length > 0) {
    if (isForYou) {
      const cachedPage = cachedForYouPage(cachedScope.items, cachedScope.updatedAt);
      initialData = { pageParams: [firstPageParamFor(cachedPage, null)], pages: [cachedPage] };
    } else {
      initialData = {
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
      };
    }
  }

  const query = useInfiniteQuery({
    enabled: !!profileId && isCacheReady && isIdentityReady,
    getNextPageParam: (lastPage): FeedPageParam | undefined => {
      if (isForYou) {
        return nextForYouPageParam(lastPage, identityRef.current);
      }
      return lastPage.isLastPage || !lastPage.nextCursor
        ? undefined
        : { cursor: lastPage.nextCursor, pageIndex: lastPage.pageIndex + 1 };
    },
    initialData,
    // Stale per costruzione: la cache si mostra subito e si aggiorna dietro.
    initialDataUpdatedAt: 0,
    initialPageParam: isForYou ? newForYouPageParam(null) : FIRST_PAGE_PARAM,
    queryFn: ({ pageParam }) =>
      isForYou
        ? fetchHomeForYouPage({
            pageParam: withSessionIdentity(pageParam, identityRef.current),
            pageSize: FEED_PAGE_SIZE,
          })
        : fetchHomeFeedPage({ pageParam, pageSize: FEED_PAGE_SIZE, scope }),
    queryKey: FEED_QK.feed(scope, profileId),
  });

  const pages = query.data?.pages ?? EMPTY_PAGES;

  // §83, §94, §220: nessun riordino. La lista è l'ordine del server, deduplicato.
  const items = mergeFeedPages(pages);

  const asOf = pages[0]?.asOf ?? null;
  const sessionId = isForYou ? (pages[pages.length - 1]?.session?.feedSessionId ?? null) : null;

  // Riallinea il pageParam della pagina 0 alla sessione della pagina 0 (vedi in testa).
  // Mai durante un fetch: i dati in volo li sostituirebbe comunque il risultato.
  const firstPage = pages[0];
  const firstParam = query.data?.pageParams[0] as FeedPageParam | undefined;
  const isFirstStale = isForYou && !query.isFetching && isFirstParamStale(firstParam, firstPage);
  useEffect(() => {
    if (!isFirstStale || !firstPage) {
      return;
    }

    queryClient.setQueryData<FeedData>(FEED_QK.feed(scope, profileId), (previous) =>
      previous && previous.pages[0]
        ? {
            ...previous,
            pageParams: [
              firstPageParamFor(previous.pages[0], identityRef.current),
              ...previous.pageParams.slice(1),
            ],
          }
        : previous,
    );
  }, [firstPage, isFirstStale, profileId, queryClient, scope]);

  // §259 `feed_session_start`: una volta per sessione NUOVA (anche quella ripartita da P0002).
  // Seguiti non ha sessioni server: un solo avvio per montaggio.
  const startedSessionsRef = useRef(new Set<string>());
  useEffect(() => {
    if (isForYou) {
      for (const page of pages) {
        const session = page.session;
        if (session?.isNew && !startedSessionsRef.current.has(session.feedSessionId)) {
          startedSessionsRef.current.add(session.feedSessionId);
          emitFeedEvent({
            eventType: "feed_session_start",
            feedSessionId: session.feedSessionId,
            tab: scope,
          });
        }
      }
      return;
    }

    if (query.isSuccess && !startedSessionsRef.current.has("seguiti")) {
      startedSessionsRef.current.add("seguiti");
      emitFeedEvent({ eventType: "feed_session_start", tab: scope });
    }
  }, [isForYou, pages, query.isSuccess, scope]);

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

    // HOM-11 §169–§170: i contenuti nascosti con «Non mi interessa» in questa sessione non si
    // riscrivono su disco (la lista visibile li tiene per il placeholder, §29–§36).
    const persistable =
      scope === "per_te" ? items.filter((item) => !isHiddenInSession(item)) : items;

    void saveFeedCacheScope(profileId, scope, {
      items: persistable,
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
    emitFeedEvent({
      eventType: "feed_load_more",
      feedSessionId: sessionId,
      position: items[items.length - 1]?.rank,
      tab: scope,
    });
    void query.fetchNextPage();
  }, [items, pages.length, query, scope, sessionId]);

  const refresh = useCallback(
    (trigger: FeedRefreshTrigger) => {
      trackFeed({ name: "feed_refresh", scope, trigger });
      // La pill ha il proprio evento (`new_content_pill_tap`, emesso dal pannello).
      if (trigger === "pull") {
        emitFeedEvent({ eventType: "feed_refresh", feedSessionId: sessionId, tab: scope });
      }

      // Si tronca alla pagina 0 prima di rifetchare: `refetch()` su una infinite
      // query rifetcherebbe TUTTE le pagine in parallelo, con i cursori della
      // sessione precedente. Per Per te la pagina 0 riparte da una sessione NUOVA
      // (§92–§93): niente rimescolamento degli stessi elementi (§94).
      queryClient.setQueryData<FeedData>(FEED_QK.feed(scope, profileId), (previous) => {
        if (!previous) {
          return previous;
        }
        if (isForYou) {
          return {
            pageParams: [newForYouPageParam(identityRef.current)],
            pages: previous.pages.slice(0, 1),
          };
        }
        return previous.pages.length > 1
          ? { pageParams: [FIRST_PAGE_PARAM], pages: previous.pages.slice(0, 1) }
          : previous;
      });

      void query.refetch();
    },
    [isForYou, profileId, query, queryClient, scope, sessionId],
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
    sessionId,
  };
}
