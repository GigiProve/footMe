import {
  composePhoneNumber,
  isPhoneNumberValid,
  splitPhoneNumber,
} from "../profiles/profile-form-utils";
import type { PlayerExperienceForm, PlayerPosition, PreferredFoot } from "../profiles/player-sports";
import { normalizePlayerPositions } from "../profiles/player-sports";
import type { UploadedMediaItem } from "../profiles/media-upload-service";
import type {
  AppRole,
  ProfileGender,
  StaffRole,
  StaffSpecialization,
} from "./onboarding-types";
import type { CoachCareerEntry } from "./coach/coach-career-types";

export type OnboardingStep =
  | "role"
  | "base"
  | "photo"
  | "technical"
  | "experience"
  | "agent_agency"
  | "agent_players"
  | "agent_football_experience"
  | "agent_player_career_toggle"
  | "agent_player_career"
  | "agent_portfolio"
  | "agent_availability"
  | "agent_verification"
  | "agent_extra"
  | "club_representative"
  | "club_data"
  | "club_youth"
  | "club_profile"
  | "coach_role"
  | "coach_career"
  | "staff_role"
  | "staff_availability"
  | "staff_career"
  | "staff_player_career_toggle"
  | "staff_player_career"
  | "player_career_toggle"
  | "player_career"
  | "coach_extra"
  | "complete"
  // Legacy steps kept for draft migration
  | "decision"
  | "details"
  | "club";

export type OnboardingValidationErrors = Partial<Record<string, string>>;

export type AvailabilityType = "ITALY" | "REGIONS" | "PROVINCES";

export type OnboardingFormState = {
  agentAgencyLogoUrl: string;
  agentAgencyName: string;
  agentFederation: string;
  agentHasOtherFootballExperience: boolean;
  agentHasPlayedFootball: boolean;
  agentIsFederationLicensed: boolean;
  agentLanguages: string[];
  agentMainPlayerRoles: PlayerPosition[];
  agentManagedPlayersCount: string;
  agentOpenToClubs: boolean;
  agentOpenToPlayers: boolean;
  agentOtherFootballRoles: string[];
  agentPlayerCareerEntries: PlayerExperienceForm[];
  agentPlayerTypes: string[];
  availabilityType: AvailabilityType;
  avatarUrl: string;
  bio: string;
  birthDate: string;
  careerEntries: PlayerExperienceForm[];
  clubCategory: string;
  clubCity: string;
  clubHasYouthSector: boolean;
  clubYouthCategories: string[];
  clubColors: string;
  clubCountry: string;
  clubDescription: string;
  clubEmail: string;
  clubFacebook: string;
  clubFieldAddress: string;
  clubFoundingYear: string;
  clubGalleryItems: UploadedMediaItem[];
  clubHeadquartersAddress: string;
  clubInstagram: string;
  clubLeague: string;
  clubLogoUrl: string;
  clubName: string;
  clubPhone: string;
  clubPhoneCountryCode: string;
  clubRegion: string;
  clubStadium: string;
  clubTotalMembers: string;
  clubWebsite: string;

  coachedCategories: string;
  coachedClubs: string;
  coachPreferredRegions: string;
  certifications: string;
  coachPrimaryRole: string;
  coachLicenseType: string;
  coachCategoriesArray: string[];
  coachAvailableFrom: string;
  coachRegionsArray: string[];
  coachCareerEntries: CoachCareerEntry[];
  hasPlayedFootball: boolean;
  coachPlayerCareerEntries: PlayerExperienceForm[];
  coachFormation: string;
  coachPlayStyle: string;
  coachLanguages: string[];
  currentStep: OnboardingStep;
  domicile: string;
  domicileRegion: string;
  experienceSummary: string;
  firstName: string;
  gamePhilosophy: string;
  gender: ProfileGender | "";
  hasCreatedProfile: boolean;
  heightCm: string;
  highlightVideoUrl: string;
  isOpenToTransfer: boolean;
  lastCompletedStep: OnboardingStep | null;
  lastName: string;
  licenses: string;
  nationality: string;
  openToNewRole: boolean;
  openToWork: boolean;
  phoneCountryCode: string;
  phoneNumber: string;
  playerMediaItems: UploadedMediaItem[];
  preferredCategories: string;
  preferredFoot: PreferredFoot | "";
  primaryPosition: PlayerPosition | "";
  repEmail: string;
  repPhone: string;
  repPhoneCountryCode: string;
  residence: string;
  residenceRegion: string;
  role: AppRole | "";
  secondaryPositions: PlayerPosition[];
  staffAvailabilityType: AvailabilityType;
  staffAvailableFrom: string;
  staffCareerEntries: CoachCareerEntry[];
  staffHasPlayedFootball: boolean;
  staffPlayerCareerEntries: PlayerExperienceForm[];
  staffPrimaryRole: string;
  staffPreferredCategories: string;
  staffPreferredProvinces: string;
  staffPreferredRegions: string;
  staffRoles: StaffRole[];
  staffSpecialization: StaffSpecialization;
  technicalVideoUrl: string;
  transferProvinces: string;
  transferRegions: string;
  uploadingField: string | null;
  useResidenceForDomicile: boolean;
  weightKg: string;
  willingToChangeClub: boolean;
};

