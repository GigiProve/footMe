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

type CoachExperienceTypeOption<TType extends string> = {
  icon: keyof typeof Ionicons.glyphMap;
  subtitle: string;
  title: string;
  type: TType;
};

type CoachExperienceTypeSelectorProps<TType extends string> = {
  options?: CoachExperienceTypeOption<TType>[];
  subtitle?: string;
  /** Prefisso dei testID, uno per flusso che riusa queste card. */
  testIDPrefix?: string;
  title?: string;
  onSelect: (type: TType) => void;
};

/** §P: le stesse tre tipologie del Calciatore, nessuna quarta. */
const typeOptions: CoachExperienceTypeOption<CoachExperienceType>[] = [
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
 *
 * Le opzioni sono un parametro perché le tipologie cambiano con il flusso: le
 * tre stagionali qui sotto per chi ragiona per stagioni, le due modalità
 * professionali del Procuratore (REV-PROF-15). Quello che non cambia — la
 * card interamente interattiva, il chevron, la gerarchia — vive qui una volta
 * sola.
 */
export function CoachExperienceTypeSelector<TType extends string = CoachExperienceType>({
  onSelect,
  options = typeOptions as unknown as CoachExperienceTypeOption<TType>[],
  subtitle,
  testIDPrefix = "coach-experience-type",
  title,
}: CoachExperienceTypeSelectorProps<TType>) {
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
            testID={`${testIDPrefix}-${option.type}`}
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
