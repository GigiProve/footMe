import { StyleSheet, View } from "react-native";

import { InlineError, OnboardingPage, OnboardingSection, RoleCard } from "../ui";
import { onboardingSpacing } from "../ui/onboarding-tokens";
import type { DirectorFocus } from "../onboarding-types";
import { DIRECTOR_FOCUS_CARD_OPTIONS } from "./director-taxonomy";

type DirectorFocusStepProps = {
  currentStep: number;
  errorMessage?: string;
  isBusy: boolean;
  onBack: () => void;
  onContinue: () => void;
  onSelect: (value: DirectorFocus) => void;
  selectedValue: string;
  stepLabel: string;
  totalSteps: number;
};

/**
 * Passo "Il tuo focus principale" (REV-ONB-07 §L).
 *
 * Una sola selezione alla volta, resa con le card del Master e non con tre
 * toggle indipendenti: "Entrambi" è una terza opzione, non la somma di due.
 */
export function DirectorFocusStep({
  currentStep,
  errorMessage,
  isBusy,
  onBack,
  onContinue,
  onSelect,
  selectedValue,
  stepLabel,
  totalSteps,
}: DirectorFocusStepProps) {
  return (
    <OnboardingPage
      currentStep={currentStep}
      footer={{
        onPrimaryPress: onContinue,
        primaryLabel: "Continua",
        primaryLoading: isBusy,
        primaryTestID: "director-focus-continue",
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle="Dove concentri principalmente la tua attività dirigenziale?"
      testID="director-focus-step"
      title="Il tuo focus principale"
      totalSteps={totalSteps}
    >
      <OnboardingSection>
        <View style={styles.list}>
          {DIRECTOR_FOCUS_CARD_OPTIONS.map((option) => (
            <RoleCard
              description={option.description}
              icon={option.icon}
              key={option.value}
              label={option.label}
              onPress={() => onSelect(option.value)}
              selected={selectedValue === option.value}
              testID={`director-focus-${option.value}`}
            />
          ))}
        </View>

        {errorMessage ? <InlineError message={errorMessage} /> : null}
      </OnboardingSection>
    </OnboardingPage>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: onboardingSpacing.s + 4,
  },
});
