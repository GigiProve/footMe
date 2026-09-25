import { useEffect, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, typography } from "../../../styles";
import { AppText } from "../../../ui";
import {
  onboardingBorderWidth,
  onboardingLayout,
  onboardingRadius,
  onboardingSpacing,
} from "./onboarding-tokens";

const DEFAULT_MIN = 0;
const DEFAULT_MAX = 999;

/**
 * Normalizza quello che l'utente digita nel campo centrale: tiene solo le
 * cifre, elimina gli zeri iniziali e applica i limiti (§W.7).
 */
export function normalizeStepperInput(
  raw: string,
  { max = DEFAULT_MAX, min = DEFAULT_MIN }: { max?: number; min?: number } = {},
) {
  const digits = raw.replace(/[^0-9]/g, "");

  if (digits.length === 0) {
    return min;
  }

  const parsed = Number.parseInt(digits, 10);

  if (Number.isNaN(parsed)) {
    return min;
  }

  return Math.min(Math.max(parsed, min), max);
}

type NumericStepperInputProps = {
  /** Etichetta del dato: "Presenze", "Gol", "Assist". */
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  testID?: string;
};

/**
 * Contatore numerico condiviso (§W): − / valore / +. Il valore centrale è
 * anche un campo, così un 28 si scrive invece di premere 28 volte.
 */
export function NumericStepperInput({
  disabled = false,
  label,
  max = DEFAULT_MAX,
  min = DEFAULT_MIN,
  onChange,
  testID,
  value,
}: NumericStepperInputProps) {
  const [draft, setDraft] = useState(String(value));
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setDraft(String(value));
    }
  }, [isEditing, value]);

  function commit(raw: string) {
    const next = normalizeStepperInput(raw, { max, min });
    setDraft(String(next));
    onChange(next);
  }

  const canDecrement = !disabled && value > min;
  const canIncrement = !disabled && value < max;

  return (
    <View style={styles.container} testID={testID}>
      <AppText style={styles.label} variant="titleSm">
        {label}
      </AppText>

      <View style={styles.control}>
        <Pressable
          accessibilityLabel={`Diminuisci ${label}`}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canDecrement }}
          disabled={!canDecrement}
          onPress={() => onChange(Math.max(value - 1, min))}
          style={({ pressed }) => [
            styles.stepButton,
            !canDecrement ? styles.stepButtonDisabled : null,
            pressed && canDecrement ? styles.pressed : null,
          ]}
          testID={testID ? `${testID}-decrement` : undefined}
        >
          <Ionicons
            color={canDecrement ? colors.textPrimary : colors.textMuted}
            name="remove"
            size={18}
          />
        </Pressable>

        <TextInput
          accessibilityLabel={`${label}, valore ${value}`}
          editable={!disabled}
          keyboardType="number-pad"
          maxLength={String(max).length}
          onBlur={() => {
            setIsEditing(false);
            commit(draft);
          }}
          onChangeText={(text) => setDraft(text.replace(/[^0-9]/g, ""))}
          onFocus={() => setIsEditing(true)}
          onSubmitEditing={() => commit(draft)}
          returnKeyType="done"
          selectTextOnFocus
          style={styles.value}
          testID={testID ? `${testID}-value` : undefined}
          value={draft}
        />

        <Pressable
          accessibilityLabel={`Aumenta ${label}`}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canIncrement }}
          disabled={!canIncrement}
          onPress={() => onChange(Math.min(value + 1, max))}
          style={({ pressed }) => [
            styles.stepButton,
            !canIncrement ? styles.stepButtonDisabled : null,
            pressed && canIncrement ? styles.pressed : null,
          ]}
          testID={testID ? `${testID}-increment` : undefined}
        >
          <Ionicons
            color={canIncrement ? colors.textPrimary : colors.textMuted}
            name="add"
            size={18}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flexDirection: "row",
    gap: onboardingSpacing.s + 4,
    minHeight: onboardingLayout.rowMinHeight,
  },
  label: {
    flex: 1,
  },
  control: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: onboardingRadius.control,
    borderWidth: onboardingBorderWidth.hairline,
    flexDirection: "row",
    padding: onboardingSpacing.xs,
  },
  stepButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: onboardingRadius.control - 4,
    borderWidth: onboardingBorderWidth.hairline,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  stepButtonDisabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.7,
  },
  value: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.displaySoft,
    fontSize: typography.fontSize[17],
    minWidth: 56,
    paddingVertical: 0,
    textAlign: "center",
  },
});
