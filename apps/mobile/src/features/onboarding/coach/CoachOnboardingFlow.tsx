import type {
  OnboardingFormState,
  OnboardingStep,
  OnboardingValidationErrors,
} from "../onboarding-form";
import type { ProfileGender } from "../onboarding-types";
import type {
  PlayerExperienceForm,
  TeamAutocompleteOption,
} from "../../profiles/player-sports";
import { PlayerCareerStep } from "../player/PlayerCareerStep";
import { PlayerPersonalDataStep } from "../player/PlayerPersonalDataStep";
import { PlayerPhotoStep } from "../player/PlayerPhotoStep";
import type { GeographicAvailabilityDraft } from "../player/geographic-availability";
import { resolveActiveAvailability } from "../player/geographic-availability";
import { CoachAvailabilityStep } from "./CoachAvailabilityStep";
import { CoachExperiencesStep } from "./CoachExperiencesStep";
import { CoachPhilosophyStep } from "./CoachPhilosophyStep";
import { CoachPlayerCareerChoiceStep } from "./CoachPlayerCareerChoiceStep";
import { CoachQualificationStep } from "./CoachQualificationStep";
import type { CoachCareerEntry } from "./coach-career-types";

/** Passi che appartengono solo al ramo Allenatore. */
const COACH_ONLY_STEPS: OnboardingStep[] = [
  "coach_role",
  "coach_availability",
  "coach_career",
  "player_career_toggle",
  "player_career",
  "coach_extra",
];

/** Passi condivisi con gli altri ruoli, resi con le pagine comuni (§B). */
const COACH_SHARED_STEPS: OnboardingStep[] = ["base", "photo"];

/**
 * L'Allenatore rende questi passi con le pagine intere del Master.
 *
 * `player_career_toggle` e `player_career` esistono solo nel ramo Allenatore:
 * lo Staff, l'Agente e il Dirigente hanno i propri passi omonimi con prefisso.
 */
export function isCoachMasterStep(step: OnboardingStep, role: string) {
  if (role !== "coach") {
    return false;
  }

  return COACH_ONLY_STEPS.includes(step) || COACH_SHARED_STEPS.includes(step);
}

type CitySelection = { name: string; region: string };

