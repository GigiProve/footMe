import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useSession } from "../../auth/use-session";
import {
  clearRecentSearches,
  formatRecentSearchAge,
  loadRecentSearches,
  type RecentSearch,
} from "../recent-searches";
import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, EmptyState, ScreenHeader } from "../../../ui";
import { SearchResultRow } from "./SearchResultRow";

function resolveHref(entry: RecentSearch): string {
  const q = encodeURIComponent(entry.query);

  switch (entry.scope) {
    case "profiles":
      return `/search/profiles?q=${q}`;
    case "clubs":
      return `/search/clubs?q=${q}`;
    case "positions":
      return `/search/positions?q=${q}`;
    case "media":
      return `/search/media?q=${q}`;
    default:
      return `/search/results?q=${q}`;
  }
}

export function RecentSearchesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const profileId = profile?.id ?? null;

  const recentSearchesQuery = useQuery({
    queryKey: ["recent-searches", profileId],
    queryFn: () => loadRecentSearches(profileId as string),
    enabled: !!profileId,
  });
  const items = recentSearchesQuery.data ?? [];

  return (
    <>
      <View style={styles.headerRow}>
        <ScreenHeader
          title="Ricerche recenti"
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

      {items.length === 0 ? (
        <EmptyState
          icon="time-outline"
          title="Nessuna ricerca recente"
          description="Le tue ultime ricerche appariranno qui."
        />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          {items.map((entry) => (
            <SearchResultRow
              fallbackIcon="time-outline"
              key={`${entry.scope}-${entry.query}`}
              onPress={() => router.push(resolveHref(entry) as never)}
              subtitle={`Ultima ricerca: ${formatRecentSearchAge(entry.searchedAt)}`}
              title={entry.query}
            />
          ))}

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
            <AppText variant="bodySm" color="danger" align="center">
              Cancella tutte le ricerche
            </AppText>
          </Pressable>
        </ScrollView>
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
  clearRow: {
    paddingVertical: spacing[20],
  },
  headerRow: {
    marginBottom: spacing[12],
  },
  pressed: {
    opacity: 0.75,
  },
  scroll: {
    flex: 1,
  },
});
