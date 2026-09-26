import { StyleSheet, View } from "react-native";

import { InlineError, OnboardingPage, SelectionRow, onboardingLayout } from "../ui";
import { CLUB_YOUTH_CATEGORY_OPTIONS } from "./club-taxonomy";

type ClubYouthStepProps = {
  currentStep: number;
  errorMessage?: string;
  isBusy: boolean;
  onBack: () => void;
  onChange: (values: string[]) => void;
  onContinue: () => void;
  selectedCategories: string[];
  stepLabel: string;
  totalSteps: number;
};

/**
 * Settore giovanile (REV-ONB-05 §X–§AA).
 *
 * Nessun toggle "la società ha un settore giovanile": quella domanda è già
 * stata fatta nello step Struttura e non si ripete. Le categorie sono le
 * macro-categorie leggibili del vivaio, non l'elenco delle annate: le
 * singole Under si gestiscono più avanti, dal club.
 */
export function ClubYouthStep({
  currentStep,
  errorMessage,
  isBusy,
  onBack,
  onChange,
  onContinue,
  selectedCategories,
  stepLabel,
  totalSteps,
}: ClubYouthStepProps) {
  function toggle(value: string) {
    onChange(
      selectedCategories.includes(value)
        ? selectedCategories.filter((entry) => entry !== value)
        : [...selectedCategories, value],
    );
  }

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
      subtitle="Seleziona le categorie presenti nel tuo settore giovanile."
      testID="club-youth-step"
      title="Settore giovanile"
      totalSteps={totalSteps}
    >
      <View style={styles.options}>
        {CLUB_YOUTH_CATEGORY_OPTIONS.map((option) => (
          <SelectionRow
            control="checkbox"
            key={option.value}
            label={option.label}
            onPress={() => toggle(option.value)}
            selected={selectedCategories.includes(option.value)}
            testID={`club-youth-${option.value}`}
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
