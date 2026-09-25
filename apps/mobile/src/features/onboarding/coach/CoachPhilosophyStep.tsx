import {
  OnboardingChipMultiSelect,
  OnboardingPage,
  OnboardingSection,
  OnboardingSelectField,
  OnboardingTextField,
} from "../ui";
import {
  COACH_FORMATION_OPTIONS,
  COACH_LANGUAGE_OPTIONS,
  COACH_PHILOSOPHY_MAX_LENGTH,
  COACH_PLAY_STYLE_OPTIONS,
} from "./coach-options";

type CoachPhilosophyStepProps = {
  currentStep: number;
  formation: string;
  isBusy: boolean;
  languages: string[];
  onBack: () => void;
  onFinish: () => void;
  onFormationChange: (value: string) => void;
  onLanguagesChange: (values: string[]) => void;
  onPhilosophyChange: (value: string) => void;
  onPlayStyleChange: (value: string) => void;
  philosophy: string;
  playStyle: string;
  stepLabel: string;
  totalSteps: number;
};

/**
 * Ultimo step dell'Allenatore: "Filosofia e stile di gioco" (§AL–§AP).
 *
 * Tre campi e una riga di chip. Nessuna CTA "Salta": i campi facoltativi si
 * lasciano vuoti e si prosegue comunque (§AQ).
 */
export function CoachPhilosophyStep({
  currentStep,
  formation,
  isBusy,
  languages,
  onBack,
  onFinish,
  onFormationChange,
  onLanguagesChange,
  onPhilosophyChange,
  onPlayStyleChange,
  philosophy,
  playStyle,
  stepLabel,
  totalSteps,
}: CoachPhilosophyStepProps) {
  /** §AM: il contatore compare solo quando serve davvero, cioè scrivendo. */
  const counter = philosophy.length
    ? `${philosophy.length}/${COACH_PHILOSOPHY_MAX_LENGTH}`
    : undefined;

  return (
    <OnboardingPage
      currentStep={currentStep}
      footer={{
        onPrimaryPress: onFinish,
        primaryLabel: "Continua",
        primaryLoading: isBusy,
        primaryTestID: "coach-philosophy-continue",
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle="Racconta la tua visione del calcio."
      testID="coach-philosophy-step"
      title="Filosofia e stile di gioco"
      totalSteps={totalSteps}
    >
      <OnboardingSection>
        <OnboardingTextField
          helperText={counter}
          label="Filosofia di gioco"
          maxLength={COACH_PHILOSOPHY_MAX_LENGTH}
          multiline
          numberOfLines={5}
          onChangeText={onPhilosophyChange}
          optional
          placeholder="Descrivi il tuo approccio, la metodologia e gli obiettivi..."
          testID="coach-philosophy-field"
          value={philosophy}
        />

        <OnboardingSelectField
          allowClear
          label="Modulo preferito"
          onChange={onFormationChange}
          optional
          options={COACH_FORMATION_OPTIONS}
          placeholder="Seleziona il modulo"
          sheetTitle="Modulo preferito"
          testID="coach-formation"
          value={formation}
        />

        <OnboardingSelectField
          allowClear
          label="Stile di gioco"
          onChange={onPlayStyleChange}
          optional
          options={COACH_PLAY_STYLE_OPTIONS}
          placeholder="Seleziona lo stile"
          sheetTitle="Stile di gioco"
          testID="coach-play-style"
          value={playStyle}
        />
      </OnboardingSection>

      <OnboardingSection
        description="Seleziona le lingue che parli."
        title="Lingue parlate"
      >
        <OnboardingChipMultiSelect
          onChange={onLanguagesChange}
          options={COACH_LANGUAGE_OPTIONS}
          testID="coach-languages"
          values={languages}
        />
      </OnboardingSection>
    </OnboardingPage>
  );
}
