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
import { searchProfilesPage } from "../search-service";
import type { SearchProfileRole } from "../search-types";
import { colors, radius, spacing } from "../../../theme/tokens";
import { EmptyState, ScreenHeader, Skeleton, useToast } from "../../../ui";
import { ProfileResultRow } from "./ProfileResultRow";
import { SearchBar } from "./SearchBar";
import { SearchFilterChips } from "./SearchFilterChips";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

const ROLE_OPTIONS: { label: string; value: SearchProfileRole | null }[] = [
  { label: "Tutti", value: null },
  { label: "Calciatori", value: "player" },
  { label: "Allenatori", value: "coach" },
  { label: "Staff", value: "staff" },
  { label: "Agenti", value: "agent" },
];

export function ProfileResultsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const profileId = profile?.id ?? null;
  const params = useLocalSearchParams<{ q?: string; role?: string }>();
  const initialQuery = typeof params.q === "string" ? params.q : "";
  const initialRole =
    (params.role as SearchProfileRole | undefined) ?? null;

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [roleChip, setRoleChip] = useState<SearchProfileRole | null>(
    initialRole,
  );

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
    queryKey: ["search-profiles", debouncedQuery, roleChip],
    queryFn: ({ pageParam }) =>
      searchProfilesPage(debouncedQuery || null, roleChip, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length : undefined,
    placeholderData: keepPreviousData,
  });

  const items = data?.pages.flat() ?? [];

  function handleSubmit() {
    const trimmed = query.trim();
    if (profileId && trimmed.length >= 2) {
      addRecentSearch(profileId, trimmed, "profiles").then(() => {
        queryClient.invalidateQueries({ queryKey: ["recent-searches"] });
      });
    }
  }

  return (
    <>
      <View style={styles.headerRow}>
        <ScreenHeader
          title="Profili"
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
          placeholder="Cerca un profilo"
          value={query}
        />
      </View>

      <SearchFilterChips
        onChange={setRoleChip}
        onFiltersPress={() =>
          showToast({ message: "Filtri avanzati in arrivo", tone: "neutral" })
        }
        options={ROLE_OPTIONS}
        value={roleChip}
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
          title="Nessun profilo trovato"
          description="Prova con un altro nome, ruolo o filtro."
        />
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={items}
          keyExtractor={(item) => item.profile_id}
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
            <ProfileResultRow
              onPress={() => router.push(`/profile/${item.profile_id}` as never)}
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