type CoachOnboardingFlowProps = {
  counter: { current: number; label: string; total: number };
  form: OnboardingFormState;
  isBusy: boolean;
  nationalityCategory: "italy" | "eu" | "non_eu" | "unknown";
  onBack: () => void;
  onClearValidationErrors: (fields: string[]) => void;
  onContinueFromAvailability: () => void;
  onContinueFromCareer: () => void;
  onContinueFromPersonalData: () => void;
  onContinueFromPhoto: () => void;
  onContinueFromPlayerCareer: () => void;
  onContinueFromPlayerCareerChoice: () => void;
  onContinueFromQualification: () => void;
  onDomicileChange: (value: string) => void;
  onDomicileSelect: (value: CitySelection) => void;
  onDomicileToggle: (value: boolean) => void;
  onFinish: () => void;
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
 * Instrada i passi dell'Allenatore sulle pagine del Master (REV-ONB-03).
 *
 * La rotta continua a possedere navigazione, validazione e salvataggio: qui
 * si decide soltanto quale schermata mostrare e come i campi del form si
 * mappano sui componenti di ruolo.
 */
export function CoachOnboardingFlow({
  counter,
  form,
  isBusy,
  nationalityCategory,
  onBack,
  onClearValidationErrors,
  onContinueFromAvailability,
  onContinueFromCareer,
  onContinueFromPersonalData,
  onContinueFromPhoto,
  onContinueFromPlayerCareer,
  onContinueFromPlayerCareerChoice,
  onContinueFromQualification,
  onDomicileChange,
  onDomicileSelect,
  onDomicileToggle,
  onFinish,
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
}: CoachOnboardingFlowProps) {
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

  if (step === "coach_role") {
    return (
      <CoachQualificationStep
        categories={form.coachCategoriesArray}
        currentStep={counter.current}
        isBusy={isBusy}
        licenseType={form.coachLicenseType}
        onBack={onBack}
        onCategoriesChange={(categories) =>
          onPatchForm({ coachCategoriesArray: categories })
        }
        onContinue={onContinueFromQualification}
        onLicenseTypeChange={(value) => onPatchForm({ coachLicenseType: value })}
        onPrimaryRoleChange={(value) => {
          onPatchForm({ coachPrimaryRole: value });
          onClearValidationErrors(["coachPrimaryRole"]);
        }}
        primaryRole={form.coachPrimaryRole}
        primaryRoleError={validationErrors.coachPrimaryRole}
        stepLabel={counter.label}
        totalSteps={counter.total}
      />
    );
  }

  if (step === "coach_availability") {
    const availabilityDraft: GeographicAvailabilityDraft = {
      mode: form.coachAvailabilityType,
      provinces: form.coachProvincesArray,
      regions: form.coachRegionsArray,
    };

    return (
      <CoachAvailabilityStep
        availableFrom={form.coachAvailableFrom}
        currentStep={counter.current}
        draft={availabilityDraft}
        isAvailable={form.openToNewRole}
        isBusy={isBusy}
        onAvailableFromChange={(value) =>
          onPatchForm({ coachAvailableFrom: value })
        }
        onBack={onBack}
        onContinue={onContinueFromAvailability}
        onDraftChange={(next) => {
          // La modalità attiva è una sola: il form non conserva due zone che
          // potrebbero contraddirsi (§J).
          const active = resolveActiveAvailability(next);

          onPatchForm({
            coachAvailabilityType: next.mode,
            coachProvincesArray: active.provinces,
            coachRegionsArray: active.regions,
          });
        }}
        onIsAvailableChange={(value) => {
          // §N: spegnere il toggle non cancella ciò che era già configurato.
          onPatchForm({ openToNewRole: value });
        }}
        onRegisterBack={onRegisterBack}
        stepLabel={counter.label}
        totalSteps={counter.total}
      />
    );
  }

  if (step === "coach_career") {
    return (
      <CoachExperiencesStep
        currentStep={counter.current}
        defaultRole={form.coachPrimaryRole}
        entries={form.coachCareerEntries}
        isBusy={isBusy}
        onBack={onBack}
        onContinue={onContinueFromCareer}
        onRegisterBack={onRegisterBack}
        onUpdateEntries={(entries: CoachCareerEntry[]) =>
          onPatchForm({ coachCareerEntries: entries })
        }
        searchTeams={searchTeams}
        stepLabel={counter.label}
        totalSteps={counter.total}
      />
    );
  }

  if (step === "player_career_toggle") {
    return (
      <CoachPlayerCareerChoiceStep
        currentStep={counter.current}
        hasPlayedFootball={form.hasPlayedFootball}
        isBusy={isBusy}
        onBack={onBack}
        onChange={(value) => onPatchForm({ hasPlayedFootball: value })}
        onContinue={onContinueFromPlayerCareerChoice}
        stepLabel={counter.label}
        totalSteps={counter.total}
      />
    );
  }

  if (step === "player_career") {
    // §AH–§AK: qui si entra direttamente nel flusso Calciatore di REV-ONB-02,
    // statistiche comprese. Nessuna seconda variante da mantenere.
    return (
      <PlayerCareerStep
        careerEntries={form.coachPlayerCareerEntries}
        currentStep={counter.current}
        isBusy={isBusy}
        onBack={onBack}
        onContinue={onContinueFromPlayerCareer}
        onRegisterBack={onRegisterBack}
        onUpdateEntries={(entries: PlayerExperienceForm[]) =>
          onPatchForm({ coachPlayerCareerEntries: entries })
        }
        searchTeams={searchTeams}
        stepLabel={counter.label}
        totalSteps={counter.total}
      />
    );
  }

  return (
    <CoachPhilosophyStep
      currentStep={counter.current}
      formation={form.coachFormation}
      isBusy={isBusy}
      languages={form.coachLanguages}
      onBack={onBack}
      onFinish={onFinish}
      onFormationChange={(value) => onPatchForm({ coachFormation: value })}
      onLanguagesChange={(values) => onPatchForm({ coachLanguages: values })}
      onPhilosophyChange={(value) => onPatchForm({ bio: value })}
      onPlayStyleChange={(value) => onPatchForm({ coachPlayStyle: value })}
      philosophy={form.bio}
      playStyle={form.coachPlayStyle}
      stepLabel={counter.label}
      totalSteps={counter.total}
    />
  );
}
