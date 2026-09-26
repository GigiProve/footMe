import type { ItalianCityOption } from "../../profiles/profile-form-utils";
import type {
  OnboardingFormState,
  OnboardingStep,
  OnboardingValidationErrors,
} from "../onboarding-form";
import { ClubContactsStep } from "./ClubContactsStep";
import { ClubFirstTeamStep } from "./ClubFirstTeamStep";
import { ClubIdentityStep } from "./ClubIdentityStep";
import { ClubProfileStep } from "./ClubProfileStep";
import { ClubRepresentativeStep } from "./ClubRepresentativeStep";
import { ClubStructureStep } from "./ClubStructureStep";
import { ClubYouthStep } from "./ClubYouthStep";
import { trackClubOnboardingEvent } from "./club-onboarding-analytics";
import {
  type ClubStructure,
  buildClubStructurePatch,
} from "./club-structure";

/** Passi che appartengono al ramo Società. */
const CLUB_STEPS: OnboardingStep[] = [
  "club_representative",
  "club_data",
  "club_structure",
  "club_first_team",
  "club_youth",
  "club_contacts",
  "club_profile",
];

/** La Società rende questi passi con le pagine intere del Master. */
export function isClubMasterStep(step: OnboardingStep, role: string) {
  return role === "club_admin" && CLUB_STEPS.includes(step);
}

type ClubOnboardingFlowProps = {
  counter: { current: number; label: string; total: number };
  form: OnboardingFormState;
  isBusy: boolean;
  onBack: () => void;
  onClearValidationErrors: (fields: string[]) => void;
  onContinueFromContacts: () => void;
  onContinueFromFirstTeam: () => void;
  onContinueFromIdentity: () => void;
  onContinueFromRepresentative: () => void;
  onContinueFromStructure: () => void;
  onContinueFromYouth: () => void;
  onCityChange: (value: string) => void;
  onCitySelect: (value: ItalianCityOption) => void;
  onFormattedNameBlur: (field: "firstName" | "lastName") => void;
  onPatchForm: (patch: Partial<OnboardingFormState>) => void;
  onPickLogoFromLibrary: () => void;
  onSubmitProfile: () => void;
  onTakeLogoPhoto: () => void;
  socialColors: string[];
  onSocialColorsChange: (values: string[]) => void;
  step: OnboardingStep;
  validationErrors: OnboardingValidationErrors;
};

/**
 * Instrada i passi della Società sulle pagine del Master (REV-ONB-05).
 *
 * La Società non ha un proprio sistema di onboarding: pagina, header,
 * progress, campi, selector e CTA sono quelli di REV-ONB-01. Qui si decide
 * solo quale schermata mostrare per il ramo scelto; navigazione, validazione
 * e salvataggio restano della rotta.
 */
