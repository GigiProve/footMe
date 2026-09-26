import { OnboardingPage, OnboardingSection, OnboardingSelectField } from "../ui";
import { CLUB_FIRST_TEAM_CATEGORY_OPTIONS } from "./club-taxonomy";

type ClubFirstTeamStepProps = {
  currentStep: number;
  errorMessage?: string;
  isBusy: boolean;
  onBack: () => void;
  onChange: (value: string) => void;
  onContinue: () => void;
  stepLabel: string;
  totalSteps: number;
  value: string;
};

/**
 * Prima squadra (REV-ONB-05 §U–§W).
 *
 * Una sola domanda, e l'elenco dei campionati vive nel bottom sheet
 * condiviso invece di occupare la schermata. Le categorie arrivano dalla
 * taxonomy della piattaforma, non dal mockup.
 */
export function ClubFirstTeamStep({
  currentStep,
  errorMessage,
  isBusy,
  onBack,
  onChange,
  onContinue,
  stepLabel,
  totalSteps,
  value,
}: ClubFirstTeamStepProps) {
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
      subtitle="Indica il campionato in cui compete la prima squadra."
      testID="club-first-team-step"
      title="Prima squadra"
      totalSteps={totalSteps}
    >
      <OnboardingSection>
        <OnboardingSelectField
          errorMessage={errorMessage}
          label="Categoria"
          onChange={(next) => onChange(next)}
          options={CLUB_FIRST_TEAM_CATEGORY_OPTIONS}
          placeholder="Seleziona categoria"
          sheetTitle="Seleziona categoria"
          testID="club-first-team-category"
          value={value}
        />
      </OnboardingSection>
    </OnboardingPage>
  );
}
