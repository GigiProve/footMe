import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors } from "../../../styles";
import { AppText } from "../../../ui";
import {
  onboardingBorderWidth,
  onboardingRadius,
  onboardingSpacing,
} from "./onboarding-tokens";

type RoleCardProps = {
  label: string;
  /** Una riga che dice cosa si fa con quel profilo. */
  description?: string;
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
  testID?: string;
};

/**
 * Tile di scelta del macro-ruolo (§V). Tutta la card è tappabile, lo stato
 * selezionato usa bordo accent, fondo tenue e spunta: mai una superficie blu
 * piena, mai un gradiente.
 */
export function RoleCard({
  description,
  icon,
  label,
  onPress,
  selected,
  testID,
}: RoleCardProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected ? styles.cardSelected : null,
        pressed ? styles.pressed : null,
      ]}
      testID={testID}
    >
      <View style={[styles.iconShell, selected ? styles.iconShellOn : null]}>
        <Ionicons
          color={selected ? colors.accent : colors.textSecondary}
          name={icon}
          size={20}
        />
      </View>

      <View style={styles.text}>
        <AppText variant="titleSm">{label}</AppText>
        {description ? (
          <AppText color="secondary" numberOfLines={2} variant="meta">
            {description}
          </AppText>
        ) : null}
      </View>

      <View style={[styles.check, selected ? styles.checkOn : null]}>
        {selected ? (
          <Ionicons color={colors.inkInvert} name="checkmark" size={13} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: onboardingRadius.card,
    borderWidth: onboardingBorderWidth.hairline,
    flexDirection: "row",
    gap: onboardingSpacing.s + 4,
    paddingHorizontal: onboardingSpacing.m - 2,
    paddingVertical: onboardingSpacing.s + 4,
  },
  cardSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    borderWidth: onboardingBorderWidth.selected,
  },
  pressed: {
    opacity: 0.75,
  },
  iconShell: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: onboardingRadius.control,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  iconShellOn: {
    backgroundColor: colors.surface,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  check: {
    alignItems: "center",
    borderColor: colors.borderStrong,
    borderRadius: onboardingRadius.pill,
    borderWidth: onboardingBorderWidth.selected,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  checkOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
});
