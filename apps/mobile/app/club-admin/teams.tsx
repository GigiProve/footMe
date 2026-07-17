import { Pressable, StyleSheet, View } from "react-native";

import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";

import { Screen } from "../../src/components/ui/screen";
import { KeyboardAwareForm } from "../../src/components/ui/keyboard-aware-form";
import { ScreenHeader } from "../../src/ui";
import { ClubTeamsSection } from "../../src/features/clubs/components/ClubTeamsSection";
import { colors, radius, spacing } from "../../src/theme/tokens";

export default function ClubTeamsScreen() {
  const router = useRouter();

  return (
    <Screen>
      <KeyboardAwareForm contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <ScreenHeader
            title="Squadre e affiliate"
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

        <ClubTeamsSection />
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
