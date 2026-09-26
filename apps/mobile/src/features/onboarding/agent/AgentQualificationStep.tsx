import {
  InlineError,
  OnboardingPage,
  OnboardingSection,
  OnboardingSelectField,
  OnboardingTextField,
  ToggleRow,
} from "../ui";
import { AGENT_FEDERATION_OPTIONS } from "./agent-taxonomy";

type AgentQualificationStepProps = {
  currentStep: number;
  federation: string;
  isBusy: boolean;
  isLicensed: boolean;
  licenseNumber: string;
  onBack: () => void;
  onContinue: () => void;
  onFederationChange: (value: string) => void;
  onLicenseNumberChange: (value: string) => void;
  onLicensedChange: (value: boolean) => void;
  stepLabel: string;
  totalSteps: number;
  validationErrors: Partial<Record<string, string>>;
};

/**
 * "Abilitazione professionale" (REV-ONB-06 §N–§Q).
 *
 * Non avere una licenza è una risposta legittima, non un errore (§O): con il
 * controllo spento la schermata si ricompatta e si prosegue. Con il controllo
 * acceso la federazione si sceglie dal selector condiviso, che apre un bottom
 * sheet ricercabile invece di un dropdown sempre a schermo (§P, §Q).
 */
export function AgentQualificationStep({
  currentStep,
  federation,
  isBusy,
  isLicensed,
  licenseNumber,
  onBack,
  onContinue,
  onFederationChange,
  onLicenseNumberChange,
  onLicensedChange,
  stepLabel,
  totalSteps,
  validationErrors,
}: AgentQualificationStepProps) {
  return (
    <OnboardingPage
      currentStep={currentStep}
      footer={{
        onPrimaryPress: onContinue,
        primaryLabel: "Continua",
        primaryLoading: isBusy,
        primaryTestID: "agent-qualification-continue",
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle="Indica se possiedi una licenza o un'abilitazione ufficiale."
      testID="agent-qualification-step"
      title="Abilitazione professionale"
      totalSteps={totalSteps}
    >
      <OnboardingSection>
        <ToggleRow
          label="Possiedi un'abilitazione ufficiale?"
          onValueChange={onLicensedChange}
          testID="agent-licensed-toggle"
          value={isLicensed}
        >
          {/* §P: il dettaglio vive dentro il toggle e sparisce con lui. */}
          <OnboardingSelectField
            errorMessage={validationErrors.agentFederation}
            label="Federazione / ente"
            onChange={onFederationChange}
            options={AGENT_FEDERATION_OPTIONS}
            placeholder="Seleziona federazione o ente"
            searchable
            sheetTitle="Federazione / ente"
            testID="agent-federation"
            value={federation}
          />

          <OnboardingTextField
            autoCapitalize="characters"
            label="Numero licenza"
            onChangeText={onLicenseNumberChange}
            optional
            placeholder="Es. 1234/ITA"
            testID="agent-license-number"
            value={licenseNumber}
          />
        </ToggleRow>
      </OnboardingSection>

      <InlineError message={validationErrors.agentQualification} />
    </OnboardingPage>
  );
}
