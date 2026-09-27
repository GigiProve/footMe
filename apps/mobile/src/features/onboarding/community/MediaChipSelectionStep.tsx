import { OnboardingChipMultiSelect, OnboardingPage } from "../ui";

type MediaChipSelectionStepProps = {
  currentStep: number;
  errorMessage?: string;
  isBusy: boolean;
  onBack: () => void;
  onChange: (values: string[]) => void;
  onContinue: () => void;
  options: readonly string[];
  stepLabel: string;
  subtitle: string;
  testID: string;
  title: string;
  totalSteps: number;
  values: string[];
};

/**
 * Passo a chip multi-selezione del Media / Creator (REV-ONB-09 §17–§20).
 *
 * "Che contenuti crei" e "Ambito principale" chiedono la stessa cosa in due
 * vocabolari diversi: una lista corta, più risposte ammesse, nessun campo
 * libero in coda. Un solo componente invece di due schermate gemelle, e le
 * chip sono quelle del Master — un solo indicatore di selezione, mai due.
 */
export function MediaChipSelectionStep({
  currentStep,
  errorMessage,
  isBusy,
  onBack,
  onChange,
  onContinue,
  options,
  stepLabel,
  subtitle,
  testID,
  title,
  totalSteps,
  values,
}: MediaChipSelectionStepProps) {
  return (
    <OnboardingPage
      currentStep={currentStep}
      footer={{
        onPrimaryPress: onContinue,
        primaryLabel: "Continua",
        primaryLoading: isBusy,
        primaryTestID: `${testID}-continue`,
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle={subtitle}
      testID={testID}
      title={title}
      totalSteps={totalSteps}
    >
      <OnboardingChipMultiSelect
        errorMessage={errorMessage}
        onChange={onChange}
        options={options.map((option) => ({ label: option, value: option }))}
        testID={`${testID}-chips`}
        values={values}
      />
    </OnboardingPage>
  );
}
