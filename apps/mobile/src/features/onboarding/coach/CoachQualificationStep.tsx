import {
  OnboardingChipMultiSelect,
  OnboardingPage,
  OnboardingSection,
  OnboardingSelectField,
} from "../ui";
import {
  COACH_CATEGORY_OPTIONS,
  COACH_PRIMARY_ROLE_OPTIONS,
  LICENSE_TYPE_OPTIONS,
} from "./coach-options";

type CoachQualificationStepProps = {
  categories: string[];
  currentStep: number;
  isBusy: boolean;
  licenseType: string;
  onBack: () => void;
  onCategoriesChange: (categories: string[]) => void;
  onContinue: () => void;
  onLicenseTypeChange: (value: string) => void;
  onPrimaryRoleChange: (value: string) => void;
  primaryRole: string;
  primaryRoleError?: string;
  stepLabel: string;
  totalSteps: number;
};

/**
 * Step "Qualifica" dell'Allenatore (REV-ONB-03 §C–§F).
 *
 * Dice dove si colloca tecnicamente l'utente oggi: ruolo principale, licenza,
 * categorie allenate. Il ruolo scelto qui è il ruolo di profilo e precompila
 * le nuove esperienze, ma non riscrive la carriera passata (§D).
 */
export function CoachQualificationStep({
  categories,
  currentStep,
  isBusy,
  licenseType,
  onBack,
  onCategoriesChange,
  onContinue,
  onLicenseTypeChange,
  onPrimaryRoleChange,
  primaryRole,
  primaryRoleError,
  stepLabel,
  totalSteps,
}: CoachQualificationStepProps) {
  return (
    <OnboardingPage
      currentStep={currentStep}
      footer={{
        onPrimaryPress: onContinue,
        primaryLabel: "Continua",
        primaryLoading: isBusy,
        primaryTestID: "coach-qualification-continue",
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle="Raccontaci il tuo percorso da allenatore."
      testID="coach-qualification-step"
      title="Qualifica"
      totalSteps={totalSteps}
    >
      <OnboardingSection>
        <OnboardingSelectField
          errorMessage={primaryRoleError}
          label="Ruolo principale"
          onChange={onPrimaryRoleChange}
          options={COACH_PRIMARY_ROLE_OPTIONS}
          placeholder="Seleziona il ruolo"
          sheetTitle="Ruolo principale"
          testID="coach-primary-role"
          value={primaryRole}
        />

        {/* §E: si dichiara la licenza, non si avvia una verifica. */}
        <OnboardingSelectField
          allowClear
          label="Tipo di patentino"
          onChange={onLicenseTypeChange}
          optional
          options={LICENSE_TYPE_OPTIONS}
          placeholder="Seleziona il patentino"
          sheetTitle="Tipo di patentino"
          testID="coach-license-type"
          value={licenseType}
        />
      </OnboardingSection>

      <OnboardingSection
        description="Seleziona una o più categorie."
        title="Categorie allenate"
      >
        <OnboardingChipMultiSelect
          onChange={onCategoriesChange}
          options={COACH_CATEGORY_OPTIONS}
          testID="coach-categories"
          values={categories}
        />
      </OnboardingSection>
    </OnboardingPage>
  );
}
