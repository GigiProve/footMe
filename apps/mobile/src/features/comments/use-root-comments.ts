/**
 * Commenti principali di un contenuto, a cursore (HOM-08 §117–§125, §130–§131,
 * §184–§187, §222, §224).
 *
 * Una infinite query per (contenuto, ordinamento, viewer): il ranking è del server
 * (§122), il client non riordina. La query porta SOLO gli id e il cursore; le
 * entità e i Mi piace vanno negli store normalizzati (`seedCommentPage`), così una
 * riga si abbona alla propria entità e un Mi piace non rirenderizza la lista (§225).
 * La semina avviene nella `queryFn`, con l'istante di PARTENZA della richiesta: la
 * riga trova la propria entità appena la pagina esiste.
 *
 * Stati (§184–§187): `loading` = solo righe skeleton nella sezione; `error` con
 * «Riprova» senza toccare il contenuto; con pagine già caricate un errore di
 * paginazione è `loadMoreFailed`, la lista resta.
 *
 * `refreshFirstPage` serve a «↑ Nuovi commenti» (§144): ritaglia la query alla prima
 * pagina e la rilegge. La lista già a schermo non scompare e non salta: la pagina
 * nuova sostituisce la vecchia in posto.
 */

import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";

import { COMMENTS_QK } from "./comment-keys";
import { seedCommentPage } from "./comment-seed";
import { classifyCommentError, listContentComments } from "./comment-service";
import { commentStore } from "./comment-store";
import type { CommentCursor, CommentErrorKind, CommentSort } from "./comment-types";

type IdsPage = { ids: string[]; nextCursor: CommentCursor | null; asOf: string | null };

export type CommentListState = {
  status: "loading" | "error" | "ready";
  errorKind: CommentErrorKind | null;
  /** Gli id nell'ordine del server, senza doppioni fra pagine (§222). */
  pageIds: string[];
  hasMore: boolean;
  isFetchingMore: boolean;
  loadMoreFailed: boolean;
  loadMore: () => void;
  retry: () => void;
  /** `as_of` SERVER della prima pagina: il watermark di «Nuovi commenti» (§141–§145). */
  firstAsOf: string | null;
};

export function dedupePageIds(pages: readonly { ids: readonly string[] }[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const page of pages) {
    for (const id of page.ids) {
      if (!seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
  }

  return out;
}

export function useRootComments({
  contentType,
  contentId,
  sort,
  viewerId,
  enabled,
}: {
  contentType: string;
  contentId: string;
  sort: CommentSort;
  viewerId: string;
  enabled: boolean;
}): CommentListState & { refreshFirstPage: () => Promise<void> } {
  const queryClient = useQueryClient();
  const queryKey = COMMENTS_QK.roots(contentType, contentId, sort, viewerId);

  const query = useInfiniteQuery({
    enabled: enabled && contentId.length > 0 && viewerId.length > 0,
    getNextPageParam: (last: IdsPage) => last.nextCursor ?? undefined,
    initialPageParam: null as CommentCursor | null,
    queryFn: async ({ pageParam }): Promise<IdsPage> => {
      // `fetchedAt` è solo la freschezza degli store (clock locale, confrontato con se stesso);
      // il watermark di «Nuovi commenti» è `asOf`, tempo del server.
      const fetchedAt = Date.now();
      const epoch = commentStore.epoch();
      const page = await listContentComments({ contentId, contentType, cursor: pageParam, sort });
      // Un cambio account a richiesta in volo: la risposta dell'utente di prima non semina.
      if (commentStore.epoch() === epoch) {
        seedCommentPage(page.comments, fetchedAt);
      }

      return { asOf: page.asOf, ids: page.comments.map((comment) => comment.id), nextCursor: page.nextCursor };
    },
    queryKey,
    // Un errore definitivo (contenuto non disponibile) non migliora al secondo tentativo.
    retry: (count, error) => count < 1 && classifyCommentError(error) === "network",
    staleTime: 30_000,
  });

  const pages = query.data?.pages ?? [];
  const hasData = query.data !== undefined;

  async function refreshFirstPage() {
    queryClient.setQueryData<InfiniteData<IdsPage, CommentCursor | null>>(queryKey, (old) =>
      old ? { pageParams: old.pageParams.slice(0, 1), pages: old.pages.slice(0, 1) } : old,
    );
    await query.refetch();
  }

  return {
    errorKind: query.isError ? classifyCommentError(query.error) : null,
    firstAsOf: pages[0]?.asOf ?? null,
    hasMore: query.hasNextPage,
    isFetchingMore: query.isFetchingNextPage,
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) {
        void query.fetchNextPage();
      }
    },
    loadMoreFailed: hasData && query.isError,
    pageIds: dedupePageIds(pages),
    refreshFirstPage,
    retry: () => {
      if (hasData && query.hasNextPage) {
        void query.fetchNextPage();
      } else {
        void query.refetch();
      }
    },
    status: hasData ? "ready" : query.isError ? "error" : "loading",
  };
}
