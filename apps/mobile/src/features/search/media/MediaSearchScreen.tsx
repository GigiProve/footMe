import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useSession } from "../../auth/use-session";
import { useUnreadNotificationsCount } from "../../notifications/use-unread-notifications-count";
import { addRecentSearch } from "../recent-searches";
import { colors, radius, spacing } from "../../../theme/tokens";
import {
  AppText,
  Button,
  EmptyState,
  HeaderBell,
  ScreenHeader,
  Skeleton,
} from "../../../ui";
import { ResultsCountBar } from "../components/ResultsCountBar";
import { SearchBar } from "../components/SearchBar";
import { SearchSectionHeader } from "../components/SearchSectionHeader";
import { MEDIA_DEFAULT_SORT, type MediaFilterSectionId } from "./media-filter-configs";
import {
  buildBroaderQuery,
  buildMediaEmptySuggestions,
  buildMediaFilterPayload,
  countActiveMediaFilters,
} from "./media-filter-helpers";
import {
  createDefaultMediaFiltersState,
  type MediaFiltersState,
} from "./media-filter-types";
import { formatMediaResultsCount } from "./media-labels";
import {
  MEDIA_PAGE_SIZE,
  MEDIA_SOURCES_INLINE_LIMIT,
  MEDIA_TOP_CONTENT_COUNT,
  fetchMediaForYou,
  fetchMediaSourcesDiscover,
  resolveMediaContentHref,
  resolveMediaPublisherHref,
  resolveMediaSourceHref,
  resolveMediaSuggestionHref,
  searchMediaContentPage,
  searchMediaSourcesPage,
  searchMediaSuggestions,
  toggleFollowSource,
  toggleSavedContent,
} from "./media-search-service";
import type {
  MediaContentRow,
  MediaContentType,
  MediaForYouRow,
  MediaSearchSort,
  MediaSourceDiscoverRow,
  MediaSourceRowData,
  MediaSourceType,
  MediaSuggestionRow,
} from "./media-search-types";
import { MediaContentPreview } from "./MediaContentPreview";
import { MediaFiltersModal } from "./MediaFiltersModal";
import { MediaHomeSections } from "./MediaHomeSections";
import { MediaQuickFilterChips } from "./MediaQuickFilterChips";
import { MediaSortSheet } from "./MediaSortSheet";
import { MediaSourcePreview } from "./MediaSourcePreview";
import { MediaSuggestionsList } from "./MediaSuggestionsList";

/**
 * Cerca > Media e contenuti (CER-05).
 *
 * Una sola schermata con tre stati mutuamente esclusivi, come
 * `SearchHomeScreen`:
 *   1. iniziale     — pochi contenuti personalizzati + fonti da scoprire;
 *   2. suggerimenti — durante la digitazione, lista compatta;
 *   3. risultati    — contenuti e fonti nella stessa pagina, filtri e
 *                     ordinamento secondari.
 *
 * La ricerca è volontaria: nessuno scorrimento infinito nello stato iniziale,
 * la paginazione esiste solo nei risultati.
 */

const SEARCH_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
const FOR_YOU_LIMIT = 4;
const DISCOVER_LIMIT = 5;

type MediaListItem =
  | { kind: "content"; row: MediaContentRow }
  | { kind: "section"; sectionId: string; title: string }
  | { kind: "source"; row: MediaSourceRowData };

function contentKey(row: { content_type: MediaContentType; post_id: string }): string {
  return `${row.content_type}:${row.post_id}`;
}

function sourceKey(row: { entity_id: string; source_type: MediaSourceType }): string {
  return `${row.source_type}:${row.entity_id}`;
}

/**
 * Gerarchia leggera dei risultati (CER-05 §8): migliori contenuti, poi le
 * fonti che trattano l'argomento, poi il resto dei contenuti. Le sezioni sono
 * solo titoli e spaziatura — nessun contenitore, nessuna card annidata.
 */
