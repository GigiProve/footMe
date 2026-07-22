import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native";
import { useInfiniteQuery } from "@tanstack/react-query";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Screen } from "../../components/ui/screen";
import { AppText, Avatar, EmptyState, ScreenHeader } from "../../ui";
import { colors, radius, spacing } from "../../theme/tokens";
import {
  fetchProfileFollowers,
  fetchProfileMutualConnections,
  type ProfileConnectionListItem,
} from "./profile-social-service";

const PAGE_SIZE = 30;

type ConnectionsMode = "followers" | "mutual";

export function ProfileConnectionsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    mode?: string;
    profileId?: string;
  }>();
  const profileId = params.profileId ?? "";
  const mode: ConnectionsMode = params.mode === "mutual" ? "mutual" : "followers";
  const title = mode === "mutual" ? "Connessioni in comune" : "Follower";

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    enabled: profileId.length > 0,
    queryKey: ["profile-connections", mode, profileId],
    queryFn: ({ pageParam }) =>
      mode === "mutual"
        ? fetchProfileMutualConnections(profileId, { limit: PAGE_SIZE, offset: pageParam })
        : fetchProfileFollowers(profileId, { limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined,
  });

  // Offset pagination can repeat a profile if the list shifts between pages.
  const items = Array.from(
    new Map(
      (data?.pages.flat() ?? []).map((item) => [item.profileId, item]),
    ).values(),
  );

  return (
    <Screen>
      <View style={styles.headerRow}>
        <ScreenHeader
          title={title}
          action={
            <Pressable
              accessibilityLabel="Indietro"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.backButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <Ionicons color={colors.textPrimary} name="arrow-back" size={20} />
            </Pressable>
          }
        />
      </View>

      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title={mode === "mutual" ? "Nessuna connessione in comune" : "Nessun follower"}
          description={
            mode === "mutual"
              ? "Non ci sono ancora connessioni in comune con questo profilo."
              : "Questo profilo non ha ancora follower."
          }
        />
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={items}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          keyExtractor={(item) => item.profileId}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : null
          }
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.4}
          renderItem={({ item }) => (
            <ConnectionRow
              item={item}
              onPress={() => router.push(`/profile/${item.profileId}` as never)}
            />
          )}
        />
      )}
    </Screen>
  );
}

function ConnectionRow({
  item,
  onPress,
}: {
  item: ProfileConnectionListItem;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={item.displayName}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
    >
      <Avatar name={item.displayName} size="md" uri={item.avatarUrl} />
      <View style={styles.rowText}>
        <AppText variant="bodyLg">{item.displayName}</AppText>
        {item.roleLabel ? (
          <AppText color="secondary" variant="bodySm">
            {item.roleLabel}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    marginBottom: spacing[12],
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.75,
  },
  loaderContainer: {
    paddingVertical: spacing[40],
    alignItems: "center",
  },
  listContent: {
    paddingBottom: spacing[24],
  },
  separator: {
    height: spacing[8],
  },
  footerLoader: {
    paddingVertical: spacing[16],
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
    paddingVertical: spacing[8],
  },
  rowPressed: {
    opacity: 0.75,
  },
  rowText: {
    flex: 1,
    gap: spacing[4],
  },
});
