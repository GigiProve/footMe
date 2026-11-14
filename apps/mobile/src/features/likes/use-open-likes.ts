/**
 * Apertura della lista Mi piace dal numero della cella (HOM-07 §24, §189).
 *
 * Un solo punto per Feed, dettaglio Post e dettaglio contenuto: traccia
 * `likes_list_open` (solo tipo, id e conteggio, §190) e naviga alla route
 * `/likes/[type]/[id]`. Il conteggio è quello dello store (il più recente); il
 * fallback è quello del payload che ha mostrato la cella.
 */

import { useRouter } from "expo-router";

import { trackLike } from "../interactions/like-analytics";
import { likeItemKey, likeStore } from "../interactions/like-store";
import { likesHref } from "./likes-routes";

export function useOpenLikes() {
  const router = useRouter();

  return (target: { contentType: string; postId: string; likesCount: number }) => {
    const current = likeStore.get(likeItemKey(target.contentType, target.postId));

    trackLike({
      contentId: target.postId,
      contentType: target.contentType,
      likesCount: current?.likesCount ?? target.likesCount,
      name: "likes_list_open",
    });
    router.push(likesHref(target.contentType, target.postId) as never);
  };
}
