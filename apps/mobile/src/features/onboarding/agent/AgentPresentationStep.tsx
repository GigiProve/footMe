import {
  OnboardingChipMultiSelect,
  OnboardingMultiSelectField,
  OnboardingPage,
  OnboardingSection,
  OnboardingTextField,
} from "../ui";
import {
  AGENT_BIO_MAX_LENGTH,
  AGENT_COMMON_LANGUAGE_OPTIONS,
  AGENT_OTHER_LANGUAGE_OPTIONS,
  splitAgentLanguages,
} from "./agent-taxonomy";

type AgentPresentationStepProps = {
  bio: string;
  currentStep: number;
  isBusy: boolean;
  languages: string[];
  onBack: () => void;
  onBioChange: (value: string) => void;
  onFinish: () => void;
  onLanguagesChange: (values: string[]) => void;
  stepLabel: string;
  totalSteps: number;
};

/**
 * "Presentati alla community" (REV-ONB-06 §AZ–§BC).
 *
 * Ultimo passo di raccolta dati: la CTA è "Completa registrazione", non
 * esiste una CTA "Salta" (§BC). Bio e lingue restano facoltative e possono
 * essere lasciate vuote.
 *
 * §BB: le lingue più frequenti stanno a vista come chip, le altre dietro un
 * selector ricercabile — una sola lista finale, due modi di raggiungerla.
 */
export function AgentPresentationStep({
  bio,
  currentStep,
  isBusy,
  languages,
  onBack,
  onBioChange,
  onFinish,
  onLanguagesChange,
  stepLabel,
  totalSteps,
}: AgentPresentationStepProps) {
  const { common, other } = splitAgentLanguages(languages);

  /** §AM del Master: il contatore compare solo quando si sta scrivendo. */
  const counter = bio.length ? `${bio.length}/${AGENT_BIO_MAX_LENGTH}` : undefined;

  return (
    <OnboardingPage
      currentStep={currentStep}
      footer={{
        onPrimaryPress: onFinish,
        primaryLabel: "Completa registrazione",
        primaryLoading: isBusy,
        primaryTestID: "agent-presentation-finish",
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle="Aggiungi una breve bio e le lingue che utilizzi professionalmente."
      testID="agent-presentation-step"
      title="Presentati alla community"
      totalSteps={totalSteps}
    >
      <OnboardingSection>
        <OnboardingTextField
          helperText={counter}
          label="Bio"
          maxLength={AGENT_BIO_MAX_LENGTH}
          multiline
          onChangeText={onBioChange}
          optional
          placeholder="Racconta brevemente la tua esperienza, i mercati in cui operi e il tipo di supporto che offri."
          testID="agent-bio"
          value={bio}
        />
      </OnboardingSection>

      <OnboardingSection
        description="Seleziona le lingue che utilizzi professionalmente."
        title="Lingue parlate"
      >
        <OnboardingChipMultiSelect
          onChange={(values) => onLanguagesChange([...values, ...other])}
          options={AGENT_COMMON_LANGUAGE_OPTIONS}
          optional
          testID="agent-languages"
          values={common}
        />

        <OnboardingMultiSelectField
          label="Altre lingue"
          onChange={(values) => onLanguagesChange([...common, ...values])}
          optional
          options={AGENT_OTHER_LANGUAGE_OPTIONS}
          placeholder="Seleziona altre lingue"
          searchable
          sheetTitle="Altre lingue"
          testID="agent-other-languages"
          values={other}
        />
      </OnboardingSection>
    </OnboardingPage>
  );
}
