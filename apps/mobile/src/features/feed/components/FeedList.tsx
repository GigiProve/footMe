/**
 * Una FlatList per tab. Contiene SOLO meccanica di lista: il fetch, la
 * navigazione e le mutazioni stanno in `FeedScreen`, che passa dati e callback.
 *
 * Scelte da conoscere:
 *
 *  • Pull-to-refresh con le prop scorciatoia `refreshing`/`onRefresh` e NON con
 *    `RefreshControl`: quel componente non è esportato dallo stub di
 *    react-native usato nei test, quindi importarlo romperebbe ogni test che
 *    renda questa lista. Il comportamento è identico.
 *  • La visibilità si legge con `viewabilityConfigCallbackPairs`, tenute in un
 *    ref con identità stabile: React Native solleva "Changing
 *    onViewableItemsChanged on the fly is not supported" se cambiano tra due
 *    render. Le coppie sono due, con soglie diverse perché rispondono a domande
 *    diverse: l'impression (50%, 350ms: «l'utente ha visto questo elemento») e
 *    il video (HOM-03 §19: soglia unica `FEED_VIDEO_VISIBLE_PERCENT`, nessun
 *    ritardo: un video che esce dalla viewport va in pausa subito, e il poll dei
 *    media in elaborazione guarda solo ciò che è davvero in vista).
 *  • Le chrome che devono scorrere col contenuto (modulo di primo accesso,
 *    avviso offline, stato vuoto) vivono in
 *    `ListHeaderComponent`/`ListEmptyComponent`. Header e tab della Home invece
 *    sono fuori dalla lista, perché devono restare visibili sempre.
 */

import { useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewToken,
} from "react-native";

import { colors, spacing } from "../../../theme/tokens";
import { FEED_VIDEO_VISIBLE_PERCENT } from "../feed-video-controller";
import type { FeedItem } from "../feed-types";
import {
  FeedEndOfList,
  FeedInlineRetry,
} from "./modules/FeedBanners";
import { FeedItemRenderer, type FeedItemHandlers, type FeedModulesState } from "./FeedItemRenderer";

type FeedListProps = {
  listRef: React.RefObject<FlatList<FeedItem> | null>;
  items: FeedItem[];
  handlers: FeedItemHandlers;
  modules: FeedModulesState;
  isRefreshing: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  showInlineRetry: boolean;
  ListHeaderComponent?: React.ReactElement | null;
  ListEmptyComponent?: React.ReactElement | null;
  onRefresh: () => void;
  onEndReached: () => void;
  onRetry: () => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onContentSizeChange: (width: number, height: number) => void;
  onItemsViewed: (items: FeedItem[]) => void;
  /**
   * HOM-03: l'insieme COMPLETO degli elementi in vista (anche vuoto), a ogni
   * variazione. Serve a mettere in pausa il video che esce (§19) e a limitare il
   * poll dei media in elaborazione a ciò che si vede (§66).
   */
  onVisibleItemsChange: (items: FeedItem[]) => void;
};

export function FeedList({
  listRef,
  items,
  handlers,
  modules,
  isRefreshing,
  isFetchingNextPage,
  hasNextPage,
  showInlineRetry,
  ListHeaderComponent = null,
  ListEmptyComponent = null,
  onRefresh,
  onEndReached,
  onRetry,
  onScroll,
  onContentSizeChange,
  onItemsViewed,
  onVisibleItemsChange,
}: FeedListProps) {
  // Identità stabile obbligatoria: vedi il commento in testa al file.
  const onItemsViewedRef = useRef(onItemsViewed);
  onItemsViewedRef.current = onItemsViewed;
  const onVisibleItemsChangeRef = useRef(onVisibleItemsChange);
  onVisibleItemsChangeRef.current = onVisibleItemsChange;

  const viewabilityPairsRef = useRef([
    {
      onViewableItemsChanged: ({ viewableItems }: { viewableItems: ViewToken[] }) => {
        const visible = itemsOf(viewableItems);

        if (visible.length > 0) {
          onItemsViewedRef.current(visible);
        }
      },
      viewabilityConfig: { itemVisiblePercentThreshold: 50, minimumViewTime: 350 },
    },
    {
      onViewableItemsChanged: ({ viewableItems }: { viewableItems: ViewToken[] }) => {
        onVisibleItemsChangeRef.current(itemsOf(viewableItems));
      },
      viewabilityConfig: {
        itemVisiblePercentThreshold: FEED_VIDEO_VISIBLE_PERCENT,
        minimumViewTime: 0,
      },
    },
  ]);

  return (
    <FlatList
      contentContainerStyle={styles.content}
      data={items}
      keyExtractor={(item) => item.id}
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={ListEmptyComponent}
      ListFooterComponent={
        <FeedListFooter
          hasItems={items.length > 0}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onRetry={onRetry}
          showInlineRetry={showInlineRetry}
        />
      }
      ListHeaderComponent={ListHeaderComponent}
      onContentSizeChange={onContentSizeChange}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      onRefresh={onRefresh}
      onScroll={onScroll}
      refreshing={isRefreshing}
      renderItem={({ item }) => (
        <FeedItemRenderer handlers={handlers} item={item} modules={modules} />
      )}
      scrollEventThrottle={250}
      showsVerticalScrollIndicator={false}
      viewabilityConfigCallbackPairs={viewabilityPairsRef.current}
    />
  );
}

function itemsOf(viewableItems: ViewToken[]): FeedItem[] {
  return viewableItems
    .map((token) => token.item as FeedItem | undefined)
    .filter((item): item is FeedItem => !!item);
}

function FeedListFooter({
  hasItems,
  hasNextPage,
  isFetchingNextPage,
  showInlineRetry,
  onRetry,
}: {
  hasItems: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  showInlineRetry: boolean;
  onRetry: () => void;
}) {
  if (isFetchingNextPage) {
    return (
      <View style={styles.footer}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (showInlineRetry) {
    return <FeedInlineRetry onRetry={onRetry} />;
  }

  // §17: "Sei aggiornato" solo a lista non vuota e davvero esaurita.
  if (hasItems && !hasNextPage) {
    return <FeedEndOfList />;
  }

  return null;
}

const styles = StyleSheet.create({
  // HOM-01.1 §11: 16px di margine pagina. Gli elementi non hanno spaziatura
  // esterna: il ritmo verticale e il divider stanno in `FeedItemFrame`.
  content: {
    paddingBottom: spacing[24],
    paddingHorizontal: spacing[16],
  },
  footer: {
    alignItems: "center",
    paddingVertical: spacing[16],
  },
});