export type OnboardingVisibleStep = {
  description: string;
  index: number;
  label: string;
  step: Exclude<OnboardingStep, "complete" | "decision" | "details" | "club">;
};

const defaultVisibleSteps: OnboardingVisibleStep[] = [
  {
    description: "Seleziona il tipo di profilo da creare",
    index: 1,
    label: "Ruolo",
    step: "role",
  },
  {
    description: "Completa le informazioni personali",
    index: 2,
    label: "Dati",
    step: "base",
  },
  {
    description: "Aggiungi una foto al tuo profilo",
    index: 3,
    label: "Foto",
    step: "photo",
  },
  {
    description: "Definisci il tuo profilo tecnico",
    index: 4,
    label: "Tecnico",
    step: "technical",
  },
  {
    description: "Aggiungi le tue esperienze calcistiche",
    index: 5,
    label: "Esperienze",
    step: "experience",
  },
];

const clubVisibleSteps: OnboardingVisibleStep[] = [
  {
    description: "Seleziona il tipo di profilo da creare",
    index: 1,
    label: "Ruolo",
    step: "role",
  },
  {
    description: "Inserisci i dati del responsabile della società",
    index: 2,
    label: "Referente",
    step: "club_representative",
  },
  {
    description: "Aggiungi le informazioni ufficiali del club",
    index: 3,
    label: "Dati società",
    step: "club_data",
  },
  {
    description: "Configura il settore giovanile della società",
    index: 4,
    label: "Settore giovanile",
    step: "club_youth",
  },
  {
    description: "Completa il profilo della società",
    index: 5,
    label: "Profilo",
    step: "club_profile",
  },
];

const agentVisibleSteps: OnboardingVisibleStep[] = [
  {
    description: "Completa i tuoi dati personali",
    index: 1,
    label: "Dati",
    step: "base",
  },
  {
    description: "Aggiungi una foto profilo",
    index: 2,
    label: "Foto",
    step: "photo",
  },
  {
    description: "Configura il profilo professionale",
    index: 3,
    label: "Profilo",
    step: "agent_agency",
  },
  {
    description: "Definisci la tua attivita' principale",
    index: 4,
    label: "Attivita'",
    step: "agent_players",
  },
  {
    description: "Aggiungi le esperienze nel calcio",
    index: 5,
    label: "Esperienze",
    step: "agent_football_experience",
  },
  {
    description: "Indica il portfolio dei calciatori seguiti",
    index: 6,
    label: "Portfolio",
    step: "agent_portfolio",
  },
  {
    description: "Imposta disponibilita' e verifica",
    index: 7,
    label: "Verifica",
    step: "agent_availability",
  },
  {
    description: "Aggiungi i dettagli di verifica",
    index: 8,
    label: "Conferma",
    step: "agent_verification",
  },
];

const defaultStepOrder: OnboardingStep[] = [
  "role",
  "base",
  "photo",
  "technical",
  "experience",
  "complete",
];

const agentStepOrder: OnboardingStep[] = [
  "role",
  "base",
  "photo",
  "agent_agency",
  "agent_players",
  "agent_football_experience",
  "agent_player_career_toggle",
  "agent_player_career",
  "agent_portfolio",
  "agent_availability",
  "agent_verification",
  "agent_extra",
  "complete",
];

const clubStepOrder: OnboardingStep[] = [
  "role",
  "club_representative",
  "club_data",
  "club_youth",
  "club_profile",
  "complete",
];

const coachStepOrder: OnboardingStep[] = [
  "role",
  "base",
  "photo",
  "coach_role",
  "coach_career",
  "player_career_toggle",
  "player_career",
  "coach_extra",
  "complete",
];

const staffStepOrder: OnboardingStep[] = [
  "role",
  "base",
  "photo",
  "staff_role",
  "staff_availability",
  "staff_career",
  "staff_player_career_toggle",
  "staff_player_career",
  "complete",
];

