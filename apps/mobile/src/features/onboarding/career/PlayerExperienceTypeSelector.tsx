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
import type { PlayerCareerType } from "./player-career-types";

type PlayerExperienceTypeOption = {
  icon: keyof typeof Ionicons.glyphMap;
  subtitle: string;
  title: string;
  type: PlayerCareerType;
};

type PlayerExperienceTypeSelectorProps = {
  options?: PlayerExperienceTypeOption[];
  subtitle?: string;
  title?: string;
  onSelect: (type: PlayerCareerType) => void;
};

/** §AE–§AG: esattamente tre tipologie, nessuna quarta. */
const typeOptions: PlayerExperienceTypeOption[] = [
  {
    icon: "layers-outline",
    subtitle: "Es. 2022/23, 2023/24 nella stessa squadra.",
    title: "Più stagioni complete",
    type: "MULTI_SEASON",
  },
  {
    icon: "calendar-outline",
    subtitle: "Es. 2023/24, una sola stagione sportiva.",
    title: "Singola stagione",
    type: "SINGLE_SEASON",
  },
  {
    icon: "time-outline",
    subtitle: "Es. da Gennaio 2025 a Maggio 2025. Utile per prestiti o periodi brevi.",
    title: "Periodo personalizzato",
    type: "CUSTOM_PERIOD",
  },
];

/**
 * Scelta della tipologia di esperienza (REV-ONB-02 §AD–§AG).
 *
 * Ogni card apre un editor: mostra quindi un chevron, mai un check (§S).
 */
export function PlayerExperienceTypeSelector({
  onSelect,
  options = typeOptions,
  subtitle = "Che tipo di esperienza vuoi inserire?",
  title,
}: PlayerExperienceTypeSelectorProps) {
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
            testID={`experience-type-${option.type}`}
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
    paddingTop: onboardingSpacing.s,
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
