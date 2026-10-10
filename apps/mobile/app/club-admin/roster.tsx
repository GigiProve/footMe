import { Pressable, StyleSheet, View } from "react-native";

import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Screen } from "../../src/components/ui/screen";
import { KeyboardAwareForm } from "../../src/components/ui/keyboard-aware-form";
import { ScreenHeader } from "../../src/ui";
import { ClubRosterSection } from "../../src/features/clubs/components/ClubRosterSection";
import type { MemberRole } from "../../src/features/clubs/membership-types";
import { colors, radius, spacing } from "../../src/theme/tokens";

const INVITE_ROLES: MemberRole[] = ["player", "coach", "staff", "director"];

/**
 * Gestione canonica dell'Organico.
 *
 * Da DAS-REV-09 accetta due riferimenti canonici, mai copie dei dati
 * visualizzati (§18): `teamId` restringe la rosa a una squadra, `invite`
 * chiede di aprire subito il modulo di collegamento con quel ruolo. Il
 * modulo richiede comunque scelta e conferma: aprirlo non collega nessuno.
 */
export default function ClubRosterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    invite?: string | string[];
    teamId?: string | string[];
  }>();

  const teamId = Array.isArray(params.teamId) ? params.teamId[0] : params.teamId;
  const inviteRaw = Array.isArray(params.invite)
    ? params.invite[0]
    : params.invite;
  const invite = INVITE_ROLES.find((role) => role === inviteRaw) ?? null;

  return (
    <Screen>
      <KeyboardAwareForm contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <ScreenHeader
            title="Organico"
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
                <Ionicons
                  color={colors.textPrimary}
                  name="arrow-back"
                  size={20}
                />
              </Pressable>
            }
          />
        </View>

        <ClubRosterSection
          autoAddRole={invite}
          showStats
          teamId={typeof teamId === "string" && teamId.length > 0 ? teamId : null}
        />
      </KeyboardAwareForm>
    </Screen>
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
  headerRow: {
    marginBottom: spacing[12],
  },
  pressed: {
    opacity: 0.75,
  },
  scrollContent: {
    gap: spacing[18],
    paddingBottom: spacing[48],
  },
});
