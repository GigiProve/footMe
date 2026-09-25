import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors } from "../../../styles";
import { AppText } from "../../../ui";
import {
  onboardingBorderWidth,
  onboardingLayout,
  onboardingRadius,
  onboardingSpacing,
} from "./onboarding-tokens";

type SelectionRowProps = {
  label: string;
  /** Una o due righe. Non è il posto per spiegare il modello dati. */
  description?: string;
  selected: boolean;
  onPress: () => void;
  /**
   * `radio` per una scelta esclusiva, `checkbox` per una scelta multipla.
   * I due non sono intercambiabili (§N.5).
   */
  control?: "radio" | "checkbox";
  disabled?: boolean;
  leading?: ReactNode;
  testID?: string;
};

/**
 * Riga selezionabile: tutta la riga è il touch target (§N.2). Lo stato
 * selezionato si legge da bordo, fondo e segno di spunta, mai dal solo colore.
 */
export function SelectionRow({
  control = "checkbox",
  description,
  disabled = false,
  label,
  leading,
  onPress,
  selected,
  testID,
}: SelectionRowProps) {
  const isRadio = control === "radio";

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole={isRadio ? "radio" : "checkbox"}
      accessibilityState={{ checked: selected, disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        selected ? styles.rowSelected : null,
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null,
      ]}
      testID={testID}
    >
      {leading ? <View style={styles.leading}>{leading}</View> : null}

      <View style={styles.text}>
        <AppText variant="titleSm">{label}</AppText>
        {description ? (
          <AppText color="secondary" variant="meta">
            {description}
          </AppText>
        ) : null}
      </View>

      <View
        style={[
          styles.control,
          isRadio ? styles.radio : styles.checkbox,
          selected ? styles.controlOn : null,
        ]}
      >
        {selected ? (
          isRadio ? (
            <View style={styles.radioDot} />
          ) : (
            <Ionicons color={colors.inkInvert} name="checkmark" size={14} />
          )
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: onboardingRadius.control,
    borderWidth: onboardingBorderWidth.hairline,
    flexDirection: "row",
    gap: onboardingSpacing.s + 4,
    minHeight: onboardingLayout.rowMinHeight,
    paddingHorizontal: onboardingSpacing.m - 2,
    paddingVertical: onboardingSpacing.s + 2,
  },
  rowSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    borderWidth: onboardingBorderWidth.selected,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.75,
  },
  leading: {
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    flex: 1,
    gap: 2,
  },
  control: {
    alignItems: "center",
    borderColor: colors.borderStrong,
    borderWidth: onboardingBorderWidth.selected,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  checkbox: {
    borderRadius: onboardingRadius.checkbox,
  },
  radio: {
    borderRadius: onboardingRadius.pill,
  },
  controlOn: {
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
