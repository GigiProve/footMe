import { StyleSheet } from "react-native";

import { AppText } from "../../../ui";
import {
  InlineError,
  OnboardingChipMultiSelect,
  OnboardingPage,
  OnboardingSection,
} from "../ui";
import { onboardingSpacing } from "../ui/onboarding-tokens";
import { DIRECTOR_RESPONSIBILITY_CHIP_OPTIONS } from "./director-taxonomy";

type DirectorResponsibilitiesStepProps = {
  currentStep: number;
  errorMessage?: string;
  isBusy: boolean;
  onBack: () => void;
  onChange: (values: string[]) => void;
  onContinue: () => void;
  selectedValues: string[];
  stepLabel: string;
  totalSteps: number;
};

/**
 * Passo "Aree di responsabilità" (REV-ONB-07 §I–§J).
 *
 * Schermata dedicata e separata dai ruoli: un Direttore sportivo può
 * occuparsi di mercato, scouting e contratti senza che nessuna di queste sia
 * un ruolo (§I).
 *
 * Chip in selezione multipla — non una card verticale per responsabilità, che
 * trasformerebbe undici voci in una schermata lunga il doppio (§J).
 */
export function DirectorResponsibilitiesStep({
  currentStep,
  errorMessage,
  isBusy,
  onBack,
  onChange,
  onContinue,
  selectedValues,
  stepLabel,
  totalSteps,
}: DirectorResponsibilitiesStepProps) {
  return (
    <OnboardingPage
      currentStep={currentStep}
      footer={{
        onPrimaryPress: onContinue,
        primaryLabel: "Continua",
        primaryLoading: isBusy,
        primaryTestID: "director-responsibilities-continue",
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle="Seleziona le aree in cui operi più frequentemente."
      testID="director-responsibilities-step"
      title="Aree di responsabilità"
      totalSteps={totalSteps}
    >
      {/* §J: che la scelta sia multipla va detto, non dedotto dalle chip. */}
      <AppText color="secondary" style={styles.hint} variant="meta">
        Puoi selezionarne più di una.
      </AppText>

      <OnboardingSection>
        <OnboardingChipMultiSelect
          onChange={onChange}
          options={DIRECTOR_RESPONSIBILITY_CHIP_OPTIONS}
          testID="director-responsibilities"
          values={selectedValues}
        />

        {errorMessage ? <InlineError message={errorMessage} /> : null}
      </OnboardingSection>
    </OnboardingPage>
  );
}

const styles = StyleSheet.create({
  hint: {
    marginBottom: onboardingSpacing.s,
  },
});
