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
  | "community_profile_type"
  | "base"
  | "photo"
  | "technical"
  | "experience"
  | "fan_basic"
  | "fan_photo"
  | "fan_interests"
  | "media_basic"
  | "media_photo"
  | "media_entity"
  | "media_content"
  | "media_focus"
  | "media_channels"
  | "media_collaborations"
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
  | "director_roles"
  | "director_responsibilities"
  | "director_categories"
  | "director_focus"
  | "director_market"
  | "director_career"
  | "director_football_experience"
  | "director_player_career_toggle"
  | "director_player_career"
  | "director_club_type"
  | "director_extra"
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
  communityProfileType: "fan" | "media" | "";
  fanInterestCategories: string[];
  fanInterestRegions: string[];
  mediaAffiliationName: string;
  mediaAffiliationType: string;
  mediaContentTypes: string[];
  mediaEntityDescription: string;
  mediaEntityName: string;
  mediaFocusAreas: string[];
  mediaFacebook: string;
  mediaInstagram: string;
  mediaLogoUrl: string;
  mediaTikTok: string;
  mediaWebsite: string;
  mediaYouTube: string;
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
  // Director fields
  directorRoles: string[];
  directorPrimaryRole: string;
  directorResponsibilities: string[];
  directorCategories: string[];
  directorMainFocus: string;
  directorMarketInvolvement: string;
  directorCareerEntries: CoachCareerEntry[];
  directorHasOtherFootballExperience: boolean;
  directorOtherFootballRoles: string[];
  directorHasPlayedFootball: boolean;
  directorPlayerCareerEntries: PlayerExperienceForm[];
  directorClubTypes: string[];
  directorLanguages: string[];
  directorBio: string;
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

const fanStepOrder: OnboardingStep[] = [
  "role",
  "community_profile_type",
  "fan_basic",
  "fan_photo",
  "fan_interests",
  "complete",
];

const mediaStepOrder: OnboardingStep[] = [
  "role",
  "community_profile_type",
  "media_basic",
  "media_photo",
  "media_entity",
  "media_content",
  "media_focus",
  "media_channels",
  "media_collaborations",
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

const fanVisibleSteps: OnboardingVisibleStep[] = [
  {
    description: "Scegli tra profilo base e profilo media",
    index: 1,
    label: "Tipo profilo",
    step: "community_profile_type",
  },
  {
    description: "Inserisci i dati personali essenziali",
    index: 2,
    label: "Dati",
    step: "fan_basic",
  },
  {
    description: "Aggiungi una foto profilo",
    index: 3,
    label: "Foto",
    step: "fan_photo",
  },
  {
    description: "Seleziona interessi e regioni che vuoi seguire",
    index: 4,
    label: "Interessi",
    step: "fan_interests",
  },
];

const mediaVisibleSteps: OnboardingVisibleStep[] = [
  {
    description: "Scegli tra profilo base e profilo media",
    index: 1,
    label: "Tipo profilo",
    step: "community_profile_type",
  },
  {
    description: "Inserisci i dati personali essenziali",
    index: 2,
    label: "Dati",
    step: "media_basic",
  },
  {
    description: "Aggiungi una foto profilo",
    index: 3,
    label: "Foto",
    step: "media_photo",
  },
  {
    description: "Configura la tua pagina o realtà editoriale",
    index: 4,
    label: "Pagina",
    step: "media_entity",
  },
  {
    description: "Definisci i contenuti che produci",
    index: 5,
    label: "Contenuti",
    step: "media_content",
  },
  {
    description: "Seleziona l'ambito che segui maggiormente",
    index: 6,
    label: "Ambito",
    step: "media_focus",
  },
  {
    description: "Collega i tuoi canali social e web",
    index: 7,
    label: "Canali",
    step: "media_channels",
  },
  {
    description: "Aggiungi eventuali collaborazioni e riferimenti",
    index: 8,
    label: "Collaborazioni",
    step: "media_collaborations",
  },
];

const directorStepOrder: OnboardingStep[] = [
  "role",
  "base",
  "photo",
  "director_roles",
  "director_responsibilities",
  "director_categories",
  "director_focus",
  "director_market",
  "director_career",
  "director_football_experience",
  "director_player_career_toggle",
  "director_player_career",
  "director_club_type",
  "director_extra",
  "complete",
];

const directorVisibleSteps: OnboardingVisibleStep[] = [
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
    description: "Il tuo ruolo nel calcio",
    index: 4,
    label: "Ruolo",
    step: "director_roles",
  },
  {
    description: "Le tue aree di responsabilità",
    index: 5,
    label: "Responsabilità",
    step: "director_responsibilities",
  },
  {
    description: "Categorie di esperienza",
    index: 6,
    label: "Categorie",
    step: "director_categories",
  },
  {
    description: "Focus principale",
    index: 7,
    label: "Focus",
    step: "director_focus",
  },
  {
    description: "Coinvolgimento nel mercato",
    index: 8,
    label: "Mercato",
    step: "director_market",
  },
  {
    description: "Esperienze dirigenziali",
    index: 9,
    label: "Carriera",
    step: "director_career",
  },
  {
    description: "Altri ruoli nel calcio",
    index: 10,
    label: "Esperienze",
    step: "director_football_experience",
  },
  {
    description: "Carriera da calciatore",
    index: 11,
    label: "Giocatore",
    step: "director_player_career_toggle",
  },
  {
    description: "Tipo di società prevalente",
    index: 12,
    label: "Società",
    step: "director_club_type",
  },
  {
    description: "Bio e lingue",
    index: 13,
    label: "Profilo",
    step: "director_extra",
  },
];

