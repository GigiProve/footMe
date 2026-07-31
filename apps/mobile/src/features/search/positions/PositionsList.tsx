import { type ReactElement } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { colors, spacing } from "../../../theme/tokens";
import { Skeleton } from "../../../ui";
import type { PositionSearchRow } from "../search-types";
import { PositionPreviewRow } from "./PositionPreviewRow";
import { useToggleSavedPosition } from "./use-toggle-saved-position";

type PositionsListProps = {
  items: PositionSearchRow[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  onEndReached: () => void;
  ListHeaderComponent?: ReactElement | null;
  ListEmptyComponent?: ReactElement | null;
};

function LoadingRows() {
  return (
    <View style={styles.loader}>
      <Skeleton.Row />
      <Skeleton.Row />
      <Skeleton.Row />
    </View>
  );
}

export function PositionsList({
  items,
  isLoading,
  isFetchingNextPage,
  onEndReached,
  ListHeaderComponent = null,
  ListEmptyComponent = null,
}: PositionsListProps) {
  const router = useRouter();
  const toggleSaved = useToggleSavedPosition();

  return (
    <FlatList
      contentContainerStyle={styles.content}
      data={items}
      keyExtractor={(item) => item.ad_id}
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={isLoading ? <LoadingRows /> : ListEmptyComponent}
      ListFooterComponent={
        isFetchingNextPage ? (
          <View style={styles.footer}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : null
      }
      ListHeaderComponent={ListHeaderComponent}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      renderItem={({ item }) => (
        <PositionPreviewRow
          onPress={() => router.push(`/position/${item.ad_id}` as never)}
          onToggleSaved={() =>
            toggleSaved.mutate({ adId: item.ad_id, saved: item.is_saved })
          }
          row={item}
        />
      )}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing[24],
  },
  footer: {
    alignItems: "center",
    paddingVertical: spacing[16],
  },
  loader: {
    gap: spacing[8],
    paddingTop: spacing[16],
  },
});
