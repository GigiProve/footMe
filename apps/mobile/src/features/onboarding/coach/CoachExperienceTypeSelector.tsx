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
import type { CoachExperienceType } from "./coach-career-types";

type CoachExperienceTypeOption = {
  icon: keyof typeof Ionicons.glyphMap;
  subtitle: string;
  title: string;
  type: CoachExperienceType;
};

type CoachExperienceTypeSelectorProps = {
  options?: CoachExperienceTypeOption[];
  subtitle?: string;
  title?: string;
  onSelect: (type: CoachExperienceType) => void;
};

/** §P: le stesse tre tipologie del Calciatore, nessuna quarta. */
const typeOptions: CoachExperienceTypeOption[] = [
  {
    icon: "layers-outline",
    subtitle: "Aggiungi più stagioni consecutive in una volta sola.",
    title: "Più stagioni complete",
    type: "MULTI_SEASON",
  },
  {
    icon: "calendar-outline",
    subtitle: "Aggiungi i dettagli di una singola stagione.",
    title: "Singola stagione",
    type: "SINGLE_SEASON",
  },
  {
    icon: "time-outline",
    subtitle: "Inserisci un'esperienza in un intervallo di date.",
    title: "Periodo personalizzato",
    type: "CUSTOM_PERIOD",
  },
];

/**
 * Scelta della tipologia di esperienza (REV-ONB-03 §P).
 *
 * Stesso pattern visuale del Calciatore: ogni card apre un editor, quindi
 * mostra un chevron e mai una spunta.
 */
export function CoachExperienceTypeSelector({
  onSelect,
  options = typeOptions,
  subtitle,
  title,
}: CoachExperienceTypeSelectorProps) {
  return (
    <View style={styles.container}>
      {title ? <AppText variant="headingSm">{title}</AppText> : null}
      {subtitle ? (
        <AppText color="secondary" variant="bodyLg">
          {subtitle}
        </AppText>
      ) : null}

      <View style={styles.options}>
        {options.map((option) => (
          <Pressable
            accessibilityHint="Apre i dettagli dell'esperienza"
            accessibilityLabel={option.title}
            accessibilityRole="button"
            key={option.type}
            onPress={() => onSelect(option.type)}
            style={({ pressed }) => [
              styles.card,
              pressed ? styles.cardPressed : null,
            ]}
            testID={`coach-experience-type-${option.type}`}
          >
            <View style={styles.iconShell}>
              <Ionicons color={colors.accent} name={option.icon} size={20} />
            </View>

            <View style={styles.body}>
              <AppText variant="titleSm">{option.title}</AppText>
              <AppText color="secondary" variant="meta">
                {option.subtitle}
              </AppText>
            </View>

            <Ionicons
              color={colors.textMuted}
              name="chevron-forward"
              size={18}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: onboardingSpacing.s,
  },
  options: {
    gap: onboardingSpacing.s + 4,
  },
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
  cardPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  iconShell: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: onboardingRadius.pill,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  body: {
    flex: 1,
    gap: 2,
  },
});
