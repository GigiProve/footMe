import type {
  OnboardingFormState,
  OnboardingStep,
  OnboardingValidationErrors,
} from "../onboarding-form";
import type { ProfileGender } from "../onboarding-types";
import { PlayerPersonalDataStep } from "../player/PlayerPersonalDataStep";
import { PlayerPhotoStep } from "../player/PlayerPhotoStep";
import { CommunityPathStep } from "./CommunityPathStep";
import { FanFootballTypesStep } from "./FanFootballTypesStep";
import { FanTerritoriesStep } from "./FanTerritoriesStep";
import { trackFanOnboardingEvent } from "./fan-onboarding-analytics";
import type { CommunityPath, FanFootballType } from "./fan-taxonomy";

/** Passi che appartengono solo al ramo Tifoso. */
const FAN_ONLY_STEPS: OnboardingStep[] = [
  "fan_football_types",
  "fan_territories",
];

/** Passi condivisi con gli altri ruoli, resi con le pagine comuni (§C, §H, §I). */
const FAN_SHARED_STEPS: OnboardingStep[] = ["base", "photo"];

/**
 * Il ramo "Media e tifosi" rende questi passi con le pagine intere del Master.
 *
 * La scelta del percorso (§E) appartiene a entrambi i rami, quindi vale anche
 * per il Media / Creator: è lo stesso bivio, non due schermate gemelle. Il
 * resto del percorso Media resta dov'era, in attesa della sua task (§B).
 */
export function isCommunityMasterStep(step: OnboardingStep, role: string) {
  if (role !== "fan" && role !== "media") {
    return false;
  }

  if (step === "community_profile_type") {
    return true;
  }

  return (
    role === "fan" &&
    (FAN_ONLY_STEPS.includes(step) || FAN_SHARED_STEPS.includes(step))
  );
}

type CitySelection = { name: string; region: string };

type CommunityOnboardingFlowProps = {
  counter: { current: number; label: string; total: number };
  form: OnboardingFormState;
  isBusy: boolean;
  nationalityCategory: "italy" | "eu" | "non_eu" | "unknown";
  onBack: () => void;
  onCanGoBack: boolean;
  onClearValidationErrors: (fields: string[]) => void;
  onContinueFromFootballTypes: () => void;
  onContinueFromPath: () => void;
  onContinueFromPersonalData: () => void;
  onContinueFromPhoto: () => void;
  onContinueFromTerritories: () => void;
  onDomicileChange: (value: string) => void;
  onDomicileSelect: (value: CitySelection) => void;
  onDomicileToggle: (value: boolean) => void;
  onFormattedNameBlur: (field: "firstName" | "lastName") => void;
  onNationalityChange: (value: string) => void;
  onPatchForm: (patch: Partial<OnboardingFormState>) => void;
  onPickPhotoFromLibrary: () => void;
  onRegisterBack: (handler: (() => void) | null) => void;
  onRemovePhoto: () => void;
  onResidenceChange: (value: string) => void;
  onResidenceSelect: (value: CitySelection) => void;
  onTakePhoto: () => void;
  photoPreviewUrl: string | null;
  step: OnboardingStep;
  validationErrors: OnboardingValidationErrors;
};

/**
 * Instrada i passi di "Media e tifosi" sulle pagine del Master (REV-ONB-08).
 *
 * Il Tifoso non ha un proprio sistema di onboarding: dati personali e foto
 * sono i componenti comuni di REV-ONB-01/02 senza varianti semplificate (§C,
 * §H, §I), la geografia è il selettore già approvato per la Disponibilità
 * geografica (§Q). Qui vive solo ciò che è davvero specifico: il bivio
 * Tifoso / Media-Creator e le due preferenze — che calcio, e dove.
 */
