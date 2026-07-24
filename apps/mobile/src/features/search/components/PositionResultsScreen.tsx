import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useSession } from "../../auth/use-session";
import { toggleSavedAd } from "../../recruiting/recruiting-service";
import { addRecentSearch } from "../recent-searches";
import { searchPositionsPage } from "../search-service";
import type { PositionSearchRow, SearchPositionTarget } from "../search-types";
import { colors, radius, spacing } from "../../../theme/tokens";
import {
  Button,
  EmptyState,
  ScreenHeader,
  Skeleton,
  useToast,
} from "../../../ui";
import { PositionResultRow } from "./PositionResultRow";
import { SearchBar } from "./SearchBar";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

const TARGET_OPTIONS: { label: string; value: SearchPositionTarget | null }[] = [
  { label: "Tutte", value: null },
  { label: "Calciatori", value: "player" },
  { label: "Allenatori", value: "coach" },
  { label: "Staff", value: "staff" },
];

export function PositionResultsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const profileId = profile?.id ?? null;
  const params = useLocalSearchParams<{
    q?: string;
    saved?: string;
    target?: string;
  }>();
  const initialQuery = typeof params.q === "string" ? params.q : "";
  const initialTarget =
    (params.target as SearchPositionTarget | undefined) ?? null;
  const initialSaved = params.saved === "1";

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [targetChip, setTargetChip] = useState<SearchPositionTarget | null>(
    initialTarget,
  );
  const [savedOnly, setSavedOnly] = useState(initialSaved);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const trimmed = query.trim();
      if (trimmed.length === 0 || trimmed.length >= 2) {
        setDebouncedQuery(trimmed);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [query]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["search-positions", debouncedQuery, targetChip, savedOnly],
    queryFn: ({ pageParam }) =>
      searchPositionsPage(
        debouncedQuery || null,
        targetChip,
        savedOnly,
        pageParam,
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length : undefined,
    placeholderData: keepPreviousData,
  });

  const items = data?.pages.flat() ?? [];

  const toggleSavedMutation = useMutation({
    mutationFn: (row: PositionSearchRow) => {
      if (!profileId) {
        throw new Error("Sessione non valida.");
      }
      return toggleSavedAd(profileId, row.ad_id, !row.is_saved);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["search-positions"] });
      queryClient.invalidateQueries({ queryKey: ["saved-items"] });
      queryClient.invalidateQueries({ queryKey: ["saved-counts"] });
    },
  });

  function handleSubmit() {
    const trimmed = query.trim();
    if (profileId && trimmed.length >= 2) {
      addRecentSearch(profileId, trimmed, "positions").then(() => {
        queryClient.invalidateQueries({ queryKey: ["recent-searches"] });
      });
    }
  }

  return (
    <>
      <View style={styles.headerRow}>
        <ScreenHeader
          title="Posizioni aperte"
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

      <View style={styles.searchBlock}>
        <SearchBar
          onChangeText={setQuery}
          onSubmitEditing={handleSubmit}
          placeholder="Cerca una posizione"
          value={query}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.chipsRow}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
      >
        {TARGET_OPTIONS.map((option) => {
          const selected = targetChip === option.value;

          return (
            <Button
              key={option.label}
              label={option.label}
              onPress={() => setTargetChip(option.value)}
              selected={selected}
              size="sm"
              style={[styles.chip, selected ? styles.chipSelected : null]}
              textStyle={selected ? styles.chipSelectedLabel : undefined}
              variant="chipAction"
            />
          );
        })}
        <Button
          label="Salvate"
          onPress={() => setSavedOnly((prev) => !prev)}
          selected={savedOnly}
          size="sm"
          style={styles.chip}
          variant="chipAction"
        />
        <Button
          label="Filtri"
          leftIcon={
            <Ionicons
              color={colors.textSecondary}
              name="options-outline"
              size={14}
            />
          }
          onPress={() =>
            showToast({ message: "Filtri avanzati in arrivo", tone: "neutral" })
          }
          size="sm"
          style={styles.chip}
          variant="chipAction"
        />
      </ScrollView>

      {isLoading ? (
        <View style={styles.loaderContainer}>
          <Skeleton.Row />
          <Skeleton.Row />
          <Skeleton.Row />
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          icon="search-outline"
          title="Nessuna posizione trovata"
          description="Prova con un altro nome, ruolo o filtro."
        />
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={items}
          keyExtractor={(item) => item.ad_id}
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
            <PositionResultRow
              onPress={() => router.push(`/position/${item.ad_id}` as never)}
              onToggleSaved={() => toggleSavedMutation.mutate(item)}
              row={item}
            />
          )}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  // Compact pills per the Banani spec (34px, 12px sides).
  chip: {
    marginRight: spacing[8],
    minHeight: 34,
    paddingHorizontal: spacing[12],
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipSelectedLabel: {
    color: colors.inkInvert,
  },
  chipsRow: {
    alignItems: "center",
    // Bleed to the screen edge (Screen pads by spacing[20]) so scrolled-out
    // chips are clipped by the display, not mid-content.
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[4],
  },
  chipsScroll: {
    flexGrow: 0,
    marginBottom: spacing[8],
    marginHorizontal: -spacing[20],
  },
  footerLoader: {
    alignItems: "center",
    paddingVertical: spacing[16],
  },
  headerRow: {
    marginBottom: spacing[12],
  },
  listContent: {
    paddingBottom: spacing[24],
  },
  loaderContainer: {
    gap: spacing[8],
    paddingTop: spacing[16],
  },
  pressed: {
    opacity: 0.75,
  },
  searchBlock: {
    marginBottom: spacing[12],
  },
});
