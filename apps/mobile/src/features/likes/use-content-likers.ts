/**
 * Query della lista Mi piace (HOM-07 §60–§61): infinite query a cursore.
 *
 * La key porta tipo, id e viewer (`likes-keys.ts`). `getNextPageParam` ferma la
 * paginazione quando il server non manda più un cursore; il dedupe fra pagine è
 * di `mergeLikerPages`. Nessun refetch automatico oltre quello esplicito del
 * chiamante: la lista resta com'è finché l'utente non la ricarica (§54).
 */

import { useInfiniteQuery } from "@tanstack/react-query";

import { LIKES_QK } from "./likes-keys";
import { fetchContentLikers } from "./likes-service";
import { mergeLikerPages } from "./likes-presentation";
import type { LikesCursor, LikesPage } from "./likes-types";

export function useContentLikers(opts: {
  contentType: string;
  postId: string;
  viewerId: string;
  enabled?: boolean;
}) {
  const { contentType, postId, viewerId, enabled = true } = opts;

  const query = useInfiniteQuery({
    enabled: enabled && contentType.length > 0 && postId.length > 0 && viewerId.length > 0,
    getNextPageParam: (lastPage: LikesPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: null as LikesCursor | null,
    queryFn: ({ pageParam }) => fetchContentLikers(contentType, postId, pageParam),
    queryKey: LIKES_QK.list(contentType, postId, viewerId),
  });

  return { actors: mergeLikerPages(query.data?.pages ?? []), query };
}
