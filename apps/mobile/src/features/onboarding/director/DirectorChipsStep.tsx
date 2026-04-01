import { Pressable, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { OnboardingEyebrow, OnboardingSectionCard } from "../onboarding-ui";

type DirectorChipsStepProps = {
  eyebrow?: string;
  options: readonly string[];
  selectedValues: string[];
  title: string;
  subtitle: string;
  errorMessage?: string;
  onToggle: (value: string) => void;
};

export function DirectorChipsStep({
  eyebrow,
  options,
  selectedValues,
  title,
  subtitle,
  errorMessage,
  onToggle,
}: DirectorChipsStepProps) {
  return (
    <View style={styles.container}>
      {eyebrow ? <OnboardingEyebrow>{eyebrow}</OnboardingEyebrow> : null}

      <View style={styles.header}>
        <AppText variant="displaySm">{title}</AppText>
        <AppText variant="bodySm" color="secondary">
          {subtitle}
        </AppText>
      </View>

      <OnboardingSectionCard>
        <View style={styles.chips}>
          {options.map((option) => {
            const active = selectedValues.includes(option);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                key={option}
                onPress={() => onToggle(option)}
                style={[styles.chip, active ? styles.chipActive : null]}
              >
                <AppText
                  variant="bodySm"
                  style={active ? styles.chipTextActive : undefined}
                >
                  {option}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {errorMessage ? (
          <AppText variant="bodySm" color="danger">
            {errorMessage}
          </AppText>
        ) : null}
      </OnboardingSectionCard>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[10],
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipTextActive: {
    color: colors.inkInvert,
    fontWeight: "600",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  container: {
    gap: spacing[16],
  },
  header: {
    gap: spacing[8],
  },
});
