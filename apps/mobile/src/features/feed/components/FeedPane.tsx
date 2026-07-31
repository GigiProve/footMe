/**
 * Una tab del Feed: query, stato e composizione della lista.
 *
 * Esiste come componente separato per una ragione precisa: ogni tab ha il
 * proprio insieme di hook (query infinita, ripristino scroll, poll dei nuovi
 * contenuti, registro delle impression) e gli hook non si possono chiamare
 * condizionalmente. Un componente per tab, entrambi montati, è ciò che dà
 * gratuitamente le posizioni di scroll separate richieste dal §18.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View, type FlatList } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { spacing } from "../../../theme/tokens";
import { trackFeed } from "../feed-analytics";
import type { CachedFeed } from "../feed-cache";
import { FEED_QK } from "../feed-keys";
import { fetchHomeFollowingState } from "../feed-meta-service";
import { resolveFeedAuthorHref, resolveFeedItemHref } from "../feed-service";
import { shouldShowFollowingHint } from "../feed-scroll-rules";
import type {
  FeedItem,
  FeedScope,
  FeedSuggestedClubRow,
  FeedSuggestedProfileRow,
} from "../feed-types";
import { useFeed } from "../use-feed";
import { useFeedConnectivity } from "../use-feed-connectivity";
import { useFeedFirstAccess } from "../use-feed-first-access";
import {
  useToggleFollowSuggestion,
  useToggleSavedFeedItem,
} from "../use-feed-item-actions";
import { useFeedNewContent } from "../use-feed-new-content";
import { useFeedScrollRestore } from "../use-feed-scroll-restore";
import { useFeedSessionSeen } from "../use-feed-session-seen";
import { useSuggestedClubs, useSuggestedProfiles } from "../use-feed-suggestions";
import { FeedList } from "./FeedList";
import type { FeedModulesState } from "./FeedItemRenderer";
import {
  FeedErrorState,
  FeedFollowingHint,
  FeedNewContentBanner,
  FeedOfflineNotice,
  FeedPerTeEmpty,
  FeedRefreshingPill,
  FeedResumeBanner,
} from "./modules/FeedBanners";
import { FeedFollowingEmpty } from "./modules/FeedFollowingEmpty";
import { FeedPersonalizeModule } from "./modules/FeedPersonalizeModule";
import { FeedSkeleton } from "./skeletons/FeedSkeleton";

type FeedPaneProps = {
  scope: FeedScope;
  profileId: string;
  cache: CachedFeed | null | undefined;
  isCacheReady: boolean;
  listRef: React.RefObject<FlatList<FeedItem> | null>;
};

export function FeedPane({
  scope,
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
    resumeBannerShownAt: cache?.resumeBannerShownAt ?? null,
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
      openHref(resolveFeedItemHref(item));
    },
    onOpenAuthor: (item: FeedItem) => openHref(resolveFeedAuthorHref(item)),
    onToggleSaved: (item: FeedItem) => {
      if (
        item.type === "suggested_position" ||
        item.type === "suggested_profiles" ||
        item.type === "suggested_clubs"
      ) {
        return;
      }

      toggleSaved.mutate({
        contentType: item.payload.contentType,
        isSaved: item.isSaved,
        itemId: item.id,
        postId: item.payload.postId,
      });
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
      {scope === "seguiti" &&
      shouldShowFollowingHint(cache?.firstAccess.followingHintShownCount ?? 0) ? (
        <FeedFollowingHint />
      ) : null}
    </View>
  );

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
        onDiscover={discoverProfiles}
        onPressProfile={(row) => openHref(`/profile/${row.entity_id}`)}
        onToggleFollow={followProfileRow}
        pendingId={pendingFollowId}
        reason={followingState.data?.followsNobody === false ? "no_content" : "no_follows"}
        suggestions={profilesQuery.data}
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
            }
          }
        }}
        onRefresh={() => feed.refresh("pull")}
        onRetry={feed.retry}
        onScroll={scroll.onScroll}
        showInlineRetry={feed.isError && feed.items.length > 0}
      />

      <View pointerEvents="box-none" style={styles.overlay}>
        {feed.isRefreshing ? <FeedRefreshingPill /> : null}
        {newContent.isVisible ? (
          <FeedNewContentBanner
            count={newContent.count}
            onPress={() => {
              // §19: prima si torna in cima, POI si caricano i nuovi elementi.
              // Mai il contrario, altrimenti la lista salta sotto il dito.
              scroll.scrollToTop(true);
              newContent.dismiss();
              feed.refresh("new_content_banner");
            }}
          />
        ) : null}
        {scroll.resumeBannerVisible ? (
          <FeedResumeBanner onDismiss={scroll.dismissResumeBanner} />
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
    paddingHorizontal: spacing[12],
  },
});
