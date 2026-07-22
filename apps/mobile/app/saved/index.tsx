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
  AppText,
  Button,
  EmptyState,
  ScreenHeader,
  useToast,
} from "../../src/ui";
import { useSession } from "../../src/features/auth/use-session";
import { SavedItemRow } from "../../src/features/saved/components/SavedItemRow";
import {
  fetchSavedItems,
  removeSavedItem,
  resolveSavedItemHref,
  type SavedFilter,
  type SavedItem,
} from "../../src/features/saved/saved-service";
import { colors, radius, spacing } from "../../src/theme/tokens";

const PAGE_SIZE = 20;

const SAVED_FILTERS: { label: string; value: SavedFilter }[] = [
  { label: "Tutti", value: "all" },
  { label: "Profili", value: "profile" },
  { label: "Posizioni", value: "position" },
  { label: "Contenuti", value: "content" },
  { label: "Società", value: "club" },
];

export default function SavedItemsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { session } = useSession();
  const ownerId = session?.user.id ?? null;
  const [filter, setFilter] = useState<SavedFilter>("all");
  const [itemToRemove, setItemToRemove] = useState<SavedItem | null>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["saved-items", filter],
    queryFn: ({ pageParam }) => fetchSavedItems(filter, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length : undefined,
  });

  const items = data?.pages.flat() ?? [];

  const removeMutation = useMutation({
    mutationFn: (item: SavedItem) => {
      if (!ownerId) {
        throw new Error("Sessione non valida.");
      }
      return removeSavedItem(ownerId, item);
    },
    onSuccess: () => {
      showToast({ message: "Elemento rimosso dai Salvati", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["saved-items"] });
      queryClient.invalidateQueries({ queryKey: ["saved-counts"] });
    },
    onError: (error) => {
      showToast({
        message:
          error instanceof Error
            ? error.message
            : "Impossibile rimuovere l'elemento.",
        tone: "neutral",
      });
    },
  });

  return (
    <Screen>
      <View style={styles.headerRow}>
        <ScreenHeader
          title="Salvati"
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

      <AppText variant="bodySm" color="muted" style={styles.privacyNote}>
        Solo tu puoi vedere ciò che salvi.
      </AppText>

      <View style={styles.filtersRow}>
        {SAVED_FILTERS.map((opt) => (
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
          icon="bookmark-outline"
          title="Nessun elemento salvato"
          description="Salva profili, posizioni e contenuti per ritrovarli qui."
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => `${item.source_table}-${item.entity_id}`}
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
          renderItem={({ item }) => {
            const href = resolveSavedItemHref(item);
            return (
              <SavedItemRow
                item={item}
                onPress={href ? () => router.push(href as never) : undefined}
                onRemove={() => setItemToRemove(item)}
              />
            );
          }}
        />
      )}
      <ActionSheet
        actions={[
          {
            destructive: true,
            icon: "bookmark",
            label: "Rimuovi dai Salvati",
            onPress: () => {
              if (itemToRemove) {
                removeMutation.mutate(itemToRemove);
              }
            },
          },
        ]}
        onClose={() => setItemToRemove(null)}
        title={itemToRemove?.title}
        visible={itemToRemove !== null}
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
  privacyNote: {
    marginBottom: spacing[12],
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
