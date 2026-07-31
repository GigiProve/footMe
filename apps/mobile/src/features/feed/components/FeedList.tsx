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
 *  • `onViewableItemsChanged` è tenuto in un ref con identità stabile: React
 *    Native solleva "Changing onViewableItemsChanged on the fly is not
 *    supported" se la funzione cambia tra due render.
 *  • Le chrome che devono scorrere col contenuto (modulo di primo accesso,
 *    helper Seguiti, avviso offline, stato vuoto) vivono in
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
}: FeedListProps) {
  // Identità stabile obbligatoria: vedi il commento in testa al file.
  const onItemsViewedRef = useRef(onItemsViewed);
  onItemsViewedRef.current = onItemsViewed;

  const viewabilityHandlerRef = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const visible = viewableItems
        .map((token) => token.item as FeedItem | undefined)
        .filter((item): item is FeedItem => !!item);

      if (visible.length > 0) {
        onItemsViewedRef.current(visible);
      }
    },
  );

  const viewabilityConfigRef = useRef({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 350,
  });

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
      onViewableItemsChanged={viewabilityHandlerRef.current}
      refreshing={isRefreshing}
      renderItem={({ item }) => (
        <View style={styles.itemSpacing}>
          <FeedItemRenderer handlers={handlers} item={item} modules={modules} />
        </View>
      )}
      scrollEventThrottle={250}
      showsVerticalScrollIndicator={false}
      viewabilityConfig={viewabilityConfigRef.current}
    />
  );
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
  content: {
    paddingBottom: spacing[24],
    paddingHorizontal: spacing[12],
  },
  footer: {
    alignItems: "center",
    paddingVertical: spacing[16],
  },
  itemSpacing: {
    paddingTop: spacing[12],
  },
});
