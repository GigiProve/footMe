import { StyleSheet, View } from "react-native";

import { AppText } from "../../../ui";
import { OnboardingPage, SelectionRow } from "../ui";
import { onboardingLayout, onboardingSpacing } from "../ui/onboarding-tokens";
import {
  DIRECTOR_PREVIOUS_ROLE_OPTIONS,
  toggleDirectorPreviousRole,
  type DirectorPreviousRole,
} from "./director-previous-roles";

type DirectorPreviousExperiencesStepProps = {
  currentStep: number;
  isBusy: boolean;
  onBack: () => void;
  onChange: (selection: DirectorPreviousRole[]) => void;
  onContinue: () => void;
  selection: DirectorPreviousRole[];
  stepLabel: string;
  totalSteps: number;
};

/**
 * Passo "Altre esperienze nel calcio" (REV-ONB-07 §Z–§AB).
 *
 * Sostituisce il vecchio toggle generico seguito da chip poco chiare: qui la
 * selezione è diretta e multipla (§Z).
 *
 * §AB: zero selezioni è una risposta valida. La CTA non si blocca e non
 * esiste una voce "Nessuna" da dover scegliere per poter proseguire.
 */
export function DirectorPreviousExperiencesStep({
  currentStep,
  isBusy,
  onBack,
  onChange,
  onContinue,
  selection,
  stepLabel,
  totalSteps,
}: DirectorPreviousExperiencesStepProps) {
  return (
    <OnboardingPage
      currentStep={currentStep}
      footer={{
        onPrimaryPress: onContinue,
        primaryLabel: "Continua",
        primaryLoading: isBusy,
        primaryTestID: "director-previous-experiences-continue",
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle="Hai ricoperto altri ruoli nel mondo del calcio oltre a quello di dirigente?"
      testID="director-previous-experiences-step"
      title="Altre esperienze nel calcio"
      totalSteps={totalSteps}
    >
      {/* §AB: che si possa proseguire a mani vuote va detto, non intuito. */}
      <AppText color="secondary" style={styles.hint} variant="meta">
        Puoi scegliere più opzioni o proseguire senza selezionarne nessuna.
      </AppText>

      <View style={styles.options}>
        {DIRECTOR_PREVIOUS_ROLE_OPTIONS.map((option) => (
          <SelectionRow
            control="checkbox"
            description={option.description}
            key={option.value}
            label={option.label}
            onPress={() =>
              onChange(toggleDirectorPreviousRole(selection, option.value))
            }
            selected={selection.includes(option.value)}
            testID={`director-previous-role-${option.value}`}
          />
        ))}
      </View>
    </OnboardingPage>
  );
}

const styles = StyleSheet.create({
  hint: {
    marginBottom: onboardingSpacing.s,
  },
  options: {
    gap: onboardingLayout.labelGap + 2,
    marginBottom: onboardingSpacing.m,
  },
});