export function ClubOnboardingFlow({
  counter,
  form,
  isBusy,
  onBack,
  onCityChange,
  onCitySelect,
  onClearValidationErrors,
  onContinueFromContacts,
  onContinueFromFirstTeam,
  onContinueFromIdentity,
  onContinueFromRepresentative,
  onContinueFromStructure,
  onContinueFromYouth,
  onFormattedNameBlur,
  onPatchForm,
  onPickLogoFromLibrary,
  onSocialColorsChange,
  onSubmitProfile,
  onTakeLogoPhoto,
  socialColors,
  step,
  validationErrors,
}: ClubOnboardingFlowProps) {
  function updateField(field: keyof OnboardingFormState, value: string) {
    onPatchForm({ [field]: value });
    onClearValidationErrors([String(field)]);
  }

  if (step === "club_representative") {
    return (
      <ClubRepresentativeStep
        currentStep={counter.current}
        email={form.repEmail}
        firstName={form.firstName}
        isBusy={isBusy}
        lastName={form.lastName}
        onBack={onBack}
        onContinue={onContinueFromRepresentative}
        onFieldChange={(field, value) => {
          if (field === "repPhoneCountryCode") {
            onPatchForm({ repPhoneCountryCode: value });
            onClearValidationErrors(["repPhone"]);
            return;
          }

          if (field === "repPhone") {
            onPatchForm({ repPhone: value });
            onClearValidationErrors(["repPhone"]);
            return;
          }

          updateField(field, value);
        }}
        onFormattedNameBlur={onFormattedNameBlur}
        phoneCountryCode={form.repPhoneCountryCode}
        phoneNumber={form.repPhone}
        stepLabel={counter.label}
        totalSteps={counter.total}
        validationErrors={validationErrors}
      />
    );
  }

  if (step === "club_data") {
    return (
      <ClubIdentityStep
        currentStep={counter.current}
        foundingYear={form.clubFoundingYear}
        isBusy={isBusy}
        isUploadingLogo={form.uploadingField === "clubLogo"}
        logoUrl={form.clubLogoUrl}
        name={form.clubName}
        onBack={onBack}
        onColorsChange={onSocialColorsChange}
        onContinue={onContinueFromIdentity}
        onFieldChange={updateField}
        onNameBlur={() => onPatchForm({ clubName: form.clubName.trim() })}
        onPickLogoFromLibrary={onPickLogoFromLibrary}
        onRemoveLogo={() => onPatchForm({ clubLogoUrl: "" })}
        onTakeLogoPhoto={onTakeLogoPhoto}
        selectedColors={socialColors}
        stepLabel={counter.label}
        totalSteps={counter.total}
        validationErrors={validationErrors}
      />
    );
  }

  if (step === "club_structure") {
    return (
      <ClubStructureStep
        currentStep={counter.current}
        errorMessage={validationErrors.clubStructure}
        isBusy={isBusy}
        onBack={onBack}
        onContinue={onContinueFromStructure}
        onSelect={(structure: ClubStructure) => {
          if (structure && structure !== form.clubStructure) {
            trackClubOnboardingEvent({
              name: "society_structure_selected",
              structure,
            });
          }

          // §T: cambiando configurazione i dati che la nuova struttura non
          // prevede smettono di essere attributi del club.
          onPatchForm(buildClubStructurePatch(structure));
          onClearValidationErrors([
            "clubStructure",
            "clubCategory",
            "clubYouthCategories",
          ]);
        }}
        stepLabel={counter.label}
        totalSteps={counter.total}
        value={form.clubStructure}
      />
    );
  }

  if (step === "club_first_team") {
    return (
      <ClubFirstTeamStep
        currentStep={counter.current}
        errorMessage={validationErrors.clubCategory}
        isBusy={isBusy}
        onBack={onBack}
        onChange={(value) => {
          if (value) {
            trackClubOnboardingEvent({
              category: value,
              name: "first_team_category_selected",
            });
          }

          updateField("clubCategory", value);
        }}
        onContinue={onContinueFromFirstTeam}
        stepLabel={counter.label}
        totalSteps={counter.total}
        value={form.clubCategory}
      />
    );
  }

  if (step === "club_youth") {
    return (
      <ClubYouthStep
        currentStep={counter.current}
        errorMessage={validationErrors.clubYouthCategories}
        isBusy={isBusy}
        onBack={onBack}
        onChange={(values) => {
          onPatchForm({ clubYouthCategories: values });
          onClearValidationErrors(["clubYouthCategories"]);
        }}
        onContinue={onContinueFromYouth}
        selectedCategories={form.clubYouthCategories}
        stepLabel={counter.label}
        totalSteps={counter.total}
      />
    );
  }

  if (step === "club_contacts") {
    return (
      <ClubContactsStep
        address={form.clubHeadquartersAddress}
        city={form.clubCity}
        currentStep={counter.current}
        email={form.clubEmail}
        isBusy={isBusy}
        onBack={onBack}
        onCityChange={onCityChange}
        onCitySelect={onCitySelect}
        onContinue={onContinueFromContacts}
        onFieldChange={(field, value) => {
          if (field === "clubPhone" || field === "clubPhoneCountryCode") {
            onPatchForm({ [field]: value });
            onClearValidationErrors(["clubPhone"]);
            return;
          }

          updateField(field, value);
        }}
        phoneCountryCode={form.clubPhoneCountryCode}
        phoneNumber={form.clubPhone}
        region={form.clubRegion}
        stepLabel={counter.label}
        totalSteps={counter.total}
        validationErrors={validationErrors}
      />
    );
  }

  return (
    <ClubProfileStep
      currentStep={counter.current}
      form={form}
      isBusy={isBusy}
      onBack={onBack}
      onFieldChange={updateField}
      onSubmit={onSubmitProfile}
      stepLabel={counter.label}
      totalSteps={counter.total}
    />
  );
}