function buildResultItems({
  contents,
  resultKind,
  sources,
}: {
  contents: MediaContentRow[];
  resultKind: MediaFiltersState["resultKind"];
  sources: MediaSourceRowData[];
}): MediaListItem[] {
  if (resultKind === "sources") {
    return sources.map((row) => ({ kind: "source", row }) as MediaListItem);
  }

  const items: MediaListItem[] = [];
  const top = contents.slice(0, MEDIA_TOP_CONTENT_COUNT);
  const rest = contents.slice(MEDIA_TOP_CONTENT_COUNT);

  if (top.length > 0) {
    items.push({ kind: "section", sectionId: "top", title: "Contenuti più pertinenti" });
    items.push(...top.map((row) => ({ kind: "content", row }) as MediaListItem));
  }

  if (resultKind !== "contents" && sources.length > 0) {
    items.push({
      kind: "section",
      sectionId: "sources",
      title: "Media che trattano l'argomento",
    });
    items.push(
      ...sources
        .slice(0, MEDIA_SOURCES_INLINE_LIMIT)
        .map((row) => ({ kind: "source", row }) as MediaListItem),
    );
  }

  if (rest.length > 0) {
    items.push({ kind: "section", sectionId: "rest", title: "Altri contenuti" });
    items.push(...rest.map((row) => ({ kind: "content", row }) as MediaListItem));
  }

  return items;
}

