import type {
  OnboardingFormState,
  OnboardingStep,
  OnboardingValidationErrors,
} from "../onboarding-form";
import type { DirectorFocus, ProfileGender } from "../onboarding-types";
import type {
  PlayerExperienceForm,
  TeamAutocompleteOption,
} from "../../profiles/player-sports";
import { CoachExperiencesStep } from "../coach/CoachExperiencesStep";
import type { CoachCareerEntry } from "../coach/coach-career-types";
import { PlayerCareerStep } from "../player/PlayerCareerStep";
import { PlayerPersonalDataStep } from "../player/PlayerPersonalDataStep";
import { PlayerPhotoStep } from "../player/PlayerPhotoStep";
import { StaffExperiencesStep } from "../staff/StaffExperiencesStep";
import { DirectorAvailabilityStep } from "./DirectorAvailabilityStep";
import { DirectorCareerStep } from "./DirectorCareerStep";
import { DirectorClubRoleStep } from "./DirectorClubRoleStep";
import { DirectorFocusStep } from "./DirectorFocusStep";
import { DirectorGenericExperiencesStep } from "./DirectorGenericExperiencesStep";
import { DirectorPresentationStep } from "./DirectorPresentationStep";
import { DirectorPreviousExperiencesStep } from "./DirectorPreviousExperiencesStep";
import { DirectorResponsibilitiesStep } from "./DirectorResponsibilitiesStep";
import { trackDirectorOnboardingEvent } from "./director-onboarding-analytics";
import {
  buildDirectorPreviousRolesPatch,
  readDirectorPreviousRoles,
  type DirectorPreviousRole,
} from "./director-previous-roles";
import type { DirectorContactAudience } from "./director-taxonomy";

/** Passi che appartengono solo al ramo Dirigente. */
const DIRECTOR_ONLY_STEPS: OnboardingStep[] = [
  "director_roles",
  "director_responsibilities",
  "director_focus",
  "director_availability",
  "director_career",
  "director_previous_experiences",
  "director_player_career",
  "director_coach_career",
  "director_staff_career",
  "director_other_career",
  "director_extra",
];

/** Passi condivisi con gli altri ruoli, resi con le pagine comuni (§B, §D). */
const DIRECTOR_SHARED_STEPS: OnboardingStep[] = ["base", "photo"];

/** Il Dirigente rende questi passi con le pagine intere del Master. */
export function isDirectorMasterStep(step: OnboardingStep, role: string) {
  if (role !== "director") {
    return false;
  }

  return (
    DIRECTOR_ONLY_STEPS.includes(step) || DIRECTOR_SHARED_STEPS.includes(step)
  );
}

type CitySelection = { name: string; region: string };

