import type {
  OnboardingFormState,
  OnboardingStep,
  OnboardingValidationErrors,
} from "../onboarding-form";
import type { StaffRole, ProfileGender } from "../onboarding-types";
import type {
  PlayerExperienceForm,
  TeamAutocompleteOption,
} from "../../profiles/player-sports";
import {
  fromDelimitedString,
  toDelimitedString,
} from "../../profiles/profile-edit-helpers";
import { CoachExperiencesStep } from "../coach/CoachExperiencesStep";
import type { CoachCareerEntry } from "../coach/coach-career-types";
import { PlayerCareerStep } from "../player/PlayerCareerStep";
import { PlayerPersonalDataStep } from "../player/PlayerPersonalDataStep";
import { PlayerPhotoStep } from "../player/PlayerPhotoStep";
import type { GeographicAvailabilityDraft } from "../player/geographic-availability";
import { resolveActiveAvailability } from "../player/geographic-availability";
import { StaffAvailabilityStep } from "./StaffAvailabilityStep";
import { StaffExperiencesStep } from "./StaffExperiencesStep";
import { StaffPreviousExperiencesStep } from "./StaffPreviousExperiencesStep";
import { StaffRolesStep } from "./StaffRolesStep";
import { trackStaffOnboardingEvent } from "./staff-onboarding-analytics";
import {
  buildStaffPreviousExperiencePatch,
  readStaffPreviousExperiences,
  type StaffPreviousExperience,
} from "./staff-previous-experiences";

/** Passi che appartengono solo al ramo Staff tecnico. */
const STAFF_ONLY_STEPS: OnboardingStep[] = [
  "staff_role",
  "staff_availability",
  "staff_career",
  "staff_previous_experiences",
  "staff_coach_career",
  "staff_player_career",
];

/** Passi condivisi con gli altri ruoli, resi con le pagine comuni (§D). */
const STAFF_SHARED_STEPS: OnboardingStep[] = ["base", "photo"];

/** Lo Staff tecnico rende questi passi con le pagine intere del Master. */
export function isStaffMasterStep(step: OnboardingStep, role: string) {
  if (role !== "staff") {
    return false;
  }

  return STAFF_ONLY_STEPS.includes(step) || STAFF_SHARED_STEPS.includes(step);
}

type CitySelection = { name: string; region: string };

type StaffOnboardingFlowProps = {
  counter: { current: number; label: string; total: number };
  form: OnboardingFormState;
  isBusy: boolean;
  nationalityCategory: "italy" | "eu" | "non_eu" | "unknown";
  onBack: () => void;
  onClearValidationErrors: (fields: string[]) => void;
  onContinueFromAvailability: () => void;
  onContinueFromCareer: () => void;
  onContinueFromCoachCareer: () => void;
  onContinueFromPersonalData: () => void;
  onContinueFromPhoto: () => void;
  onContinueFromPlayerCareer: () => void;
  onContinueFromPreviousExperiences: () => void;
  onContinueFromRoles: () => void;
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
  searchTeams: (query: string) => Promise<TeamAutocompleteOption[]>;
  step: OnboardingStep;
  validationErrors: OnboardingValidationErrors;
};

/**
 * Instrada i passi dello Staff tecnico sulle pagine del Master (REV-ONB-04).
 *
 * Lo Staff non ha un proprio sistema di onboarding: le schermate comuni
 * vengono dal Calciatore (§D), la disponibilità geografica dal Calciatore
 * (§H) e le esperienze professionali senza statistiche dall'Allenatore (§Q).
 * Qui si decide soltanto quale schermata mostrare e come i campi del form si
 * mappano sui componenti; navigazione, validazione e salvataggio restano
 * della rotta.
 */
