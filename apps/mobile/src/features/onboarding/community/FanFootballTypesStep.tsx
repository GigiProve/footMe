import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors } from "../../../styles";
import { InlineError, OnboardingPage, SelectionRow } from "../ui";
import { onboardingSpacing } from "../ui/onboarding-tokens";
import {
  FAN_FOOTBALL_TYPE_OPTIONS,
  type FanFootballType,
} from "./fan-taxonomy";

type FanFootballTypesStepProps = {
  currentStep: number;
  errorMessage?: string;
  isBusy: boolean;
  onBack: () => void;
  onChange: (values: FanFootballType[]) => void;
  onContinue: () => void;
  selectedValues: FanFootballType[];
  stepLabel: string;
  totalSteps: number;
};

/**
 * "Che calcio vuoi seguire?" (REV-ONB-08 §J–§N).
 *
 * Multi-selezione su quattro macro-categorie: tutte e quattro possono
 * convivere, nessuna esclude le altre. L'icona resta piccola e secondaria
 * rispetto al nome della categoria (§M), e la selezione ha un solo segno —
 * la spunta della riga del Master, non una seconda decorazione (§N).
 */
export function FanFootballTypesStep({
  currentStep,
  errorMessage,
  isBusy,
  onBack,
  onChange,
  onContinue,
  selectedValues,
  stepLabel,
  totalSteps,
}: FanFootballTypesStepProps) {
  function handleToggle(value: FanFootballType) {
    onChange(
      selectedValues.includes(value)
        ? selectedValues.filter((entry) => entry !== value)
        : [...selectedValues, value],
    );
  }

  return (
    <OnboardingPage
      currentStep={currentStep}
      footer={{
        onPrimaryPress: onContinue,
        primaryLabel: "Continua",
        primaryLoading: isBusy,
        primaryTestID: "fan-football-types-continue",
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle="Scegli le realtà del calcio che vuoi vedere più spesso su ProLink."
      testID="fan-football-types-step"
      title="Che calcio vuoi seguire?"
      totalSteps={totalSteps}
    >
      <View style={styles.options}>
        {FAN_FOOTBALL_TYPE_OPTIONS.map((option) => {
          const selected = selectedValues.includes(option.value);

          return (
            <SelectionRow
              description={option.description}
              key={option.value}
              label={option.label}
              leading={
                <Ionicons
                  color={selected ? colors.accent : colors.textSecondary}
                  name={option.icon}
                  size={18}
                />
              }
              onPress={() => handleToggle(option.value)}
              selected={selected}
              testID={`fan-football-type-${option.value}`}
            />
          );
        })}
      </View>

      <InlineError message={errorMessage} />
    </OnboardingPage>
  );
}

const styles = StyleSheet.create({
  options: {
    gap: onboardingSpacing.s + 4,
    paddingBottom: onboardingSpacing.s,
  },
});
