/**
 * HOM-03 §104: Mi piace e commenti nel dettaglio `/content/[type]/[id]`.
 *
 * Il dettaglio legacy non riceve il payload del Feed: legge lo stato da
 * `fetch_content_interaction_state` e mette Mi piace con lo stesso motore del
 * Feed (`useContentLikeToggle`: stessa coda, stesso tracker), che patcha anche
 * le cache Feed con la stessa chiave `<content_type>:<post_id>`. Like dal
 * dettaglio, ritorno al Feed: il cuore è già pieno.
 */

import { useQuery } from "@tanstack/react-query";

import { FEED_QK } from "./feed-keys";
import { fetchContentInteractionState } from "./feed-service";
import type { FeedContentType } from "./feed-types";
import { likeItemId, useContentLikeToggle } from "./use-feed-post-like";

export type ContentInteraction = {
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  canLike: boolean;
  isLoading: boolean;
  toggleLike: () => void;
};

export function useContentInteraction(
  contentType: FeedContentType,
  postId: string,
  opts: { profileId: string; enabled: boolean },
): ContentInteraction {
  const enabled = opts.enabled && opts.profileId.length > 0 && postId.length > 0;

  const query = useQuery({
    enabled,
    queryFn: () => fetchContentInteractionState(contentType, postId),
    queryKey: FEED_QK.interaction(contentType, postId),
  });

  const toggle = useContentLikeToggle({ profileId: opts.profileId });
  const state = query.data ?? null;

  return {
    canLike: state?.canLike ?? false,
    commentsCount: state?.commentsCount ?? 0,
    isLiked: state?.isLiked ?? false,
    isLoading: enabled && query.isLoading,
    likesCount: state?.likesCount ?? 0,
    toggleLike: () => {
      // Contenuto non leggibile o stato non ancora arrivato: nessun Like da
      // inventare (il controllo non dovrebbe essere visibile).
      if (!state) {
        return;
      }
      toggle({
        canLike: state.canLike,
        contentType,
        current: { isLiked: state.isLiked, likesCount: state.likesCount },
        itemId: likeItemId(contentType, postId),
        postId,
      });
    },
  };
}
