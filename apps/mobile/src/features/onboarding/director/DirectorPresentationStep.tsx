import {
  OnboardingChipMultiSelect,
  OnboardingMultiSelectField,
  OnboardingPage,
  OnboardingSection,
  OnboardingTextField,
} from "../ui";
import {
  AGENT_COMMON_LANGUAGE_OPTIONS,
  AGENT_OTHER_LANGUAGE_OPTIONS,
  splitAgentLanguages,
} from "../agent/agent-taxonomy";
import { DIRECTOR_BIO_MAX_LENGTH } from "./director-taxonomy";

type DirectorPresentationStepProps = {
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
 * Passo "Informazioni aggiuntive" (REV-ONB-07 §AI–§AK).
 *
 * §AK: una sola CTA primaria, "Completa registrazione". Nessuna "Salta"
 * concorrente: bio e lingue sono facoltative e si può proseguire lasciandole
 * vuote, quindi una seconda CTA direbbe la stessa cosa due volte.
 *
 * §AJ: il selector lingue è quello già approvato negli altri onboarding — le
 * lingue frequenti a vista come chip, le altre dietro un selector ricercabile.
 */
export function DirectorPresentationStep({
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
}: DirectorPresentationStepProps) {
  const { common, other } = splitAgentLanguages(languages);

  /** §AM del Master: il contatore compare solo quando si sta scrivendo. */
  const counter = bio.length
    ? `${bio.length}/${DIRECTOR_BIO_MAX_LENGTH}`
    : undefined;

  return (
    <OnboardingPage
      currentStep={currentStep}
      footer={{
        onPrimaryPress: onFinish,
        primaryLabel: "Completa registrazione",
        primaryLoading: isBusy,
        primaryTestID: "director-presentation-finish",
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle="Completa il tuo profilo per essere ancora più efficace."
      testID="director-presentation-step"
      title="Informazioni aggiuntive"
      totalSteps={totalSteps}
    >
      <OnboardingSection>
        <OnboardingTextField
          helperText={counter}
          label="Bio professionale"
          maxLength={DIRECTOR_BIO_MAX_LENGTH}
          multiline
          onChangeText={onBioChange}
          optional
          placeholder="Racconta brevemente la tua esperienza dirigenziale, i club con cui hai lavorato e il tuo modo di lavorare."
          testID="director-bio"
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
          testID="director-languages"
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
          testID="director-other-languages"
          values={other}
        />
      </OnboardingSection>
    </OnboardingPage>
  );
}
