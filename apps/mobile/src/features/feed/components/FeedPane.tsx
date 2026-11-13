/**
 * Una tab del Feed: query, stato e composizione della lista.
 *
 * Esiste come componente separato per una ragione precisa: ogni tab ha il
 * proprio insieme di hook (query infinita, ripristino scroll, poll dei nuovi
 * contenuti, registro delle impression) e gli hook non si possono chiamare
 * condizionalmente. Un componente per tab, entrambi montati, è ciò che dà
 * gratuitamente le posizioni di scroll separate richieste dal §18.
 *
 * HOM-03: qui si cablano anche il Video e l'Articolo. Gli elementi in vista
 * (soglia unica del controller) vanno al controller video, che mette in pausa
 * il video che esce (§19), e al poll dei media in elaborazione (§66); solo la
 * tab attiva riferisce al controller, perché il pane nascosto non ha una
 * viewport vera. Like, Salva e apertura valgono per Post, Articolo e Video
 * editoriale con gli stessi handler (§52, §95, §104); l'apertura di un Articolo
 * traccia `feed_article_open` (§102).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, StyleSheet, View, type FlatList } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { spacing } from "../../../theme/tokens";
import { useToast } from "../../../ui";
import { trackFeed } from "../feed-analytics";
import type { CachedFeed } from "../feed-cache";
import { FEED_QK } from "../feed-keys";
import { fetchHomeFollowingState } from "../feed-meta-service";
import { FEED_SOON_MESSAGES } from "../feed-labels";
import {
  resolveFeedAuthorHref,
  resolveFeedItemHref,
  resolveIdentityHref,
  resolvePostMediaHref,
} from "../feed-service";
import type {
  FeedItem,
  FeedPostItem,
  FeedScope,
  FeedSuggestedClubRow,
  FeedSuggestedProfileRow,
} from "../feed-types";
import { useFeed } from "../use-feed";
import { useFeedMediaProcessing } from "../use-feed-media-processing";
import { useFeedVideoController } from "../use-feed-video";
import { useFeedConnectivity } from "../use-feed-connectivity";
import { useFeedFirstAccess } from "../use-feed-first-access";
import {
  useToggleFollowSuggestion,
  useToggleSavedFeedItem,
} from "../use-feed-item-actions";
import { useToggleFeedPostLike } from "../use-feed-post-like";
import { useFeedNewContent } from "../use-feed-new-content";
import { useFeedScrollRestore } from "../use-feed-scroll-restore";
import { useFeedSessionSeen } from "../use-feed-session-seen";
import { useSuggestedClubs, useSuggestedProfiles } from "../use-feed-suggestions";
import { FeedList } from "./FeedList";
import type {
  FeedIdentityTarget,
  FeedInteractiveItem,
  FeedModulesState,
} from "./FeedItemRenderer";
import {
  FeedErrorState,
  FeedOfflineNotice,
  FeedPerTeEmpty,
  NewContentPill,
} from "./modules/FeedBanners";
import { FeedFollowingEmpty } from "./modules/FeedFollowingEmpty";
import { FeedPersonalizeModule } from "./modules/FeedPersonalizeModule";
import { FeedSkeleton } from "./skeletons/FeedSkeleton";

type FeedPaneProps = {
  scope: FeedScope;
  /** La tab visibile: l'altra resta montata ma nascosta (vedi FeedScreen). */
  isActive: boolean;
  profileId: string;
  cache: CachedFeed | null | undefined;
  isCacheReady: boolean;
  listRef: React.RefObject<FlatList<FeedItem> | null>;
};

