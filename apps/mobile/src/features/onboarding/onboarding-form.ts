import { validateProfileBio } from "../profiles/profile-form-utils";
import type { PlayerExperienceForm, PlayerPosition, PreferredFoot } from "../profiles/player-sports";
import { DEFAULT_PLAYER_PRIMARY_POSITION } from "../profiles/player-sports";
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
  gender: ProfileGender;
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
  phoneNumber: string;
  playerMediaItems: UploadedMediaItem[];
  preferredCategories: string;
  preferredFoot: PreferredFoot | "";
  primaryPosition: PlayerPosition;
  residence: string;
  role: AppRole;
  secondaryPosition: PlayerPosition | "";
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
  gender: "male",
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
  phoneNumber: "",
  playerMediaItems: [],
  preferredCategories: "",
  preferredFoot: "",
  primaryPosition: DEFAULT_PLAYER_PRIMARY_POSITION,
  residence: "",
  role: "player",
  secondaryPosition: "",
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
    uploadingField: null,
  };
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
  if (step === "base") {
    return mapBaseStepValidationError(form);
  }

  if (step === "details") {
    const bioValidation = validateProfileBio(form.bio);

    if (!bioValidation.isValid) {
      return {
        bio: bioValidation.message ?? "Inserisci una descrizione valida del tuo profilo.",
      };
    }
  }

  return {};
}

function mapBaseStepValidationError(form: OnboardingFormState): OnboardingValidationErrors {
  const errors: OnboardingValidationErrors = {};

  if (!form.firstName.trim()) {
    errors.firstName = "Inserisci il nome.";
  }

  if (!form.lastName.trim()) {
    errors.lastName = "Inserisci il cognome.";
  }

  if (!form.birthDate.trim()) {
    errors.birthDate = "Seleziona la data di nascita.";
  }

  if (!form.nationality.trim()) {
    errors.nationality = "Seleziona la nazionalita'.";
  }

  if (!form.residence.trim()) {
    errors.residence = "Inserisci la residenza.";
  }

  if (!getEffectiveDomicile(form).trim()) {
    errors.domicile = "Inserisci il domicilio.";
  }

  if (form.role === "club_admin") {
    if (!form.clubName.trim()) {
      errors.clubName = "Inserisci il nome della societa'.";
    }

    if (!form.clubCity.trim()) {
      errors.clubCity = "Inserisci la citta' della societa'.";
    }

    if (!form.clubRegion.trim()) {
      errors.clubRegion = "Seleziona la regione della societa'.";
    }
  }

  return errors;
}
