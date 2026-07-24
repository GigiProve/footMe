import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import {
  keepPreviousData,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useSession } from "../../auth/use-session";
import { addRecentSearch } from "../recent-searches";
import { searchClubsPage } from "../search-service";
import type { SearchClubKind } from "../search-types";
import { colors, radius, spacing } from "../../../theme/tokens";
import { EmptyState, ScreenHeader, Skeleton, useToast } from "../../../ui";
import { ClubResultRow } from "./ClubResultRow";
import { SearchBar } from "./SearchBar";
import { SearchFilterChips } from "./SearchFilterChips";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

const KIND_OPTIONS: { label: string; value: SearchClubKind | null }[] = [
  { label: "Tutte", value: null },
  { label: "Club", value: "club" },
  { label: "Squadre interne", value: "team" },
  { label: "Affiliate", value: "affiliate" },
];

export function ClubResultsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const profileId = profile?.id ?? null;
  const params = useLocalSearchParams<{ kind?: string; q?: string }>();
  const initialQuery = typeof params.q === "string" ? params.q : "";
  const initialKind = (params.kind as SearchClubKind | undefined) ?? null;

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [kindChip, setKindChip] = useState<SearchClubKind | null>(initialKind);

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
    queryKey: ["search-clubs", debouncedQuery, kindChip],
    queryFn: ({ pageParam }) =>
      searchClubsPage(debouncedQuery || null, kindChip, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length : undefined,
    placeholderData: keepPreviousData,
  });

  const items = data?.pages.flat() ?? [];

  function handleSubmit() {
    const trimmed = query.trim();
    if (profileId && trimmed.length >= 2) {
      addRecentSearch(profileId, trimmed, "clubs").then(() => {
        queryClient.invalidateQueries({ queryKey: ["recent-searches"] });
      });
    }
  }

  return (
    <>
      <View style={styles.headerRow}>
        <ScreenHeader
          title="Società"
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
          placeholder="Cerca una società o una squadra"
          value={query}
        />
      </View>

      <SearchFilterChips
        onChange={setKindChip}
        onFiltersPress={() =>
          showToast({ message: "Filtri avanzati in arrivo", tone: "neutral" })
        }
        options={KIND_OPTIONS}
        value={kindChip}
      />

      {isLoading ? (
        <View style={styles.loaderContainer}>
          <Skeleton.Row />
          <Skeleton.Row />
          <Skeleton.Row />
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          icon="search-outline"
          title="Nessuna società trovata"
          description="Prova con un altro nome o un altro filtro."
        />
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={items}
          keyExtractor={(item) => `${item.kind}-${item.entity_id}`}
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
            <ClubResultRow
              onPress={() =>
                router.push(
                  (item.kind === "team"
                    ? `/club/team/${item.entity_id}`
                    : `/club/${item.entity_id}`) as never,
                )
              }
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
