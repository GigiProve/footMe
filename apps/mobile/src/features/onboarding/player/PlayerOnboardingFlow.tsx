import type {
  OnboardingFormState,
  OnboardingStep,
  OnboardingValidationErrors,
} from "../onboarding-form";
import type { ProfileGender } from "../onboarding-types";
import {
  excludePrimaryFromSecondaryPositions,
  type PlayerExperienceForm,
  type PlayerPosition,
  type PreferredFoot,
  type TeamAutocompleteOption,
} from "../../profiles/player-sports";
import { PlayerAvailabilityStep } from "./PlayerAvailabilityStep";
import { PlayerCareerStep } from "./PlayerCareerStep";
import { PlayerPersonalDataStep } from "./PlayerPersonalDataStep";
import { PlayerPhotoStep } from "./PlayerPhotoStep";
import { PlayerSportsProfileStep } from "./PlayerSportsProfileStep";
import type { GeographicAvailabilityDraft } from "./geographic-availability";
import { resolveActiveAvailability } from "./geographic-availability";
import { revalidateSecondaryPosition } from "./player-pitch-positions";
import { trackPlayerOnboardingEvent } from "./player-onboarding-analytics";

/** Passi che appartengono solo al ramo Calciatore. */
const PLAYER_ONLY_STEPS: OnboardingStep[] = [
  "technical",
  "player_availability",
  "experience",
];

/** Passi condivisi con altri ruoli, ma resi dal Calciatore con le sue pagine. */
const PLAYER_SHARED_STEPS: OnboardingStep[] = ["base", "photo"];

/**
 * Il Calciatore rende questi passi con le pagine intere del Master. I passi
 * che esistono solo nel suo ramo valgono anche con il ruolo non ancora
 * risolto: nessuna bozza può restare su una schermata che nessuno disegna.
 */
export function isPlayerMasterStep(step: OnboardingStep, role: string) {
  // Il ruolo vuoto è una bozza non ancora risolta, non un altro profilo: un
  // allenatore che riapre una bozza legacy migrata su "technical" deve
  // comunque vedere la sua schermata, non il campo da calcio.
  if (role !== "player" && role !== "") {
    return false;
  }

  return (
    PLAYER_ONLY_STEPS.includes(step) ||
    (role === "player" && PLAYER_SHARED_STEPS.includes(step))
  );
}

