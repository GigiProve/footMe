/**
 * Risposte di UN thread, a blocchi (HOM-08 §126, §132–§136, §226).
 *
 * Caricamento PIGRO: la query parte solo quando il thread è espanso (`enabled`),
 * mai per ogni root (§136: nessuna richiesta di massa). Espandere non rilegge il
 * contenuto né i commenti principali (§226). Ordine conversazionale, dalla più
 * vecchia alla più recente (§126), deciso dal server; le pagine successive si
 * chiedono con «Visualizza altre risposte» (§134–§135).
 *
 * Come i principali, la query porta gli id e il cursore; le entità e i Mi piace vanno
 * negli store normalizzati con l'istante di PARTENZA della richiesta.
 */

import { useInfiniteQuery } from "@tanstack/react-query";

import { COMMENTS_QK } from "./comment-keys";
import { seedCommentPage } from "./comment-seed";
import { classifyCommentError, listCommentReplies } from "./comment-service";
import { commentStore } from "./comment-store";
import type { CommentCursor } from "./comment-types";
import { dedupePageIds, type CommentListState } from "./use-root-comments";

type IdsPage = { ids: string[]; nextCursor: CommentCursor | null; asOf: string | null };

export function useCommentReplies({
  rootCommentId,
  viewerId,
  enabled,
}: {
  rootCommentId: string;
  viewerId: string;
  enabled: boolean;
}): CommentListState {
  const query = useInfiniteQuery({
    enabled: enabled && rootCommentId.length > 0 && viewerId.length > 0,
    getNextPageParam: (last: IdsPage) => last.nextCursor ?? undefined,
    initialPageParam: null as CommentCursor | null,
    queryFn: async ({ pageParam }): Promise<IdsPage> => {
      const fetchedAt = Date.now();
      const epoch = commentStore.epoch();
      const page = await listCommentReplies({ cursor: pageParam, rootCommentId });
      // Un cambio account a richiesta in volo: la risposta dell'utente di prima non semina.
      if (commentStore.epoch() === epoch) {
        seedCommentPage(page.comments, fetchedAt);
      }

      return { asOf: page.asOf, ids: page.comments.map((comment) => comment.id), nextCursor: page.nextCursor };
    },
    queryKey: COMMENTS_QK.replies(rootCommentId, viewerId),
    retry: (count, error) => count < 1 && classifyCommentError(error) === "network",
    staleTime: 30_000,
  });

  const pages = query.data?.pages ?? [];
  const hasData = query.data !== undefined;

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
