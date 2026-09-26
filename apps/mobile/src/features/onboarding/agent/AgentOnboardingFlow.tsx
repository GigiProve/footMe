import type {
  AgentManagedPlayerEntryDraft,
  AgentPlayerCandidate,
} from "../../profiles/agent-profile";
import type {
  PlayerExperienceForm,
  TeamAutocompleteOption,
} from "../../profiles/player-sports";
import {
  fromDelimitedString,
  toDelimitedString,
} from "../../profiles/profile-edit-helpers";
import type {
  OnboardingFormState,
  OnboardingStep,
  OnboardingValidationErrors,
} from "../onboarding-form";
import type { ProfileGender } from "../onboarding-types";
import { PlayerCareerStep } from "../player/PlayerCareerStep";
import { PlayerPersonalDataStep } from "../player/PlayerPersonalDataStep";
import { PlayerPhotoStep } from "../player/PlayerPhotoStep";

import { AgentActivityStep } from "./AgentActivityStep";
import {
  resolveAgentOperatingArea,
  type AgentOperatingAreaDraft,
} from "./agent-operating-area";
import { AgentContactPreferencesStep } from "./AgentContactPreferencesStep";
import { AgentPortfolioStep } from "./AgentPortfolioStep";
import { AgentPresentationStep } from "./AgentPresentationStep";
import { AgentPreviousExperiencesStep } from "./AgentPreviousExperiencesStep";
import { AgentProfessionalStep } from "./AgentProfessionalStep";
import { AgentQualificationStep } from "./AgentQualificationStep";
import { trackAgentOnboardingEvent } from "./agent-onboarding-analytics";
import {
  buildAgentPreviousRolesPatch,
  readAgentPreviousRoles,
  type AgentPreviousRole,
} from "./agent-previous-roles";
import type {
  AgentActivityScope,
  AgentPortfolioRange,
  AgentProfessionalMode,
} from "./agent-taxonomy";
import { toLegacyManagedPlayersCount } from "./agent-taxonomy";

/** Passi che appartengono solo al ramo Procuratore. */
const AGENT_ONLY_STEPS: OnboardingStep[] = [
  "agent_professional",
  "agent_qualification",
  "agent_portfolio",
  "agent_activity",
  "agent_previous_experiences",
  "agent_player_career",
  "agent_contact_preferences",
  "agent_presentation",
];

/** Passi condivisi con gli altri ruoli, resi con le pagine comuni (§D, §E, §G). */
const AGENT_SHARED_STEPS: OnboardingStep[] = ["base", "photo"];

/** Il Procuratore rende questi passi con le pagine intere del Master. */
export function isAgentMasterStep(step: OnboardingStep, role: string) {
  if (role !== "agent") {
    return false;
  }

  return AGENT_ONLY_STEPS.includes(step) || AGENT_SHARED_STEPS.includes(step);
}

type CitySelection = { name: string; region: string };

type AgentOnboardingFlowProps = {
  counter: { current: number; label: string; total: number };
  form: OnboardingFormState;
  isBusy: boolean;
  nationalityCategory: "italy" | "eu" | "non_eu" | "unknown";
  onBack: () => void;
  onClearValidationErrors: (fields: string[]) => void;
  onContinueFromActivity: () => void;
  onContinueFromContactPreferences: () => void;
  onContinueFromPersonalData: () => void;
  onContinueFromPhoto: () => void;
  onContinueFromPlayerCareer: () => void;
  onContinueFromPortfolio: () => void;
  onContinueFromPreviousExperiences: () => void;
  onContinueFromProfessional: () => void;
  onContinueFromQualification: () => void;
  onDomicileChange: (value: string) => void;
  onDomicileSelect: (value: CitySelection) => void;
  onDomicileToggle: (value: boolean) => void;
  onFinish: () => void;
  onFormattedNameBlur: (field: "firstName" | "lastName") => void;
  onNationalityChange: (value: string) => void;
  onPatchForm: (patch: Partial<OnboardingFormState>) => void;
  onPickLogoFromLibrary: () => void;
  onPickPhotoFromLibrary: () => void;
  onRegisterBack: (handler: (() => void) | null) => void;
  onRemoveLogo: () => void;
  onRemovePhoto: () => void;
  onResidenceChange: (value: string) => void;
  onResidenceSelect: (value: CitySelection) => void;
  onTakeLogoPhoto: () => void;
  onTakePhoto: () => void;
  photoPreviewUrl: string | null;
  searchPlayers: (query: string) => Promise<AgentPlayerCandidate[]>;
  searchTeams: (query: string) => Promise<TeamAutocompleteOption[]>;
  step: OnboardingStep;
  validationErrors: OnboardingValidationErrors;
};