export function getOnboardingVisibleSteps(role: AppRole | ""): OnboardingVisibleStep[] {
  if (role === "club_admin") return clubVisibleSteps;
  if (role === "agent") return agentVisibleSteps;
  if (role === "coach") return coachVisibleSteps;
  if (role === "staff") return staffVisibleSteps;
  if (role === "director") return directorVisibleSteps;
  if (role === "fan") return fanVisibleSteps;
  if (role === "media") return mediaVisibleSteps;
  return defaultVisibleSteps;
}

export function getOnboardingStepOrder(role: AppRole | ""): OnboardingStep[] {
  if (role === "club_admin") return clubStepOrder;
  if (role === "agent") return agentStepOrder;
  if (role === "coach") return coachStepOrder;
  if (role === "staff") return staffStepOrder;
  if (role === "director") return directorStepOrder;
  if (role === "fan") return fanStepOrder;
  if (role === "media") return mediaStepOrder;
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
  communityProfileType: "",
  fanInterestCategories: [],
  fanInterestRegions: [],
  mediaAffiliationName: "",
  mediaAffiliationType: "Nessuna",
  mediaContentTypes: [],
  mediaEntityDescription: "",
  mediaEntityName: "",
  mediaFacebook: "",
  mediaFocusAreas: [],
  mediaInstagram: "",
  mediaLogoUrl: "",
  mediaTikTok: "",
  mediaWebsite: "",
  mediaYouTube: "",
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
  directorRoles: [],
  directorPrimaryRole: "",
  directorResponsibilities: [],
  directorCategories: [],
  directorMainFocus: "",
  directorMarketInvolvement: "",
  directorCareerEntries: [],
  directorHasOtherFootballExperience: false,
  directorOtherFootballRoles: [],
  directorHasPlayedFootball: false,
  directorPlayerCareerEntries: [],
  directorClubTypes: [],
  directorLanguages: [],
  directorBio: "",
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
    communityProfileType:
      value.communityProfileType === "fan" || value.communityProfileType === "media"
        ? value.communityProfileType
        : defaultOnboardingFormState.communityProfileType,
    fanInterestCategories: Array.isArray(value.fanInterestCategories)
      ? value.fanInterestCategories.filter((v): v is string => typeof v === "string")
      : defaultOnboardingFormState.fanInterestCategories,
    fanInterestRegions: Array.isArray(value.fanInterestRegions)
      ? value.fanInterestRegions.filter((v): v is string => typeof v === "string")
      : defaultOnboardingFormState.fanInterestRegions,
    primaryPosition:
      normalizePlayerPositions(value.primaryPosition)[0] ?? defaultOnboardingFormState.primaryPosition,
    residenceRegion:
      typeof value.residenceRegion === "string" ? value.residenceRegion : defaultOnboardingFormState.residenceRegion,
    role: coerceAppRole(value.role) ?? defaultOnboardingFormState.role,
    mediaAffiliationName:
      typeof value.mediaAffiliationName === "string"
        ? value.mediaAffiliationName
        : defaultOnboardingFormState.mediaAffiliationName,
    mediaAffiliationType:
      typeof value.mediaAffiliationType === "string"
        ? value.mediaAffiliationType
        : defaultOnboardingFormState.mediaAffiliationType,
    mediaContentTypes: Array.isArray(value.mediaContentTypes)
      ? value.mediaContentTypes.filter((v): v is string => typeof v === "string")
      : defaultOnboardingFormState.mediaContentTypes,
    mediaEntityDescription:
      typeof value.mediaEntityDescription === "string"
        ? value.mediaEntityDescription
        : defaultOnboardingFormState.mediaEntityDescription,
    mediaEntityName:
      typeof value.mediaEntityName === "string"
        ? value.mediaEntityName
        : defaultOnboardingFormState.mediaEntityName,
    mediaFacebook:
      typeof value.mediaFacebook === "string"
        ? value.mediaFacebook
        : defaultOnboardingFormState.mediaFacebook,
    mediaFocusAreas: Array.isArray(value.mediaFocusAreas)
      ? value.mediaFocusAreas.filter((v): v is string => typeof v === "string")
      : defaultOnboardingFormState.mediaFocusAreas,
    mediaInstagram:
      typeof value.mediaInstagram === "string"
        ? value.mediaInstagram
        : defaultOnboardingFormState.mediaInstagram,
    mediaLogoUrl:
      typeof value.mediaLogoUrl === "string"
        ? value.mediaLogoUrl
        : defaultOnboardingFormState.mediaLogoUrl,
    mediaTikTok:
      typeof value.mediaTikTok === "string"
        ? value.mediaTikTok
        : defaultOnboardingFormState.mediaTikTok,
    mediaWebsite:
      typeof value.mediaWebsite === "string"
        ? value.mediaWebsite
        : defaultOnboardingFormState.mediaWebsite,
    mediaYouTube:
      typeof value.mediaYouTube === "string"
        ? value.mediaYouTube
        : defaultOnboardingFormState.mediaYouTube,
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
    directorRoles: Array.isArray(value.directorRoles)
      ? value.directorRoles.filter((v): v is string => typeof v === "string")
      : defaultOnboardingFormState.directorRoles,
    directorResponsibilities: Array.isArray(value.directorResponsibilities)
      ? value.directorResponsibilities.filter((v): v is string => typeof v === "string")
      : defaultOnboardingFormState.directorResponsibilities,
    directorCategories: Array.isArray(value.directorCategories)
      ? value.directorCategories.filter((v): v is string => typeof v === "string")
      : defaultOnboardingFormState.directorCategories,
    directorCareerEntries: Array.isArray(value.directorCareerEntries)
      ? value.directorCareerEntries
      : defaultOnboardingFormState.directorCareerEntries,
    directorHasOtherFootballExperience: value.directorHasOtherFootballExperience === true,
    directorOtherFootballRoles: Array.isArray(value.directorOtherFootballRoles)
      ? value.directorOtherFootballRoles.filter((v): v is string => typeof v === "string")
      : defaultOnboardingFormState.directorOtherFootballRoles,
    directorHasPlayedFootball: value.directorHasPlayedFootball === true,
    directorPlayerCareerEntries: Array.isArray(value.directorPlayerCareerEntries)
      ? value.directorPlayerCareerEntries
      : defaultOnboardingFormState.directorPlayerCareerEntries,
    directorClubTypes: Array.isArray(value.directorClubTypes)
      ? value.directorClubTypes.filter((v): v is string => typeof v === "string")
      : defaultOnboardingFormState.directorClubTypes,
    directorLanguages: Array.isArray(value.directorLanguages)
      ? value.directorLanguages.filter((v): v is string => typeof v === "string")
      : defaultOnboardingFormState.directorLanguages,
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
    value === "director" ||
    value === "fan" ||
    value === "media"
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
    "role", "community_profile_type", "base", "photo", "technical", "experience",
    "fan_basic", "fan_photo", "fan_interests",
    "media_basic", "media_photo", "media_entity", "media_content", "media_focus",
    "media_channels", "media_collaborations",
    "agent_agency", "agent_players", "agent_football_experience",
    "agent_player_career_toggle", "agent_player_career", "agent_portfolio",
    "agent_availability", "agent_verification", "agent_extra",
    "club_representative", "club_data", "club_youth", "club_profile",
    "coach_role", "coach_career", "staff_role", "staff_availability", "staff_career",
    "staff_player_career_toggle", "staff_player_career",
    "player_career_toggle", "player_career", "coach_extra",
    "director_roles", "director_responsibilities", "director_categories",
    "director_focus", "director_market", "director_career",
    "director_football_experience", "director_player_career_toggle",
    "director_player_career", "director_club_type", "director_extra",
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

  if (role === "director" && effectiveStep === "director_player_career") {
    comparableStep = "director_player_career_toggle";
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
    if (role === "fan") return "fan_interests";
    if (role === "media") return "media_collaborations";
    if (role === "staff") {
      return _lastCompletedStep === "staff_player_career"
        ? "staff_player_career"
        : "staff_player_career_toggle";
    }
    if (role === "director") return "director_extra";
    return "experience";
  }

  if (role === "agent" && effectiveStep === "agent_portfolio") {
    return _lastCompletedStep === "agent_player_career"
      ? "agent_player_career"
      : "agent_player_career_toggle";
  }

  if (role === "director" && effectiveStep === "director_club_type") {
    return _lastCompletedStep === "director_player_career"
      ? "director_player_career"
      : "director_player_career_toggle";
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

  if (step === "community_profile_type") {
    return mapCommunityProfileTypeValidationError(form);
  }

  if (step === "fan_basic" || step === "media_basic") {
    return mapSimpleCommunityBasicValidationError(form);
  }

  if (step === "fan_interests") {
    return mapFanInterestsValidationError(form);
  }

  if (step === "media_entity") {
    return mapMediaEntityValidationError(form);
  }

  if (step === "media_content") {
    return mapMediaContentValidationError(form);
  }

  if (step === "media_focus") {
    return mapMediaFocusValidationError(form);
  }

  if (step === "media_collaborations") {
    return mapMediaCollaborationsValidationError(form);
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

  if (step === "director_roles") {
    return mapDirectorRolesValidationError(form);
  }
  if (step === "director_responsibilities") {
    return mapDirectorResponsibilitiesValidationError(form);
  }
  if (step === "director_categories") {
    return mapDirectorCategoriesValidationError(form);
  }
  if (step === "director_focus") {
    return mapDirectorFocusValidationError(form);
  }
  if (step === "director_market") {
    return mapDirectorMarketValidationError(form);
  }
  if (step === "director_football_experience") {
    return mapDirectorFootballExperienceValidationError(form);
  }
  if (step === "director_club_type") {
    return mapDirectorClubTypeValidationError(form);
  }

  // director career, toggle, player career, extra → no required validation
  if (
    step === "director_career" ||
    step === "director_player_career_toggle" ||
    step === "director_player_career" ||
    step === "director_extra" ||
    step === "fan_photo" ||
    step === "media_photo" ||
    step === "media_channels"
  ) {
    return {};
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

function mapCommunityProfileTypeValidationError(
  form: OnboardingFormState,
): OnboardingValidationErrors {
  if (form.communityProfileType === "fan" || form.communityProfileType === "media") {
    return {};
  }

  return {
    communityProfileType: "Seleziona il tipo di profilo per continuare.",
  };
}

function mapSimpleCommunityBasicValidationError(
  form: OnboardingFormState,
): OnboardingValidationErrors {
  const errors: OnboardingValidationErrors = {};

  if (!form.firstName.trim()) {
    errors.firstName = "Questo campo è obbligatorio";
  }

  if (!form.lastName.trim()) {
    errors.lastName = "Questo campo è obbligatorio";
  }

  if (!form.birthDate.trim()) {
    errors.birthDate = "Questo campo è obbligatorio";
  }

  return errors;
}

function mapFanInterestsValidationError(
  form: OnboardingFormState,
): OnboardingValidationErrors {
  const errors: OnboardingValidationErrors = {};

  if (form.fanInterestCategories.length === 0) {
    errors.fanInterestCategories = "Seleziona almeno una categoria di interesse.";
  }

  if (form.fanInterestRegions.length === 0) {
    errors.fanInterestRegions = "Seleziona almeno una regione di interesse.";
  }

  return errors;
}

function mapMediaEntityValidationError(
  form: OnboardingFormState,
): OnboardingValidationErrors {
  if (form.mediaEntityName.trim()) {
    return {};
  }

  return {
    mediaEntityName: "Inserisci il nome della tua pagina, testata o realtà.",
  };
}

function mapMediaContentValidationError(
  form: OnboardingFormState,
): OnboardingValidationErrors {
  if (form.mediaContentTypes.length > 0) {
    return {};
  }

  return {
    mediaContentTypes: "Seleziona almeno un tipo di contenuto.",
  };
}

function mapMediaFocusValidationError(
  form: OnboardingFormState,
): OnboardingValidationErrors {
  if (form.mediaFocusAreas.length > 0) {
    return {};
  }

  return {
    mediaFocusAreas: "Seleziona almeno un ambito principale.",
  };
}

function mapMediaCollaborationsValidationError(
  form: OnboardingFormState,
): OnboardingValidationErrors {
  if (
    form.mediaAffiliationType &&
    form.mediaAffiliationType !== "Nessuna" &&
    !form.mediaAffiliationName.trim()
  ) {
    return {
      mediaAffiliationName: "Inserisci il nome del riferimento collegato.",
    };
  }

  return {};
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

  if (form.role !== "agent" && form.role !== "director" && !form.gender) {
    errors.gender = "Questo campo è obbligatorio";
  }

  if (!form.birthDate.trim()) {
    errors.birthDate = "Questo campo è obbligatorio";
  }

  if ((form.role === "agent" || form.role === "director") && !form.nationality.trim()) {
    errors.nationality = "Questo campo è obbligatorio";
  }

  if ((form.role === "agent" || form.role === "director") && !form.residence.trim()) {
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

function mapDirectorRolesValidationError(form: OnboardingFormState): OnboardingValidationErrors {
  if (form.directorRoles.length === 0) {
    return { directorRoles: "Seleziona almeno un ruolo per continuare." };
  }
  if (form.directorRoles.length > 1 && !form.directorPrimaryRole) {
    return { directorPrimaryRole: "Seleziona il ruolo principale per continuare." };
  }
  return {};
}

function mapDirectorResponsibilitiesValidationError(form: OnboardingFormState): OnboardingValidationErrors {
  if (form.directorResponsibilities.length === 0) {
    return { directorResponsibilities: "Seleziona almeno una responsabilità per continuare." };
  }
  return {};
}

function mapDirectorCategoriesValidationError(form: OnboardingFormState): OnboardingValidationErrors {
  if (form.directorCategories.length === 0) {
    return { directorCategories: "Seleziona almeno una categoria per continuare." };
  }
  return {};
}

function mapDirectorFocusValidationError(form: OnboardingFormState): OnboardingValidationErrors {
  if (!form.directorMainFocus) {
    return { directorMainFocus: "Seleziona il focus principale per continuare." };
  }
  return {};
}

function mapDirectorMarketValidationError(form: OnboardingFormState): OnboardingValidationErrors {
  if (!form.directorMarketInvolvement) {
    return { directorMarketInvolvement: "Seleziona una risposta per continuare." };
  }
  return {};
}

function mapDirectorFootballExperienceValidationError(form: OnboardingFormState): OnboardingValidationErrors {
  if (form.directorHasOtherFootballExperience && form.directorOtherFootballRoles.length === 0) {
    return { directorOtherFootballRoles: "Seleziona almeno un'esperienza calcistica." };
  }
  return {};
}

function mapDirectorClubTypeValidationError(form: OnboardingFormState): OnboardingValidationErrors {
  if (form.directorClubTypes.length === 0) {
    return { directorClubTypes: "Seleziona almeno un tipo di società per continuare." };
  }
  return {};
}
