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
import { useUnreadNotificationsCount } from "../../notifications/use-unread-notifications-count";
import { useFollowedClubFlags, useToggleFollowClub } from "../../clubs/use-followed-club-flags";
import { useSavedEntityFlags, useToggleSavedEntity } from "../../saved/use-saved-entity-flags";
import { addRecentSearch } from "../recent-searches";
import {
  buildClubEmptySuggestions,
  buildClubFilterPayload,
  clubSortOptions,
  countActiveClubFilters,
  tipologiaToKind,
} from "../club-filters/club-filter-helpers";
import { createDefaultClubFiltersState, type ClubFiltersState } from "../club-filters/club-filter-types";
import type { ClubFilterSectionId } from "../club-filters/club-filter-configs";
import { formatClubResultsCount } from "../search-format";
import { searchClubsPage } from "../search-service";
import type { ClubSearchSort } from "../search-types";
import { useClubGroupedResults } from "../use-club-grouped-results";
import { colors, radius, spacing } from "../../../theme/tokens";
import { Button, EmptyState, HeaderBell, ScreenHeader, Skeleton } from "../../../ui";
import { ClubFiltersModal } from "./ClubFiltersModal";
import { ClubGroupedResults } from "./ClubGroupedResults";
import { ClubQuickFilterChips } from "./ClubQuickFilterChips";
import { ClubResultRow } from "./ClubResultRow";
import { ResultsCountBar } from "./ResultsCountBar";
import { SearchBar } from "./SearchBar";
import { SortSheet } from "./SortSheet";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

