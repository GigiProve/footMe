/**
 * HOM-03 §104: Mi piace e commenti nel dettaglio `/content/[type]/[id]`.
 *
 * Il dettaglio legacy non riceve il payload del Feed: legge lo stato da
 * `fetch_content_interaction_state` e lo semina nello store dei Mi piace
 * (HOM-07 §135), la stessa cella `<content_type>:<post_id>` del Feed. Mi piace
 * messo qui, ritorno al Feed: il cuore è già pieno, senza patchare nessuna
 * pagina. Il toggle è lo stesso motore del Feed (`useContentLikeToggle`).
 */

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import type { LikeIdentityRef } from "../interactions/interaction-types";
import { likeItemKey, likeStore, useLikeView } from "../interactions/like-store";
import { FEED_QK } from "./feed-keys";
import { fetchContentInteractionState } from "./feed-service";
import type { FeedContentType } from "./feed-types";
import { useContentLikeToggle } from "./use-feed-post-like";

export type ContentInteraction = {
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  canLike: boolean;
  isLoading: boolean;
  /** Le identità del viewer che hanno messo Mi piace: il seed della cella prima del suo primo sync. */
  likedAs: LikeIdentityRef[];
  toggleLike: () => void;
};

export function useContentInteraction(
  contentType: FeedContentType,
  postId: string,
  opts: { profileId: string; enabled: boolean },
): ContentInteraction {
  const enabled = opts.enabled && opts.profileId.length > 0 && postId.length > 0;
  const key = likeItemKey(contentType, postId);

  const query = useQuery({
    enabled,
    queryFn: () => fetchContentInteractionState(contentType, postId),
    queryKey: FEED_QK.interaction(contentType, postId),
  });

  const toggle = useContentLikeToggle({ profileId: opts.profileId });
  const state = query.data ?? null;
  const seed = { likedAs: state?.likedAs ?? [], likesCount: state?.likesCount ?? 0 };
  const view = useLikeView(key, seed);

  // Dopo `useContentLikeToggle`, che al cambio utente svuota lo store.
  useEffect(() => {
    if (query.data) {
      likeStore.seed(
        key,
        { likedAs: query.data.likedAs, likesCount: query.data.likesCount },
        query.data.fetchedAt ?? 0,
      );
    }
  }, [key, query.data]);

  return {
    canLike: state?.canLike ?? false,
    commentsCount: state?.commentsCount ?? 0,
    isLiked: view.isLiked,
    isLoading: enabled && query.isLoading,
    likedAs: seed.likedAs,
    likesCount: view.likesCount,
    toggleLike: () => {
      // Contenuto non leggibile o stato non ancora arrivato: nessun Like da
      // inventare (il controllo non dovrebbe essere visibile).
      if (!state) {
        return;
      }
      toggle({ canLike: state.canLike, contentType, postId, seed });
    },
  };
}