const coachVisibleSteps: OnboardingVisibleStep[] = [
  {
    description: "Seleziona il tipo di profilo da creare",
    index: 1,
    label: "Ruolo",
    step: "role",
  },
  {
    description: "Informazioni personali",
    index: 2,
    label: "Dati",
    step: "base",
  },
  {
    description: "Aggiungi una foto profilo",
    index: 3,
    label: "Foto",
    step: "photo",
  },
  {
    description: "Ruolo e disponibilità",
    index: 4,
    label: "Qualifica",
    step: "coach_role",
  },
  {
    description: "Esperienze da allenatore",
    index: 5,
    label: "Carriera",
    step: "coach_career",
  },
  {
    description: "Carriera in campo",
    index: 6,
    label: "Giocatore",
    step: "player_career_toggle",
  },
  {
    description: "Filosofia e stile di gioco",
    index: 7,
    label: "Profilo",
    step: "coach_extra",
  },
];

const staffVisibleSteps: OnboardingVisibleStep[] = [
  {
    description: "Seleziona il tipo di profilo da creare",
    index: 1,
    label: "Ruolo",
    step: "role",
  },
  {
    description: "Informazioni personali",
    index: 2,
    label: "Dati",
    step: "base",
  },
  {
    description: "Aggiungi una foto profilo",
    index: 3,
    label: "Foto",
    step: "photo",
  },
  {
    description: "Seleziona i tuoi ruoli nello staff",
    index: 4,
    label: "Ruoli",
    step: "staff_role",
  },
  {
    description: "Definisci dove e quando vuoi collaborare",
    index: 5,
    label: "Disponibilità",
    step: "staff_availability",
  },
  {
    description: "Aggiungi le tue esperienze da staff tecnico",
    index: 6,
    label: "Esperienze",
    step: "staff_career",
  },
  {
    description: "Carriera in campo",
    index: 7,
    label: "Giocatore",
    step: "staff_player_career_toggle",
  },
];

export function getOnboardingVisibleSteps(role: AppRole | ""): OnboardingVisibleStep[] {
  if (role === "club_admin") return clubVisibleSteps;
  if (role === "agent") return agentVisibleSteps;
  if (role === "coach") return coachVisibleSteps;
  if (role === "staff") return staffVisibleSteps;
  return defaultVisibleSteps;
}

export function getOnboardingStepOrder(role: AppRole | ""): OnboardingStep[] {
  if (role === "club_admin") return clubStepOrder;
  if (role === "agent") return agentStepOrder;
  if (role === "coach") return coachStepOrder;
  if (role === "staff") return staffStepOrder;
  return defaultStepOrder;
}

/** @deprecated Use getOnboardingVisibleSteps(role) instead */
export const onboardingVisibleSteps = defaultVisibleSteps;

/** @deprecated Use getOnboardingStepOrder(role) instead */
export const onboardingStepOrder = defaultStepOrder;

export const defaultOnboardingFormState: OnboardingFormState = {
  agentAgencyLogoUrl: "",
  agentAgencyName: "",
  agentFederation: "",
  agentHasOtherFootballExperience: false,
  agentHasPlayedFootball: false,
  agentIsFederationLicensed: false,
  agentLanguages: [],
  agentMainPlayerRoles: [],
  agentManagedPlayersCount: "",
  agentOpenToClubs: true,
  agentOpenToPlayers: true,
  agentOtherFootballRoles: [],
  agentPlayerCareerEntries: [],
  agentPlayerTypes: [],
  availabilityType: "ITALY",
  avatarUrl: "",
  bio: "",
  birthDate: "",
  careerEntries: [],
  clubCategory: "",
  clubCity: "",
  clubHasYouthSector: false,
  clubYouthCategories: [],
  clubColors: "",
  clubCountry: "IT",
  clubDescription: "",
  clubEmail: "",
  clubFacebook: "",
  clubFieldAddress: "",
  clubFoundingYear: "",
  clubGalleryItems: [],
  clubHeadquartersAddress: "",
  clubInstagram: "",
  clubLeague: "",
  clubLogoUrl: "",
  clubName: "",
  clubPhone: "",
  clubPhoneCountryCode: "+39",
  clubRegion: "",
  clubStadium: "",
  clubTotalMembers: "",
  clubWebsite: "",

  coachedCategories: "",
  coachedClubs: "",
  coachPreferredRegions: "",
  certifications: "",
  coachPrimaryRole: "",
  coachLicenseType: "",
  coachCategoriesArray: [],
  coachAvailableFrom: "",
  coachRegionsArray: [],
  coachCareerEntries: [],
  hasPlayedFootball: false,
  coachPlayerCareerEntries: [],
  coachFormation: "",
  coachPlayStyle: "",
  coachLanguages: [],
  currentStep: "role",
  domicile: "",
  domicileRegion: "",
  experienceSummary: "",
  firstName: "",
  gamePhilosophy: "",
  gender: "",
  hasCreatedProfile: false,
  heightCm: "",
  highlightVideoUrl: "",
  isOpenToTransfer: false,
  lastCompletedStep: null,
  lastName: "",
  licenses: "",
  nationality: "",
  openToNewRole: false,
  openToWork: false,
  phoneCountryCode: "+39",
  phoneNumber: "",
  playerMediaItems: [],
  preferredCategories: "",
  preferredFoot: "",
  primaryPosition: "",
  repEmail: "",
  repPhone: "",
  repPhoneCountryCode: "+39",
  residence: "",
  residenceRegion: "",
  role: "",
  secondaryPositions: [],
  staffAvailabilityType: "ITALY",
  staffAvailableFrom: "",
  staffCareerEntries: [],
  staffHasPlayedFootball: false,
  staffPlayerCareerEntries: [],
  staffPrimaryRole: "",
  staffPreferredCategories: "",
  staffPreferredProvinces: "",
  staffPreferredRegions: "",
  staffRoles: [],
  staffSpecialization: "fitness_coach",
  technicalVideoUrl: "",
  transferProvinces: "",
  transferRegions: "",
  uploadingField: null,
  useResidenceForDomicile: true,
  weightKg: "",
  willingToChangeClub: false,
};

