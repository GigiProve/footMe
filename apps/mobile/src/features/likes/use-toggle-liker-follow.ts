/**
 * Segui dalla lista Mi piace (HOM-07 §55–§57, §189).
 *
 * Nessuna relazione HOM-07 specifica: è il sistema Follow globale
 * (`toggleFollowSource`: `profile_follows` per profili e Media, `club_follows`
 * per le Società), con la stessa mutazione ottimistica dei suggerimenti della
 * Home. Il Follow resta dell'UTENTE, non dell'identità di interazione.
 *
 * La patch tocca UN solo attore nelle pagine già caricate: la lista non si
 * ricarica e non salta. Errore → si torna allo stato di prima su quell'attore.
 * A mutazione chiusa si passa dalla lista unica del Follow (HOM-15 §179), che
 * rilegge anche questa lista: dopo la patch il dato del server coincide.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useToast } from "../../ui";
import { trackLike } from "../interactions/like-analytics";
import { followKindOfIdentity } from "../following/follow-source";
import { invalidateFollowQueries } from "../following/invalidate-follow-queries";
import { toggleFollowSource } from "../search/media/media-search-service";
import { LIKES_QK } from "./likes-keys";
import {
  likeActorFollowType,
  patchLikerFollowing,
  type LikesData,
} from "./likes-presentation";
import type { LikeActor } from "./likes-types";

export const LIKES_FOLLOW_ERROR = "Non è stato possibile aggiornare il follow.";

export function useToggleLikerFollow({
  contentType,
  postId,
  viewerId,
}: {
  contentType: string;
  postId: string;
  viewerId: string;
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [busyKeys, setBusyKeys] = useState<readonly string[]>([]);
  const queryKey = LIKES_QK.list(contentType, postId, viewerId);

  const write = (actor: LikeActor, isFollowing: boolean) => {
    queryClient.setQueryData<LikesData>(queryKey, (data) =>
      patchLikerFollowing(data, actor.key, isFollowing),
    );
  };

  const setBusy = (key: string, busy: boolean) => {
    setBusyKeys((current) =>
      busy ? [...current.filter((entry) => entry !== key), key] : current.filter((entry) => entry !== key),
    );
  };

  const mutation = useMutation({
    mutationFn: (actor: LikeActor) =>
      toggleFollowSource(viewerId, likeActorFollowType(actor), actor.actorId, !actor.isFollowing),
    onError: (_error, actor) => {
      write(actor, actor.isFollowing);
      showToast({ message: LIKES_FOLLOW_ERROR });
    },
    onMutate: (actor) => {
      setBusy(actor.key, true);
      write(actor, !actor.isFollowing);
      trackLike({
        actorType: actor.actorType,
        contentId: postId,
        contentType,
        following: !actor.isFollowing,
        name: "follow_from_likes",
      });
    },
    onSettled: (_data, error, actor) => {
      setBusy(actor.key, false);
      // HOM-15 §179: la lista unica del Follow (suggerimenti, contatori, «Seguiti», Feed,
      // Cerca); il Feed si ritocca solo a server confermato.
      invalidateFollowQueries(
        queryClient,
        viewerId,
        error
          ? undefined
          : {
              following: !actor.isFollowing,
              source: { id: actor.actorId, kind: followKindOfIdentity(actor.actorType) },
            },
      );
    },
  });

  return {
    isBusy: (actor: LikeActor) => busyKeys.includes(actor.key),
    toggle: (actor: LikeActor) => {
      if (!busyKeys.includes(actor.key)) {
        mutation.mutate(actor);
      }
    },
  };
}