export function StaffOnboardingFlow({
  counter,
  form,
  isBusy,
  nationalityCategory,
  onBack,
  onClearValidationErrors,
  onContinueFromAvailability,
  onContinueFromCareer,
  onContinueFromCoachCareer,
  onContinueFromPersonalData,
  onContinueFromPhoto,
  onContinueFromPlayerCareer,
  onContinueFromPreviousExperiences,
  onContinueFromRoles,
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
  searchTeams,
  step,
  validationErrors,
}: StaffOnboardingFlowProps) {
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
        onContinue={onContinueFromPhoto}
        onPickFromLibrary={onPickPhotoFromLibrary}
        onRemove={form.avatarUrl ? onRemovePhoto : undefined}
        onTakePhoto={onTakePhoto}
        stepLabel={counter.label}
        totalSteps={counter.total}
      />
    );
  }

  if (step === "staff_role") {
    return (
      <StaffRolesStep
        currentStep={counter.current}
        isBusy={isBusy}
        onBack={onBack}
        onContinue={onContinueFromRoles}
        onPrimaryRoleChange={(value) => {
          trackStaffOnboardingEvent({
            name: "staff_primary_role_selected",
            role: value,
          });
          onPatchForm({ staffPrimaryRole: value });
          onClearValidationErrors(["staffPrimaryRole"]);
        }}
        onRolesChange={(roles: StaffRole[], primaryRole) => {
          trackStaffOnboardingEvent({
            count: roles.length,
            name: "staff_roles_selected",
          });
          onPatchForm({ staffPrimaryRole: primaryRole, staffRoles: roles });
          onClearValidationErrors(["staffRoles", "staffPrimaryRole"]);
        }}
        primaryRole={form.staffPrimaryRole}
        primaryRoleError={validationErrors.staffPrimaryRole}
        rolesError={validationErrors.staffRoles}
        selectedRoles={form.staffRoles}
        stepLabel={counter.label}
        totalSteps={counter.total}
      />
    );
  }

  if (step === "staff_availability") {
    const availabilityDraft: GeographicAvailabilityDraft = {
      mode: form.staffAvailabilityType,
      provinces: fromDelimitedString(form.staffPreferredProvinces),
      regions: fromDelimitedString(form.staffPreferredRegions),
    };

    return (
      <StaffAvailabilityStep
        availableFrom={form.staffAvailableFrom}
        categories={fromDelimitedString(form.staffPreferredCategories)}
        currentStep={counter.current}
        draft={availabilityDraft}
        isAvailable={form.openToWork}
        isBusy={isBusy}
        onAvailableFromChange={(value) =>
          onPatchForm({ staffAvailableFrom: value })
        }
        onBack={onBack}
        onCategoriesChange={(categories) =>
          onPatchForm({ staffPreferredCategories: toDelimitedString(categories) })
        }
        onContinue={onContinueFromAvailability}
        onDraftChange={(next) => {
          // La modalità attiva è una sola: il form non conserva due zone che
          // potrebbero contraddirsi (§J).
          const active = resolveActiveAvailability(next);

          if (next.mode !== form.staffAvailabilityType) {
            trackStaffOnboardingEvent({
              mode: next.mode,
              name: "staff_geo_mode_selected",
            });
          }

          onPatchForm({
            staffAvailabilityType: next.mode,
            staffPreferredProvinces: toDelimitedString(active.provinces),
            staffPreferredRegions: toDelimitedString(active.regions),
          });
        }}
        onIsAvailableChange={(value) => {
          trackStaffOnboardingEvent({
            available: value,
            name: "staff_availability_changed",
          });
          // §I: spegnere il toggle non cancella ciò che era già configurato.
          onPatchForm({ openToWork: value });
        }}
        onProvincesConfirmed={(count) =>
          trackStaffOnboardingEvent({ count, name: "staff_provinces_selected" })
        }
        onRegionsConfirmed={(count) =>
          trackStaffOnboardingEvent({ count, name: "staff_regions_selected" })
        }
        onRegisterBack={onRegisterBack}
        stepLabel={counter.label}
        totalSteps={counter.total}
      />
    );
  }

  if (step === "staff_career") {
    return (
      <StaffExperiencesStep
        currentStep={counter.current}
        declaredRoles={form.staffRoles}
        defaultRole={form.staffPrimaryRole}
        entries={form.staffCareerEntries}
        isBusy={isBusy}
        onBack={onBack}
        onContinue={onContinueFromCareer}
        onExperienceAdded={() =>
          trackStaffOnboardingEvent({ name: "staff_experience_added" })
        }
        onExperienceEdited={() =>
          trackStaffOnboardingEvent({ name: "staff_experience_edited" })
        }
        onExperienceTypeSelected={(type) =>
          trackStaffOnboardingEvent({
            experienceType: type,
            name: "staff_experience_type_selected",
          })
        }
        onRegisterBack={onRegisterBack}
        onUpdateEntries={(entries: CoachCareerEntry[]) =>
          onPatchForm({ staffCareerEntries: entries })
        }
        searchTeams={searchTeams}
        stepLabel={counter.label}
        totalSteps={counter.total}
      />
    );
  }

  if (step === "staff_previous_experiences") {
    return (
      <StaffPreviousExperiencesStep
        currentStep={counter.current}
        isBusy={isBusy}
        onBack={onBack}
        onChange={(selection: StaffPreviousExperience[]) => {
          if (selection.includes("coach")) {
            trackStaffOnboardingEvent({
              name: "previous_coach_experience_selected",
            });
          }

          if (selection.includes("player")) {
            trackStaffOnboardingEvent({
              name: "previous_player_experience_selected",
            });
          }

          onPatchForm(buildStaffPreviousExperiencePatch(selection));
        }}
        onContinue={onContinueFromPreviousExperiences}
        selection={readStaffPreviousExperiences(form)}
        stepLabel={counter.label}
        totalSteps={counter.total}
      />
    );
  }

  if (step === "staff_coach_career") {
    // §AH: si entra nel flusso Allenatore di REV-ONB-03, senza un secondo
    // editor e senza cambiare il tipo di profilo principale (§AK).
    return (
      <CoachExperiencesStep
        currentStep={counter.current}
        defaultRole=""
        entries={form.staffCoachCareerEntries}
        isBusy={isBusy}
        onBack={onBack}
        onContinue={onContinueFromCoachCareer}
        onRegisterBack={onRegisterBack}
        onUpdateEntries={(entries: CoachCareerEntry[]) =>
          onPatchForm({ staffCoachCareerEntries: entries })
        }
        searchTeams={searchTeams}
        stepLabel={counter.label}
        totalSteps={counter.total}
      />
    );
  }

  // §AI: la carriera da calciatore è quella di REV-ONB-02, statistiche
  // comprese. Nessuna versione Staff del player experience editor.
  return (
    <PlayerCareerStep
      careerEntries={form.staffPlayerCareerEntries}
      currentStep={counter.current}
      isBusy={isBusy}
      onBack={onBack}
      onContinue={onContinueFromPlayerCareer}
      onRegisterBack={onRegisterBack}
      onUpdateEntries={(entries: PlayerExperienceForm[]) =>
        onPatchForm({ staffPlayerCareerEntries: entries })
      }
      searchTeams={searchTeams}
      stepLabel={counter.label}
      totalSteps={counter.total}
    />
  );
}
