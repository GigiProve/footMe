import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Screen } from "../../../src/components/ui/screen";
import { KeyboardAwareScrollView } from "../../../src/components/ui/keyboard-aware-scroll-view";
import {
  fetchClubPositions,
  fetchPublicClubProfile,
  type ClubPositionSummary,
  type PublicClubProfile,
} from "../../../src/features/clubs/club-service";
import { colors, radius, spacing, typography } from "../../../src/theme/tokens";
import { AppText, EmptyState } from "../../../src/ui";

const roleLabels: Record<string, string> = {
  defender: "Difensore",
  forward: "Attaccante",
  goalkeeper: "Portiere",
  midfielder: "Centrocampista",
};

export default function ClubPositionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [club, setClub] = useState<PublicClubProfile | null>(null);
  const [positions, setPositions] = useState<ClubPositionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadPositions = useCallback(async () => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const [clubData, positionData] = await Promise.all([
        fetchPublicClubProfile(id),
        fetchClubPositions(id),
      ]);

      setClub(clubData);
      setPositions(positionData);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadPositions();
  }, [loadPositions]);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAwareScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityLabel="Torna indietro"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.topBarButton}
          >
            <Ionicons color={colors.textPrimary} name="arrow-back" size={24} />
          </Pressable>
          <View style={styles.topBarText}>
            <AppText align="center" style={styles.topBarTitle} variant="bodySm">
              Posizioni aperte
            </AppText>
            {club ? (
              <AppText align="center" color="secondary" numberOfLines={1} variant="caption">
                {club.name}
              </AppText>
            ) : null}
          </View>
          <View style={styles.topBarButton} />
        </View>

        {isLoading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : positions.length === 0 ? (
          <EmptyState
            description="Questa società non ha ricerche attive al momento."
            icon="briefcase-outline"
            title="Nessuna posizione aperta"
          />
        ) : (
          <View style={styles.list}>
            {positions.map((position) => (
              <View key={position.id} style={styles.positionCard}>
                <View style={styles.positionIcon}>
                  <Ionicons color={colors.accent} name="briefcase-outline" size={18} />
                </View>
                <View style={styles.positionText}>
                  <AppText style={styles.positionTitle} variant="titleSm">
                    {position.title}
                  </AppText>
                  <AppText color="accent" variant="bodySm">
                    {formatRole(position.role_required)}
                    {position.team_name || position.team_category
                      ? ` — ${position.team_name ?? position.team_category}`
                      : ""}
                  </AppText>
                  <AppText color="secondary" numberOfLines={3} variant="bodySm">
                    {position.description ?? "Dettagli disponibili nella sezione annunci."}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
        )}
      </KeyboardAwareScrollView>
    </Screen>
  );
}

function formatRole(role: string) {
  return roleLabels[role] ?? role;
}

const styles = StyleSheet.create({
  list: {
    gap: spacing[12],
  },
  loadingBlock: {
    alignItems: "center",
    minHeight: 220,
    justifyContent: "center",
  },
  positionCard: {
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    padding: spacing[16],
  },
  positionIcon: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius[6],
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  positionText: {
    flex: 1,
    gap: spacing[6],
  },
  positionTitle: {
    fontWeight: typography.fontWeight.bold,
  },
  scrollContent: {
    gap: spacing[16],
    paddingBottom: spacing[28],
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 44,
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
    fontWeight: typography.fontWeight.semibold,
  },
});
