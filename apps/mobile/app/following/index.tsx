import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Screen } from "../../src/components/ui/screen";
import {
  ActionSheet,
  Button,
  EmptyState,
  ScreenHeader,
  useToast,
} from "../../src/ui";
import { useSession } from "../../src/features/auth/use-session";
import { FollowedRow } from "../../src/features/following/components/FollowedRow";
import {
  fetchFollowedProfiles,
  resolveFollowedHref,
  unfollowEntity,
  type FollowedEntity,
  type FollowFilter,
} from "../../src/features/following/following-service";
import { colors, radius, spacing } from "../../src/theme/tokens";

const PAGE_SIZE = 20;

const FOLLOW_FILTERS: { label: string; value: FollowFilter }[] = [
  { label: "Tutti", value: "all" },
  { label: "Società", value: "club" },
  { label: "Calciatori", value: "player" },
  { label: "Media", value: "media" },
  { label: "Allenatori", value: "coach" },
  { label: "Agenti", value: "agent" },
];

export default function FollowingScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { session } = useSession();
  const ownerId = session?.user.id ?? null;
  const [filter, setFilter] = useState<FollowFilter>("all");
  const [entityToUnfollow, setEntityToUnfollow] =
    useState<FollowedEntity | null>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["followed", filter],
    queryFn: ({ pageParam }) => fetchFollowedProfiles(filter, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length : undefined,
  });

  const items = data?.pages.flat() ?? [];

  const unfollowMutation = useMutation({
    mutationFn: (item: FollowedEntity) => {
      if (!ownerId) {
        throw new Error("Sessione non valida.");
      }
      return unfollowEntity(ownerId, item);
    },
    onSuccess: (_data, item) => {
      showToast({ message: `Non segui più ${item.name}`, tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["followed"] });
      queryClient.invalidateQueries({ queryKey: ["following-count"] });
    },
    onError: (error) => {
      showToast({
        message:
          error instanceof Error
            ? error.message
            : "Impossibile aggiornare il seguito.",
        tone: "neutral",
      });
    },
  });

  return (
    <Screen>
      <View style={styles.headerRow}>
        <ScreenHeader
          title="Seguiti"
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

      <View style={styles.filtersRow}>
        {FOLLOW_FILTERS.map((opt) => (
          <Button
            key={opt.value}
            label={opt.label}
            onPress={() => setFilter(opt.value)}
            selected={filter === opt.value}
            size="sm"
            variant="chipAction"
          />
        ))}
      </View>

      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="Nessun profilo seguito"
          description="Segui calciatori, società, media e altri profili per vederli qui."
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => `${item.kind}-${item.entity_id}`}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <FollowedRow
              item={item}
              onPress={() => router.push(resolveFollowedHref(item) as never)}
              onUnfollow={() => setEntityToUnfollow(item)}
            />
          )}
        />
      )}
      <ActionSheet
        actions={[
          {
            destructive: true,
            icon: "person-remove-outline",
            label: "Non seguire più",
            onPress: () => {
              if (entityToUnfollow) {
                unfollowMutation.mutate(entityToUnfollow);
              }
            },
          },
        ]}
        message="Non riceverai più aggiornamenti principali da questo profilo nella tua Home."
        onClose={() => setEntityToUnfollow(null)}
        title={
          entityToUnfollow
            ? `Non seguire più ${entityToUnfollow.name}?`
            : undefined
        }
        visible={entityToUnfollow !== null}
      />
    </Screen>
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
  filtersRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
    marginBottom: spacing[16],
  },
  loaderContainer: {
    paddingVertical: spacing[40],
    alignItems: "center",
  },
  listContent: {
    gap: spacing[0],
    paddingBottom: spacing[24],
  },
  separator: {
    height: spacing[8],
  },
  footerLoader: {
    paddingVertical: spacing[16],
    alignItems: "center",
  },
});
