import { StyleSheet, View } from "react-native";

import { InlineError, OnboardingPage, SelectionRow, onboardingLayout } from "../ui";
import { CLUB_STRUCTURE_OPTIONS, type ClubStructure } from "./club-structure";

type ClubStructureStepProps = {
  currentStep: number;
  errorMessage?: string;
  isBusy: boolean;
  onBack: () => void;
  onContinue: () => void;
  onSelect: (structure: ClubStructure) => void;
  stepLabel: string;
  totalSteps: number;
  value: ClubStructure;
};

/**
 * Struttura del club (REV-ONB-05 §N–§R).
 *
 * È il passo che rende comprensibile tutto il resto: da qui in poi
 * l'onboarding chiede solo ciò che riguarda davvero questa società. Le tre
 * configurazioni sono alternative, quindi sono radio a tutti gli effetti,
 * anche per chi usa uno screen reader (§BH).
 */
export function ClubStructureStep({
  currentStep,
  errorMessage,
  isBusy,
  onBack,
  onContinue,
  onSelect,
  stepLabel,
  totalSteps,
  value,
}: ClubStructureStepProps) {
  return (
    <OnboardingPage
      currentStep={currentStep}
      footer={{
        onPrimaryPress: onContinue,
        primaryDisabled: isBusy,
        primaryLabel: "Continua",
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle="Seleziona la configurazione che rappresenta la tua società."
      testID="club-structure-step"
      title="Come è strutturato il tuo club?"
      totalSteps={totalSteps}
    >
      <View accessibilityRole="radiogroup" style={styles.options}>
        {CLUB_STRUCTURE_OPTIONS.map((option) => (
          <SelectionRow
            control="radio"
            description={option.description}
            key={option.value}
            label={option.label}
            onPress={() => onSelect(option.value)}
            selected={value === option.value}
            testID={`club-structure-${option.value}`}
          />
        ))}
      </View>

      <InlineError message={errorMessage} />
    </OnboardingPage>
  );
}

const styles = StyleSheet.create({
  options: {
    gap: onboardingLayout.labelGap + 2,
    paddingBottom: onboardingLayout.labelGap,
  },
});
