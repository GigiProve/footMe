import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { OnboardingEyebrow, OnboardingSectionCard } from "../onboarding-ui";

type DirectorSingleSelectStepProps = {
  eyebrow?: string;
  options: { label: string; value: string }[];
  selectedValue: string;
  title: string;
  subtitle: string;
  errorMessage?: string;
  onSelect: (value: string) => void;
};

export function DirectorSingleSelectStep({
  eyebrow,
  options,
  selectedValue,
  title,
  subtitle,
  errorMessage,
  onSelect,
}: DirectorSingleSelectStepProps) {
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
        <View style={styles.optionsList}>
          {options.map((option) => {
            const active = selectedValue === option.value;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                key={option.value}
                onPress={() => onSelect(option.value)}
                style={[styles.optionCard, active ? styles.optionCardActive : null]}
              >
                <AppText
                  variant="titleSm"
                  style={active ? styles.optionTextActive : undefined}
                >
                  {option.label}
                </AppText>
                {active ? (
                  <Ionicons
                    color={colors.accent}
                    name="checkmark"
                    size={20}
                  />
                ) : null}
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
  container: {
    gap: spacing[16],
  },
  header: {
    gap: spacing[8],
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[14],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius[12],
    backgroundColor: colors.surface,
  },
  optionCardActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  optionTextActive: {
    color: colors.accentStrong,
  },
  optionsList: {
    gap: spacing[10],
  },
});
