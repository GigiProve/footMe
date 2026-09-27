import {
  OnboardingPage,
  OnboardingSection,
  OnboardingTextField,
} from "../ui";

/** §9: "breve" vale quanto vale negli altri campi multiline dell'app. */
export const MEDIA_PROJECT_DESCRIPTION_MAX_LENGTH = 400;

type MediaProjectStepProps = {
  currentStep: number;
  description: string;
  errorMessage?: string;
  isBusy: boolean;
  name: string;
  onBack: () => void;
  onContinue: () => void;
  onDescriptionChange: (value: string) => void;
  onNameChange: (value: string) => void;
  stepLabel: string;
  totalSteps: number;
};

/**
 * "La tua pagina o realtà" (REV-ONB-09 §9, §10).
 *
 * I termini restano generici di proposito: un creator indipendente non deve
 * fingere di avere una testata per rispondere. Il nome è l'unico campo
 * obbligatorio — la descrizione si può lasciare vuota e scrivere dopo.
 */
export function MediaProjectStep({
  currentStep,
  description,
  errorMessage,
  isBusy,
  name,
  onBack,
  onContinue,
  onDescriptionChange,
  onNameChange,
  stepLabel,
  totalSteps,
}: MediaProjectStepProps) {
  return (
    <OnboardingPage
      currentStep={currentStep}
      footer={{
        onPrimaryPress: onContinue,
        primaryLabel: "Continua",
        primaryLoading: isBusy,
        primaryTestID: "media-project-continue",
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle="Inserisci le informazioni principali del tuo progetto media."
      testID="media-project-step"
      title="La tua pagina o realtà"
      totalSteps={totalSteps}
    >
      <OnboardingSection>
        <OnboardingTextField
          autoCapitalize="words"
          errorMessage={errorMessage}
          label="Nome pagina, realtà o testata"
          onChangeText={onNameChange}
          placeholder="Es. TuttoDilettanti"
          testID="media-project-name"
          value={name}
        />

        <OnboardingTextField
          label="Descrizione breve"
          maxLength={MEDIA_PROJECT_DESCRIPTION_MAX_LENGTH}
          multiline
          onChangeText={onDescriptionChange}
          optional
          placeholder="Racconta in poche parole il tuo progetto e il tipo di calcio che segui."
          testID="media-project-description"
          value={description}
        />
      </OnboardingSection>
    </OnboardingPage>
  );
}
