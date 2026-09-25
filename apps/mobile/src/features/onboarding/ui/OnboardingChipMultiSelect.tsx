import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors } from "../../../styles";
import { AppText } from "../../../ui";
import { FieldShell } from "./FieldShell";
import {
  onboardingBorderWidth,
  onboardingLayout,
  onboardingRadius,
  onboardingSpacing,
} from "./onboarding-tokens";

type ChipOption<T extends string> = {
  label: string;
  value: T;
};

type OnboardingChipMultiSelectProps<T extends string> = {
  label?: string;
  helperText?: string;
  errorMessage?: string;
  optional?: boolean;
  options: readonly ChipOption<T>[];
  values: T[];
  onChange: (values: T[]) => void;
  testID?: string;
};

/**
 * Selezione multipla su una lista corta e leggibile a colpo d'occhio.
 *
 * Stessa grammatica di chip già usata dal selettore stagioni: superficie
 * neutra quando non è selezionata, accent pieno e spunta quando lo è. Lo
 * stato non dipende dal solo colore — la spunta e `accessibilityState` lo
 * dicono comunque.
 *
 * Per liste lunghe resta `OnboardingMultiSelectField`: le chip servono
 * quando le voci si contano, non quando si cercano.
 */
export function OnboardingChipMultiSelect<T extends string>({
  errorMessage,
  helperText,
  label,
  onChange,
  optional,
  options,
  testID,
  values,
}: OnboardingChipMultiSelectProps<T>) {
  const selected = new Set(values);

  function toggle(value: T) {
    onChange(
      selected.has(value)
        ? values.filter((entry) => entry !== value)
        : [...values, value],
    );
  }

  return (
    <FieldShell
      errorMessage={errorMessage}
      helperText={helperText}
      label={label}
      optional={optional}
    >
      <View style={styles.grid} testID={testID}>
        {options.map((option) => {
          const isSelected = selected.has(option.value);

          return (
            <Pressable
              accessibilityLabel={option.label}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              key={option.value}
              onPress={() => toggle(option.value)}
              style={({ pressed }) => [
                styles.chip,
                isSelected ? styles.chipSelected : null,
                pressed ? styles.chipPressed : null,
              ]}
              testID={testID ? `${testID}-${option.value}` : undefined}
            >
              <AppText
                color={isSelected ? "inverse" : "primary"}
                variant="chipLabel"
              >
                {option.label}
              </AppText>
              {isSelected ? (
                <Ionicons color={colors.inkInvert} name="checkmark" size={13} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </FieldShell>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: onboardingSpacing.s,
  },
  chip: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: onboardingRadius.pill,
    borderWidth: onboardingBorderWidth.hairline,
    flexDirection: "row",
    gap: onboardingSpacing.xs + 1,
    justifyContent: "center",
    minHeight: onboardingLayout.touchTarget - 8,
    paddingHorizontal: onboardingSpacing.m - 4,
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipPressed: {
    opacity: 0.75,
  },
});