/**
 * Maps legacy step names from persisted drafts to current step names.
 * "decision" was removed (flow no longer has a decision step).
 * "details" was renamed to "technical".
 */
function migrateLegacyStep(step: OnboardingStep): OnboardingStep {
  if (step === "decision") return "base";
  if (step === "details") return "technical";
  if (step === "club") return "club_representative";
  return step;
}

export function normalizeOnboardingDraft(
  value: Partial<OnboardingFormState> | null | undefined,
): OnboardingFormState {
  if (!value) {
    return defaultOnboardingFormState;
  }

  const normalizedSecondaryPositions = normalizePlayerPositions(value.secondaryPositions);

  const rawCurrentStep = coerceOnboardingStep(value.currentStep) ?? defaultOnboardingFormState.currentStep;
  const rawLastCompleted = coerceOnboardingStep(value.lastCompletedStep) ?? defaultOnboardingFormState.lastCompletedStep;

  return {
    ...defaultOnboardingFormState,
    ...value,
    availabilityType: coerceAvailabilityType(value.availabilityType) ?? defaultOnboardingFormState.availabilityType,
    currentStep: migrateLegacyStep(rawCurrentStep),
    lastCompletedStep: rawLastCompleted ? migrateLegacyStep(rawLastCompleted) : null,
    gender: coerceProfileGender(value.gender) ?? defaultOnboardingFormState.gender,
    phoneCountryCode:
      typeof value.phoneCountryCode === "string" && value.phoneCountryCode.trim()
        ? value.phoneCountryCode
        : splitPhoneNumber(value.phoneNumber).phoneCountryCode,
    phoneNumber:
      typeof value.phoneCountryCode === "string"
        ? splitPhoneNumber(composePhoneNumber(value.phoneCountryCode, value.phoneNumber)).phoneNumber
        : splitPhoneNumber(value.phoneNumber).phoneNumber,
    primaryPosition:
      normalizePlayerPositions(value.primaryPosition)[0] ?? defaultOnboardingFormState.primaryPosition,
    residenceRegion:
      typeof value.residenceRegion === "string" ? value.residenceRegion : defaultOnboardingFormState.residenceRegion,
    role: coerceAppRole(value.role) ?? defaultOnboardingFormState.role,
    secondaryPositions:
      normalizedSecondaryPositions.length > 0
        ? normalizedSecondaryPositions
        : normalizePlayerPositions((value as { secondaryPosition?: unknown }).secondaryPosition),
    clubHasYouthSector: value.clubHasYouthSector === true,
    clubYouthCategories: Array.isArray(value.clubYouthCategories)
      ? value.clubYouthCategories.filter((v): v is string => typeof v === "string")
      : defaultOnboardingFormState.clubYouthCategories,
    coachCategoriesArray: Array.isArray(value.coachCategoriesArray)
      ? value.coachCategoriesArray.filter((v): v is string => typeof v === "string")
      : defaultOnboardingFormState.coachCategoriesArray,
    coachRegionsArray: Array.isArray(value.coachRegionsArray)
      ? value.coachRegionsArray.filter((v): v is string => typeof v === "string")
      : defaultOnboardingFormState.coachRegionsArray,
    coachCareerEntries: Array.isArray(value.coachCareerEntries)
      ? value.coachCareerEntries
      : defaultOnboardingFormState.coachCareerEntries,
    coachPlayerCareerEntries: Array.isArray(value.coachPlayerCareerEntries)
      ? value.coachPlayerCareerEntries
      : Array.isArray((value as { simplePlayerCareerEntries?: unknown }).simplePlayerCareerEntries)
        ? []
        : defaultOnboardingFormState.coachPlayerCareerEntries,
    coachLanguages: Array.isArray(value.coachLanguages)
      ? value.coachLanguages.filter((v): v is string => typeof v === "string")
      : defaultOnboardingFormState.coachLanguages,
    agentHasOtherFootballExperience: value.agentHasOtherFootballExperience === true,
    agentHasPlayedFootball: value.agentHasPlayedFootball === true,
    agentIsFederationLicensed: value.agentIsFederationLicensed === true,
    agentLanguages: Array.isArray(value.agentLanguages)
      ? value.agentLanguages.filter((v): v is string => typeof v === "string")
      : defaultOnboardingFormState.agentLanguages,
    agentMainPlayerRoles: normalizePlayerPositions(value.agentMainPlayerRoles),
    agentOtherFootballRoles: Array.isArray(value.agentOtherFootballRoles)
      ? value.agentOtherFootballRoles.filter((v): v is string => typeof v === "string")
      : defaultOnboardingFormState.agentOtherFootballRoles,
    agentPlayerCareerEntries: Array.isArray(value.agentPlayerCareerEntries)
      ? value.agentPlayerCareerEntries
      : defaultOnboardingFormState.agentPlayerCareerEntries,
    agentPlayerTypes: Array.isArray(value.agentPlayerTypes)
      ? value.agentPlayerTypes.filter((v): v is string => typeof v === "string")
      : defaultOnboardingFormState.agentPlayerTypes,
    hasPlayedFootball: value.hasPlayedFootball === true,
    staffCareerEntries: Array.isArray(value.staffCareerEntries)
      ? value.staffCareerEntries
      : defaultOnboardingFormState.staffCareerEntries,
    staffHasPlayedFootball: value.staffHasPlayedFootball === true,
    staffPlayerCareerEntries: Array.isArray(value.staffPlayerCareerEntries)
      ? value.staffPlayerCareerEntries
      : defaultOnboardingFormState.staffPlayerCareerEntries,
    staffAvailabilityType:
      coerceAvailabilityType(value.staffAvailabilityType) ??
      defaultOnboardingFormState.staffAvailabilityType,
    staffAvailableFrom:
      typeof value.staffAvailableFrom === "string"
        ? value.staffAvailableFrom
        : defaultOnboardingFormState.staffAvailableFrom,
    staffPrimaryRole:
      typeof value.staffPrimaryRole === "string"
        ? value.staffPrimaryRole
        : defaultOnboardingFormState.staffPrimaryRole,
    staffPreferredCategories:
      typeof value.staffPreferredCategories === "string"
        ? value.staffPreferredCategories
        : defaultOnboardingFormState.staffPreferredCategories,
    staffRoles: Array.isArray(value.staffRoles)
      ? value.staffRoles.filter((v): v is StaffRole => typeof v === "string")
      : defaultOnboardingFormState.staffRoles,
    staffPreferredProvinces:
      typeof value.staffPreferredProvinces === "string"
        ? value.staffPreferredProvinces
        : defaultOnboardingFormState.staffPreferredProvinces,
    uploadingField: null,
  };
}