function splitDelimited(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

type CitySelection = { name: string; region: string };

type PlayerOnboardingFlowProps = {
  counter: { current: number; label: string; total: number };
  form: OnboardingFormState;
  isBusy: boolean;
  nationalityCategory: "italy" | "eu" | "non_eu" | "unknown";
  onBack: () => void;
  onClearValidationErrors: (fields: string[]) => void;
  onContinueFromAvailability: () => void;
  onContinueFromPersonalData: () => void;
  onContinueFromPhoto: () => void;
  onContinueFromSportsProfile: () => void;
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
  onSaveCareer: () => void;
  onShowPhysicalFieldsChange: (value: boolean) => void;
  onTakePhoto: () => void;
  photoPreviewUrl: string | null;
  searchTeams: (query: string) => Promise<TeamAutocompleteOption[]>;
  showPhysicalFields: boolean;
  step: OnboardingStep;
  validationErrors: OnboardingValidationErrors;
};

/**
 * Instrada i passi del Calciatore sulle pagine del Master (REV-ONB-02).
 *
 * La rotta continua a possedere navigazione, validazione e salvataggio: qui
 * si decide soltanto quale schermata mostrare e come i campi del form si
 * mappano sui componenti di ruolo.
 */
export function PlayerOnboardingFlow({
  counter,
  form,
  isBusy,
  nationalityCategory,
  onBack,
  onClearValidationErrors,
  onContinueFromAvailability,
  onContinueFromPersonalData,
  onContinueFromPhoto,
  onContinueFromSportsProfile,
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
  onSaveCareer,
  onShowPhysicalFieldsChange,
  onTakePhoto,
  photoPreviewUrl,
  searchTeams,
  showPhysicalFields,
  step,
  validationErrors,
}: PlayerOnboardingFlowProps) {
  const secondaryPosition = form.secondaryPositions[0] ?? "";

  const availabilityDraft: GeographicAvailabilityDraft = {
    mode: form.availabilityType,
    provinces: splitDelimited(form.transferProvinces),
    regions: splitDelimited(form.transferRegions),
  };

  if (step === "base") {
    return (
      <PlayerPersonalDataStep
        birthDate={form.birthDate}
        currentLocationCity={form.currentLocationCity}
        currentLocationCountry={form.currentLocationCountry}
        currentStep={counter.current}
        domicile={form.domicile}
        domicileRegion={form.domicileRegion}
        firstName={form.firstName}
        gender={form.gender}
        isBusy={isBusy}
        lastName={form.lastName}
        legalStatus={form.legalStatus}
        nationality={form.nationality}
        nationalityCategory={nationalityCategory}
        onBack={onBack}
        onBirthDateChange={(value) => {
          onPatchForm({ birthDate: value });
          onClearValidationErrors(["birthDate"]);
        }}
        onContinue={onContinueFromPersonalData}
        onCurrentLocationCityChange={(value) => {
          onPatchForm({ currentLocationCity: value });
          onClearValidationErrors(["currentLocationCity"]);
        }}
        onCurrentLocationCountryChange={(value) => {
          onPatchForm({ currentLocationCountry: value });
          onClearValidationErrors(["currentLocationCountry"]);
        }}
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
        onLegalStatusChange={(value) => {
          onPatchForm({ legalStatus: value });
          onClearValidationErrors(["legalStatus"]);
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
        onContinue={() => {
          if (form.avatarUrl) {
            trackPlayerOnboardingEvent({ name: "profile_photo_added" });
          }
          onContinueFromPhoto();
        }}
        onPickFromLibrary={onPickPhotoFromLibrary}
        onRemove={form.avatarUrl ? onRemovePhoto : undefined}
        onTakePhoto={onTakePhoto}
        stepLabel={counter.label}
        totalSteps={counter.total}
      />
    );
  }

  if (step === "technical") {
    return (
      <PlayerSportsProfileStep
        currentStep={counter.current}
        heightCm={form.heightCm}
        isBusy={isBusy}
        onBack={onBack}
        onContinue={onContinueFromSportsProfile}
        onHeightChange={(value) => onPatchForm({ heightCm: value })}
        onPreferredFootChange={(value: PreferredFoot) =>
          onPatchForm({ preferredFoot: value })
        }
        onPrimaryPositionChange={(value: PlayerPosition) => {
          trackPlayerOnboardingEvent({
            name: "primary_role_selected",
            role: value,
          });
          onPatchForm({
            primaryPosition: value,
            // §R: cambiando il principale il secondario va rivalidato.
            secondaryPositions: excludePrimaryFromSecondaryPositions(
              form.secondaryPositions,
              value,
            ),
          });
          onClearValidationErrors(["primaryPosition", "secondaryPositions"]);
        }}
        onSecondaryPositionChange={(value) => {
          const nextSecondary = revalidateSecondaryPosition(
            value,
            form.primaryPosition,
          );

          if (nextSecondary) {
            trackPlayerOnboardingEvent({
              name: "secondary_role_selected",
              role: nextSecondary,
            });
          }

          onPatchForm({
            secondaryPositions: nextSecondary ? [nextSecondary] : [],
          });
          onClearValidationErrors(["secondaryPositions"]);
        }}
        onShowPhysicalFieldsChange={(value) => {
          onShowPhysicalFieldsChange(value);

          if (!value) {
            onPatchForm({ heightCm: "", weightKg: "" });
          }
        }}
        onWeightChange={(value) => onPatchForm({ weightKg: value })}
        preferredFoot={form.preferredFoot}
        primaryPosition={form.primaryPosition}
        primaryPositionError={validationErrors.primaryPosition}
        secondaryPosition={secondaryPosition}
        showPhysicalFields={showPhysicalFields}
        stepLabel={counter.label}
        totalSteps={counter.total}
        weightKg={form.weightKg}
      />
    );
  }

  if (step === "player_availability") {
    return (
      <PlayerAvailabilityStep
        categories={splitDelimited(form.preferredCategories)}
        currentStep={counter.current}
        draft={availabilityDraft}
        isAvailable={form.isOpenToTransfer}
        isBusy={isBusy}
        onBack={onBack}
        onCategoriesChange={(categories) => {
          trackPlayerOnboardingEvent({
            count: categories.length,
            name: "categories_interest_selected",
          });
          onPatchForm({ preferredCategories: categories.join(", ") });
          onClearValidationErrors(["preferredCategories"]);
        }}
        onContinue={onContinueFromAvailability}
        onDraftChange={(next) => {
          if (next.mode !== availabilityDraft.mode) {
            trackPlayerOnboardingEvent({
              mode: next.mode,
              name: "availability_mode_selected",
            });
          }

          if (next.regions.length !== availabilityDraft.regions.length) {
            trackPlayerOnboardingEvent({
              count: next.regions.length,
              name: "regions_selected",
            });
          }

          if (next.provinces.length !== availabilityDraft.provinces.length) {
            trackPlayerOnboardingEvent({
              count: next.provinces.length,
              name: "provinces_selected",
            });
          }

          // La bozza conserva tutto; il form tiene solo ciò che la modalità
          // rende davvero attivo, così il dato finale non è mai ambiguo (§T).
          const active = resolveActiveAvailability(next);

          onPatchForm({
            availabilityType: next.mode,
            transferProvinces: active.provinces.join(", "),
            transferRegions: active.regions.join(", "),
          });
          onClearValidationErrors(["transferRegions", "transferProvinces"]);
        }}
        onIsAvailableChange={(value) => {
          onPatchForm({ isOpenToTransfer: value, willingToChangeClub: value });

          if (!value) {
            onClearValidationErrors([
              "preferredCategories",
              "transferProvinces",
              "transferRegions",
            ]);
          }
        }}
        onRegisterBack={onRegisterBack}
        stepLabel={counter.label}
        totalSteps={counter.total}
      />
    );
  }

  return (
    <PlayerCareerStep
      careerEntries={form.careerEntries}
      currentStep={counter.current}
      isBusy={isBusy}
      onBack={onBack}
      onContinue={onSaveCareer}
      onExperienceAddStarted={() =>
        trackPlayerOnboardingEvent({
          name:
            form.careerEntries.length > 0
              ? "additional_experience_started"
              : "experience_add_started",
        })
      }
      onExperienceSaved={(isEditing) =>
        trackPlayerOnboardingEvent({
          name: isEditing ? "experience_edited" : "experience_saved",
        })
      }
      onExperienceTypeSelected={(type) =>
        trackPlayerOnboardingEvent({
          experienceType: type,
          name: "experience_type_selected",
        })
      }
      onRegisterBack={onRegisterBack}
      onUpdateEntries={(entries: PlayerExperienceForm[]) =>
        onPatchForm({ careerEntries: entries })
      }
      searchTeams={searchTeams}
      stepLabel={counter.label}
      totalSteps={counter.total}
    />
  );
}
