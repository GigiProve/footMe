import {
  composePhoneNumber,
  isPhoneNumberValid,
  splitPhoneNumber,
  validateProfileBio,
} from "../profiles/profile-form-utils";
import type { PlayerExperienceForm, PlayerPosition, PreferredFoot } from "../profiles/player-sports";
import { normalizePlayerPositions } from "../profiles/player-sports";
import type { UploadedMediaItem } from "../profiles/media-upload-service";
import type { AppRole, ProfileGender, StaffSpecialization } from "./onboarding-types";

export type OnboardingStep = "role" | "base" | "decision" | "details" | "complete";

export type OnboardingValidationErrors = Partial<Record<string, string>>;

export type OnboardingFormState = {
  avatarUrl: string;
  bio: string;
  birthDate: string;
  careerEntries: PlayerExperienceForm[];
  clubCategory: string;
  clubCity: string;
  clubDescription: string;
  clubGalleryItems: UploadedMediaItem[];
  clubLeague: string;
  clubLogoUrl: string;
  clubName: string;
  clubRegion: string;
  coachedCategories: string;
  coachedClubs: string;
  coachPreferredRegions: string;
  certifications: string;
  currentStep: OnboardingStep;
  domicile: string;
  experienceSummary: string;
  firstName: string;
  gamePhilosophy: string;
  gender: ProfileGender | "";
  hasCreatedProfile: boolean;
  heightCm: string;
  highlightVideoUrl: string;
  isAvailable: boolean;
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

export const onboardingVisibleSteps: {
  description: string;
  index: number;
  label: string;
  step: Exclude<OnboardingStep, "complete">;
}[] = [
  {
    description: "Seleziona il tipo di profilo da creare",
    index: 1,
    label: "Ruolo",
    step: "role",
  },
  {
    description: "Completa le informazioni essenziali",
    index: 2,
    label: "Dati base",
    step: "base",
  },
  {
    description: "Scegli come proseguire il tuo onboarding",
    index: 3,
    label: "Scelta",
    step: "decision",
  },
  {
    description: "Completa il profilo sportivo",
    index: 4,
    label: "Profilo sportivo",
    step: "details",
  },
];

export const onboardingStepOrder: OnboardingStep[] = [
  "role",
  "base",
  "decision",
  "details",
  "complete",
];

export const defaultOnboardingFormState: OnboardingFormState = {
  avatarUrl: "",
  bio: "",
  birthDate: "",
  careerEntries: [],
  clubCategory: "",
  clubCity: "",
  clubDescription: "",
  clubGalleryItems: [],
  clubLeague: "",
  clubLogoUrl: "",
  clubName: "",
  clubRegion: "",
  coachedCategories: "",
  coachedClubs: "",
  coachPreferredRegions: "",
  certifications: "",
  currentStep: "role",
  domicile: "",
  experienceSummary: "",
  firstName: "",
  gamePhilosophy: "",
  gender: "",
  hasCreatedProfile: false,
  heightCm: "",
  highlightVideoUrl: "",
  isAvailable: false,
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

export function normalizeOnboardingDraft(
  value: Partial<OnboardingFormState> | null | undefined,
): OnboardingFormState {
  if (!value) {
    return defaultOnboardingFormState;
  }

  return {
    ...defaultOnboardingFormState,
    ...value,
    currentStep: coerceOnboardingStep(value.currentStep) ?? defaultOnboardingFormState.currentStep,
    lastCompletedStep:
      coerceOnboardingStep(value.lastCompletedStep) ??
      defaultOnboardingFormState.lastCompletedStep,
    gender: coerceProfileGender(value.gender) ?? defaultOnboardingFormState.gender,
    // Legacy drafts used a single phone string, so when the prefix has not been
    // persisted yet we safely split the stored value to preserve what the user
    // already entered without forcing them to recompile the field.
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
      normalizePlayerPositions(value.secondaryPositions).length > 0
        ? normalizePlayerPositions(value.secondaryPositions)
        : normalizePlayerPositions((value as { secondaryPosition?: unknown }).secondaryPosition),
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

  return onboardingStepOrder.includes(value as OnboardingStep)
    ? (value as OnboardingStep)
    : null;
}

export function getOnboardingStepIndex(step: OnboardingStep) {
  const visibleIndex = onboardingVisibleSteps.findIndex((entry) => entry.step === step);

  if (visibleIndex >= 0) {
    return visibleIndex;
  }

  return onboardingVisibleSteps.length - 1;
}

export function getOnboardingProgress(step: OnboardingStep) {
  const stepIndex = getOnboardingStepIndex(step);
  const completedSteps = step === "complete" ? onboardingVisibleSteps.length : stepIndex + 1;
  const totalSteps = onboardingVisibleSteps.length;
  const percentage = Math.round((completedSteps / totalSteps) * 100);
  const currentStep =
    step === "complete"
      ? onboardingVisibleSteps[onboardingVisibleSteps.length - 1]
      : onboardingVisibleSteps[stepIndex];

  return {
    currentStep,
    percentage,
    stepIndex,
    totalSteps,
  };
}

export function getNextOnboardingStep(step: OnboardingStep) {
  if (step === "complete") {
    return null;
  }

  return onboardingStepOrder[onboardingStepOrder.indexOf(step) + 1] ?? null;
}

export function getPreviousOnboardingStep(
  step: OnboardingStep,
  lastCompletedStep: OnboardingStep | null = null,
) {
  if (step === "complete") {
    if (lastCompletedStep === "details") {
      return "details";
    }

    return "decision";
  }

  const previousIndex = onboardingStepOrder.indexOf(step) - 1;
  return previousIndex >= 0 ? onboardingStepOrder[previousIndex] : null;
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

  if (step === "details") {
    if (form.role === "player" && !form.primaryPosition) {
      return {
        primaryPosition: "Seleziona il ruolo principale per continuare.",
      };
    }

    const bioValidation = validateProfileBio(form.bio);

    if (!bioValidation.isValid) {
      return {
        bio: bioValidation.message ?? "Inserisci una descrizione valida del tuo profilo.",
      };
    }
  }

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

  // Residence becomes valid only when it comes from a suggestion selection,
  // which also stores the derived region alongside the chosen city name.
  if (form.residence.trim() && !form.residenceRegion.trim()) {
    errors.residence = "Seleziona una città valida dai suggerimenti.";
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
