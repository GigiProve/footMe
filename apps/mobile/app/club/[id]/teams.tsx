/**
 * Elenco completo delle squadre interne (REV-PROF-17 §"Vedi tutte").
 *
 * Stessa riga e stesso ordinamento dell'anteprima nella tab Profilo: "Vedi
 * tutte" apre più contenuto, non un secondo stile di lista. Le affiliate non
 * entrano qui — sono altre Società.
 */
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Screen } from "../../../src/components/ui/screen";
import { fetchSocietyMasterProfile } from "../../../src/features/clubs/society/society-profile-service";
import { formatTeamsCount } from "../../../src/features/clubs/society/society-profile-model";
import { SocietyListRow } from "../../../src/features/clubs/society/SocietyRows";
import type {
  SocietyMasterProfile,
  SocietyTeamSummary,
} from "../../../src/features/clubs/society/society-profile-types";
import { colors, spacing } from "../../../src/theme/tokens";
import { AppText, Button, EmptyState } from "../../../src/ui";

export default function ClubTeamsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<SocietyMasterProfile | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [hasError, setError] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(false);

    try {
      setProfile(await fetchSocietyMasterProfile(id));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const teams = profile?.teams ?? [];

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Torna indietro"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.back()}
          style={styles.topBarButton}
        >
          <Ionicons color={colors.textPrimary} name="arrow-back" size={24} />
        </Pressable>
        <View style={styles.topBarText}>
          <AppText align="center" style={styles.topBarTitle} variant="bodySm">
            Squadre del club
          </AppText>
          {teams.length > 0 ? (
            <AppText align="center" color="secondary" variant="caption">
              {formatTeamsCount(teams.length)}
            </AppText>
          ) : null}
        </View>
        <View style={styles.topBarButton} />
      </View>

      {hasError ? (
        <View style={styles.center}>
          <AppText color="secondary" variant="bodyLg">
            Non è stato possibile caricare le squadre. Riprova.
          </AppText>
          <Button label="Riprova" onPress={() => void load()} variant="secondary" />
        </View>
      ) : isLoading ? (
        <View style={styles.list}>
          {[0, 1, 2, 3].map((index) => (
            <View key={index} style={styles.skeletonRow} />
          ))}
        </View>
      ) : teams.length === 0 ? (
        <View style={styles.center}>
          <EmptyState
            description="Il club non ha ancora pubblicato le proprie squadre."
            icon="shield-outline"
            title="Nessuna squadra disponibile"
          />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={teams}
          keyExtractor={(team) => team.id}
          renderItem={({ index, item }) => (
            <SocietyListRow
              isLast={index === teams.length - 1}
              logoUrl={item.logoUrl}
              onPress={() => router.push(`/club/team/${item.id}` as never)}
              subtitle={buildSubtitle(item)}
              testID={`society-all-teams-row-${item.id}`}
              title={item.name}
            />
          )}
        />
      )}
    </Screen>
  );
}

function buildSubtitle(team: SocietyTeamSummary): string | null {
  return team.competitionName?.trim() || team.category?.trim() || null;
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    flex: 1,
    gap: spacing[16],
    justifyContent: "center",
    paddingHorizontal: spacing[20],
  },
  list: {
    backgroundColor: colors.surface,
    gap: spacing[0],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[8],
  },
  skeletonRow: {
    backgroundColor: colors.backgroundStrong,
    borderRadius: 10,
    height: 60,
    marginBottom: spacing[8],
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: spacing[8],
  },
  topBarButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  topBarText: {
    flex: 1,
  },
  topBarTitle: {
    fontWeight: "600",
  },
});
