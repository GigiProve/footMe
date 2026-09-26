import { OnboardingPage, OnboardingSection, ToggleRow } from "../ui";

type AgentContactPreferencesStepProps = {
  currentStep: number;
  isBusy: boolean;
  onBack: () => void;
  onContinue: () => void;
  onOpenToClubsChange: (value: boolean) => void;
  onOpenToPlayersChange: (value: boolean) => void;
  openToClubs: boolean;
  openToPlayers: boolean;
  stepLabel: string;
  totalSteps: number;
};

/**
 * "Opportunità e contatti" (REV-ONB-06 §AU–§AY).
 *
 * I due controlli sono indipendenti e ogni combinazione è valida, spenti
 * compresi (§AX): non si forza nessuno a restare contattabile. Sono
 * preferenze di opportunità, non permessi — chi può davvero scrivere resta
 * deciso dalle regole di piattaforma (§AY).
 */
export function AgentContactPreferencesStep({
  currentStep,
  isBusy,
  onBack,
  onContinue,
  onOpenToClubsChange,
  onOpenToPlayersChange,
  openToClubs,
  openToPlayers,
  stepLabel,
  totalSteps,
}: AgentContactPreferencesStepProps) {
  return (
    <OnboardingPage
      currentStep={currentStep}
      footer={{
        onPrimaryPress: onContinue,
        primaryLabel: "Continua",
        primaryLoading: isBusy,
        primaryTestID: "agent-contact-preferences-continue",
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle="Scegli quali opportunità vuoi ricevere attraverso ProLink."
      testID="agent-contact-preferences-step"
      title="Opportunità e contatti"
      totalSteps={totalSteps}
    >
      <OnboardingSection>
        <ToggleRow
          description="I club possono contattarti per proporti collaborazioni."
          label="Disponibile a collaborazioni con club"
          onValueChange={onOpenToClubsChange}
          testID="agent-open-to-clubs-toggle"
          value={openToClubs}
        />

        <ToggleRow
          description="I calciatori possono contattarti per proporti una collaborazione."
          label="Aperto a richieste di rappresentanza"
          onValueChange={onOpenToPlayersChange}
          testID="agent-open-to-players-toggle"
          value={openToPlayers}
        />
      </OnboardingSection>
    </OnboardingPage>
  );
}
