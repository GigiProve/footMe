/**
 * Azioni sulle card del Feed.
 *
 * Solo due azioni sono reali in questo blocco, ed è deliberato:
 *  • SALVA — HOM-07: passa dallo store normalizzato dei Salvati e dalla
 *    mutation unica `set_saved` (§130–§137). Nessuna patch delle pagine del
 *    Feed: il toggle aggiorna la sola cella del contenuto, quindi non
 *    rirenderizza la lista né ricarica la Home (§137);
 *  • SEGUI — `toggleFollowSource` esiste già e conosce la differenza tra
 *    `profile_follows` e `club_follows`.
 * HOM-11: Non mi interessa, Non seguire e Segnala non stanno qui — hanno i propri
 * moduli (`feed-feedback`, `following`, `moderation`) e il menu li compone.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useToast } from "../../ui";
import { toggleFollowSource } from "../search/media/media-search-service";
import { contentSavedTarget, getSavedValue, savedKey, seedSaved } from "../saved/saved-store";
import { useSetSaved } from "../saved/use-set-saved";
import { trackFeed } from "./feed-analytics";
import { FEED_QK } from "./feed-keys";
import { isContentItem, type FeedContentType, type FeedItem, type FeedScope } from "./feed-types";

/**
 * HOM-07 §133, §141: i contenuti caricati seminano lo store Salvati con
 * l'istante della loro pagina, così una pagina in cache più vecchia di un
 * salvataggio fatto altrove non lo cancella, e un refetch più nuovo prevale.
 */
export function seedSavedFromItems(items: readonly FeedItem[]): void {
  for (const item of items) {
    if (isContentItem(item)) {
      seedSaved(
        savedKey(contentSavedTarget(item.payload.contentType, item.payload.postId)),
        item.isSaved,
        item.fetchedAt ?? 0,
      );
    }
  }
}

export function useSeedSaved(items: readonly FeedItem[]) {
  useEffect(() => {
    seedSavedFromItems(items);
  }, [items]);
}

type FeedSaveTap = {
  itemId: string;
  contentType: FeedContentType;
  postId: string;
  /** Il seme dal payload: lo store, se ne sa di più (altra superficie), vince. */
  isSaved: boolean;
};

/**
 * HOM-03 §37, §51, §95 + HOM-07: un solo Saved per tutta l'app. Lo stato
 * mostrato è quello dello store, quindi Feed, dettaglio, Cerca e Salvati
 * restano allineati (§133). La firma conserva `profileId` e `scope` per i
 * chiamanti esistenti: la scrittura non dipende più da nessuno dei due.
 */
export function useToggleSavedFeedItem(_options?: { profileId: string; scope?: FeedScope }) {
  const setSaved = useSetSaved();

  return {
    isPending: setSaved.isPending,
    mutate: (tap: FeedSaveTap) => {
      const target = contentSavedTarget(tap.contentType, tap.postId);
      const next = !getSavedValue(target, tap.isSaved);

      trackFeed({ itemId: tap.itemId, name: "feed_save_tap", saved: next });
      setSaved.mutate({ saved: next, surface: "feed", target });
    },
  };
}

type FollowTarget = {
  targetId: string;
  targetType: "profile" | "club";
  isFollowing: boolean;
};

export function useToggleFollowSuggestion({
  profileId,
  scope,
}: {
  profileId: string;
  scope: FeedScope;
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (target: FollowTarget) =>
      toggleFollowSource(
        profileId,
        target.targetType === "club" ? "club" : "media_profile",
        target.targetId,
        !target.isFollowing,
      ),
    onMutate: (target) => {
      trackFeed({
        name: "feed_follow_tap",
        scope,
        targetId: target.targetId,
        targetType: target.targetType,
      });
    },
    onError: () => {
      showToast({ message: "Non è stato possibile aggiornare il follow." });
    },
    onSettled: () => {
      // I suggerimenti escludono chi è già seguito: la lista va ricalcolata.
      void queryClient.invalidateQueries({
        queryKey: FEED_QK.suggestedProfiles(profileId),
      });
      void queryClient.invalidateQueries({
        queryKey: FEED_QK.suggestedClubs(profileId),
      });
      void queryClient.invalidateQueries({
        queryKey: FEED_QK.followingState(profileId),
      });
    },
  });
}