export function CommunityOnboardingFlow({
  counter,
  form,
  isBusy,
  nationalityCategory,
  onBack,
  onCanGoBack,
  onClearValidationErrors,
  onContinueFromFootballTypes,
  onContinueFromPath,
  onContinueFromPersonalData,
  onContinueFromPhoto,
  onContinueFromTerritories,
  onDomicileChange,
  onDomicileSelect,
  onDomicileToggle,
  onFormattedNameBlur,
  onNationalityChange,
  onPatchForm,
  onPickPhotoFromLibrary,
  onRegisterBack,
  onRemovePhoto,
  onResidenceChange,
  onResidenceSelect,
  onTakePhoto,
  photoPreviewUrl,
  step,
  validationErrors,
}: CommunityOnboardingFlowProps) {
  if (step === "community_profile_type") {
    return (
      <CommunityPathStep
        currentStep={counter.current}
        errorMessage={validationErrors.communityProfileType}
        isBusy={isBusy}
        onBack={onCanGoBack ? onBack : undefined}
        onContinue={onContinueFromPath}
        onSelect={(value: CommunityPath) => {
          trackFanOnboardingEvent({
            name: "community_path_selected",
            path: value,
          });
          onPatchForm({ communityProfileType: value, role: value });
          onClearValidationErrors(["communityProfileType", "role"]);
        }}
        selectedValue={form.communityProfileType}
        stepLabel={counter.label}
        totalSteps={counter.total}
      />
    );
  }

  if (step === "base") {
    return (
      <PlayerPersonalDataStep
        birthDate={form.birthDate}
        currentStep={counter.current}
        domicile={form.domicile}
        domicileRegion={form.domicileRegion}
        firstName={form.firstName}
        gender={form.gender}
        isBusy={isBusy}
        lastName={form.lastName}
        nationality={form.nationality}
        nationalityCategory={nationalityCategory}
        onBack={onBack}
        onBirthDateChange={(value) => {
          onPatchForm({ birthDate: value });
          onClearValidationErrors(["birthDate"]);
        }}
        onContinue={onContinueFromPersonalData}
        onDomicileChange={onDomicileChange}
        onDomicileSelect={onDomicileSelect}
        onDomicileToggle={onDomicileToggle}
        onFieldChange={(field, value) => {
          onPatchForm({ [field]: value });
          onClearValidationErrors([field]);
        }}
        onFormattedNameBlur={onFormattedNameBlur}
        onGenderChange={(value: ProfileGender) => {
          onPatchForm({ gender: value });
          onClearValidationErrors(["gender"]);
        }}
        onNationalityChange={onNationalityChange}
        onPhoneCountryCodeChange={(value) => {
          onPatchForm({ phoneCountryCode: value });
          onClearValidationErrors(["phoneNumber"]);
        }}
        onPhoneNumberChange={(value) => {
          onPatchForm({ phoneNumber: value });
          onClearValidationErrors(["phoneNumber"]);
        }}
        onResidenceChange={onResidenceChange}
        onResidenceCountryChange={(value) => {
          onPatchForm({ residenceCountry: value });
          onClearValidationErrors(["residenceCountry"]);
        }}
        onResidenceSelect={onResidenceSelect}
        phoneCountryCode={form.phoneCountryCode}
        phoneNumber={form.phoneNumber}
        residence={form.residence}
        residenceCountry={form.residenceCountry}
        residenceRegion={form.residenceRegion}
        stepLabel={counter.label}
        totalSteps={counter.total}
        useResidenceForDomicile={form.useResidenceForDomicile}
        validationErrors={validationErrors}
      />
    );
  }

  if (step === "photo") {
    return (
      <PlayerPhotoStep
        avatarUrl={photoPreviewUrl}
        currentStep={counter.current}
        isUploading={form.uploadingField === "avatar"}
        onBack={onBack}
        onContinue={onContinueFromPhoto}
        onPickFromLibrary={onPickPhotoFromLibrary}
        onRemove={form.avatarUrl ? onRemovePhoto : undefined}
        onTakePhoto={onTakePhoto}
        stepLabel={counter.label}
        totalSteps={counter.total}
      />
    );
  }

  if (step === "fan_football_types") {
    return (
      <FanFootballTypesStep
        currentStep={counter.current}
        errorMessage={validationErrors.fanFootballTypes}
        isBusy={isBusy}
        onBack={onBack}
        onChange={(values: FanFootballType[]) => {
          trackFanOnboardingEvent({
            count: values.length,
            name: "fan_football_types_selected",
          });
          onPatchForm({ fanFootballTypes: values });
          onClearValidationErrors(["fanFootballTypes"]);
        }}
        onContinue={onContinueFromFootballTypes}
        selectedValues={form.fanFootballTypes}
        stepLabel={counter.label}
        totalSteps={counter.total}
      />
    );
  }

  return (
    <FanTerritoriesStep
      currentStep={counter.current}
      draft={{
        mode: form.fanGeoScope,
        provinces: form.fanProvinces,
        regions: form.fanRegions,
      }}
      isBusy={isBusy}
      onBack={onBack}
      onBranchOpened={(branch) =>
        trackFanOnboardingEvent({ branch, name: "fan_territory_branch_opened" })
      }
      onContinue={onContinueFromTerritories}
      onDraftChange={(draft) => {
        onPatchForm({
          fanGeoScope: draft.mode,
          fanProvinces: draft.provinces,
          fanRegions: draft.regions,
        });
        onClearValidationErrors(["fanGeoScope"]);
      }}
      onModeSelected={(mode) =>
        trackFanOnboardingEvent({ mode, name: "fan_territory_mode_selected" })
      }
      onRegisterBack={onRegisterBack}
      onSelectionConfirmed={(branch, count) =>
        trackFanOnboardingEvent(
          branch === "regions"
            ? { count, name: "fan_regions_selected" }
            : { count, name: "fan_provinces_selected" },
        )
      }
      stepLabel={counter.label}
      totalSteps={counter.total}
    />
  );
}
