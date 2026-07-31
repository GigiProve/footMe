/**
 * Azioni sulle card del Feed.
 *
 * Solo due azioni sono reali in questo blocco, ed è deliberato:
 *  • SALVA — `toggleSavedContent` esiste già e smista sulle 5 tabelle `saved_*`
 *    (§10 chiede di predisporre il bookmark, e qui funziona davvero);
 *  • SEGUI — `toggleFollowSource` esiste già e conosce la differenza tra
 *    `profile_follows` e `club_follows`.
 * Mi piace, Commenta, Condividi, Non mi interessa, Nascondi, Non seguire e
 * Segnala sono esclusi dal §29: i loro punti d'accesso esistono e rispondono
 * con un messaggio, senza inventare comportamenti.
 *
 * La patch ottimistica riscrive le pagine della infinite query in cache, sul
 * modello di `use-saved-profile-flags.ts`, così il bookmark risponde al tocco
 * invece che al round-trip.
 */

import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";

import { useToast } from "../../ui";
import {
  toggleFollowSource,
  toggleSavedContent,
} from "../search/media/media-search-service";
import { trackFeed } from "./feed-analytics";
import { FEED_QK } from "./feed-keys";
import type {
  FeedItem,
  FeedPage,
  FeedPageParam,
  FeedScope,
  MediaContentType,
} from "./feed-types";

type SavedTarget = {
  itemId: string;
  contentType: MediaContentType;
  postId: string;
  isSaved: boolean;
};

function patchSavedFlag(
  data: InfiniteData<FeedPage, FeedPageParam> | undefined,
  itemId: string,
  isSaved: boolean,
): InfiniteData<FeedPage, FeedPageParam> | undefined {
  if (!data) {
    return data;
  }

  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((item) =>
        item.id === itemId ? ({ ...item, isSaved } as FeedItem) : item,
      ),
    })),
  };
}

export function useToggleSavedFeedItem({
  profileId,
  scope,
}: {
  profileId: string;
  scope: FeedScope;
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const queryKey = FEED_QK.feed(scope, profileId);

  return useMutation({
    mutationFn: (target: SavedTarget) =>
      toggleSavedContent(profileId, target.contentType, target.postId, !target.isSaved),
    onMutate: async (target) => {
      await queryClient.cancelQueries({ queryKey });
      const previous =
        queryClient.getQueryData<InfiniteData<FeedPage, FeedPageParam>>(queryKey);

      queryClient.setQueryData<InfiniteData<FeedPage, FeedPageParam>>(queryKey, (data) =>
        patchSavedFlag(data, target.itemId, !target.isSaved),
      );

      trackFeed({ itemId: target.itemId, name: "feed_save_tap", saved: !target.isSaved });
      return { previous };
    },
    onError: (_error, _target, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      showToast({ message: "Non è stato possibile aggiornare i salvati." });
    },
    onSuccess: (_result, target) => {
      showToast({
        icon: target.isSaved ? "bookmark-outline" : "bookmark",
        message: target.isSaved ? "Rimosso dai salvati." : "Salvato.",
        tone: "success",
      });
    },
  });
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