export function MediaSearchScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const profileId = profile?.id ?? null;
  const unreadCount = useUnreadNotificationsCount();
  const params = useLocalSearchParams<{ q?: string }>();
  const initialQuery = typeof params.q === "string" ? params.q : "";

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery.trim());
  const [filters, setFilters] = useState<MediaFiltersState>(
    createDefaultMediaFiltersState(),
  );
  const [sort, setSort] = useState<MediaSearchSort>(MEDIA_DEFAULT_SORT);
  const [filtersModal, setFiltersModal] = useState<{
    open: boolean;
    sectionId: MediaFilterSectionId | null;
  }>({ open: false, sectionId: null });
  const [sortSheetOpen, setSortSheetOpen] = useState(false);

  /**
   * Override locali di bookmark e follow: il tap deve aggiornare l'icona
   * immediatamente, senza modali e senza attendere un refetch (CER-05
   * §14/§15). Le RPC restituiscono `is_saved` / `is_following` freschi al
   * prossimo caricamento, quindi gli override valgono solo per le righe
   * toccate in questa sessione di ricerca.
   */
  const [savedOverrides, setSavedOverrides] = useState<Record<string, boolean>>({});
  const [followOverrides, setFollowOverrides] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(query);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [query]);

  const trimmedQuery = query.trim();
  const trimmedDebounced = debouncedQuery.trim();
  const activeFiltersCount = countActiveMediaFilters(filters);
  const payload = buildMediaFilterPayload(filters);

  const isEditingQuery = trimmedQuery !== submittedQuery;
  const showSuggestions = isEditingQuery && trimmedDebounced.length >= MIN_QUERY_LENGTH;
  const showResults =
    !showSuggestions && (submittedQuery.length > 0 || activeFiltersCount > 0);
  const showHome = !showSuggestions && !showResults;

  const wantsContents = filters.resultKind !== "sources";
  const wantsSources = filters.resultKind !== "contents";

  // ── stato iniziale ────────────────────────────────────────────────
  const forYouQuery = useQuery({
    enabled: showHome && !!profileId,
    queryFn: () => fetchMediaForYou(FOR_YOU_LIMIT),
    queryKey: ["media-for-you", profileId],
  });

  const discoverQuery = useQuery({
    enabled: showHome && !!profileId,
    queryFn: () => fetchMediaSourcesDiscover(DISCOVER_LIMIT),
    queryKey: ["media-sources-discover", profileId],
  });

  // ── suggerimenti ──────────────────────────────────────────────────
  const suggestionsQuery = useQuery({
    enabled: showSuggestions,
    placeholderData: keepPreviousData,
    queryFn: () => searchMediaSuggestions(trimmedDebounced, 3),
    queryKey: ["media-suggestions", trimmedDebounced],
  });

  // ── risultati ─────────────────────────────────────────────────────
  // Key order matches the other Cerca verticals: `queryFn` must precede
  // `getNextPageParam` for TanStack to infer the page type.
  const contentsQuery = useInfiniteQuery({
    queryKey: ["search-media-content", submittedQuery, payload, sort],
    queryFn: ({ pageParam }) =>
      searchMediaContentPage({
        filters: payload,
        page: pageParam,
        query: submittedQuery || null,
        sort,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.rows.length === MEDIA_PAGE_SIZE ? allPages.length : undefined,
    enabled: showResults && wantsContents,
    placeholderData: keepPreviousData,
  });

  const sourcesQuery = useInfiniteQuery({
    queryKey: ["search-media-sources", submittedQuery, payload],
    queryFn: ({ pageParam }) =>
      searchMediaSourcesPage({
        filters: payload,
        page: pageParam,
        query: submittedQuery || null,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.rows.length === MEDIA_PAGE_SIZE ? allPages.length : undefined,
    enabled: showResults && wantsSources,
    placeholderData: keepPreviousData,
  });

  const contents = (contentsQuery.data?.pages.flatMap((page) => page.rows) ?? []).map(
    (row) => ({ ...row, is_saved: savedOverrides[contentKey(row)] ?? row.is_saved }),
  );
  const sources = (sourcesQuery.data?.pages.flatMap((page) => page.rows) ?? []).map(
    (row) => ({
      ...row,
      is_following: followOverrides[sourceKey(row)] ?? row.is_following,
    }),
  );

  const contentsTotal = wantsContents
    ? (contentsQuery.data?.pages[0]?.totalCount ?? null)
    : 0;
  const sourcesTotal = wantsSources ? (sourcesQuery.data?.pages[0]?.totalCount ?? null) : 0;
  const totalCount =
    contentsTotal == null && sourcesTotal == null
      ? null
      : (contentsTotal ?? 0) + (sourcesTotal ?? 0);

  const isResultsLoading =
    (wantsContents && contentsQuery.isLoading) || (wantsSources && sourcesQuery.isLoading);
  const items = buildResultItems({ contents, resultKind: filters.resultKind, sources });
  const isResultsEmpty = !isResultsLoading && items.length === 0;
  const isFetchingNextPage =
    filters.resultKind === "sources"
      ? sourcesQuery.isFetchingNextPage
      : contentsQuery.isFetchingNextPage;

  // ── azioni ────────────────────────────────────────────────────────

  function handleChangeQuery(value: string) {
    setQuery(value);

    // Svuotare la barra riporta alla schermata iniziale, senza dover
    // passare dall'empty state (CER-05 §22, "Reimposta ricerca").
    if (value.trim().length === 0) {
      setSubmittedQuery("");
    }
  }

  function runSearch(value: string) {
    const trimmed = value.trim();

    if (trimmed.length < MIN_QUERY_LENGTH) {
      return;
    }

    setQuery(trimmed);
    setDebouncedQuery(trimmed);
    setSubmittedQuery(trimmed);

    if (profileId) {
      addRecentSearch(profileId, trimmed, "media").then(() => {
        queryClient.invalidateQueries({ queryKey: ["recent-searches"] });
      });
    }
  }

  function resetSearch() {
    setQuery("");
    setDebouncedQuery("");
    setSubmittedQuery("");
    setFilters(createDefaultMediaFiltersState());
    setSort(MEDIA_DEFAULT_SORT);
  }

  function handleSelectSuggestion(row: MediaSuggestionRow) {
    const href = resolveMediaSuggestionHref(row);

    // Argomenti e territori non hanno un profilo pubblico: aggiornano la
    // ricerca (CER-05 §21).
    if (!href) {
      runSearch(row.search_term ?? row.label);
      return;
    }

    if (profileId && trimmedDebounced.length >= MIN_QUERY_LENGTH) {
      addRecentSearch(profileId, trimmedDebounced, "media").then(() => {
        queryClient.invalidateQueries({ queryKey: ["recent-searches"] });
      });
    }

    router.push(href as never);
  }

  async function handleToggleSave(row: {
    content_type: MediaContentType;
    is_saved: boolean;
    post_id: string;
  }) {
    if (!profileId) {
      return;
    }

    const key = contentKey(row);
    const current = savedOverrides[key] ?? row.is_saved;
    const next = !current;

    setSavedOverrides((prev) => ({ ...prev, [key]: next }));

    try {
      await toggleSavedContent(profileId, row.content_type, row.post_id, next);
      queryClient.invalidateQueries({ queryKey: ["saved-items"] });
      queryClient.invalidateQueries({ queryKey: ["saved-counts"] });
    } catch {
      setSavedOverrides((prev) => ({ ...prev, [key]: current }));
      Alert.alert("Errore", "Non siamo riusciti ad aggiornare i contenuti salvati.");
    }
  }

  async function handleToggleFollow(row: {
    entity_id: string;
    is_following: boolean;
    source_type: MediaSourceType;
  }) {
    if (!profileId) {
      return;
    }

    const key = sourceKey(row);
    const current = followOverrides[key] ?? row.is_following;
    const next = !current;

    setFollowOverrides((prev) => ({ ...prev, [key]: next }));

    try {
      await toggleFollowSource(profileId, row.source_type, row.entity_id, next);
      queryClient.invalidateQueries({ queryKey: ["following-count"] });
      queryClient.invalidateQueries({ queryKey: ["followed"] });
    } catch {
      setFollowOverrides((prev) => ({ ...prev, [key]: current }));
      Alert.alert("Errore", "Non siamo riusciti ad aggiornare il follow.");
    }
  }

  function handleEndReached() {
    if (filters.resultKind === "sources") {
      if (sourcesQuery.hasNextPage && !sourcesQuery.isFetchingNextPage) {
        sourcesQuery.fetchNextPage();
      }
      return;
    }

    if (contentsQuery.hasNextPage && !contentsQuery.isFetchingNextPage) {
      contentsQuery.fetchNextPage();
    }
  }

  const emptySuggestions = buildMediaEmptySuggestions(filters, submittedQuery || null);
  const broaderQuery = buildBroaderQuery(submittedQuery || null);
  // Con "Solo profili Media" la lista è fatta di sole fonti, quindi un
  // risultato vuoto è l'empty state delle fonti (CER-05 §22).
  const onlySourcesMissing = filters.resultKind === "sources";

  const headerTitle =
    showResults && submittedQuery.length > 0
      ? `Risultati per "${submittedQuery}"`
      : "Media e contenuti";

  return (
    <>
      <View style={styles.headerRow}>
        <ScreenHeader
          action={
            <HeaderBell count={unreadCount} onPress={() => router.push("/notifications")} />
          }
          leading={
            <Pressable
              accessibilityLabel="Indietro"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}
            >
              <Ionicons color={colors.textPrimary} name="arrow-back" size={20} />
            </Pressable>
          }
          title={headerTitle}
        />
      </View>

      <View style={styles.searchBlock}>
        <SearchBar
          onChangeText={handleChangeQuery}
          onSubmitEditing={() => runSearch(query)}
          placeholder="Cerca articoli, video, testate o creator"
          value={query}
        />
      </View>

      {showHome ? (
        <>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/saved?filter=content" as never)}
            style={styles.savedLink}
          >
            <AppText color="accent" variant="bodySm">
              Vedi salvati
            </AppText>
          </Pressable>

          <MediaHomeSections
            discoverRows={(discoverQuery.data ?? []).map((row) => ({
              ...row,
              is_following: followOverrides[sourceKey(row)] ?? row.is_following,
            }))}
            forYouRows={(forYouQuery.data ?? []).map((row) => ({
              ...row,
              is_saved: savedOverrides[contentKey(row)] ?? row.is_saved,
            }))}
            isLoading={forYouQuery.isLoading || discoverQuery.isLoading}
            onOpenContent={(row: MediaForYouRow) =>
              router.push(resolveMediaContentHref(row) as never)
            }
            onOpenContentSource={(row: MediaForYouRow) =>
              router.push(resolveMediaPublisherHref(row) as never)
            }
            onOpenSource={(row: MediaSourceDiscoverRow) =>
              router.push(resolveMediaSourceHref(row) as never)
            }
            onToggleFollow={handleToggleFollow}
            onToggleSave={handleToggleSave}
          />
        </>
      ) : null}

      {showSuggestions ? (
        <MediaSuggestionsList
          isLoading={suggestionsQuery.isLoading}
          onSeeAllResults={() => runSearch(trimmedDebounced)}
          onSelect={handleSelectSuggestion}
          query={trimmedDebounced}
          rows={suggestionsQuery.data ?? []}
        />
      ) : null}

      {showResults ? (
        <>
          {activeFiltersCount > 0 ? (
            <MediaQuickFilterChips
              activeFiltersCount={activeFiltersCount}
              filters={filters}
              onChange={setFilters}
              onOpenFilters={() => setFiltersModal({ open: true, sectionId: null })}
            />
          ) : null}

          <ResultsCountBar
            filtersActiveCount={activeFiltersCount}
            label={formatMediaResultsCount(totalCount)}
            onFiltersPress={() => setFiltersModal({ open: true, sectionId: null })}
            onSortPress={() => setSortSheetOpen(true)}
            showFilters
            sortActive={sort !== MEDIA_DEFAULT_SORT}
          />

          {isResultsLoading ? (
            <View style={styles.loaderContainer}>
              <Skeleton.Row />
              <Skeleton.Row />
              <Skeleton.Row />
            </View>
          ) : isResultsEmpty ? (
            onlySourcesMissing ? (
              <EmptyState
                action={
                  <Button
                    fullWidth
                    label="Mostra contenuti correlati"
                    onPress={() => setFilters({ ...filters, resultKind: "contents" })}
                    variant="primary"
                  />
                }
                description="Non abbiamo trovato testate o creator con questo nome."
                icon="newspaper-outline"
                title="Nessuna fonte trovata"
              />
            ) : (
              <EmptyState
                action={
                  <View style={styles.emptyActions}>
                    {activeFiltersCount > 0 ? (
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
                    {activeFiltersCount > 0 ? (
                      <Button label="Reimposta ricerca" onPress={resetSearch} variant="link" />
                    ) : null}
                    {broaderQuery ? (
                      <Button
                        label={`Cerca solo «${broaderQuery}»`}
                        onPress={() => runSearch(broaderQuery)}
                        variant="link"
                      />
                    ) : null}
                    {emptySuggestions.map((suggestion) => (
                      <Button
                        key={suggestion.id}
                        label={suggestion.label}
                        onPress={() => setFilters(suggestion.apply(filters))}
                        variant="link"
                      />
                    ))}
                  </View>
                }
                description="Prova a usare un termine più generale o a rimuovere alcuni filtri."
                icon="search-outline"
                title="Nessun contenuto trovato"
              />
            )
          ) : (
            <FlatList
              contentContainerStyle={styles.listContent}
              data={items}
              keyExtractor={(item) =>
                item.kind === "section"
                  ? `section-${item.sectionId}`
                  : item.kind === "content"
                    ? `content-${contentKey(item.row)}`
                    : `source-${sourceKey(item.row)}`
              }
              keyboardShouldPersistTaps="handled"
              ListFooterComponent={
                isFetchingNextPage ? (
                  <View style={styles.footerLoader}>
                    <ActivityIndicator color={colors.accent} />
                  </View>
                ) : null
              }
              onEndReached={handleEndReached}
              onEndReachedThreshold={0.4}
              renderItem={({ item }) => {
                if (item.kind === "section") {
                  return (
                    <View style={styles.sectionHeader}>
                      <SearchSectionHeader title={item.title} />
                    </View>
                  );
                }

                if (item.kind === "content") {
                  return (
                    <MediaContentPreview
                      onPress={() => router.push(resolveMediaContentHref(item.row) as never)}
                      onPressSource={() =>
                        router.push(resolveMediaPublisherHref(item.row) as never)
                      }
                      onToggleSave={() => handleToggleSave(item.row)}
                      row={item.row}
                    />
                  );
                }

                return (
                  <MediaSourcePreview
                    onPress={() => router.push(resolveMediaSourceHref(item.row) as never)}
                    onToggleFollow={() => handleToggleFollow(item.row)}
                    row={item.row}
                  />
                );
              }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </>
      ) : null}

      <MediaFiltersModal
        initialFilters={filters}
        initialSectionId={filtersModal.sectionId}
        onApply={setFilters}
        onClose={() => setFiltersModal({ open: false, sectionId: null })}
        query={submittedQuery || null}
        visible={filtersModal.open}
      />

      <MediaSortSheet
        onApply={setSort}
        onClose={() => setSortSheetOpen(false)}
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
    alignItems: "center",
    alignSelf: "stretch",
    gap: spacing[8],
  },
  footerLoader: {
    paddingVertical: spacing[16],
  },
  headerRow: {
    marginBottom: spacing[12],
  },
  listContent: {
    paddingBottom: spacing[24],
  },
  loaderContainer: {
    gap: spacing[12],
    paddingTop: spacing[8],
  },
  pressed: {
    opacity: 0.7,
  },
  savedLink: {
    alignSelf: "flex-start",
    paddingBottom: spacing[12],
    paddingTop: spacing[4],
  },
  searchBlock: {
    marginBottom: spacing[8],
  },
  sectionHeader: {
    paddingTop: spacing[16],
  },
});
