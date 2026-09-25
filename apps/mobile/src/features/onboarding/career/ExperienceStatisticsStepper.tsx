import { StyleSheet, View } from "react-native";

import { colors } from "../../../styles";
import { NumericStepperInput, OnboardingTextField } from "../ui";
import {
  onboardingBorderWidth,
  onboardingRadius,
  onboardingSpacing,
} from "../ui/onboarding-tokens";
import type { PlayerSeasonDetail } from "./player-career-types";

const MAX_STAT = 999;

type ExperienceStatisticsStepperProps = {
  detail: PlayerSeasonDetail;
  onChange: (field: keyof PlayerSeasonDetail, value: string) => void;
  awardsPlaceholder?: string;
  testID?: string;
};

function toStatNumber(value: string) {
  const parsed = Number.parseInt(value, 10);

  return Number.isNaN(parsed) || parsed < 0 ? 0 : Math.min(parsed, MAX_STAT);
}

/**
 * Presenze, Gol e Assist di una singola stagione (REV-ONB-02 §AN–§AQ).
 *
 * Identico nelle tre modalità di esperienza: lo stesso − / valore / + del
 * Master, con il valore centrale digitabile. Interi non negativi, nient'altro.
 */
export function ExperienceStatisticsStepper({
  awardsPlaceholder = "Es. Capocannoniere, Miglior giocatore…",
  detail,
  onChange,
  testID,
}: ExperienceStatisticsStepperProps) {
  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.stats}>
        <NumericStepperInput
          label="Presenze"
          max={MAX_STAT}
          onChange={(value) => onChange("appearances", String(value))}
          testID={testID ? `${testID}-appearances` : undefined}
          value={toStatNumber(detail.appearances)}
        />
        <View style={styles.divider} />
        <NumericStepperInput
          label="Gol"
          max={MAX_STAT}
          onChange={(value) => onChange("goals", String(value))}
          testID={testID ? `${testID}-goals` : undefined}
          value={toStatNumber(detail.goals)}
        />
        <View style={styles.divider} />
        <NumericStepperInput
          label="Assist"
          max={MAX_STAT}
          onChange={(value) => onChange("assists", String(value))}
          testID={testID ? `${testID}-assists` : undefined}
          value={toStatNumber(detail.assists)}
        />
      </View>

      <OnboardingTextField
        label="Premi"
        onChangeText={(value) => onChange("awards", value)}
        optional
        placeholder={awardsPlaceholder}
        value={detail.awards}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: onboardingSpacing.m,
  },
  stats: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: onboardingRadius.control,
    borderWidth: onboardingBorderWidth.hairline,
    paddingHorizontal: onboardingSpacing.m - 2,
  },
  divider: {
    backgroundColor: colors.divider,
    height: StyleSheet.hairlineWidth,
  },
});
