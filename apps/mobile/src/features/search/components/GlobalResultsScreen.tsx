import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useSession } from "../../auth/use-session";
import { addRecentSearch } from "../recent-searches";
import { resolveGlobalSearchHref, searchGlobal } from "../search-service";
import type { GlobalSearchGroupKey } from "../search-types";
import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, EmptyState, ScreenHeader, Skeleton } from "../../../ui";
import { SearchBar } from "./SearchBar";
import { SearchResultRow } from "./SearchResultRow";
import { SearchSectionHeader } from "./SearchSectionHeader";

const SEARCH_DEBOUNCE_MS = 300;

const SECTIONS: {
  actionHref?: string;
  actionLabel?: string;
  groupKey: GlobalSearchGroupKey;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  squareAvatar?: boolean;
}[] = [
  {
    actionHref: "/search/clubs",
    actionLabel: "Vedi tutte le società",
    groupKey: "societa",
    icon: "shield-outline",
    label: "Società",
    squareAvatar: true,
  },
  {
    actionHref: "/search/profiles",
    actionLabel: "Vedi tutti i profili",
    groupKey: "profilo",
    icon: "person-outline",
    label: "Profili",
  },
  {
    actionHref: "/search/positions",
    actionLabel: "Vedi tutte le posizioni",
    groupKey: "posizione",
    icon: "briefcase-outline",
    label: "Posizioni aperte",
  },
  {
    groupKey: "contenuto",
    icon: "newspaper-outline",
    label: "Contenuti",
  },
];

export function GlobalResultsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const profileId = profile?.id ?? null;
  const params = useLocalSearchParams<{ q?: string }>();
  const initialQuery = typeof params.q === "string" ? params.q : "";

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(query);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [query]);

  const trimmed = debouncedQuery.trim();

  const globalQuery = useQuery({
    queryKey: ["search-global", trimmed, 3],
    queryFn: () => searchGlobal(trimmed, 3, 2),
    enabled: trimmed.length >= 2,
  });
  const rows = globalQuery.data ?? [];

  function handleSubmit() {
    const trimmedNew = query.trim();
    if (trimmedNew.length < 2) {
      return;
    }

    if (profileId) {
      addRecentSearch(profileId, trimmedNew, "global").then(() => {
        queryClient.invalidateQueries({ queryKey: ["recent-searches"] });
      });
    }

    router.setParams({ q: trimmedNew });
  }

  const groups = SECTIONS.map((section) => ({
    ...section,
    rows: rows.filter((row) => row.group_key === section.groupKey),
  })).filter((section) => section.rows.length > 0);

  return (
    <>
      <View style={styles.headerRow}>
        <ScreenHeader
          title={`Risultati per "${trimmed}"`}
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

      <SearchBar
        onChangeText={setQuery}
        onSubmitEditing={handleSubmit}
        placeholder="Cerca persone, società o posizioni"
        value={query}
      />

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        {globalQuery.isLoading ? (
          <View style={styles.section}>
            <Skeleton.Row />
            <Skeleton.Row />
            <Skeleton.Row />
          </View>
        ) : groups.length === 0 ? (
          <EmptyState
            description="Prova con un altro nome o una parola chiave diversa."
            icon="search-outline"
            title="Nessun risultato"
          />
        ) : (
          groups.map((section) => (
            <View key={section.groupKey} style={styles.section}>
              {section.actionLabel && section.actionHref ? (
                <SearchSectionHeader
                  actionLabel={section.actionLabel}
                  onActionPress={() =>
                    router.push(
                      `${section.actionHref}?q=${encodeURIComponent(trimmed)}` as never,
                    )
                  }
                  title={section.label}
                />
              ) : (
                <AppText variant="overline" color="muted" style={styles.groupLabel}>
                  {section.label}
                </AppText>
              )}
              {section.rows.map((row) => (
                <SearchResultRow
                  fallbackIcon={section.icon}
                  imageUrl={row.image_url}
                  key={`${row.target_type}-${row.target_id}`}
                  onPress={() => router.push(resolveGlobalSearchHref(row) as never)}
                  showDivider={false}
                  squareAvatar={section.squareAvatar}
                  subtitle={row.subtitle}
                  title={row.title}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>
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
  groupLabel: {
    marginBottom: spacing[8],
  },
  headerRow: {
    marginBottom: spacing[12],
  },
  pressed: {
    opacity: 0.75,
  },
  scroll: {
    flex: 1,
    marginTop: spacing[16],
  },
  section: {
    marginBottom: spacing[20],
  },
});
