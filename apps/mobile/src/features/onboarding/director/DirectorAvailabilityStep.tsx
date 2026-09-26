import { AppText } from "../../../ui";
import { OnboardingPage, OnboardingSection, ToggleRow } from "../ui";
import {
  DIRECTOR_CONTACT_AUDIENCE_OPTIONS,
  type DirectorContactAudience,
} from "./director-taxonomy";

type DirectorAvailabilityStepProps = {
  currentStep: number;
  isBusy: boolean;
  onBack: () => void;
  onChange: (audience: DirectorContactAudience, value: boolean) => void;
  onContinue: () => void;
  stepLabel: string;
  totalSteps: number;
  values: Record<DirectorContactAudience, boolean>;
};

/**
 * Passo "Disponibilità" (REV-ONB-07 §M–§N).
 *
 * Quattro categorie indipendenti: ogni combinazione è valida, spente comprese
 * (§N). Non è un nuovo sistema di messaggistica né un permesso — è la
 * preferenza di contatto del profilo, che resta modificabile dal profilo e
 * non introduce regole di privacy parallele a quelle già esistenti (§N).
 */
export function DirectorAvailabilityStep({
  currentStep,
  isBusy,
  onBack,
  onChange,
  onContinue,
  stepLabel,
  totalSteps,
  values,
}: DirectorAvailabilityStepProps) {
  return (
    <OnboardingPage
      currentStep={currentStep}
      footer={{
        onPrimaryPress: onContinue,
        primaryLabel: "Continua",
        primaryLoading: isBusy,
        primaryTestID: "director-availability-continue",
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle="Seleziona da chi sei disponibile a ricevere contatti su ProLink."
      testID="director-availability-step"
      title="Disponibilità"
      totalSteps={totalSteps}
    >
      <OnboardingSection>
        {DIRECTOR_CONTACT_AUDIENCE_OPTIONS.map((option) => (
          <ToggleRow
            description={option.description}
            key={option.value}
            label={option.label}
            onValueChange={(value) => onChange(option.value, value)}
            testID={`director-availability-${option.value}`}
            value={values[option.value]}
          />
        ))}
      </OnboardingSection>

      {/* §N: la scelta non è irreversibile e va detto qui, non dopo. */}
      <AppText color="secondary" variant="meta">
        Potrai cambiare queste preferenze in qualsiasi momento dal tuo profilo.
      </AppText>
    </OnboardingPage>
  );
}
