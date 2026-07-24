import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useSession } from "../../auth/use-session";
import { followClub } from "../../clubs/club-service";
import {
  addRecentSearch,
  clearRecentSearches,
  formatRecentSearchAge,
  loadRecentSearches,
} from "../recent-searches";
import { getForYouSuggestions } from "../for-you-service";
import { formatDeadlineLabel } from "../search-format";
import { resolveGlobalSearchHref, searchGlobal } from "../search-service";
import type { GlobalSearchGroupKey, GlobalSearchRow } from "../search-types";
import { spacing } from "../../../theme/tokens";
import { AppText, Button, Divider, EmptyState, Skeleton } from "../../../ui";
import { SearchBar } from "./SearchBar";
import { SearchResultRow } from "./SearchResultRow";
import { SearchSectionHeader } from "./SearchSectionHeader";

const SEARCH_DEBOUNCE_MS = 300;
const MIN_AUTOCOMPLETE_LENGTH = 2;

const GROUP_ORDER: GlobalSearchGroupKey[] = [
  "societa",
  "posizione",
  "profilo",
  "contenuto",
];

const GROUP_LABELS: Record<GlobalSearchGroupKey, string> = {
  societa: "Società",
  posizione: "Posizioni aperte",
  profilo: "Profili",
  contenuto: "Contenuti",
};

const GROUP_ICONS: Record<GlobalSearchGroupKey, keyof typeof Ionicons.glyphMap> = {
  societa: "shield-outline",
  posizione: "briefcase-outline",
  profilo: "person-outline",
  contenuto: "newspaper-outline",
};

const EXPLORE_ITEMS: {
  href: string;
  icon: keyof typeof Ionicons.glyphMap;
  subtitle: string;
  title: string;
}[] = [
  {
    href: "/search/profiles",
    icon: "people-outline",
    subtitle: "Calciatori, allenatori, staff e agenti",
    title: "Profili",
  },
  {
    href: "/search/clubs",
    icon: "shield-outline",
    subtitle: "Club, squadre interne e realtà affiliate",
    title: "Società",
  },
  {
    href: "/search/positions",
    icon: "briefcase-outline",
    subtitle: "Opportunità pubblicate dalle società",
    title: "Posizioni aperte",
  },
];

