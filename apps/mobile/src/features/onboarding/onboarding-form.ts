import {
  composePhoneNumber,
  isPhoneNumberValid,
  splitPhoneNumber,
} from "../profiles/profile-form-utils";
import type { PlayerExperienceForm, PlayerPosition, PreferredFoot } from "../profiles/player-sports";
import { normalizePlayerPositions } from "../profiles/player-sports";
import type { UploadedMediaItem } from "../profiles/media-upload-service";
import type { AppRole, ProfileGender, StaffSpecialization } from "./onboarding-types";

export type OnboardingStep =
  | "role"
  | "base"
  | "photo"
  | "technical"
  | "experience"
  | "club"
  | "complete"
  // Legacy steps kept for draft migration
  | "decision"
  | "details";

export type OnboardingValidationErrors = Partial<Record<string, string>>;

export type OnboardingFormState = {
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
  clubFieldAddress: string;
  clubFoundingYear: string;
  clubGalleryItems: UploadedMediaItem[];
  clubHeadquartersAddress: string;
  clubLeague: string;
  clubLogoUrl: string;
  clubName: string;
  clubPhone: string;
  clubPhoneCountryCode: string;
  clubRegion: string;
  clubWebsite: string;
  coachedCategories: string;
  coachedClubs: string;
  coachPreferredRegions: string;
  certifications: string;
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
  residence: string;
  residenceRegion: string;
  role: AppRole | "";
  secondaryPositions: PlayerPosition[];
  staffPreferredRegions: string;
  staffSpecialization: StaffSpecialization;
  technicalVideoUrl: string;
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
  step: Exclude<OnboardingStep, "complete" | "decision" | "details">;
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
    description: "Inserisci i dati della tua societa'",
    index: 2,
    label: "Il tuo club",
    step: "club",
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

const clubStepOrder: OnboardingStep[] = [
  "role",
  "club",
  "complete",
];

export function getOnboardingVisibleSteps(role: AppRole | ""): OnboardingVisibleStep[] {
  return role === "club_admin" ? clubVisibleSteps : defaultVisibleSteps;
}

export function getOnboardingStepOrder(role: AppRole | ""): OnboardingStep[] {
  return role === "club_admin" ? clubStepOrder : defaultStepOrder;
}

/** @deprecated Use getOnboardingVisibleSteps(role) instead */
export const onboardingVisibleSteps = defaultVisibleSteps;

/** @deprecated Use getOnboardingStepOrder(role) instead */
export const onboardingStepOrder = defaultStepOrder;

export const defaultOnboardingFormState: OnboardingFormState = {
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
  clubFieldAddress: "",
  clubFoundingYear: "",
  clubGalleryItems: [],
  clubHeadquartersAddress: "",
  clubLeague: "",
  clubLogoUrl: "",
  clubName: "",
  clubPhone: "",
  clubPhoneCountryCode: "+39",
  clubRegion: "",
  clubWebsite: "",
  coachedCategories: "",
  coachedClubs: "",
  coachPreferredRegions: "",
  certifications: "",
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
  residence: "",
  residenceRegion: "",
  role: "",
  secondaryPositions: [],
  staffPreferredRegions: "",
  staffSpecialization: "fitness_coach",
  technicalVideoUrl: "",
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
    "club", "complete",
    // Legacy steps for draft migration
    "decision", "details",
  ];
  return allSteps.includes(value as OnboardingStep)
    ? (value as OnboardingStep)
    : null;
}

export function getOnboardingStepIndex(step: OnboardingStep, role: AppRole | "" = "") {
  const visibleSteps = getOnboardingVisibleSteps(role);
  const effectiveStep = migrateLegacyStep(step);
  const visibleIndex = visibleSteps.findIndex((entry) => entry.step === effectiveStep);

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
    if (role === "club_admin") {
      return "club";
    }
    return "experience";
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

  if (step === "club") {
    return mapClubStepValidationError(form);
  }

  if (step === "technical" || step === "details") {
    if (form.role === "player" && !form.primaryPosition) {
      return {
        primaryPosition: "Seleziona il ruolo principale per continuare.",
      };
    }
  }

  // photo and experience steps have no required validation
  return {};
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

function mapClubStepValidationError(form: OnboardingFormState): OnboardingValidationErrors {
  const errors: OnboardingValidationErrors = {};

  if (!form.firstName.trim()) {
    errors.firstName = "Questo campo è obbligatorio";
  }

  if (!form.lastName.trim()) {
    errors.lastName = "Questo campo è obbligatorio";
  }

  if (!form.clubName.trim()) {
    errors.clubName = "Questo campo è obbligatorio";
  }

  if (!form.clubCity.trim()) {
    errors.clubCity = "Questo campo è obbligatorio";
  }

  if (!form.clubRegion.trim()) {
    errors.clubRegion = "Questo campo è obbligatorio";
  }

  if (!form.clubEmail.trim()) {
    errors.clubEmail = "Questo campo è obbligatorio";
  } else if (!isBasicEmailFormat(form.clubEmail.trim())) {
    errors.clubEmail = "Inserisci un indirizzo email valido.";
  }

  if (form.clubFoundingYear.trim()) {
    const year = parseInt(form.clubFoundingYear.trim(), 10);
    const currentYear = new Date().getFullYear();

    if (isNaN(year) || year < 1850 || year > currentYear) {
      errors.clubFoundingYear = `Inserisci un anno tra 1850 e ${currentYear}.`;
    }
  }

  if (form.clubWebsite.trim()) {
    const website = form.clubWebsite.trim();

    if (!/^https?:\/\/.+\..+/.test(website) && !/^[a-zA-Z0-9].*\..+/.test(website)) {
      errors.clubWebsite = "Inserisci un indirizzo web valido.";
    }
  }

  if (!form.clubCategory.trim()) {
    errors.clubCategory = "Seleziona la categoria della prima squadra";
  }

  if (form.clubHasYouthSector && form.clubYouthCategories.length === 0) {
    errors.clubYouthCategories = "Seleziona almeno una categoria giovanile";
  }

  const phoneValue = composePhoneNumber(form.clubPhoneCountryCode, form.clubPhone);

  if (phoneValue && !isPhoneNumberValid(phoneValue)) {
    errors.clubPhone = "Inserisci un numero di telefono valido.";
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

  if (!form.gender) {
    errors.gender = "Questo campo è obbligatorio";
  }

  if (!form.birthDate.trim()) {
    errors.birthDate = "Questo campo è obbligatorio";
  }

  if (form.residence.trim() && !form.residenceRegion.trim()) {
    errors.residence = "Seleziona una città valida dai suggerimenti.";
  }

  if (!form.useResidenceForDomicile && form.domicile.trim() && !form.domicileRegion.trim()) {
    errors.domicile = "Seleziona una città valida dai suggerimenti.";
  }

  const phoneValue = composePhoneNumber(form.phoneCountryCode, form.phoneNumber);

  if (phoneValue && !isPhoneNumberValid(phoneValue)) {
    errors.phoneNumber = "Inserisci un numero di cellulare valido.";
  }

  if (form.role === "club_admin") {
    if (!form.clubName.trim()) {
      errors.clubName = "Questo campo è obbligatorio";
    }

    if (!form.clubCity.trim()) {
      errors.clubCity = "Questo campo è obbligatorio";
    }

    if (!form.clubRegion.trim()) {
      errors.clubRegion = "Questo campo è obbligatorio";
    }
  }

  return errors;
}