/**
 * Instrada i passi del Procuratore sulle pagine del Master (REV-ONB-06).
 *
 * Il Procuratore non ha un proprio sistema di onboarding: scelta profilo,
 * dati personali e foto sono le pagine comuni (§D, §E, §G) e la carriera da
 * calciatore, quando dichiarata, è integralmente quella di REV-ONB-02 (§AN).
 * Qui si decide soltanto quale schermata mostrare e come i campi del form si
 * mappano sui componenti; navigazione, validazione e salvataggio restano
 * della rotta.
 */
export function AgentOnboardingFlow({
  counter,
  form,
  isBusy,
  nationalityCategory,
  onBack,
  onClearValidationErrors,
  onContinueFromActivity,
  onContinueFromContactPreferences,
  onContinueFromPersonalData,
  onContinueFromPhoto,
  onContinueFromPlayerCareer,
  onContinueFromPortfolio,
  onContinueFromPreviousExperiences,
  onContinueFromProfessional,
  onContinueFromQualification,
  onDomicileChange,
  onDomicileSelect,
  onDomicileToggle,
  onFinish,
  onFormattedNameBlur,
  onNationalityChange,
  onPatchForm,
  onPickLogoFromLibrary,
  onPickPhotoFromLibrary,
  onRegisterBack,
  onRemoveLogo,
  onRemovePhoto,
  onResidenceChange,
  onResidenceSelect,
  onTakeLogoPhoto,
  onTakePhoto,
  photoPreviewUrl,
  searchPlayers,
  searchTeams,
  step,
  validationErrors,
}: AgentOnboardingFlowProps) {
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

  if (step === "agent_professional") {
    return (
      <AgentProfessionalStep
        agencyLogoUrl={form.agentAgencyLogoUrl}
        agencyName={form.agentAgencyName}
        agencyRole={form.agentAgencyRole}
        agencyStartYear={form.agentAgencyStartYear}
        currentStep={counter.current}
        isBusy={isBusy}
        isUploadingLogo={form.uploadingField === "agent-agency-logo"}
        mode={form.agentProfessionalMode}
        onAgencyNameChange={(value) => {
          onPatchForm({ agentAgencyName: value });
          onClearValidationErrors(["agentAgencyName"]);
        }}
        onAgencyRoleChange={(value) => {
          onPatchForm({ agentAgencyRole: value });
          onClearValidationErrors(["agentAgencyRole"]);
        }}
        onAgencyStartYearChange={(value) => {
          onPatchForm({ agentAgencyStartYear: value });
          onClearValidationErrors(["agentAgencyStartYear"]);
        }}
        onBack={onBack}
        onContinue={onContinueFromProfessional}
        onModeChange={(mode: Exclude<AgentProfessionalMode, "">) => {
          trackAgentOnboardingEvent({
            mode,
            name: "professional_mode_selected",
          });
          // §I: scegliere "Indipendente" non lascia in giro dati di agenzia
          // che l'utente non ha più modo di vedere o correggere.
          onPatchForm(
            mode === "independent"
              ? {
                  agentAgencyLogoUrl: "",
                  agentAgencyName: "",
                  agentAgencyRole: "",
                  agentAgencyStartYear: "",
                  agentProfessionalMode: mode,
                }
              : { agentProfessionalMode: mode },
          );
          onClearValidationErrors([
            "agentProfessionalMode",
            "agentAgencyName",
            "agentAgencyRole",
            "agentAgencyStartYear",
          ]);
        }}
        onPickLogoFromLibrary={onPickLogoFromLibrary}
        onRemoveLogo={onRemoveLogo}
        onTakeLogoPhoto={onTakeLogoPhoto}
        stepLabel={counter.label}
        totalSteps={counter.total}
        validationErrors={validationErrors}
      />
    );
  }

  if (step === "agent_qualification") {
    return (
      <AgentQualificationStep
        currentStep={counter.current}
        federation={form.agentFederation}
        isBusy={isBusy}
        isLicensed={form.agentIsFederationLicensed}
        licenseNumber={form.agentLicenseNumber}
        onBack={onBack}
        onContinue={onContinueFromQualification}
        onFederationChange={(value) => {
          onPatchForm({ agentFederation: value });
          onClearValidationErrors(["agentFederation"]);
        }}
        onLicenseNumberChange={(value) =>
          onPatchForm({ agentLicenseNumber: value })
        }
        onLicensedChange={(value) => {
          trackAgentOnboardingEvent({
            licensed: value,
            name: "qualification_state_selected",
          });
          // §O: spegnere il controllo nasconde il dettaglio e lo azzera, così
          // non resta salvata una licenza che l'utente non dichiara più.
          onPatchForm(
            value
              ? { agentIsFederationLicensed: true }
              : {
                  agentFederation: "",
                  agentIsFederationLicensed: false,
                  agentLicenseNumber: "",
                },
          );
          onClearValidationErrors(["agentFederation"]);
        }}
        stepLabel={counter.label}
        totalSteps={counter.total}
        validationErrors={validationErrors}
      />
    );
  }

  if (step === "agent_portfolio") {
    return (
      <AgentPortfolioStep
        currentStep={counter.current}
        isBusy={isBusy}
        managedPlayerEntries={form.agentManagedPlayerEntries}
        onBack={onBack}
        onContinue={onContinueFromPortfolio}
        onManagedPlayerEntriesChange={(
          entries: AgentManagedPlayerEntryDraft[],
        ) => onPatchForm({ agentManagedPlayerEntries: entries })}
        onPlayerLinked={(count) =>
          trackAgentOnboardingEvent({ count, name: "portfolio_player_linked" })
        }
        onRangeChange={(range: Exclude<AgentPortfolioRange, "">) => {
          trackAgentOnboardingEvent({ name: "portfolio_range_selected", range });
          onPatchForm({
            // §BQ: la colonna legacy continua a leggersi, il dato vero è il
            // range strutturato.
            agentManagedPlayersCount: toLegacyManagedPlayersCount(range) ?? "",
            agentPortfolioRange: range,
          });
          onClearValidationErrors(["agentPortfolioRange"]);
        }}
        range={form.agentPortfolioRange}
        searchPlayers={searchPlayers}
        stepLabel={counter.label}
        totalSteps={counter.total}
        validationErrors={validationErrors}
      />
    );
  }

  if (step === "agent_activity") {
    const draft: AgentOperatingAreaDraft = {
      mode: form.agentOperatingAreaType,
      provinces: fromDelimitedString(form.agentOperatingProvinces),
      regions: fromDelimitedString(form.agentOperatingRegions),
    };

    return (
      <AgentActivityStep
        countries={form.agentOperatingCountries}
        currentStep={counter.current}
        draft={draft}
        isBusy={isBusy}
        onBack={onBack}
        onContinue={onContinueFromActivity}
        onCountriesChange={(values) => {
          trackAgentOnboardingEvent({
            count: values.length,
            name: "international_scope_selected",
          });
          onPatchForm({ agentOperatingCountries: values });
        }}
        onDraftChange={(next) => {
          // §AA: una sola modalità Italia alla volta, mai due zone che
          // possono contraddirsi.
          const active = resolveAgentOperatingArea(next);

          onPatchForm({
            agentOperatingAreaType: next.mode,
            agentOperatingProvinces: toDelimitedString(active.provinces),
            agentOperatingRegions: toDelimitedString(active.regions),
          });
        }}
        onProvincesConfirmed={(count) =>
          trackAgentOnboardingEvent({
            count,
            mode: "PROVINCES",
            name: "geographic_scope_selected",
          })
        }
        onRegionsConfirmed={(count) =>
          trackAgentOnboardingEvent({
            count,
            mode: "REGIONS",
            name: "geographic_scope_selected",
          })
        }
        onRegisterBack={onRegisterBack}
        onScopesChange={(values: AgentActivityScope[]) => {
          trackAgentOnboardingEvent({
            name: "activity_scope_selected",
            scopes: values.join(","),
          });
          onPatchForm({ agentActivityScopes: values });
          onClearValidationErrors(["agentActivityScopes"]);
        }}
        onWorksAbroadChange={(value) =>
          // §AF: spegnere il controllo nasconde i paesi e li azzera.
          onPatchForm(
            value
              ? { agentWorksAbroad: true }
              : { agentOperatingCountries: [], agentWorksAbroad: false },
          )
        }
        scopes={form.agentActivityScopes}
        stepLabel={counter.label}
        totalSteps={counter.total}
        worksAbroad={form.agentWorksAbroad}
      />
    );
  }

  if (step === "agent_previous_experiences") {
    return (
      <AgentPreviousExperiencesStep
        currentStep={counter.current}
        isBusy={isBusy}
        onBack={onBack}
        onChange={(selection: AgentPreviousRole[]) => {
          trackAgentOnboardingEvent({
            name: "previous_roles_selected",
            roles: selection.join(","),
          });
          onPatchForm(buildAgentPreviousRolesPatch(selection));
        }}
        onContinue={onContinueFromPreviousExperiences}
        selection={readAgentPreviousRoles(form)}
        stepLabel={counter.label}
        totalSteps={counter.total}
      />
    );
  }

  if (step === "agent_player_career") {
    // §AN–§AS: si entra nel flusso Calciatore di REV-ONB-02, statistiche
    // comprese. Nessun editor parallelo per il Procuratore.
    return (
      <PlayerCareerStep
        careerEntries={form.agentPlayerCareerEntries}
        currentStep={counter.current}
        isBusy={isBusy}
        onBack={onBack}
        onContinue={onContinueFromPlayerCareer}
        onExperienceAddStarted={() =>
          trackAgentOnboardingEvent({ name: "player_career_started" })
        }
        onRegisterBack={onRegisterBack}
        onUpdateEntries={(entries: PlayerExperienceForm[]) =>
          onPatchForm({ agentPlayerCareerEntries: entries })
        }
        searchTeams={searchTeams}
        stepLabel={counter.label}
        totalSteps={counter.total}
      />
    );
  }

  if (step === "agent_contact_preferences") {
    return (
      <AgentContactPreferencesStep
        currentStep={counter.current}
        isBusy={isBusy}
        onBack={onBack}
        onContinue={onContinueFromContactPreferences}
        onOpenToClubsChange={(value) =>
          onPatchForm({ agentOpenToClubs: value })
        }
        onOpenToPlayersChange={(value) =>
          onPatchForm({ agentOpenToPlayers: value })
        }
        openToClubs={form.agentOpenToClubs}
        openToPlayers={form.agentOpenToPlayers}
        stepLabel={counter.label}
        totalSteps={counter.total}
      />
    );
  }

  return (
    <AgentPresentationStep
      bio={form.bio}
      currentStep={counter.current}
      isBusy={isBusy}
      languages={form.agentLanguages}
      onBack={onBack}
      onBioChange={(value) => onPatchForm({ bio: value })}
      onFinish={onFinish}
      onLanguagesChange={(values) => onPatchForm({ agentLanguages: values })}
      stepLabel={counter.label}
      totalSteps={counter.total}
    />
  );
}