export function ClubResultsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const profileId = profile?.id ?? null;
  const unreadCount = useUnreadNotificationsCount();
  const params = useLocalSearchParams<{ q?: string }>();
  const initialQuery = typeof params.q === "string" ? params.q : "";

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<ClubFiltersState>(createDefaultClubFiltersState());
  const [sort, setSort] = useState<ClubSearchSort>("relevance");
  const [filtersModal, setFiltersModal] = useState<{
    open: boolean;
    sectionId: ClubFilterSectionId | null;
  }>({ open: false, sectionId: null });
  const [sortSheetOpen, setSortSheetOpen] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const trimmed = query.trim();
      if (trimmed.length === 0 || trimmed.length >= MIN_QUERY_LENGTH) {
        setDebouncedQuery(trimmed);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [query]);

  const kind = tipologiaToKind(filters.tipologia);
  const payload = buildClubFilterPayload(filters);
  const activeCount = countActiveClubFilters(filters);
  const isQueryMode = debouncedQuery.length >= MIN_QUERY_LENGTH;

  const {
    data: browseData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isBrowseLoading,
  } = useInfiniteQuery({
    queryKey: ["search-clubs", kind, payload, sort],
    queryFn: ({ pageParam }) =>
      searchClubsPage({ filters: payload, kind, page: pageParam, pageSize: PAGE_SIZE, query: null, sort }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.rows.length === PAGE_SIZE ? allPages.length : undefined,
    enabled: !isQueryMode,
    placeholderData: keepPreviousData,
  });

  const { data: groupedData, isLoading: isGroupedLoading } = useClubGroupedResults(
    debouncedQuery,
    kind,
    payload,
    sort,
  );

  const browseItems = browseData?.pages.flatMap((p) => p.rows) ?? [];
  const browseClubIds = browseItems.filter((r) => r.kind === "club").map((r) => r.entity_id);
  const browseTeamIds = browseItems.filter((r) => r.kind === "team").map((r) => r.entity_id);

  const groupedClubIds: string[] = [];
  const groupedTeamIds: string[] = [];
  if (groupedData) {
    if (groupedData.mode === "club") {
      groupedClubIds.push(groupedData.primary.entity_id);
      groupedClubIds.push(...groupedData.affiliates.map((a) => a.id));
      groupedClubIds.push(...groupedData.linkedSiblings.map((a) => a.id));
      if (groupedData.parent) groupedClubIds.push(groupedData.parent.id);
      groupedTeamIds.push(...groupedData.teams.map((t) => t.id));
      groupedClubIds.push(
        ...groupedData.others.filter((r) => r.kind === "club").map((r) => r.entity_id),
      );
      groupedTeamIds.push(
        ...groupedData.others.filter((r) => r.kind === "team").map((r) => r.entity_id),
      );
    } else if (groupedData.mode === "team") {
      groupedTeamIds.push(groupedData.primary.entity_id);
      groupedTeamIds.push(...groupedData.relatedTeams.map((r) => r.entity_id));
      if (groupedData.primary.parent_club_id) {
        groupedClubIds.push(groupedData.primary.parent_club_id);
      }
      groupedClubIds.push(
        ...groupedData.others.filter((r) => r.kind === "club").map((r) => r.entity_id),
      );
    }
  }

  const clubIds = isQueryMode ? groupedClubIds : browseClubIds;
  const teamIds = isQueryMode ? groupedTeamIds : browseTeamIds;

  const { savedIds: savedClubIds } = useSavedEntityFlags("club", [clubIds]);
  const { savedIds: savedTeamIds } = useSavedEntityFlags("team", [teamIds]);
  const { followedIds: followedClubIds } = useFollowedClubFlags([clubIds]);
  const toggleSaveClub = useToggleSavedEntity("club");
  const toggleSaveTeam = useToggleSavedEntity("team");
  const toggleFollow = useToggleFollowClub();

  function handleSubmit() {
    const trimmed = query.trim();
    if (profileId && trimmed.length >= MIN_QUERY_LENGTH) {
      addRecentSearch(profileId, trimmed, "clubs").then(() => {
        queryClient.invalidateQueries({ queryKey: ["recent-searches"] });
      });
    }
  }

  function resetSearch() {
    setQuery("");
    setFilters(createDefaultClubFiltersState());
    setSort("relevance");
  }

  function openClub(id: string) {
    router.push(`/club/${id}` as never);
  }

  function openTeam(id: string) {
    router.push(`/club/team/${id}` as never);
  }

  const suggestions = buildClubEmptySuggestions(filters);
  const totalCount = isQueryMode
    ? (groupedData?.totalCount ?? null)
    : (browseData?.pages[0]?.totalCount ?? null);
  const isLoading = isQueryMode ? isGroupedLoading : isBrowseLoading;
  const isEmpty = isQueryMode
    ? !isGroupedLoading && (!groupedData || groupedData.mode === "empty")
    : !isBrowseLoading && browseItems.length === 0;

  return (
    <>
      <View style={styles.headerRow}>
        <ScreenHeader
          action={<HeaderBell count={unreadCount} onPress={() => router.push("/notifications")} />}
          leading={
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
          title="Società"
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

      {activeCount > 0 ? (
        <ClubQuickFilterChips
          activeFiltersCount={activeCount}
          filters={filters}
          onChange={setFilters}
          onOpenFilters={() => setFiltersModal({ open: true, sectionId: null })}
        />
      ) : null}

      <ResultsCountBar
        filtersActiveCount={activeCount}
        label={totalCount != null ? formatClubResultsCount(totalCount) : null}
        onFiltersPress={() => setFiltersModal({ open: true, sectionId: null })}
        onSortPress={() => setSortSheetOpen(true)}
        showFilters
        sortActive={sort !== "relevance"}
      />

      {isLoading ? (
        <View style={styles.loaderContainer}>
          <Skeleton.Row />
          <Skeleton.Row />
          <Skeleton.Row />
        </View>
      ) : isEmpty ? (
        <EmptyState
          action={
            <View style={styles.emptyActions}>
              {activeCount > 0 ? (
                <Button
                  fullWidth
                  label="Modifica filtri"
                  onPress={() => setFiltersModal({ open: true, sectionId: null })}
                  variant="primary"
                />
              ) : (
                <Button
                  fullWidth
                  label="Reimposta ricerca"
                  onPress={resetSearch}
                  variant="primary"
                />
              )}
              {activeCount > 0 ? (
                <Button label="Reimposta ricerca" onPress={resetSearch} variant="link" />
              ) : null}
              {suggestions.map((suggestion) => (
                <Button
                  key={suggestion.id}
                  label={suggestion.label}
                  onPress={() => setFilters(suggestion.apply(filters))}
                  variant="link"
                />
              ))}
            </View>
          }
          description="Prova a modificare i filtri o ampliare la zona geografica."
          icon="search-outline"
          title="Nessuna società trovata"
        />
      ) : isQueryMode && groupedData ? (
        <ClubGroupedResults
          data={groupedData}
          followedClubIds={followedClubIds}
          onOpenClub={openClub}
          onOpenTeam={openTeam}
          onToggleFollow={(id) =>
            toggleFollow.mutate({ followed: followedClubIds.has(id), targetId: id })
          }
          onToggleSaveClub={(id) =>
            toggleSaveClub.mutate({ saved: savedClubIds.has(id), targetId: id })
          }
          onToggleSaveTeam={(id) =>
            toggleSaveTeam.mutate({ saved: savedTeamIds.has(id), targetId: id })
          }
          savedClubIds={savedClubIds}
          savedTeamIds={savedTeamIds}
        />
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={browseItems}
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
          renderItem={({ item }) => {
            const variant = item.is_affiliate ? "affiliate" : item.kind === "team" ? "team" : "principal";
            return (
              <ClubResultRow
                data={{
                  category: item.category,
                  city: item.city,
                  has_senior: item.has_senior,
                  has_youth: item.has_youth,
                  id: item.entity_id,
                  is_affiliate: item.is_affiliate,
                  kind: item.kind,
                  logo_url: item.logo_url,
                  name: item.name,
                  parent_club_name: item.parent_club_name,
                  region: item.region,
                }}
                follow={
                  variant !== "team"
                    ? {
                        following: followedClubIds.has(item.entity_id),
                        onToggle: () =>
                          toggleFollow.mutate({
                            followed: followedClubIds.has(item.entity_id),
                            targetId: item.entity_id,
                          }),
                      }
                    : null
                }
                onPress={() => (item.kind === "team" ? openTeam(item.entity_id) : openClub(item.entity_id))}
                save={{
                  saved:
                    item.kind === "team"
                      ? savedTeamIds.has(item.entity_id)
                      : savedClubIds.has(item.entity_id),
                  onToggle: () =>
                    item.kind === "team"
                      ? toggleSaveTeam.mutate({
                          saved: savedTeamIds.has(item.entity_id),
                          targetId: item.entity_id,
                        })
                      : toggleSaveClub.mutate({
                          saved: savedClubIds.has(item.entity_id),
                          targetId: item.entity_id,
                        }),
                }}
                variant={variant}
              />
            );
          }}
        />
      )}

      <ClubFiltersModal
        initialFilters={filters}
        initialSectionId={filtersModal.sectionId}
        onApply={setFilters}
        onClose={() => setFiltersModal({ open: false, sectionId: null })}
        query={debouncedQuery || null}
        visible={filtersModal.open}
      />

      <SortSheet
        onApply={setSort}
        onClose={() => setSortSheetOpen(false)}
        options={clubSortOptions()}
        value={sort}
        visible={sortSheetOpen}
      />
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
  emptyActions: {
    gap: spacing[8],
    width: "100%",
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
