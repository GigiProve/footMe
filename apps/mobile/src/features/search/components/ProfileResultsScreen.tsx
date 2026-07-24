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
import { useSavedProfileFlags, useToggleSavedProfile } from "../../saved/use-saved-profile-flags";
import { AddToShortlistFlow } from "../../shortlist/components/AddToShortlistFlow";
import {
  invalidateShortlistMembership,
  useShortlistMembershipFlags,
} from "../../shortlist/use-shortlist-membership-flags";
import { addRecentSearch } from "../recent-searches";
import { buildEmptySuggestions, buildFilterPayload, coerceSort, countActiveFilters, sortOptionsForRole } from "../profile-filters/profile-filter-helpers";
import { createDefaultProfileFiltersState, type ProfileFiltersState } from "../profile-filters/profile-filter-types";
import type { FilterSectionId } from "../profile-filters/profile-filter-configs";
import { buildProfileMetaLines, formatResultsCount } from "../search-format";
import { searchProfilesPage } from "../search-service";
import type { ProfileSearchRow, ProfileSearchSort, SearchProfileRole } from "../search-types";
import { colors, radius, spacing } from "../../../theme/tokens";
import { Button, EmptyState, HeaderBell, ScreenHeader, Skeleton, useToast } from "../../../ui";
import { ProfileFiltersModal } from "./ProfileFiltersModal";
import { ProfileResultRow } from "./ProfileResultRow";
import { QuickFilterChips } from "./QuickFilterChips";
import { ResultsCountBar } from "./ResultsCountBar";
import { SearchBar } from "./SearchBar";
import { SearchFilterChips } from "./SearchFilterChips";
import { SortSheet } from "./SortSheet";

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
  const unreadCount = useUnreadNotificationsCount();
  const params = useLocalSearchParams<{ q?: string; role?: string }>();
  const initialQuery = typeof params.q === "string" ? params.q : "";
  const initialRole =
    (params.role as SearchProfileRole | undefined) ?? null;

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [roleChip, setRoleChip] = useState<SearchProfileRole | null>(
    initialRole,
  );
  const [filters, setFilters] = useState<ProfileFiltersState>(
    createDefaultProfileFiltersState(),
  );
  const [sort, setSort] = useState<ProfileSearchSort>("relevance");
  const [filtersModal, setFiltersModal] = useState<{
    open: boolean;
    sectionId: FilterSectionId | null;
  }>({ open: false, sectionId: null });
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [shortlistTarget, setShortlistTarget] = useState<ProfileSearchRow | null>(
    null,
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

  const payload = buildFilterPayload(roleChip, filters);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["search-profiles", debouncedQuery, roleChip, payload, sort],
    queryFn: ({ pageParam }) =>
      searchProfilesPage({
        filters: payload,
        page: pageParam,
        query: debouncedQuery || null,
        role: roleChip,
        sort,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.rows.length === PAGE_SIZE ? allPages.length : undefined,
    placeholderData: keepPreviousData,
  });

  const items = data?.pages.flatMap((p) => p.rows) ?? [];
  const totalCount = data?.pages[0]?.totalCount ?? null;
  const pageIds = (data?.pages ?? []).map((p) => p.rows.map((r) => r.profile_id));

  const { savedIds } = useSavedProfileFlags(pageIds);
  const toggleSave = useToggleSavedProfile();
  const shortlistFlags = useShortlistMembershipFlags(pageIds);
  const activeFiltersCount = countActiveFilters(roleChip, filters);

  function handleSubmit() {
    const trimmed = query.trim();
    if (profileId && trimmed.length >= 2) {
      addRecentSearch(profileId, trimmed, "profiles").then(() => {
        queryClient.invalidateQueries({ queryKey: ["recent-searches"] });
      });
    }
  }

  function handleRoleChipChange(next: SearchProfileRole | null) {
    setRoleChip(next);
    setSort((prev) => coerceSort(next, prev));
  }

  function resetSearch() {
    setQuery("");
    setFilters(createDefaultProfileFiltersState());
    setSort("relevance");
  }

  const suggestions = buildEmptySuggestions(roleChip, filters);

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
          title="Profili"
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
        onChange={handleRoleChipChange}
        options={ROLE_OPTIONS}
        value={roleChip}
      />

      {roleChip ? (
        <QuickFilterChips
          activeFiltersCount={activeFiltersCount}
          filters={filters}
          onChange={setFilters}
          onOpenFilters={() => setFiltersModal({ open: true, sectionId: null })}
          onOpenSection={(sectionId) => setFiltersModal({ open: true, sectionId })}
          role={roleChip}
        />
      ) : null}

      <ResultsCountBar
        filtersActiveCount={activeFiltersCount}
        label={totalCount != null ? formatResultsCount(totalCount, roleChip) : null}
        onFiltersPress={() => setFiltersModal({ open: true, sectionId: null })}
        onSortPress={() => setSortSheetOpen(true)}
        showFilters={roleChip !== null}
        sortActive={sort !== "relevance"}
      />

      {isLoading ? (
        <View style={styles.loaderContainer}>
          <Skeleton.Row />
          <Skeleton.Row />
          <Skeleton.Row />
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          action={
            <View style={styles.emptyActions}>
              {roleChip !== null && activeFiltersCount > 0 ? (
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
              {roleChip !== null && activeFiltersCount > 0 ? (
                <Button
                  label="Reimposta ricerca"
                  onPress={resetSearch}
                  variant="link"
                />
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
          title="Nessun profilo trovato"
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
              onToggleSave={() =>
                toggleSave.mutate({ saved: savedIds.has(item.profile_id), targetId: item.profile_id })
              }
              row={item}
              saved={savedIds.has(item.profile_id)}
              shortlist={
                item.role === "player" && shortlistFlags.enabled
                  ? {
                      actionable: !!shortlistFlags.permissions?.can_add_profiles,
                      inShortlist: shortlistFlags.shortlistedIds.has(item.profile_id),
                      onPress: () => {
                        if (shortlistFlags.permissions?.can_add_profiles) {
                          setShortlistTarget(item);
                        } else {
                          showToast({
                            message: "Non hai i permessi per aggiungere alla Shortlist",
                            tone: "neutral",
                          });
                        }
                      },
                    }
                  : null
              }
            />
          )}
        />
      )}

      {roleChip ? (
        <ProfileFiltersModal
          initialFilters={filters}
          initialSectionId={filtersModal.sectionId}
          onApply={setFilters}
          onClose={() => setFiltersModal({ open: false, sectionId: null })}
          query={debouncedQuery || null}
          role={roleChip}
          visible={filtersModal.open}
        />
      ) : null}

      <SortSheet
        onApply={setSort}
        onClose={() => setSortSheetOpen(false)}
        options={sortOptionsForRole(roleChip)}
        value={sort}
        visible={sortSheetOpen}
      />

      {shortlistTarget &&
      shortlistFlags.permissions &&
      shortlistFlags.clubId ? (
        <AddToShortlistFlow
          clubId={shortlistFlags.clubId}
          initialMode={
            shortlistFlags.shortlistedIds.has(shortlistTarget.profile_id) ? "manage" : "picker"
          }
          onClose={() => {
            const clubId = shortlistFlags.clubId;
            setShortlistTarget(null);
            if (clubId) {
              invalidateShortlistMembership(queryClient, clubId);
            }
          }}
          open
          permissions={shortlistFlags.permissions}
          profile={{
            avatarUrl: shortlistTarget.avatar_url ?? undefined,
            fullName: shortlistTarget.full_name,
            id: shortlistTarget.profile_id,
            subtitle: buildProfileMetaLines(shortlistTarget).lines[0] ?? "",
          }}
        />
      ) : null}
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
