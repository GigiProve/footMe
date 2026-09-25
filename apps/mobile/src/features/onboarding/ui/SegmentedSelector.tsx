import { Pressable, StyleSheet, View } from "react-native";

import { colors } from "../../../styles";
import { AppText } from "../../../ui";
import { FieldShell } from "./FieldShell";
import {
  onboardingBorderWidth,
  onboardingLayout,
  onboardingRadius,
  onboardingSpacing,
} from "./onboarding-tokens";

type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentedSelectorProps<T extends string> = {
  label?: string;
  options: SegmentedOption<T>[];
  value: T | "";
  onChange: (value: T) => void;
  helperText?: string;
  errorMessage?: string;
  optional?: boolean;
  testID?: string;
};

/**
 * Scelta singola fra due o tre opzioni brevi (§L): solo testo, niente
 * simboli. È il renderer giusto per "Uomo | Donna", non per liste lunghe.
 */
export function SegmentedSelector<T extends string>({
  errorMessage,
  helperText,
  label,
  onChange,
  optional,
  options,
  testID,
  value,
}: SegmentedSelectorProps<T>) {
  return (
    <FieldShell
      errorMessage={errorMessage}
      helperText={helperText}
      label={label}
      optional={optional}
    >
      <View style={styles.track} testID={testID}>
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, selected }}
              key={option.value}
              onPress={() => onChange(option.value)}
              style={[styles.segment, selected ? styles.segmentOn : null]}
            >
              <AppText
                color={selected ? "accent" : "secondary"}
                numberOfLines={1}
                variant="titleSm"
              >
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </FieldShell>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: onboardingRadius.control,
    borderWidth: onboardingBorderWidth.hairline,
    flexDirection: "row",
    gap: onboardingSpacing.xs,
    padding: onboardingSpacing.xs,
  },
  segment: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: onboardingRadius.control - 4,
    borderWidth: onboardingBorderWidth.selected,
    flex: 1,
    justifyContent: "center",
    minHeight: onboardingLayout.controlHeight - 10,
    paddingHorizontal: onboardingSpacing.s,
  },
  segmentOn: {
    backgroundColor: colors.surface,
    borderColor: colors.accent,
  },
});
