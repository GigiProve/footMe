import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors } from "../../../styles";
import { AppText } from "../../../ui";
import {
  onboardingBorderWidth,
  onboardingLayout,
  onboardingRadius,
  onboardingSpacing,
} from "../ui/onboarding-tokens";

type AvailabilityModeCardProps = {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
  /**
   * `direct` = la card conclude la scelta e mostra il radio selezionato.
   * `drilldown` = la card apre un livello successivo e mostra il chevron.
   *
   * Le due affordance non convivono mai sulla stessa card (§S): il check dice
   * "ho scelto questo", il chevron dice "qui dentro c'è dell'altro".
   */
  affordance: "direct" | "drilldown";
  /** Riepilogo leggero della selezione di dettaglio: "3 regioni selezionate". */
  summary?: string;
  testID?: string;
};

/**
 * Card di una modalità di disponibilità geografica (§S–§V).
 */
export function AvailabilityModeCard({
  affordance,
  description,
  icon,
  onPress,
  selected,
  summary,
  testID,
  title,
}: AvailabilityModeCardProps) {
  const isDrilldown = affordance === "drilldown";

  return (
    <Pressable
      accessibilityHint={
        isDrilldown ? "Apre la selezione di dettaglio" : undefined
      }
      accessibilityLabel={title}
      accessibilityRole={isDrilldown ? "button" : "radio"}
      accessibilityState={{ checked: selected, selected }}
      accessibilityValue={summary ? { text: summary } : undefined}
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
          size={19}
        />
      </View>

      <View style={styles.body}>
        <AppText variant="titleSm">{title}</AppText>
        <AppText color="secondary" variant="meta">
          {description}
        </AppText>
        {summary ? (
          <AppText color="accent" variant="metaStrong">
            {summary}
          </AppText>
        ) : null}
      </View>

      {isDrilldown ? (
        <Ionicons
          color={selected ? colors.accent : colors.textMuted}
          name="chevron-forward"
          size={18}
        />
      ) : (
        <View style={[styles.radio, selected ? styles.radioOn : null]}>
          {selected ? <View style={styles.radioDot} /> : null}
        </View>
      )}
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
    minHeight: onboardingLayout.rowMinHeight + 10,
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
    borderRadius: onboardingRadius.pill,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  iconShellOn: {
    backgroundColor: colors.surface,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  radio: {
    alignItems: "center",
    borderColor: colors.borderStrong,
    borderRadius: onboardingRadius.pill,
    borderWidth: onboardingBorderWidth.selected,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  radioOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  radioDot: {
    backgroundColor: colors.inkInvert,
    borderRadius: onboardingRadius.pill,
    height: 8,
    width: 8,
  },
});
