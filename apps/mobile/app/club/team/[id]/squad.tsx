/**
 * Rosa completa di una squadra (REV-PROF-17 §"PROFILO SQUADRA — ORGANICO").
 *
 * Aperta dalla card Rosa dell'Organico. Riusa la stessa riga persona, così il
 * passaggio dall'anteprima all'elenco non cambia linguaggio visivo.
 */
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Screen } from "../../../../src/components/ui/screen";
import { SocietyTeamSquadList } from "../../../../src/features/clubs/society/SocietyTeamProfileView";
import { fetchSocietyTeamProfile } from "../../../../src/features/clubs/society/society-profile-service";
import { composeTeamDisplayName } from "../../../../src/features/clubs/society/society-profile-model";
import type { SocietyTeamDetail } from "../../../../src/features/clubs/society/society-profile-types";
import { colors, spacing } from "../../../../src/theme/tokens";
import { AppText, Button } from "../../../../src/ui";

export default function ClubTeamSquadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<SocietyTeamDetail | null>(null);
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
      setDetail(await fetchSocietyTeamProfile(id));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const title = detail
    ? composeTeamDisplayName(detail.club.name, detail.team.name)
    : "Rosa";

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
            Rosa
          </AppText>
          <AppText align="center" color="secondary" numberOfLines={1} variant="caption">
            {title}
          </AppText>
        </View>
        <View style={styles.topBarButton} />
      </View>

      {hasError ? (
        <View style={styles.center}>
          <AppText color="secondary" variant="bodyLg">
            Non è stato possibile caricare l&apos;organico. Riprova.
          </AppText>
          <Button label="Riprova" onPress={() => void load()} variant="secondary" />
        </View>
      ) : isLoading ? (
        <View style={styles.skeletonList}>
          {[0, 1, 2, 3, 4].map((index) => (
            <View key={index} style={styles.skeletonRow} />
          ))}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <SocietyTeamSquadList
            onOpenProfile={(profileId) => router.push(`/profile/${profileId}` as never)}
            squad={detail?.squad ?? []}
          />
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    flex: 1,
    gap: spacing[16],
    justifyContent: "center",
    paddingHorizontal: spacing[20],
  },
  scrollContent: {
    paddingBottom: spacing[28],
  },
  skeletonList: {
    gap: spacing[8],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[16],
  },
  skeletonRow: {
    backgroundColor: colors.backgroundStrong,
    borderRadius: 10,
    height: 60,
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