export function SearchHomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const profileId = profile?.id ?? null;

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(query);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [query]);

  const trimmedDebounced = debouncedQuery.trim();
  const showAutocomplete = trimmedDebounced.length >= MIN_AUTOCOMPLETE_LENGTH;
  const showRecentPanel = !showAutocomplete && isFocused;

  const recentSearchesQuery = useQuery({
    queryKey: ["recent-searches", profileId],
    queryFn: () => loadRecentSearches(profileId as string),
    enabled: !!profileId,
  });
  const recentSearches = recentSearchesQuery.data ?? [];

  const forYouQuery = useQuery({
    queryKey: [
      "search-for-you",
      profileId,
      profile?.role ?? null,
      profile?.region ?? null,
    ],
    queryFn: () =>
      getForYouSuggestions({
        id: profileId as string,
        region: profile?.region ?? null,
        role: profile?.role ?? "",
      }),
    enabled: !!profileId,
  });
  const forYou = forYouQuery.data;

  const globalQuery = useQuery({
    queryKey: ["search-global", trimmedDebounced, 2],
    queryFn: () => searchGlobal(trimmedDebounced, 2, 2),
    enabled: showAutocomplete,
    placeholderData: keepPreviousData,
  });
  const globalRows = globalQuery.data ?? [];

  const followMutation = useMutation({
    mutationFn: (clubId: string) => {
      if (!profileId) {
        throw new Error("Sessione non valida.");
      }
      return followClub(profileId, clubId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["search-for-you"] });
      queryClient.invalidateQueries({ queryKey: ["following-count"] });
      queryClient.invalidateQueries({ queryKey: ["followed"] });
    },
    onError: () => {
      Alert.alert("Errore", "Non siamo riusciti ad aggiornare il follow.");
    },
  });

  function recordRecentSearch(value: string, scope: "global") {
    if (!profileId || value.trim().length < MIN_AUTOCOMPLETE_LENGTH) {
      return;
    }

    addRecentSearch(profileId, value, scope).then(() => {
      queryClient.invalidateQueries({ queryKey: ["recent-searches"] });
    });
  }

  function handleRowPress(row: GlobalSearchRow) {
    recordRecentSearch(query, "global");
    router.push(resolveGlobalSearchHref(row) as never);
  }

  function handleSubmit() {
    const trimmed = query.trim();
    if (trimmed.length < MIN_AUTOCOMPLETE_LENGTH) {
      return;
    }

    recordRecentSearch(trimmed, "global");
    router.push(`/search/results?q=${encodeURIComponent(trimmed)}` as never);
  }

  function handleSeeAllResults() {
    const trimmed = query.trim();
    recordRecentSearch(trimmed, "global");
    router.push(`/search/results?q=${encodeURIComponent(trimmed)}` as never);
  }

  const groupedRows = GROUP_ORDER.map((groupKey) => ({
    groupKey,
    rows: globalRows.filter((row) => row.group_key === groupKey),
  })).filter((group) => group.rows.length > 0);

  return (
    <View style={styles.container}>
      <SearchBar
        onBlur={() => setIsFocused(false)}
        onChangeText={setQuery}
        onFocus={() => setIsFocused(true)}
        onSubmitEditing={handleSubmit}
        placeholder="Cerca persone, società o posizioni"
        value={query}
      />

      {showAutocomplete ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
        >
          {globalQuery.isLoading ? (
            <View style={styles.section}>
              <Skeleton.Row />
              <Skeleton.Row />
              <Skeleton.Row />
            </View>
          ) : groupedRows.length === 0 ? (
            <EmptyState
              description="Prova con un altro nome o una parola chiave diversa."
              icon="search-outline"
              title="Nessun risultato"
            />
          ) : (
            <>
              {groupedRows.map((group, index) => (
                <View key={group.groupKey} style={styles.section}>
                  {index > 0 ? <Divider spacing={12} /> : null}
                  <AppText variant="overline" color="muted" style={styles.groupLabel}>
                    {GROUP_LABELS[group.groupKey]}
                  </AppText>
                  {group.rows.map((row) => (
                    <SearchResultRow
                      fallbackIcon={GROUP_ICONS[group.groupKey]}
                      imageUrl={row.image_url}
                      key={`${row.target_type}-${row.target_id}`}
                      onPress={() => handleRowPress(row)}
                      showDivider={false}
                      squareAvatar={group.groupKey === "societa"}
                      subtitle={row.subtitle}
                      title={row.title}
                    />
                  ))}
                </View>
              ))}
              <Pressable
                accessibilityRole="button"
                onPress={handleSeeAllResults}
                style={styles.seeAllRow}
              >
                <AppText variant="bodySm" color="accent">
                  {`Vedi tutti i risultati per "${trimmedDebounced}"`}
                </AppText>
              </Pressable>
            </>
          )}
        </ScrollView>
      ) : showRecentPanel ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
        >
          <View style={styles.section}>
            <SearchSectionHeader title="Ricerche recenti" />
            {recentSearches.slice(0, 5).map((entry) => (
              <SearchResultRow
                fallbackIcon="time-outline"
                key={`${entry.scope}-${entry.query}`}
                onPress={() =>
                  router.push(
                    `/search/results?q=${encodeURIComponent(entry.query)}` as never,
                  )
                }
                showDivider={false}
                subtitle={`Ultima ricerca: ${formatRecentSearchAge(entry.searchedAt)}`}
                title={entry.query}
              />
            ))}
            {recentSearches.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  if (profileId) {
                    clearRecentSearches(profileId).then(() =>
                      queryClient.invalidateQueries({
                        queryKey: ["recent-searches"],
                      }),
                    );
                  }
                }}
                style={styles.clearRow}
              >
                <AppText variant="bodySm" color="muted">
                  Cancella ricerche recenti
                </AppText>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.section}>
            <SearchSectionHeader title="Accessi rapidi" />
            <SearchResultRow
              fallbackIcon="bookmark-outline"
              onPress={() => router.push("/search/positions?saved=1" as never)}
              showDivider={false}
              title="Posizioni salvate"
            />
            <SearchResultRow
              fallbackIcon="person-outline"
              onPress={() => router.push("/saved" as never)}
              showDivider={false}
              title="Profili salvati"
            />
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
        >
          <View style={styles.section}>
            <SearchSectionHeader title="Esplora" />
            {EXPLORE_ITEMS.map((item) => (
              <SearchResultRow
                fallbackIcon={item.icon}
                key={item.href}
                onPress={() => router.push(item.href as never)}
                showDivider={false}
                subtitle={item.subtitle}
                title={item.title}
              />
            ))}
          </View>

          {forYou && forYou.kind !== "hidden" ? (
            <View style={styles.section}>
              {forYou.kind === "player" ? (
                <>
                  <SearchSectionHeader
                    actionLabel="Vedi tutte le posizioni"
                    onActionPress={() => router.push("/search/positions" as never)}
                    title="Per te"
                  />
                  {forYou.positions.slice(0, 3).map((position) => {
                    const line1 = [position.club_name, position.team_name, position.category]
                      .filter(Boolean)
                      .join(" • ");
                    const line2 = position.deadline
                      ? formatDeadlineLabel(position.deadline)
                      : null;
                    return (
                      <SearchResultRow
                        fallbackIcon="briefcase-outline"
                        key={position.ad_id}
                        onPress={() => router.push(`/position/${position.ad_id}` as never)}
                        showDivider={false}
                        subtitle={[line1, line2].filter(Boolean).join("\n")}
                        subtitleNumberOfLines={2}
                        title={position.title}
                      />
                    );
                  })}

                  {forYou.clubsToFollow.length > 0 ? (
                    <View style={styles.subsection}>
                      <AppText variant="overline" color="muted" style={styles.groupLabel}>
                        Società da seguire
                      </AppText>
                      {forYou.clubsToFollow.slice(0, 3).map((club) => (
                        <SearchResultRow
                          imageUrl={club.logo_url}
                          key={club.club_id}
                          right={
                            <Button
                              label="Segui"
                              onPress={() => followMutation.mutate(club.club_id)}
                              size="sm"
                              variant="secondary"
                            />
                          }
                          showDivider={false}
                          squareAvatar
                          subtitle={[club.city, club.region].filter(Boolean).join(" · ")}
                          title={club.name}
                        />
                      ))}
                    </View>
                  ) : null}
                </>
              ) : null}

              {forYou.kind === "scout" ? (
                <>
                  <SearchSectionHeader title="Per te" />
                  {forYou.availableNearby.length > 0 ? (
                    <View style={styles.subsection}>
                      <AppText variant="overline" color="muted" style={styles.groupLabel}>
                        Profili disponibili nella tua zona
                      </AppText>
                      {forYou.availableNearby.slice(0, 3).map((item) => (
                        <SearchResultRow
                          imageUrl={item.avatar_url}
                          key={item.profile_id}
                          onPress={() => router.push(`/profile/${item.profile_id}` as never)}
                          showDivider={false}
                          subtitle={[item.city, item.region].filter(Boolean).join(" · ")}
                          title={item.full_name}
                        />
                      ))}
                    </View>
                  ) : null}
                  {forYou.recentlyUpdated.length > 0 ? (
                    <View style={styles.subsection}>
                      <AppText variant="overline" color="muted" style={styles.groupLabel}>
                        Profili aggiornati recentemente
                      </AppText>
                      {forYou.recentlyUpdated.slice(0, 3).map((item) => (
                        <SearchResultRow
                          imageUrl={item.avatar_url}
                          key={item.profile_id}
                          onPress={() => router.push(`/profile/${item.profile_id}` as never)}
                          showDivider={false}
                          subtitle={[item.city, item.region].filter(Boolean).join(" · ")}
                          title={item.full_name}
                        />
                      ))}
                    </View>
                  ) : null}
                </>
              ) : null}

              {forYou.kind === "follow-only" && forYou.clubsToFollow.length > 0 ? (
                <>
                  <SearchSectionHeader title="Per te" />
                  <View style={styles.subsection}>
                    <AppText variant="overline" color="muted" style={styles.groupLabel}>
                      Società da seguire
                    </AppText>
                    {forYou.clubsToFollow.slice(0, 3).map((club) => (
                      <SearchResultRow
                        imageUrl={club.logo_url}
                        key={club.club_id}
                        right={
                          <Button
                            label="Segui"
                            onPress={() => followMutation.mutate(club.club_id)}
                            size="sm"
                            variant="secondary"
                          />
                        }
                        showDivider={false}
                        squareAvatar
                        subtitle={[club.city, club.region].filter(Boolean).join(" · ")}
                        title={club.name}
                      />
                    ))}
                  </View>
                </>
              ) : null}
            </View>
          ) : null}

          {recentSearches.length > 0 ? (
            <View style={styles.section}>
              <SearchResultRow
                fallbackIcon="time-outline"
                onPress={() => router.push("/search/recent" as never)}
                showDivider={false}
                subtitle="Riprendi una ricerca precedente"
                title="Ricerche recenti"
              />
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  clearRow: {
    alignItems: "center",
    paddingVertical: spacing[12],
  },
  container: {
    flex: 1,
    gap: spacing[16],
  },
  groupLabel: {
    marginBottom: spacing[4],
  },
  scroll: {
    flex: 1,
  },
  section: {
    marginBottom: spacing[20],
  },
  seeAllRow: {
    alignItems: "center",
    paddingVertical: spacing[16],
  },
  subsection: {
    marginTop: spacing[12],
  },
});