export function coerceAppRole(value: unknown): AppRole | null {
  if (
    value === "player" ||
    value === "coach" ||
    value === "staff" ||
    value === "club_admin" ||
    value === "agent" ||
    value === "director"
  ) {
    return value;
  }

  return null;
}

export function coerceAvailabilityType(value: unknown): AvailabilityType | null {
  if (value === "ITALY" || value === "REGIONS" || value === "PROVINCES") {
    return value;
  }
  return null;
}

export function coerceProfileGender(value: unknown): ProfileGender | null {
  if (
    value === "male" ||
    value === "female" ||
    value === "non_binary" ||
    value === "prefer_not_to_say"
  ) {
    return value;
  }

  return null;
}

export function coerceOnboardingStep(value: unknown): OnboardingStep | null {
  if (typeof value !== "string") {
    return null;
  }

  const allSteps: OnboardingStep[] = [
    "role", "base", "photo", "technical", "experience",
    "agent_agency", "agent_players", "agent_football_experience",
    "agent_player_career_toggle", "agent_player_career", "agent_portfolio",
    "agent_availability", "agent_verification", "agent_extra",
    "club_representative", "club_data", "club_youth", "club_profile",
    "coach_role", "coach_career", "staff_role", "staff_availability", "staff_career",
    "staff_player_career_toggle", "staff_player_career",
    "player_career_toggle", "player_career", "coach_extra",
    "complete",
    // Legacy steps for draft migration
    "decision", "details", "club",
  ];
  return allSteps.includes(value as OnboardingStep)
    ? (value as OnboardingStep)
    : null;
}