type DirectorOnboardingFlowProps = {
  counter: { current: number; label: string; total: number };
  form: OnboardingFormState;
  isBusy: boolean;
  nationalityCategory: "italy" | "eu" | "non_eu" | "unknown";
  onBack: () => void;
  onClearValidationErrors: (fields: string[]) => void;
  onContinueFromAvailability: () => void;
  onContinueFromCareer: () => void;
  onContinueFromCoachCareer: () => void;
  onContinueFromFocus: () => void;
  onContinueFromOtherCareer: () => void;
  onContinueFromPersonalData: () => void;
  onContinueFromPhoto: () => void;
  onContinueFromPlayerCareer: () => void;
  onContinueFromPreviousExperiences: () => void;
  onContinueFromResponsibilities: () => void;
  onContinueFromRoles: () => void;
  onContinueFromStaffCareer: () => void;
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
 * Instrada i passi del Dirigente sulle pagine del Master (REV-ONB-07).
 *
 * Il Dirigente non ha un proprio sistema di onboarding: le schermate comuni
 * vengono dal Calciatore (§B, §D, §E), la carriera dall'Allenatore senza
 * statistiche (§P–§V), i rami delle esperienze precedenti dai flussi già
 * approvati (§AC–§AF). Qui si decide soltanto quale schermata mostrare e come
 * i campi del form si mappano sui componenti; navigazione, validazione e
 * salvataggio restano della rotta.
 */
export function DirectorOnboardingFlow({
  counter,
  form,
  isBusy,
  nationalityCategory,
  onBack,
  onClearValidationErrors,
  onContinueFromAvailability,
  onContinueFromCareer,
  onContinueFromCoachCareer,
  onContinueFromFocus,
  onContinueFromOtherCareer,
  onContinueFromPersonalData,
  onContinueFromPhoto,
  onContinueFromPlayerCareer,
  onContinueFromPreviousExperiences,
  onContinueFromResponsibilities,
  onContinueFromRoles,
  onContinueFromStaffCareer,
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
}: DirectorOnboardingFlowProps) {
  const previousRoles = readDirectorPreviousRoles(form);

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

  if (step === "director_roles") {
    return (
      <DirectorClubRoleStep
        currentStep={counter.current}
        isBusy={isBusy}
        onBack={onBack}
        onContinue={onContinueFromRoles}
        onOtherRoleLabelChange={(value) => {
          onPatchForm({ directorOtherRoleLabel: value });
          onClearValidationErrors(["directorOtherRoleLabel"]);
        }}
        onPrimaryRoleChange={(value) => {
          trackDirectorOnboardingEvent({
            name: "director_primary_role_selected",
            role: value,
          });
          onPatchForm({ directorPrimaryRole: value });
          onClearValidationErrors(["directorPrimaryRole"]);
        }}
        onRolesChange={(roles, primaryRole) => {
          trackDirectorOnboardingEvent({
            count: roles.length,
            name: "director_roles_selected",
          });

          if (roles.length > 1) {
            trackDirectorOnboardingEvent({ name: "director_multi_role_used" });
          }

          onPatchForm({
            directorPrimaryRole: primaryRole,
            directorRoles: roles,
            // §H: il ruolo libero segue la dichiarazione che lo giustifica.
            ...(roles.includes("Altro") ? {} : { directorOtherRoleLabel: "" }),
          });
          onClearValidationErrors([
            "directorRoles",
            "directorPrimaryRole",
            "directorOtherRoleLabel",
          ]);
        }}
        otherRoleError={validationErrors.directorOtherRoleLabel}
        otherRoleLabel={form.directorOtherRoleLabel}
        primaryRole={form.directorPrimaryRole}
        primaryRoleError={validationErrors.directorPrimaryRole}
        rolesError={validationErrors.directorRoles}
        selectedRoles={form.directorRoles}
        stepLabel={counter.label}
        totalSteps={counter.total}
      />
    );
  }

  if (step === "director_responsibilities") {
    return (
      <DirectorResponsibilitiesStep
        currentStep={counter.current}
        errorMessage={validationErrors.directorResponsibilities}
        isBusy={isBusy}
        onBack={onBack}
        onChange={(values) => {
          trackDirectorOnboardingEvent({
            count: values.length,
            name: "director_responsibility_selected",
          });
          onPatchForm({ directorResponsibilities: values });
          onClearValidationErrors(["directorResponsibilities"]);
        }}
        onContinue={onContinueFromResponsibilities}
        selectedValues={form.directorResponsibilities}
        stepLabel={counter.label}
        totalSteps={counter.total}
      />
    );
  }

  if (step === "director_focus") {
    return (
      <DirectorFocusStep
        currentStep={counter.current}
        errorMessage={validationErrors.directorMainFocus}
        isBusy={isBusy}
        onBack={onBack}
        onContinue={onContinueFromFocus}
        onSelect={(value: DirectorFocus) => {
          trackDirectorOnboardingEvent({
            focus: value,
            name: "director_focus_selected",
          });
          onPatchForm({ directorMainFocus: value });
          onClearValidationErrors(["directorMainFocus"]);
        }}
        selectedValue={form.directorMainFocus}
        stepLabel={counter.label}
        totalSteps={counter.total}
      />
    );
  }

  if (step === "director_availability") {
    const AUDIENCE_FIELDS: Record<
      DirectorContactAudience,
      "directorOpenToClubs" | "directorOpenToStaff" | "directorOpenToPlayers" | "directorOpenToOthers"
    > = {
      clubs: "directorOpenToClubs",
      others: "directorOpenToOthers",
      players: "directorOpenToPlayers",
      staff: "directorOpenToStaff",
    };

    return (
      <DirectorAvailabilityStep
        currentStep={counter.current}
        isBusy={isBusy}
        onBack={onBack}
        onChange={(audience, value) => {
          trackDirectorOnboardingEvent({
            audience,
            enabled: value,
            name: "director_availability_changed",
          });
          onPatchForm({ [AUDIENCE_FIELDS[audience]]: value });
        }}
        onContinue={onContinueFromAvailability}
        stepLabel={counter.label}
        totalSteps={counter.total}
        values={{
          clubs: form.directorOpenToClubs,
          others: form.directorOpenToOthers,
          players: form.directorOpenToPlayers,
          staff: form.directorOpenToStaff,
        }}
      />
    );
  }

  if (step === "director_career") {
    return (
      <DirectorCareerStep
        currentStep={counter.current}
        declaredRoles={form.directorRoles}
        defaultRole={
          form.directorPrimaryRole === "Altro" && form.directorOtherRoleLabel.trim()
            ? form.directorOtherRoleLabel.trim()
            : form.directorPrimaryRole
        }
        entries={form.directorCareerEntries}
        isBusy={isBusy}
        onBack={onBack}
        onContinue={onContinueFromCareer}
        onExperienceAddStarted={() =>
          trackDirectorOnboardingEvent({ name: "director_career_entry_opened" })
        }
        onExperienceSaved={(isEditing) =>
          trackDirectorOnboardingEvent({
            name: isEditing
              ? "director_experience_edited"
              : "director_experience_saved",
          })
        }
        onExperienceTypeSelected={(type) =>
          trackDirectorOnboardingEvent({
            experienceType: type,
            name: "director_experience_type_selected",
          })
        }
        onRegisterBack={onRegisterBack}
        onUpdateEntries={(entries: CoachCareerEntry[]) =>
          onPatchForm({ directorCareerEntries: entries })
        }
        otherRoleLabel={form.directorOtherRoleLabel}
        searchTeams={searchTeams}
        stepLabel={counter.label}
        totalSteps={counter.total}
      />
    );
  }

  if (step === "director_previous_experiences") {
    return (
      <DirectorPreviousExperiencesStep
        currentStep={counter.current}
        isBusy={isBusy}
        onBack={onBack}
        onChange={(selection: DirectorPreviousRole[]) => {
          trackDirectorOnboardingEvent({
            count: selection.length,
            name: "director_previous_experience_selected",
          });
          onPatchForm(buildDirectorPreviousRolesPatch(selection));
        }}
        onContinue={onContinueFromPreviousExperiences}
        selection={previousRoles}
        stepLabel={counter.label}
        totalSteps={counter.total}
      />
    );
  }

  if (step === "director_player_career") {
    // §AC: è la carriera da calciatore di REV-ONB-02, statistiche comprese.
    // Nessun editor semplificato specifico per il Dirigente.
    return (
      <PlayerCareerStep
        careerEntries={form.directorPlayerCareerEntries}
        currentStep={counter.current}
        isBusy={isBusy}
        onBack={onBack}
        onContinue={onContinueFromPlayerCareer}
        onRegisterBack={onRegisterBack}
        onUpdateEntries={(entries: PlayerExperienceForm[]) =>
          onPatchForm({ directorPlayerCareerEntries: entries })
        }
        searchTeams={searchTeams}
        stepLabel={counter.label}
        totalSteps={counter.total}
      />
    );
  }

  if (step === "director_coach_career") {
    // §AD: modello esperienza Allenatore di REV-ONB-03, senza aggiungere
    // statistiche vittorie/pareggi/sconfitte che quel flusso non prevede.
    return (
      <CoachExperiencesStep
        currentStep={counter.current}
        defaultRole=""
        entries={form.directorCoachCareerEntries}
        isBusy={isBusy}
        onBack={onBack}
        onContinue={onContinueFromCoachCareer}
        onRegisterBack={onRegisterBack}
        onUpdateEntries={(entries: CoachCareerEntry[]) =>
          onPatchForm({ directorCoachCareerEntries: entries })
        }
        searchTeams={searchTeams}
        stepLabel={counter.label}
        totalSteps={counter.total}
      />
    );
  }

  if (step === "director_staff_career") {
    // §AE: modello carriera Staff di REV-ONB-04, dove il ruolo si specifica
    // nella singola esperienza.
    return (
      <StaffExperiencesStep
        currentStep={counter.current}
        declaredRoles={[]}
        defaultRole=""
        entries={form.directorStaffCareerEntries}
        isBusy={isBusy}
        onBack={onBack}
        onContinue={onContinueFromStaffCareer}
        onRegisterBack={onRegisterBack}
        onUpdateEntries={(entries: CoachCareerEntry[]) =>
          onPatchForm({ directorStaffCareerEntries: entries })
        }
        searchTeams={searchTeams}
        stepLabel={counter.label}
        totalSteps={counter.total}
      />
    );
  }

  if (step === "director_other_career") {
    return (
      <DirectorGenericExperiencesStep
        currentStep={counter.current}
        entries={form.directorOtherCareerEntries}
        isBusy={isBusy}
        onBack={onBack}
        onContinue={onContinueFromOtherCareer}
        onExperienceSaved={(isEditing) =>
          trackDirectorOnboardingEvent({
            name: isEditing
              ? "director_experience_edited"
              : "director_experience_saved",
          })
        }
        onRegisterBack={onRegisterBack}
        onUpdateEntries={(entries: CoachCareerEntry[]) =>
          onPatchForm({ directorOtherCareerEntries: entries })
        }
        searchTeams={searchTeams}
        selection={previousRoles}
        stepLabel={counter.label}
        totalSteps={counter.total}
      />
    );
  }

  return (
    <DirectorPresentationStep
      bio={form.directorBio}
      currentStep={counter.current}
      isBusy={isBusy}
      languages={form.directorLanguages}
      onBack={onBack}
      onBioChange={(value) => onPatchForm({ directorBio: value })}
      onFinish={onFinish}
      onLanguagesChange={(values) => onPatchForm({ directorLanguages: values })}
      stepLabel={counter.label}
      totalSteps={counter.total}
    />
  );
}