export function FeedPane({
  scope,
  isActive,
  profileId,
  cache,
  isCacheReady,
  listRef,
}: FeedPaneProps) {
  const router = useRouter();
  const [pendingFollowId, setPendingFollowId] = useState<string | null>(null);

  const feed = useFeed({ cache, isCacheReady, profileId, scope });
  const profilesQuery = useSuggestedProfiles(profileId);
  const clubsQuery = useSuggestedClubs(profileId);
  const toggleSaved = useToggleSavedFeedItem({ profileId, scope });
  const toggleFollow = useToggleFollowSuggestion({ profileId, scope });
  const toggleLike = useToggleFeedPostLike({ profileId });
  const videoController = useFeedVideoController();
  const mediaProcessing = useFeedMediaProcessing({ enabled: isActive, profileId });
  const { showToast } = useToast();

  const cachedScope = cache?.scopes[scope];
  const seen = useFeedSessionSeen({
    initialSeenIds: cachedScope?.seenIds ?? [],
    profileId,
    scope,
  });

  const scroll = useFeedScrollRestore({
    hydratedFromCache: feed.hydratedFromCache,
    itemCount: feed.items.length,
    listRef,
    profileId,
    savedScroll: feed.savedScroll,
    scope,
  });

  const newContent = useFeedNewContent({ profileId, scope, since: feed.asOf });
  const connectivity = useFeedConnectivity({
    error: feed.error,
    hasCachedItems: feed.items.length > 0,
    isError: feed.isError,
  });

  const intro = useFeedFirstAccess({
    cachedFirstAccess: cache?.firstAccess,
    profileId,
  });

  // Serve solo alla tab Seguiti: distingue i due stati vuoti del §14.
  const followingState = useQuery({
    enabled: !!profileId && scope === "seguiti",
    queryFn: fetchHomeFollowingState,
    queryKey: FEED_QK.followingState(profileId),
  });

  const openHref = useCallback(
    (href: string | null) => {
      if (href) {
        router.push(href as never);
      }
    },
    [router],
  );

  const handlers = {
    onOpenItem: (item: FeedItem) => {
      if (item.type === "suggested_position") {
        trackFeed({
          name: "feed_position_open",
          positionId: item.payload.adId,
          scope,
        });
      } else {
        trackFeed({
          itemId: item.id,
          itemType: item.type,
          name: "feed_content_open",
          scope,
        });
      }

      if (item.type === "article") {
        trackFeed({
          itemId: item.id,
          name: "feed_article_open",
          origin: "feed",
          position: item.rank,
        });
      }
      openHref(resolveFeedItemHref(item));
    },
    onOpenAuthor: (item: FeedItem) => {
      if (item.type === "post" && item.author) {
        trackFeed({
          identityType: item.payload.authorIdentityType,
          itemId: item.id,
          name: "feed_post_author_open",
        });
      }
      openHref(resolveFeedAuthorHref(item));
    },
    onToggleSaved: (item: FeedItem) => {
      if (
        item.type === "suggested_position" ||
        item.type === "suggested_profiles" ||
        item.type === "suggested_clubs"
      ) {
        return;
      }

      // I post persona non hanno ancora un salvataggio (Centro Salvati, HOM-07):
      // `capabilities.canSave` è false e il menu non mostra la voce.
      const contentType = item.payload.contentType;
      if (contentType === "profile_post") {
        return;
      }

      toggleSaved.mutate({
        contentType,
        isSaved: item.isSaved,
        itemId: item.id,
        postId: item.payload.postId,
      });
    },
    onToggleLike: toggleLike,
    onOpenMedia: (item: FeedPostItem, index: number) => {
      const media = item.payload.media[index];
      if (!media) {
        return;
      }
      trackFeed({
        index,
        itemId: item.id,
        mediaType: media.type,
        name: "feed_post_media_open",
      });
      openHref(resolvePostMediaHref(item, index));
    },
    onOpenIdentity: (item: FeedPostItem, target: FeedIdentityTarget) => {
      if (target.identityType !== "team") {
        trackFeed({
          identityType: target.identityType,
          itemId: item.id,
          name: "feed_post_mention_open",
        });
      }
      openHref(resolveIdentityHref(target));
    },
    onOpenLink: (item: FeedPostItem) => {
      const preview = item.payload.linkPreview;
      // §45: solo target https già validati dal server (HOM-06.1).
      if (!preview || !/^https:\/\//i.test(preview.url)) {
        return;
      }
      trackFeed({
        domain: preview.domain,
        itemId: item.id,
        name: "feed_post_link_preview_open",
      });
      void Linking.openURL(preview.url).catch(() => undefined);
    },
    onComment: (item: FeedInteractiveItem) => {
      trackFeed({ itemId: item.id, name: "feed_post_comment_tap" });
      showToast({ message: FEED_SOON_MESSAGES.comment });
    },
    onShare: (item: FeedInteractiveItem) => {
      trackFeed({ itemId: item.id, name: "feed_post_share_tap" });
      showToast({ message: FEED_SOON_MESSAGES.share });
    },
  };


  const followProfileRow = (row: FeedSuggestedProfileRow) => {
    setPendingFollowId(row.entity_id);
    toggleFollow.mutate(
      { isFollowing: row.is_following, targetId: row.entity_id, targetType: "profile" },
      { onSettled: () => setPendingFollowId(null) },
    );
  };

  const followClubRow = (row: FeedSuggestedClubRow) => {
    setPendingFollowId(row.entity_id);
    toggleFollow.mutate(
      { isFollowing: row.is_following, targetId: row.entity_id, targetType: "club" },
      { onSettled: () => setPendingFollowId(null) },
    );
  };

  const modules: FeedModulesState = {
    clubs: {
      isError: clubsQuery.isError,
      isLoading: clubsQuery.isLoading,
      retry: () => void clubsQuery.refetch(),
      rows: clubsQuery.data,
    },
    onPressSuggestedClub: (row) => openHref(`/club/${row.entity_id}`),
    onPressSuggestedProfile: (row) => {
      trackFeed({ name: "feed_suggested_profile_open", profileId: row.entity_id, scope });
      openHref(`/profile/${row.entity_id}`);
    },
    onSeeAllClubs: () => openHref("/search/clubs"),
    onSeeAllProfiles: () => openHref("/search/profiles"),
    onToggleFollowClub: followClubRow,
    onToggleFollowProfile: followProfileRow,
    pendingFollowId,
    profiles: {
      isError: profilesQuery.isError,
      isLoading: profilesQuery.isLoading,
      retry: () => void profilesQuery.refetch(),
      rows: profilesQuery.data,
    },
  };

  // §25: "stato vuoto visualizzato". Una volta sola per montaggio, e solo
  // quando è davvero uno stato vuoto: non durante il caricamento e non in caso
  // di errore, altrimenti il dato conterebbe altro.
  const emptyTrackedRef = useRef(false);
  useEffect(() => {
    if (
      emptyTrackedRef.current ||
      feed.isInitialLoading ||
      feed.isError ||
      feed.items.length > 0
    ) {
      return;
    }

    emptyTrackedRef.current = true;
    trackFeed({
      name: "feed_empty_state_shown",
      reason:
        scope === "seguiti" && followingState.data?.followsNobody !== false
          ? "no_follows"
          : "no_content",
      scope,
    });
  }, [
    feed.isError,
    feed.isInitialLoading,
    feed.items.length,
    followingState.data?.followsNobody,
    scope,
  ]);

  // HOM-01.1 §70: "nuovi contenuti disponibili" una volta per comparsa della
  // pill, non a ogni poll che ne aggiorna il conteggio. Solo nella tab attiva:
  // il pane nascosto resta montato e poll-a, ma la sua pill non si vede.
  const showNewContent = isActive && newContent.isVisible;
  const newContentTrackedRef = useRef(false);
  useEffect(() => {
    if (!showNewContent) {
      newContentTrackedRef.current = false;
      return;
    }
    if (newContentTrackedRef.current) {
      return;
    }

    newContentTrackedRef.current = true;
    trackFeed({ count: newContent.count, name: "feed_new_content_available", scope });
  }, [newContent.count, scope, showNewContent]);

  // §16: skeleton solo quando non c'è davvero nulla. Con contenuti in cache la
  // schermata non viene mai sostituita da un loader.
  if (feed.isInitialLoading) {
    return (
      <View style={styles.padded}>
        <FeedSkeleton />
      </View>
    );
  }

  // §23: schermata d'errore solo se non è rimasto nulla da mostrare. Il
  // messaggio sottostante viene riportato in forma discreta: senza, una RPC
  // assente o un permesso negato sono indistinguibili da un problema di rete.
  if (feed.isError && feed.items.length === 0) {
    return <FeedErrorState detail={feed.error?.message ?? null} onRetry={feed.retry} />;
  }

  // HOM-01.1 §24: Seguiti non ha più un helper sotto le tab.
  const header = (
    <View>
      {connectivity.isOffline ? <FeedOfflineNotice /> : null}
      {scope === "per_te" && intro.isVisible ? (
        <View style={styles.introSpacing}>
          <FeedPersonalizeModule
            isSaving={intro.isSaving}
            onDismiss={intro.dismiss}
            onSave={intro.save}
            options={intro.options}
          />
        </View>
      ) : null}
    </View>
  );

  // §36: Cerca → Profili, la discovery già esistente.
  const discoverProfiles = () => {
    trackFeed({ name: "feed_discover_profiles_tap", scope });
    openHref("/search/profiles");
  };

  const emptyComponent =
    scope === "per_te" ? (
      // La spina fa già di tutto per non arrivare qui (contenuti globali,
      // popolari, floor che cade): se ci arriva davvero, meglio dirlo che
      // lasciare la Home bianca.
      <FeedPerTeEmpty onDiscover={discoverProfiles} />
    ) : !feed.isInitialLoading ? (
      <FeedFollowingEmpty
        clubs={clubsQuery.data}
        onDiscover={discoverProfiles}
        onPressClub={modules.onPressSuggestedClub}
        onPressProfile={modules.onPressSuggestedProfile}
        onToggleFollowClub={followClubRow}
        onToggleFollowProfile={followProfileRow}
        pendingId={pendingFollowId}
        profiles={profilesQuery.data}
        reason={followingState.data?.followsNobody === false ? "no_content" : "no_follows"}
      />
    ) : null;

  return (
    <View style={styles.container}>
      <FeedList
        handlers={handlers}
        hasNextPage={feed.hasNextPage}
        isFetchingNextPage={feed.isFetchingNextPage}
        isRefreshing={feed.isRefreshing}
        items={feed.items}
        listRef={listRef}
        ListEmptyComponent={emptyComponent}
        ListHeaderComponent={header}
        modules={modules}
        onContentSizeChange={scroll.onContentSizeChange}
        onEndReached={feed.loadNextPage}
        onItemsViewed={(visible) => {
          for (const item of visible) {
            if (seen.markSeen(item.id)) {
              trackFeed({
                itemId: item.id,
                itemType: item.type,
                name: "feed_item_impression",
                position: item.rank,
                scope,
              });

              // §102: l'impression dell'Articolo è un evento suo, una volta per
              // sessione come l'impression generica (HOME-05 aggrega).
              if (item.type === "article") {
                trackFeed({ itemId: item.id, name: "feed_article_impression" });
              }
            }
          }
        }}
        onVisibleItemsChange={(visible) => {
          // Il pane nascosto non ha viewport: non deve mettere in pausa il
          // video della tab attiva (vedi il commento in testa al file).
          if (isActive) {
            videoController.reportVisibleItems(new Set(visible.map((item) => item.id)));
          }
          mediaProcessing.reportVisibleItems(visible);
        }}
        onRefresh={() => feed.refresh("pull")}
        onRetry={feed.retry}
        onScroll={scroll.onScroll}
        showInlineRetry={feed.isError && feed.items.length > 0}
      />

      {/* HOM-01.1 §43–47: nessuna pill di refresh e nessun banner di
          ripristino. L'unico elemento sovrapposto è "Nuovi contenuti". */}
      <View pointerEvents="box-none" style={styles.overlay}>
        {showNewContent ? (
          <NewContentPill
            onPress={() => {
              // §41: prima si torna in cima, POI si caricano i nuovi elementi.
              // Mai il contrario, altrimenti la lista salta sotto il dito. La
              // dedup per id di `mergeFeedPages` evita i duplicati.
              trackFeed({ name: "feed_new_content_tap", scope });
              scroll.scrollToTop(true);
              newContent.dismiss();
              feed.refresh("new_content_banner");
            }}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  introSpacing: {
    paddingTop: spacing[12],
  },
  overlay: {
    alignItems: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: spacing[12],
  },
  padded: {
    flex: 1,
    paddingHorizontal: spacing[16],
  },
});