export function getOnboardingStepIndex(step: OnboardingStep, role: AppRole | "" = "") {
  const visibleSteps = getOnboardingVisibleSteps(role);
  const effectiveStep = migrateLegacyStep(step);
  let comparableStep = effectiveStep;

  if (role === "coach" && effectiveStep === "player_career") {
    comparableStep = "player_career_toggle";
  }

  if (role === "staff" && effectiveStep === "staff_player_career") {
    comparableStep = "staff_player_career_toggle";
  }

  if (
    role === "agent" &&
    (effectiveStep === "agent_player_career_toggle" ||
      effectiveStep === "agent_player_career")
  ) {
    comparableStep = "agent_football_experience";
  }

  if (role === "agent" && effectiveStep === "agent_extra") {
    comparableStep = "agent_verification";
  }

  const visibleIndex = visibleSteps.findIndex((entry) => entry.step === comparableStep);

  if (visibleIndex >= 0) {
    return visibleIndex;
  }

  return visibleSteps.length - 1;
}

export function getOnboardingProgress(step: OnboardingStep, role: AppRole | "" = "") {
  const visibleSteps = getOnboardingVisibleSteps(role);
  const effectiveStep = migrateLegacyStep(step);
  const stepIndex = getOnboardingStepIndex(effectiveStep, role);
  const completedSteps = effectiveStep === "complete" ? visibleSteps.length : stepIndex + 1;
  const totalSteps = visibleSteps.length;
  const percentage = Math.round((completedSteps / totalSteps) * 100);
  const currentStep =
    effectiveStep === "complete"
      ? visibleSteps[visibleSteps.length - 1]
      : visibleSteps[stepIndex];

  return {
    currentStep,
    percentage,
    stepIndex,
    totalSteps,
  };
}

export function getNextOnboardingStep(step: OnboardingStep, role: AppRole | "" = "") {
  if (step === "complete") {
    return null;
  }

  const stepOrder = getOnboardingStepOrder(role);
  const effectiveStep = migrateLegacyStep(step);
  return stepOrder[stepOrder.indexOf(effectiveStep) + 1] ?? null;
}

export function getPreviousOnboardingStep(
  step: OnboardingStep,
  _lastCompletedStep: OnboardingStep | null = null,
  role: AppRole | "" = "",
) {
  const stepOrder = getOnboardingStepOrder(role);
  const effectiveStep = migrateLegacyStep(step);

  if (effectiveStep === "complete") {
    if (role === "club_admin") return "club_profile";
    if (role === "agent") return "agent_extra";
    if (role === "coach") return "coach_extra";
    if (role === "staff") {
      return _lastCompletedStep === "staff_player_career"
        ? "staff_player_career"
        : "staff_player_career_toggle";
    }
    return "experience";
  }

  if (role === "agent" && effectiveStep === "agent_portfolio") {
    return _lastCompletedStep === "agent_player_career"
      ? "agent_player_career"
      : "agent_player_career_toggle";
  }

  const previousIndex = stepOrder.indexOf(effectiveStep) - 1;
  return previousIndex >= 0 ? stepOrder[previousIndex] : null;
}

export function getOnboardingFullName(form: OnboardingFormState) {
  return [form.firstName.trim(), form.lastName.trim()].filter(Boolean).join(" ");
}

export function getEffectiveDomicile(form: OnboardingFormState) {
  return form.useResidenceForDomicile ? form.residence : form.domicile;
}

export function validateOnboardingStep(
  step: OnboardingStep,
  form: OnboardingFormState,
): OnboardingValidationErrors {
  if (step === "role") {
    return mapRoleStepValidationError(form);
  }

  if (step === "base") {
    return mapBaseStepValidationError(form);
  }

  if (step === "club_representative") {
    return mapClubRepresentativeValidationError(form);
  }

  if (step === "club_data") {
    return mapClubDataValidationError(form);
  }

  if (step === "club_youth") {
    return mapClubYouthValidationError(form);
  }

  if (step === "club_profile") {
    return {};
  }

  if (step === "coach_role") {
    return mapCoachRoleValidationError(form);
  }

  if (step === "agent_agency") {
    return mapAgentAgencyValidationError(form);
  }

  if (step === "agent_players") {
    return mapAgentPlayersValidationError(form);
  }

  if (step === "agent_football_experience") {
    return mapAgentFootballExperienceValidationError(form);
  }

  if (step === "agent_portfolio") {
    return mapAgentPortfolioValidationError(form);
  }

  if (step === "agent_availability") {
    return mapAgentAvailabilityValidationError(form);
  }

  if (step === "agent_verification") {
    return mapAgentVerificationValidationError(form);
  }

  if (step === "staff_role") {
    return mapStaffRoleValidationError(form);
  }

  if (step === "staff_availability") {
    return mapStaffAvailabilityValidationError(form);
  }

  // career toggle/list steps have no required validation here
  if (
    step === "coach_career" ||
    step === "staff_career" ||
    step === "staff_player_career_toggle" ||
    step === "staff_player_career" ||
    step === "agent_player_career_toggle" ||
    step === "agent_player_career" ||
    step === "agent_extra" ||
    step === "player_career_toggle" ||
    step === "player_career" ||
    step === "coach_extra"
  ) {
    return {};
  }

  if (step === "technical" || step === "details") {
    return mapTechnicalStepValidationError(form);
  }

  // photo and experience steps have no required validation
  return {};
}

