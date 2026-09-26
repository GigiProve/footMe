import type { OnboardingValidationErrors } from "../onboarding-form";
import {
  OnboardingPage,
  OnboardingSection,
  OnboardingTextField,
  PhotoPicker,
} from "../ui";
import { ClubColorsField } from "./ClubColorsField";

type ClubIdentityStepProps = {
  currentStep: number;
  foundingYear: string;
  isBusy: boolean;
  isUploadingLogo: boolean;
  logoUrl: string;
  name: string;
  onBack: () => void;
  onColorsChange: (values: string[]) => void;
  onContinue: () => void;
  onFieldChange: (field: "clubName" | "clubFoundingYear", value: string) => void;
  onNameBlur: () => void;
  onPickLogoFromLibrary: () => void;
  onRemoveLogo?: () => void;
  onTakeLogoPhoto: () => void;
  selectedColors: string[];
  stepLabel: string;
  totalSteps: number;
  validationErrors: OnboardingValidationErrors;
};

/**
 * Il tuo club (REV-ONB-05 §H–§M).
 *
 * È l'identità della società: stemma, nome, anno, colori. La categoria della
 * prima squadra non compare, perché dipende da una configurazione che
 * l'utente non ha ancora dichiarato (§H).
 */
export function ClubIdentityStep({
  currentStep,
  foundingYear,
  isBusy,
  isUploadingLogo,
  logoUrl,
  name,
  onBack,
  onColorsChange,
  onContinue,
  onFieldChange,
  onNameBlur,
  onPickLogoFromLibrary,
  onRemoveLogo,
  onTakeLogoPhoto,
  selectedColors,
  stepLabel,
  totalSteps,
  validationErrors,
}: ClubIdentityStepProps) {
  return (
    <OnboardingPage
      currentStep={currentStep}
      footer={{
        onPrimaryPress: onContinue,
        primaryDisabled: isBusy,
        primaryLabel: "Continua",
        primaryLoading: isBusy,
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle="Aggiungi le informazioni principali della società."
      testID="club-identity-step"
      title="Il tuo club"
      totalSteps={totalSteps}
    >
      <OnboardingSection>
        {/* Lo stemma sta in un contenitore quadrato: è un logo, non una
            foto profilo (§I). Il resto del componente è quello del Master. */}
        <PhotoPicker
          addLabel="Carica logo società"
          onPickFromLibrary={onPickLogoFromLibrary}
          onRemove={logoUrl ? onRemoveLogo : undefined}
          onTakePhoto={onTakeLogoPhoto}
          placeholderIcon="shield-outline"
          replaceLabel="Cambia logo"
          shape="square"
          sheetTitle="Logo società"
          testID="club-logo-picker"
          uploading={isUploadingLogo}
          value={logoUrl}
        />

        <OnboardingTextField
          autoCapitalize="words"
          errorMessage={validationErrors.clubName}
          label="Nome società"
          onBlur={onNameBlur}
          onChangeText={(value) => onFieldChange("clubName", value)}
          placeholder="Es. ASD Calcio Milano"
          value={name}
        />

        <OnboardingTextField
          errorMessage={validationErrors.clubFoundingYear}
          keyboardType="number-pad"
          label="Anno di fondazione"
          maxLength={4}
          onChangeText={(value) =>
            onFieldChange("clubFoundingYear", value.replace(/[^0-9]/g, ""))
          }
          optional
          placeholder="1999"
          value={foundingYear}
        />

        <ClubColorsField
          errorMessage={validationErrors.clubColors}
          onChange={onColorsChange}
          values={selectedColors}
        />
      </OnboardingSection>
    </OnboardingPage>
  );
}
