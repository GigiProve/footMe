/**
 * Mi piace e Salva di UN media di carriera nel viewer del profilo altrui
 * (HOM-15 §174–§175). Nessun motore nuovo: Like = `useContentLikeToggle` +
 * like-store (cella `career_media:<uuid>`), Salva = `useSetSaved` + saved-store
 * (target `content` / `career_media`), come ogni altro contenuto (HOM-07 §1,
 * §84). Lo stato server di tutto il profilo arriva da una sola query
 * (`fetch_career_media_interactions`), condivisa dalle pagine del viewer, e
 * semina gli store con l'istante della richiesta (§141): un dato più vecchio
 * non cancella un tap fatto dopo.
 *
 * `null` finché lo stato non c'è o se il server non restituisce l'elemento
 * (profilo bloccato, elemento legacy senza target): il viewer non mostra
 * controlli invece di inventare uno stato.
 */

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { useSession } from "../../auth/use-session";
import { useContentLikeToggle } from "../../feed/use-feed-post-like";
import { likeItemKey, likeStore, useLikeView } from "../../interactions/like-store";
import { contentSavedTarget, useIsSaved } from "../../saved/saved-store";
import { useSetSaved } from "../../saved/use-set-saved";
import { CAREER_MEDIA_QK } from "./career-media-keys";
import {
  CAREER_MEDIA_CONTENT_TYPE,
  fetchCareerMediaInteractions,
} from "./career-media-service";

export type CareerMediaActions = {
  likesCount: number;
  isLiked: boolean;
  isSaved: boolean;
  canSave: boolean;
  toggleLike: () => void;
  toggleSaved: () => void;
};

export function useCareerMediaActions(
  ownerProfileId: string,
  itemKey: string,
): CareerMediaActions | null {
  const { session } = useSession();
  const viewerId = session?.user.id ?? "";

  const query = useQuery({
    enabled: viewerId.length > 0 && ownerProfileId.length > 0,
    queryFn: () => fetchCareerMediaInteractions(ownerProfileId),
    queryKey: CAREER_MEDIA_QK.interactions(viewerId, ownerProfileId),
  });

  const toggle = useContentLikeToggle({ profileId: viewerId });
  const setSaved = useSetSaved();

  const target = query.data?.byItemKey.get(itemKey) ?? null;
  const fetchedAt = query.data?.fetchedAt ?? 0;
  const mediaId = target?.mediaId ?? "";
  const likeKey = likeItemKey(CAREER_MEDIA_CONTENT_TYPE, mediaId);
  const seed = { likedAs: target?.likedAs ?? [], likesCount: target?.likesCount ?? 0 };
  const like = useLikeView(likeKey, seed);
  const savedTarget = target ? contentSavedTarget(CAREER_MEDIA_CONTENT_TYPE, mediaId) : null;
  const isSaved = useIsSaved(savedTarget, target?.isSaved, fetchedAt);

  // Dopo `useContentLikeToggle`, che al cambio utente svuota lo store.
  useEffect(() => {
    if (target) {
      likeStore.seed(
        likeItemKey(CAREER_MEDIA_CONTENT_TYPE, target.mediaId),
        { likedAs: target.likedAs, likesCount: target.likesCount },
        fetchedAt,
      );
    }
  }, [target, fetchedAt]);

  if (!target || !savedTarget) {
    return null;
  }

  return {
    canSave: target.canSave,
    isLiked: like.isLiked,
    isSaved,
    likesCount: like.likesCount,
    toggleLike: () =>
      toggle({
        canLike: target.canLike,
        contentType: CAREER_MEDIA_CONTENT_TYPE,
        postId: target.mediaId,
        seed,
      }),
    toggleSaved: () => {
      if (!target.canSave) {
        return;
      }
      setSaved.mutate({ saved: !isSaved, surface: "profile", target: savedTarget });
    },
  };
}