function fromDelimitedString(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function mapTechnicalStepValidationError(form: OnboardingFormState): OnboardingValidationErrors {
  const errors: OnboardingValidationErrors = {};

  if (form.role === "player" && !form.primaryPosition) {
    errors.primaryPosition = "Seleziona il ruolo principale per continuare.";
  }

  if (form.isOpenToTransfer) {
    if (form.availabilityType === "REGIONS" && fromDelimitedString(form.transferRegions).length === 0) {
      errors.transferRegions = "Seleziona almeno una regione.";
    }

    if (form.availabilityType === "PROVINCES" && fromDelimitedString(form.transferProvinces).length === 0) {
      errors.transferProvinces = "Seleziona almeno una provincia.";
    }

    if (fromDelimitedString(form.preferredCategories).length === 0) {
      errors.preferredCategories = "Seleziona almeno una categoria.";
    }
  }

  return errors;
}

function mapRoleStepValidationError(form: OnboardingFormState): OnboardingValidationErrors {
  if (form.role) {
    return {};
  }

  return {
    role: "Seleziona un ruolo per continuare.",
  };
}

function isBasicEmailFormat(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function mapClubRepresentativeValidationError(form: OnboardingFormState): OnboardingValidationErrors {
  const errors: OnboardingValidationErrors = {};

  if (!form.firstName.trim()) {
    errors.firstName = "Questo campo è obbligatorio";
  }

  if (!form.lastName.trim()) {
    errors.lastName = "Questo campo è obbligatorio";
  }

  if (!form.repEmail.trim()) {
    errors.repEmail = "Questo campo è obbligatorio";
  } else if (!isBasicEmailFormat(form.repEmail.trim())) {
    errors.repEmail = "Inserisci un indirizzo email valido.";
  }

  const repPhoneValue = composePhoneNumber(form.repPhoneCountryCode, form.repPhone);

  if (repPhoneValue && !isPhoneNumberValid(repPhoneValue)) {
    errors.repPhone = "Inserisci un numero di telefono valido.";
  }

  return errors;
}

function mapClubDataValidationError(form: OnboardingFormState): OnboardingValidationErrors {
  const errors: OnboardingValidationErrors = {};

  if (!form.clubName.trim()) {
    errors.clubName = "Questo campo è obbligatorio";
  }

  if (!form.clubCategory.trim()) {
    errors.clubCategory = "Seleziona la categoria della prima squadra";
  }

  if (!form.clubCity.trim()) {
    errors.clubCity = "Questo campo è obbligatorio";
  }

  if (!form.clubRegion.trim()) {
    errors.clubRegion = "Questo campo è obbligatorio";
  }

  if (form.clubFoundingYear.trim()) {
    const year = parseInt(form.clubFoundingYear.trim(), 10);
    const currentYear = new Date().getFullYear();

    if (isNaN(year) || year < 1850 || year > currentYear) {
      errors.clubFoundingYear = `Inserisci un anno tra 1850 e ${currentYear}.`;
    }
  }

  if (form.clubEmail.trim() && !isBasicEmailFormat(form.clubEmail.trim())) {
    errors.clubEmail = "Inserisci un indirizzo email valido.";
  }

  const phoneValue = composePhoneNumber(form.clubPhoneCountryCode, form.clubPhone);

  if (phoneValue && !isPhoneNumberValid(phoneValue)) {
    errors.clubPhone = "Inserisci un numero di telefono valido.";
  }

  return errors;
}

function mapClubYouthValidationError(form: OnboardingFormState): OnboardingValidationErrors {
  const errors: OnboardingValidationErrors = {};

  if (form.clubHasYouthSector && form.clubYouthCategories.length === 0) {
    errors.clubYouthCategories = "Seleziona almeno una categoria giovanile";
  }

  return errors;
}

function mapCoachRoleValidationError(form: OnboardingFormState): OnboardingValidationErrors {
  if (!form.coachPrimaryRole) {
    return { coachPrimaryRole: "Seleziona il ruolo principale per continuare." };
  }
  return {};
}

function mapStaffRoleValidationError(form: OnboardingFormState): OnboardingValidationErrors {
  if (form.staffRoles.length === 0) {
    return { staffRoles: "Seleziona almeno un ruolo per continuare." };
  }

  if (form.staffRoles.length > 1 && !form.staffPrimaryRole) {
    return {
      staffPrimaryRole: "Seleziona il ruolo principale per continuare.",
    };
  }

  if (
    form.staffPrimaryRole &&
    !form.staffRoles.includes(form.staffPrimaryRole as StaffRole)
  ) {
    return {
      staffPrimaryRole: "Il ruolo principale deve appartenere ai ruoli selezionati.",
    };
  }

  return {};
}

function mapStaffAvailabilityValidationError(
  form: OnboardingFormState,
): OnboardingValidationErrors {
  const errors: OnboardingValidationErrors = {};

  if (!form.openToWork) {
    return errors;
  }

  if (!form.staffAvailableFrom) {
    errors.staffAvailableFrom = "Seleziona da quando sei disponibile.";
  }

  if (
    form.staffAvailabilityType === "REGIONS" &&
    fromDelimitedString(form.staffPreferredRegions).length === 0
  ) {
    errors.staffPreferredRegions = "Seleziona almeno una regione.";
  }

  if (
    form.staffAvailabilityType === "PROVINCES" &&
    fromDelimitedString(form.staffPreferredProvinces).length === 0
  ) {
    errors.staffPreferredProvinces = "Seleziona almeno una provincia.";
  }

  if (fromDelimitedString(form.staffPreferredCategories).length === 0) {
    errors.staffPreferredCategories = "Seleziona almeno una categoria.";
  }

  return errors;
}

function mapBaseStepValidationError(form: OnboardingFormState): OnboardingValidationErrors {
  const errors: OnboardingValidationErrors = {};

  if (!form.firstName.trim()) {
    errors.firstName = "Questo campo è obbligatorio";
  }

  if (!form.lastName.trim()) {
    errors.lastName = "Questo campo è obbligatorio";
  }

  if (form.role !== "agent" && !form.gender) {
    errors.gender = "Questo campo è obbligatorio";
  }

  if (!form.birthDate.trim()) {
    errors.birthDate = "Questo campo è obbligatorio";
  }

  if (form.role === "agent" && !form.nationality.trim()) {
    errors.nationality = "Questo campo è obbligatorio";
  }

  if (form.role === "agent" && !form.residence.trim()) {
    errors.residence = "Questo campo è obbligatorio";
  }

  if (form.residence.trim() && !form.residenceRegion.trim()) {
    errors.residence = "Seleziona una città valida dai suggerimenti.";
  }

  if (
    form.role !== "agent" &&
    !form.useResidenceForDomicile &&
    form.domicile.trim() &&
    !form.domicileRegion.trim()
  ) {
    errors.domicile = "Seleziona una città valida dai suggerimenti.";
  }

  const phoneValue = composePhoneNumber(form.phoneCountryCode, form.phoneNumber);

  if (form.role === "agent" && !form.phoneNumber.trim()) {
    errors.phoneNumber = "Questo campo è obbligatorio";
  }

  if (phoneValue && !isPhoneNumberValid(phoneValue)) {
    errors.phoneNumber = "Inserisci un numero di cellulare valido.";
  }

  return errors;
}

function mapAgentAgencyValidationError(
  form: OnboardingFormState,
): OnboardingValidationErrors {
  if (!form.agentAgencyName.trim()) {
    return {
      agentAgencyName: "Inserisci il nome dell'agenzia o dello studio.",
    };
  }

  return {};
}

function mapAgentPlayersValidationError(
  form: OnboardingFormState,
): OnboardingValidationErrors {
  if (!form.agentManagedPlayersCount) {
    return {
      agentManagedPlayersCount: "Seleziona la fascia di calciatori seguiti.",
    };
  }

  return {};
}

function mapAgentFootballExperienceValidationError(
  form: OnboardingFormState,
): OnboardingValidationErrors {
  if (
    form.agentHasOtherFootballExperience &&
    form.agentOtherFootballRoles.length === 0
  ) {
    return {
      agentOtherFootballRoles: "Seleziona almeno un'esperienza calcistica.",
    };
  }

  return {};
}

function mapAgentPortfolioValidationError(
  form: OnboardingFormState,
): OnboardingValidationErrors {
  const errors: OnboardingValidationErrors = {};

  if (form.agentPlayerTypes.length === 0) {
    errors.agentPlayerTypes = "Seleziona almeno un profilo di calciatore.";
  }

  if (form.agentMainPlayerRoles.length === 0) {
    errors.agentMainPlayerRoles = "Seleziona almeno un ruolo principale.";
  }

  return errors;
}

function mapAgentAvailabilityValidationError(
  form: OnboardingFormState,
): OnboardingValidationErrors {
  if (!form.agentOpenToClubs && !form.agentOpenToPlayers) {
    return {
      agentAvailability: "Attiva almeno un canale di contatto.",
    };
  }

  return {};
}

function mapAgentVerificationValidationError(
  form: OnboardingFormState,
): OnboardingValidationErrors {
  if (form.agentIsFederationLicensed && !form.agentFederation.trim()) {
    return {
      agentFederation: "Inserisci la federazione di riferimento.",
    };
  }

  return {};
}
