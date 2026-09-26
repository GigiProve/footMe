import {
  composePhoneNumber,
  getNationalityCategory,
  isPhoneNumberValid,
  splitPhoneNumber,
} from "../profiles/profile-form-utils";
import type {
  AgentCareerEntryDraft,
  AgentManagedPlayerEntryDraft,
} from "../profiles/agent-profile";
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
import {
  AGENT_ACTIVITY_SCOPE_OPTIONS,
  AGENT_PORTFOLIO_RANGE_OPTIONS,
  type AgentActivityScope,
  type AgentPortfolioRange,
  type AgentProfessionalMode,
} from "./agent/agent-taxonomy";
import {
  type ClubStructure,
  clubStructureHasFirstTeam,
  clubStructureHasYouth,
  coerceClubStructure,
  deriveLegacyClubStructure,
} from "./club/club-structure";

/** Token accettati quando si rilegge una bozza salvata. */
const AGENT_ACTIVITY_SCOPE_VALUES = new Set<AgentActivityScope>(
  AGENT_ACTIVITY_SCOPE_OPTIONS.map((option) => option.value),
);

const AGENT_PORTFOLIO_RANGE_VALUES = new Set<AgentPortfolioRange>(
  AGENT_PORTFOLIO_RANGE_OPTIONS.map((option) => option.value),
);

export type OnboardingStep =
  | "role"
  | "community_profile_type"
  | "base"
  | "photo"
  | "technical"
  | "player_availability"
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
  | "agent_professional"
  | "agent_qualification"
  | "agent_portfolio"
  | "agent_activity"
  | "agent_previous_experiences"
  | "agent_player_career"
  | "agent_contact_preferences"
  | "agent_presentation"
  // Passi del vecchio onboarding Agente, tenuti solo per migrare le bozze (§BQ)
  | "agent_agency"
  | "agent_players"
  | "agent_football_experience"
  | "agent_player_career_toggle"
  | "agent_availability"
  | "agent_verification"
  | "agent_extra"
  | "club_representative"
  | "club_data"
  | "club_structure"
  | "club_first_team"
  | "club_youth"
  | "club_contacts"
  | "club_profile"
  | "coach_role"
  | "coach_availability"
  | "coach_career"
  | "staff_role"
  | "staff_availability"
  | "staff_career"
  | "staff_previous_experiences"
  | "staff_coach_career"
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
  | "director_coach_career"
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

export type LegalStatus = "has_permit" | "no_permit" | "pending_permit" | "";

export type OnboardingFormState = {
  agentActivityScopes: AgentActivityScope[];
  agentAgencyLogoUrl: string;
  agentAgencyName: string;
  agentAgencyRole: string;
  agentAgencyStartYear: string;
  agentCareerEntries: AgentCareerEntryDraft[];
  agentFederation: string;
  agentHasNoPreviousExperience: boolean;
  agentHasOtherFootballExperience: boolean;
  agentHasPlayedFootball: boolean;
  agentIsFederationLicensed: boolean;
  agentLanguages: string[];
  agentLicenseNumber: string;
  agentMainPlayerRoles: PlayerPosition[];
  agentManagedPlayersCount: string;
  agentManagedPlayerEntries: AgentManagedPlayerEntryDraft[];
  agentOpenToClubs: boolean;
  agentOpenToPlayers: boolean;
  agentOperatingAreaType: AvailabilityType | "";
  agentOperatingCountries: string[];
  agentOperatingProvinces: string;
  /** Legacy REV-ONB-06 §AE: sostituito dalle aree strutturate, mai riscritto. */
  agentOperationalFocuses: string[];
  /** Legacy REV-ONB-06 §AH: la descrizione vive nella Bio. */
  agentOperationalNote: string;
  agentOtherFootballRoles: string[];
  /** Legacy REV-ONB-06 §AE: Nord/Centro/Sud/Isole non sono più una scelta. */
  agentOperatingMacroAreas: string[];
  agentOperatingRegions: string;
  agentPlayerCareerEntries: PlayerExperienceForm[];
  agentPlayerTypes: string[];
  agentPortfolioRange: AgentPortfolioRange;
  agentPreviousRoles: string[];
  agentProfessionalMode: AgentProfessionalMode;
  agentWorksAbroad: boolean;
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
  /**
   * REV-ONB-05 §BD: com'è fatta davvero la società. È la sorgente unica del
   * ramo condizionale, non una deduzione da `clubCategory`.
   */
  clubStructure: ClubStructure;
  clubTikTok: string;
  clubTotalMembers: string;
  clubWebsite: string;
  clubYouTube: string;

  coachedCategories: string;
  coachedClubs: string;
  coachPreferredRegions: string;
  certifications: string;
  coachPrimaryRole: string;
  coachLicenseType: string;
  coachAvailabilityType: AvailabilityType;
  coachCategoriesArray: string[];
  coachAvailableFrom: string;
  coachProvincesArray: string[];
  coachRegionsArray: string[];
  coachCareerEntries: CoachCareerEntry[];
  hasPlayedFootball: boolean;
  coachPlayerCareerEntries: PlayerExperienceForm[];
  coachFormation: string;
  coachPlayStyle: string;
  coachLanguages: string[];
  currentLocationCity: string;
  currentLocationCountry: string;
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
  legalStatus: LegalStatus;
  licenses: string;
  nationality: string;
  openToNewRole: boolean;
  openToWork: boolean;
  phoneCountryCode: string;
  phoneNumber: string;
  communityProfileType: "fan" | "media" | "";
  fanFavoriteClubId: string | null;
  fanFavoriteTeamName: string;
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
  residenceCity: string;
  residenceCountry: string;
  residenceRegion: string;
  role: AppRole | "";
  secondaryPositions: PlayerPosition[];
  staffAvailabilityType: AvailabilityType;
  staffAvailableFrom: string;
  staffCareerEntries: CoachCareerEntry[];
  /** Carriera da allenatore dichiarata come esperienza precedente (§AH). */
  staffCoachCareerEntries: CoachCareerEntry[];
  staffHasCoachedFootball: boolean;
  /** "Nessuna esperienza aggiuntiva": una risposta esplicita, non un default (§AG). */
  staffHasNoPreviousExperience: boolean;
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
  directorCoachCareerEntries: CoachCareerEntry[];
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
    description: "Dove vuoi giocare e in quali categorie",
    index: 5,
    label: "Disponibilità",
    step: "player_availability",
  },
  {
    description: "Aggiungi le tue esperienze calcistiche",
    index: 6,
    label: "Esperienze",
    step: "experience",
  },
];

/**
 * Passi della Società (REV-ONB-05 §C).
 *
 * Prima squadra e Settore giovanile sono condizionali: l'elenco si costruisce
 * sulla configurazione dichiarata, così non compaiono mai schermate che non
 * riguardano il club che si sta registrando (§S).
 *
 * Finché la struttura non è stata scelta si assume il ramo più lungo — prima
 * squadra più vivaio — perché §AP consente di fissare la progressione una
 * volta nota la configurazione, ma non tollera un contatore che cresce.
 */
function buildClubVisibleSteps(
  structure: ClubStructure,
): OnboardingVisibleStep[] {
  const effective: ClubStructure = structure || "first_team_and_youth";

  const steps: Omit<OnboardingVisibleStep, "index">[] = [
    {
      description: "Seleziona il tipo di profilo da creare",
      label: "Ruolo",
      step: "role",
    },
    {
      description: "I dati di chi gestirà il profilo della società",
      label: "Referente",
      step: "club_representative",
    },
    {
      description: "Le informazioni principali della società",
      label: "Il tuo club",
      step: "club_data",
    },
    {
      description: "La configurazione che rappresenta la società",
      label: "Struttura",
      step: "club_structure",
    },
    ...(clubStructureHasFirstTeam(effective)
      ? [
          {
            description: "Il campionato in cui compete la prima squadra",
            label: "Prima squadra",
            step: "club_first_team" as const,
          },
        ]
      : []),
    ...(clubStructureHasYouth(effective)
      ? [
          {
            description: "Le categorie presenti nel settore giovanile",
            label: "Settore giovanile",
            step: "club_youth" as const,
          },
        ]
      : []),
    {
      description: "I riferimenti ufficiali della società",
      label: "Sede e contatti",
      step: "club_contacts",
    },
    {
      description: "Qualche dettaglio per presentare il club",
      label: "Profilo",
      step: "club_profile",
    },
  ];

  return steps.map((entry, position) => ({ ...entry, index: position + 1 }));
}

function buildClubStepOrder(structure: ClubStructure): OnboardingStep[] {
  return [
    ...buildClubVisibleSteps(structure).map((entry) => entry.step),
    "complete",
  ];
}

/**
 * Passi contati del Procuratore (REV-ONB-06 §BF).
 *
 * La carriera da calciatore è condizionale: condivide la posizione di
 * "Esperienze precedenti" invece di allungare il contatore a metà flusso,
 * così chi non l'ha dichiarata non vede numerazioni che saltano.
 */
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
    description: "Indica come lavori",
    index: 3,
    label: "Profilo",
    step: "agent_professional",
  },
  {
    description: "Indica la tua abilitazione professionale",
    index: 4,
    label: "Abilitazione",
    step: "agent_qualification",
  },
  {
    description: "Definisci la dimensione del portfolio",
    index: 5,
    label: "Portfolio",
    step: "agent_portfolio",
  },
  {
    description: "Scegli mercati e aree operative",
    index: 6,
    label: "Attività",
    step: "agent_activity",
  },
  {
    description: "Indica le esperienze precedenti nel calcio",
    index: 7,
    label: "Esperienze",
    step: "agent_previous_experiences",
  },
  {
    description: "Scegli quali opportunità ricevere",
    index: 8,
    label: "Opportunità",
    step: "agent_contact_preferences",
  },
  {
    description: "Presentati alla community",
    index: 9,
    label: "Presentazione",
    step: "agent_presentation",
  },
];

const defaultStepOrder: OnboardingStep[] = [
  "role",
  "base",
  "photo",
  "technical",
  "player_availability",
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
  "agent_professional",
  "agent_qualification",
  "agent_portfolio",
  "agent_activity",
  "agent_previous_experiences",
  "agent_player_career",
  "agent_contact_preferences",
  "agent_presentation",
  "complete",
];

const coachStepOrder: OnboardingStep[] = [
  "role",
  "base",
  "photo",
  "coach_role",
  "coach_availability",
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
  "staff_previous_experiences",
  "staff_coach_career",
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
    description: "Qualifica e licenza",
    index: 4,
    label: "Qualifica",
    step: "coach_role",
  },
  {
    description: "Disponibilità per una nuova squadra",
    index: 5,
    label: "Disponibilità",
    step: "coach_availability",
  },
  {
    description: "Esperienze da allenatore",
    index: 6,
    label: "Carriera",
    step: "coach_career",
  },
  {
    description: "Carriera in campo",
    index: 7,
    label: "Giocatore",
    step: "player_career_toggle",
  },
  {
    description: "Filosofia e stile di gioco",
    index: 8,
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
    description: "Seleziona i ruoli che hai ricoperto nello staff",
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
  /**
   * §C: i sotto-flussi Allenatore e Calciatore sono opzionali e condividono
   * questo passo nel contatore, che resta così coerente per tutti i percorsi.
   */
  {
    description: "Altre esperienze maturate nel calcio",
    index: 7,
    label: "Precedenti",
    step: "staff_previous_experiences",
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
  "director_coach_career",
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

export function getOnboardingVisibleSteps(
  role: AppRole | "",
  clubStructure: ClubStructure = "",
): OnboardingVisibleStep[] {
  if (role === "club_admin") return buildClubVisibleSteps(clubStructure);
  if (role === "agent") return agentVisibleSteps;
  if (role === "coach") return coachVisibleSteps;
  if (role === "staff") return staffVisibleSteps;
  if (role === "director") return directorVisibleSteps;
  if (role === "fan") return fanVisibleSteps;
  if (role === "media") return mediaVisibleSteps;
  return defaultVisibleSteps;
}

export function getOnboardingStepOrder(
  role: AppRole | "",
  clubStructure: ClubStructure = "",
): OnboardingStep[] {
  if (role === "club_admin") return buildClubStepOrder(clubStructure);
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
  agentActivityScopes: [],
  agentAgencyLogoUrl: "",
  agentAgencyName: "",
  agentAgencyRole: "",
  agentAgencyStartYear: "",
  agentCareerEntries: [],
  agentFederation: "",
  agentHasNoPreviousExperience: false,
  agentHasOtherFootballExperience: false,
  agentHasPlayedFootball: false,
  agentIsFederationLicensed: false,
  agentLanguages: [],
  agentLicenseNumber: "",
  agentMainPlayerRoles: [],
  agentManagedPlayersCount: "",
  agentManagedPlayerEntries: [],
  agentOpenToClubs: true,
  agentOpenToPlayers: true,
  agentOperatingAreaType: "",
  agentOperatingCountries: [],
  agentOperatingProvinces: "",
  agentOperationalFocuses: [],
  agentOperationalNote: "",
  agentOtherFootballRoles: [],
  agentOperatingMacroAreas: [],
  agentOperatingRegions: "",
  agentPlayerCareerEntries: [],
  agentPlayerTypes: [],
  agentPortfolioRange: "",
  agentPreviousRoles: [],
  agentProfessionalMode: "",
  agentWorksAbroad: false,
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
  clubStructure: "",
  clubTikTok: "",
  clubTotalMembers: "",
  clubWebsite: "",
  clubYouTube: "",

  coachedCategories: "",
  coachedClubs: "",
  coachPreferredRegions: "",
  certifications: "",
  coachPrimaryRole: "",
  coachLicenseType: "",
  coachAvailabilityType: "ITALY",
  coachCategoriesArray: [],
  coachAvailableFrom: "",
  coachProvincesArray: [],
  coachRegionsArray: [],
  coachCareerEntries: [],
  hasPlayedFootball: false,
  coachPlayerCareerEntries: [],
  coachFormation: "",
  coachPlayStyle: "",
  coachLanguages: [],
  currentLocationCity: "",
  currentLocationCountry: "",
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
  legalStatus: "",
  licenses: "",
  nationality: "",
  openToNewRole: false,
  openToWork: false,
  phoneCountryCode: "+39",
  phoneNumber: "",
  communityProfileType: "",
  fanFavoriteClubId: null,
  fanFavoriteTeamName: "",
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
  residenceCity: "",
  residenceCountry: "",
  residenceRegion: "",
  role: "",
  secondaryPositions: [],
  staffAvailabilityType: "ITALY",
  staffAvailableFrom: "",
  staffCareerEntries: [],
  staffCoachCareerEntries: [],
  staffHasCoachedFootball: false,
  staffHasNoPreviousExperience: false,
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
  directorCoachCareerEntries: [],
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
  // REV-ONB-04: il bivio "hai giocato?" diventa la multi-selezione §AE.
  if (step === "staff_player_career_toggle") return "staff_previous_experiences";
  /**
   * REV-ONB-06 §BQ: una bozza aperta con il vecchio onboarding Agente
   * riprende dal passo Procuratore che ne raccoglie le stesse informazioni.
   * Il portfolio manuale (§BR) non si perde: rientra dal passo Portfolio.
   */
  if (step === "agent_agency") return "agent_professional";
  if (step === "agent_verification") return "agent_qualification";
  if (step === "agent_players") return "agent_portfolio";
  if (step === "agent_football_experience") return "agent_previous_experiences";
  if (step === "agent_player_career_toggle") return "agent_previous_experiences";
  if (step === "agent_availability") return "agent_contact_preferences";
  if (step === "agent_extra") return "agent_presentation";
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
    /**
     * REV-ONB-05 §BC: una bozza iniziata con il vecchio onboarding non
     * conosce la struttura del club. La ricostruiamo da ciò che aveva già
     * dichiarato, così chi riprende non perde niente e non si ritrova a
     * rispondere due volte alla stessa domanda.
     */
    clubStructure:
      coerceClubStructure(value.clubStructure) ||
      deriveLegacyClubStructure({
        clubCategory: value.clubCategory,
        clubHasYouthSector: value.clubHasYouthSector,
        clubYouthCategories: Array.isArray(value.clubYouthCategories)
          ? value.clubYouthCategories
          : null,
      }),
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
    fanFavoriteClubId:
      typeof value.fanFavoriteClubId === "string" && value.fanFavoriteClubId.trim()
        ? value.fanFavoriteClubId
        : null,
    fanFavoriteTeamName:
      typeof value.fanFavoriteTeamName === "string"
        ? value.fanFavoriteTeamName
        : defaultOnboardingFormState.fanFavoriteTeamName,
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
    coachAvailabilityType:
      coerceAvailabilityType(value.coachAvailabilityType) ??
      defaultOnboardingFormState.coachAvailabilityType,
    coachProvincesArray: Array.isArray(value.coachProvincesArray)
      ? value.coachProvincesArray.filter((v): v is string => typeof v === "string")
      : defaultOnboardingFormState.coachProvincesArray,
    coachRegionsArray: Array.isArray(value.coachRegionsArray)
      ? value.coachRegionsArray.filter((v): v is string => typeof v === "string")
      : defaultOnboardingFormState.coachRegionsArray,
    coachCareerEntries: Array.isArray(value.coachCareerEntries)
      ? value.coachCareerEntries.map((e: CoachCareerEntry) => ({
          ...e,
          seasonDetails: e.seasonDetails ?? {},
        }))
      : defaultOnboardingFormState.coachCareerEntries,
    coachPlayerCareerEntries: Array.isArray(value.coachPlayerCareerEntries)
      ? value.coachPlayerCareerEntries
      : Array.isArray((value as { simplePlayerCareerEntries?: unknown }).simplePlayerCareerEntries)
        ? []
        : defaultOnboardingFormState.coachPlayerCareerEntries,
    coachLanguages: Array.isArray(value.coachLanguages)
      ? value.coachLanguages.filter((v): v is string => typeof v === "string")
      : defaultOnboardingFormState.coachLanguages,
    agentAgencyRole:
      typeof value.agentAgencyRole === "string"
        ? value.agentAgencyRole
        : defaultOnboardingFormState.agentAgencyRole,
    agentAgencyStartYear:
      typeof value.agentAgencyStartYear === "string"
        ? value.agentAgencyStartYear
        : defaultOnboardingFormState.agentAgencyStartYear,
    agentCareerEntries: Array.isArray(value.agentCareerEntries)
      ? value.agentCareerEntries
          .filter((entry): entry is AgentCareerEntryDraft => Boolean(entry && typeof entry === "object"))
          .map((entry) => ({
            agency_logo_url:
              typeof entry.agency_logo_url === "string" ? entry.agency_logo_url : null,
            agency_name: typeof entry.agency_name === "string" ? entry.agency_name : "",
            id:
              typeof entry.id === "string"
                ? entry.id
                : defaultOnboardingFormState.agentCareerEntries[0]?.id ?? "",
            period_end_month:
              typeof entry.period_end_month === "string" ? entry.period_end_month : null,
            period_end_year:
              typeof entry.period_end_year === "number" ? entry.period_end_year : null,
            period_start_month:
              typeof entry.period_start_month === "string" ? entry.period_start_month : null,
            period_start_year:
              typeof entry.period_start_year === "number" ? entry.period_start_year : null,
            role: typeof entry.role === "string" ? entry.role : "",
          }))
      : defaultOnboardingFormState.agentCareerEntries,
    agentActivityScopes: Array.isArray(value.agentActivityScopes)
      ? value.agentActivityScopes.filter((entry): entry is AgentActivityScope =>
          AGENT_ACTIVITY_SCOPE_VALUES.has(entry as AgentActivityScope),
        )
      : defaultOnboardingFormState.agentActivityScopes,
    agentHasNoPreviousExperience: value.agentHasNoPreviousExperience === true,
    agentHasOtherFootballExperience: value.agentHasOtherFootballExperience === true,
    agentHasPlayedFootball: value.agentHasPlayedFootball === true,
    agentIsFederationLicensed: value.agentIsFederationLicensed === true,
    agentLanguages: Array.isArray(value.agentLanguages)
      ? value.agentLanguages.filter((v): v is string => typeof v === "string")
      : defaultOnboardingFormState.agentLanguages,
    agentLicenseNumber:
      typeof value.agentLicenseNumber === "string"
        ? value.agentLicenseNumber
        : defaultOnboardingFormState.agentLicenseNumber,
    agentMainPlayerRoles: normalizePlayerPositions(value.agentMainPlayerRoles),
    agentManagedPlayerEntries: Array.isArray(value.agentManagedPlayerEntries)
      ? value.agentManagedPlayerEntries
          .filter((entry): entry is AgentManagedPlayerEntryDraft => Boolean(entry && typeof entry === "object"))
          .map((entry) => ({
            avatar_url: typeof entry.avatar_url === "string" ? entry.avatar_url : null,
            birth_year: typeof entry.birth_year === "number" ? entry.birth_year : null,
            category_label:
              typeof entry.category_label === "string" ? entry.category_label : null,
            display_name:
              typeof entry.display_name === "string" ? entry.display_name : "",
            id:
              typeof entry.id === "string"
                ? entry.id
                : defaultOnboardingFormState.agentManagedPlayerEntries[0]?.id ?? "",
            is_free_agent: entry.is_free_agent === true,
            linked_profile_id:
              typeof entry.linked_profile_id === "string" ? entry.linked_profile_id : null,
            primary_position: normalizePlayerPositions(entry.primary_position)[0] ?? null,
          }))
      : defaultOnboardingFormState.agentManagedPlayerEntries,
    agentManagedPlayersCount:
      typeof value.agentManagedPlayersCount === "string"
        ? value.agentManagedPlayersCount
        : defaultOnboardingFormState.agentManagedPlayersCount,
    agentOperatingAreaType:
      value.agentOperatingAreaType === "ITALY" ||
      value.agentOperatingAreaType === "REGIONS" ||
      value.agentOperatingAreaType === "PROVINCES"
        ? value.agentOperatingAreaType
        : defaultOnboardingFormState.agentOperatingAreaType,
    agentOperatingCountries: Array.isArray(value.agentOperatingCountries)
      ? value.agentOperatingCountries.filter((v): v is string => typeof v === "string")
      : defaultOnboardingFormState.agentOperatingCountries,
    agentOperatingProvinces:
      typeof value.agentOperatingProvinces === "string"
        ? value.agentOperatingProvinces
        : defaultOnboardingFormState.agentOperatingProvinces,
    agentOperationalFocuses: Array.isArray(value.agentOperationalFocuses)
      ? value.agentOperationalFocuses.filter((v): v is string => typeof v === "string")
      : defaultOnboardingFormState.agentOperationalFocuses,
    agentOperationalNote:
      typeof value.agentOperationalNote === "string"
        ? value.agentOperationalNote
        : defaultOnboardingFormState.agentOperationalNote,
    agentOtherFootballRoles: Array.isArray(value.agentOtherFootballRoles)
      ? value.agentOtherFootballRoles.filter((v): v is string => typeof v === "string")
      : defaultOnboardingFormState.agentOtherFootballRoles,
    agentOperatingMacroAreas: Array.isArray(value.agentOperatingMacroAreas)
      ? value.agentOperatingMacroAreas.filter((v): v is string => typeof v === "string")
      : defaultOnboardingFormState.agentOperatingMacroAreas,
    agentOperatingRegions:
      typeof value.agentOperatingRegions === "string"
        ? value.agentOperatingRegions
        : defaultOnboardingFormState.agentOperatingRegions,
    agentPlayerCareerEntries: Array.isArray(value.agentPlayerCareerEntries)
      ? value.agentPlayerCareerEntries
      : defaultOnboardingFormState.agentPlayerCareerEntries,
    agentPlayerTypes: Array.isArray(value.agentPlayerTypes)
      ? value.agentPlayerTypes.filter((v): v is string => typeof v === "string")
      : defaultOnboardingFormState.agentPlayerTypes,
    agentPortfolioRange: AGENT_PORTFOLIO_RANGE_VALUES.has(
      value.agentPortfolioRange as AgentPortfolioRange,
    )
      ? (value.agentPortfolioRange as AgentPortfolioRange)
      : defaultOnboardingFormState.agentPortfolioRange,
    agentPreviousRoles: Array.isArray(value.agentPreviousRoles)
      ? value.agentPreviousRoles.filter((v): v is string => typeof v === "string")
      : defaultOnboardingFormState.agentPreviousRoles,
    agentProfessionalMode:
      value.agentProfessionalMode === "independent" ||
      value.agentProfessionalMode === "agency"
        ? value.agentProfessionalMode
        : defaultOnboardingFormState.agentProfessionalMode,
    agentWorksAbroad: value.agentWorksAbroad === true,
    hasPlayedFootball: value.hasPlayedFootball === true,
    staffCareerEntries: Array.isArray(value.staffCareerEntries)
      ? (value.staffCareerEntries as CoachCareerEntry[]).map((e) => ({
          ...e,
          seasonDetails: e.seasonDetails ?? {},
        }))
      : defaultOnboardingFormState.staffCareerEntries,
    staffCoachCareerEntries: Array.isArray(value.staffCoachCareerEntries)
      ? (value.staffCoachCareerEntries as CoachCareerEntry[]).map((e) => ({
          ...e,
          seasonDetails: e.seasonDetails ?? {},
        }))
      : defaultOnboardingFormState.staffCoachCareerEntries,
    staffHasCoachedFootball: value.staffHasCoachedFootball === true,
    staffHasNoPreviousExperience: value.staffHasNoPreviousExperience === true,
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
      ? (value.directorCareerEntries as CoachCareerEntry[]).map((e) => ({
          ...e,
          seasonDetails: e.seasonDetails ?? {},
        }))
      : defaultOnboardingFormState.directorCareerEntries,
    directorCoachCareerEntries: Array.isArray(value.directorCoachCareerEntries)
      ? (value.directorCoachCareerEntries as CoachCareerEntry[]).map((e) => ({
          ...e,
          seasonDetails: e.seasonDetails ?? {},
        }))
      : defaultOnboardingFormState.directorCoachCareerEntries,
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
    currentLocationCity:
      typeof value.currentLocationCity === "string"
        ? value.currentLocationCity
        : defaultOnboardingFormState.currentLocationCity,
    currentLocationCountry:
      typeof value.currentLocationCountry === "string"
        ? value.currentLocationCountry
        : defaultOnboardingFormState.currentLocationCountry,
    legalStatus:
      value.legalStatus === "has_permit" ||
      value.legalStatus === "no_permit" ||
      value.legalStatus === "pending_permit"
        ? value.legalStatus
        : defaultOnboardingFormState.legalStatus,
    residenceCity:
      typeof value.residenceCity === "string"
        ? value.residenceCity
        : defaultOnboardingFormState.residenceCity,
    residenceCountry:
      typeof value.residenceCountry === "string"
        ? value.residenceCountry
        : defaultOnboardingFormState.residenceCountry,
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
    "role", "community_profile_type", "base", "photo", "technical", "player_availability", "experience",
    "fan_basic", "fan_photo", "fan_interests",
    "media_basic", "media_photo", "media_entity", "media_content", "media_focus",
    "media_channels", "media_collaborations",
    "agent_professional", "agent_qualification", "agent_portfolio",
    "agent_activity", "agent_previous_experiences", "agent_player_career",
    "agent_contact_preferences", "agent_presentation",
    "agent_agency", "agent_players", "agent_football_experience",
    "agent_player_career_toggle", "agent_availability", "agent_verification",
    "agent_extra",
    "club_representative", "club_data", "club_structure", "club_first_team",
    "club_youth", "club_contacts", "club_profile",
    "coach_role", "coach_availability", "coach_career", "staff_role", "staff_availability", "staff_career",
    "staff_previous_experiences", "staff_coach_career",
    "staff_player_career_toggle", "staff_player_career",
    "player_career_toggle", "player_career", "coach_extra",
    "director_roles", "director_responsibilities", "director_categories",
    "director_focus", "director_market", "director_career",
    "director_football_experience", "director_coach_career", "director_player_career_toggle",
    "director_player_career", "director_club_type", "director_extra",
    "complete",
    // Legacy steps for draft migration
    "decision", "details", "club",
  ];
  return allSteps.includes(value as OnboardingStep)
    ? (value as OnboardingStep)
    : null;
}

export function getOnboardingStepIndex(
  step: OnboardingStep,
  role: AppRole | "" = "",
  clubStructure: ClubStructure = "",
) {
  const visibleSteps = getOnboardingVisibleSteps(role, clubStructure);
  const effectiveStep = migrateLegacyStep(step);
  let comparableStep = effectiveStep;

  if (role === "coach" && effectiveStep === "player_career") {
    comparableStep = "player_career_toggle";
  }

  /**
   * §C: i due sotto-flussi opzionali condividono il passo "Esperienze
   * precedenti", così il contatore non cambia lunghezza a metà navigazione.
   */
  if (
    role === "staff" &&
    (effectiveStep === "staff_coach_career" ||
      effectiveStep === "staff_player_career")
  ) {
    comparableStep = "staff_previous_experiences";
  }

  /**
   * §BF: la carriera da calciatore è condizionale e condivide la posizione
   * di "Esperienze precedenti", così il contatore non cambia lunghezza fra
   * chi la dichiara e chi no.
   */
  if (role === "agent" && effectiveStep === "agent_player_career") {
    comparableStep = "agent_previous_experiences";
  }

  if (role === "director" && effectiveStep === "director_player_career") {
    comparableStep = "director_player_career_toggle";
  }

  if (role === "director" && effectiveStep === "director_coach_career") {
    comparableStep = "director_football_experience";
  }

  const visibleIndex = visibleSteps.findIndex((entry) => entry.step === comparableStep);

  if (visibleIndex >= 0) {
    return visibleIndex;
  }

  return visibleSteps.length - 1;
}

export function getOnboardingProgress(
  step: OnboardingStep,
  role: AppRole | "" = "",
  clubStructure: ClubStructure = "",
) {
  const visibleSteps = getOnboardingVisibleSteps(role, clubStructure);
  const effectiveStep = migrateLegacyStep(step);
  const stepIndex = getOnboardingStepIndex(effectiveStep, role, clubStructure);
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

export function getNextOnboardingStep(
  step: OnboardingStep,
  role: AppRole | "" = "",
  clubStructure: ClubStructure = "",
) {
  if (step === "complete") {
    return null;
  }

  const stepOrder = getOnboardingStepOrder(role, clubStructure);
  const effectiveStep = migrateLegacyStep(step);
  return stepOrder[stepOrder.indexOf(effectiveStep) + 1] ?? null;
}

export function getPreviousOnboardingStep(
  step: OnboardingStep,
  _lastCompletedStep: OnboardingStep | null = null,
  role: AppRole | "" = "",
  clubStructure: ClubStructure = "",
) {
  const stepOrder = getOnboardingStepOrder(role, clubStructure);
  const effectiveStep = migrateLegacyStep(step);

  if (effectiveStep === "complete") {
    if (role === "club_admin") return "club_profile";
    if (role === "agent") return "agent_presentation";
    if (role === "coach") return "coach_extra";
    if (role === "fan") return "fan_interests";
    if (role === "media") return "media_collaborations";
    /**
     * §AJ, §AK: il ritorno indietro deve rientrare nell'ultimo sotto-flusso
     * effettivamente percorso, non in uno che l'utente non ha mai aperto.
     */
    if (role === "staff") {
      if (_lastCompletedStep === "staff_player_career") {
        return "staff_player_career";
      }

      if (_lastCompletedStep === "staff_coach_career") {
        return "staff_coach_career";
      }

      return "staff_previous_experiences";
    }
    if (role === "director") return "director_extra";
    return "experience";
  }

  /**
   * §BG: il Back rientra nel ramo davvero percorso. Chi non ha dichiarato
   * "Calciatore" non deve ritrovarsi dentro la carriera da calciatore.
   */
  if (role === "agent" && effectiveStep === "agent_contact_preferences") {
    return _lastCompletedStep === "agent_player_career"
      ? "agent_player_career"
      : "agent_previous_experiences";
  }

  if (role === "staff" && effectiveStep === "staff_player_career") {
    return _lastCompletedStep === "staff_coach_career"
      ? "staff_coach_career"
      : "staff_previous_experiences";
  }

  if (role === "director" && effectiveStep === "director_club_type") {
    return _lastCompletedStep === "director_player_career"
      ? "director_player_career"
      : "director_player_career_toggle";
  }

  if (role === "director" && effectiveStep === "director_player_career_toggle") {
    return _lastCompletedStep === "director_coach_career"
      ? "director_coach_career"
      : "director_football_experience";
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

  if (step === "club_structure") {
    return mapClubStructureValidationError(form);
  }

  if (step === "club_first_team") {
    return mapClubFirstTeamValidationError(form);
  }

  if (step === "club_youth") {
    return mapClubYouthValidationError(form);
  }

  if (step === "club_contacts") {
    return mapClubContactsValidationError(form);
  }

  if (step === "club_profile") {
    return {};
  }

  if (step === "coach_role") {
    return mapCoachRoleValidationError(form);
  }

  if (step === "player_availability") {
    return mapPlayerAvailabilityValidationError(form);
  }

  if (step === "agent_professional") {
    return mapAgentProfessionalValidationError(form);
  }

  if (step === "agent_qualification") {
    return mapAgentQualificationValidationError(form);
  }

  if (step === "agent_portfolio") {
    return mapAgentPortfolioValidationError(form);
  }

  if (step === "agent_activity") {
    return mapAgentActivityValidationError(form);
  }

  if (step === "agent_previous_experiences") {
    return mapAgentPreviousExperiencesValidationError(form);
  }

  if (step === "staff_role") {
    return mapStaffRoleValidationError(form);
  }

  if (step === "staff_availability") {
    return mapStaffAvailabilityValidationError(form);
  }

  if (step === "staff_previous_experiences") {
    return mapStaffPreviousExperiencesValidationError(form);
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
    step === "director_coach_career" ||
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
    step === "coach_availability" ||
    step === "staff_career" ||
    step === "staff_player_career_toggle" ||
    step === "staff_player_career" ||
    step === "agent_player_career" ||
    step === "agent_contact_preferences" ||
    step === "agent_presentation" ||
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

  return errors;
}

function mapPlayerAvailabilityValidationError(form: OnboardingFormState): OnboardingValidationErrors {
  const errors: OnboardingValidationErrors = {};

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

/**
 * Una data di nascita nel futuro non esiste (REV-ONB-02 §I). Il picker
 * ferma già gli anni all'anno corrente: qui si chiude il mese.
 */
function isFutureDate(value: string) {
  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return false;
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  return parsed > today.getTime();
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

/** §H–§K: identità del club. La categoria non si chiede qui (§H). */
function mapClubDataValidationError(form: OnboardingFormState): OnboardingValidationErrors {
  const errors: OnboardingValidationErrors = {};

  if (!form.clubName.trim()) {
    errors.clubName = "Inserisci il nome della società.";
  }

  if (form.clubFoundingYear.trim()) {
    const raw = form.clubFoundingYear.trim();
    const year = parseInt(raw, 10);
    const currentYear = new Date().getFullYear();

    if (!/^\d{4}$/.test(raw) || isNaN(year) || year < 1850 || year > currentYear) {
      errors.clubFoundingYear = `Inserisci un anno tra 1850 e ${currentYear}.`;
    }
  }

  return errors;
}

function mapClubStructureValidationError(form: OnboardingFormState): OnboardingValidationErrors {
  if (!form.clubStructure) {
    return { clubStructure: "Seleziona la struttura del club." };
  }

  return {};
}

function mapClubFirstTeamValidationError(form: OnboardingFormState): OnboardingValidationErrors {
  if (!form.clubCategory.trim()) {
    return { clubCategory: "Seleziona la categoria della prima squadra." };
  }

  return {};
}

/**
 * §X: la presenza del vivaio è già stata decisa nello step Struttura, quindi
 * qui si valida soltanto la selezione delle categorie.
 */
function mapClubYouthValidationError(form: OnboardingFormState): OnboardingValidationErrors {
  if (form.clubYouthCategories.length === 0) {
    return {
      clubYouthCategories: "Seleziona almeno una categoria del settore giovanile.",
    };
  }

  return {};
}

function mapClubContactsValidationError(form: OnboardingFormState): OnboardingValidationErrors {
  const errors: OnboardingValidationErrors = {};

  if (!form.clubCity.trim() || !form.clubRegion.trim()) {
    errors.clubCity = "Scegli la città della società.";
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

/**
 * §H–§O: con il toggle spento non si chiede nulla. Con il toggle acceso
 * l'unico obbligo è che la modalità scelta sia completa: "Ovunque in Italia"
 * lo è già (§K), le altre due vogliono almeno una voce.
 *
 * "Disponibile da" e le categorie di interesse restano dati opzionali (§G, §O).
 */
function mapStaffAvailabilityValidationError(
  form: OnboardingFormState,
): OnboardingValidationErrors {
  const errors: OnboardingValidationErrors = {};

  if (!form.openToWork) {
    return errors;
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

  return errors;
}

/** §AE–§AG: una risposta serve, anche quando è "nessuna esperienza". */
function mapStaffPreviousExperiencesValidationError(
  form: OnboardingFormState,
): OnboardingValidationErrors {
  if (
    form.staffHasCoachedFootball ||
    form.staffHasPlayedFootball ||
    form.staffHasNoPreviousExperience
  ) {
    return {};
  }

  return {
    staffPreviousExperiences: "Seleziona almeno un'opzione per continuare.",
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

  if (form.role !== "agent" && form.role !== "director" && !form.gender) {
    errors.gender = "Questo campo è obbligatorio";
  }

  if (!form.birthDate.trim()) {
    errors.birthDate = "Questo campo è obbligatorio";
  } else if (isFutureDate(form.birthDate)) {
    errors.birthDate = "La data di nascita non può essere nel futuro.";
  }

  if (!form.nationality.trim()) {
    errors.nationality = "Questo campo è obbligatorio";
  }

  const nationalityCategory = getNationalityCategory(form.nationality);

  // Italian users: validate Italian city autocomplete fields
  if (nationalityCategory === "italy") {
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
  }

  // EU and non-EU users: validate international location fields
  if (nationalityCategory === "eu" || nationalityCategory === "non_eu") {
    if (form.nationality.trim()) {
      if (!form.residenceCountry.trim()) {
        errors.residenceCountry = "Questo campo è obbligatorio";
      }
      if (!form.currentLocationCountry.trim()) {
        errors.currentLocationCountry = "Questo campo è obbligatorio";
      }
      if (!form.currentLocationCity.trim()) {
        errors.currentLocationCity = "Questo campo è obbligatorio";
      }
    }
  }

  // non-EU only: legal status is required
  if (nationalityCategory === "non_eu" && form.nationality.trim()) {
    if (!form.legalStatus) {
      errors.legalStatus = "Questo campo è obbligatorio";
    }
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

/**
 * §BN: gli errori sono inline e parlano della scelta mancante, non del campo
 * tecnico che la contiene.
 */
function mapAgentProfessionalValidationError(
  form: OnboardingFormState,
): OnboardingValidationErrors {
  const errors: OnboardingValidationErrors = {};

  if (!form.agentProfessionalMode) {
    errors.agentProfessionalMode = "Seleziona come lavori.";
    return errors;
  }

  // §I: a chi lavora per conto proprio non si chiede nulla dell'agenzia.
  if (form.agentProfessionalMode !== "agency") {
    return errors;
  }

  if (!form.agentAgencyName.trim()) {
    errors.agentAgencyName = "Inserisci il nome dell'agenzia o dello studio.";
  }

  if (!form.agentAgencyRole.trim()) {
    errors.agentAgencyRole = "Seleziona il tuo ruolo attuale.";
  }

  // §K: l'anno è facoltativo, ma se c'è non può essere nel futuro.
  const startYear = Number.parseInt(form.agentAgencyStartYear, 10);

  if (
    form.agentAgencyStartYear.trim() &&
    (Number.isNaN(startYear) || startYear > new Date().getFullYear())
  ) {
    errors.agentAgencyStartYear = "Inserisci un anno valido, non futuro.";
  }

  return errors;
}

function mapAgentQualificationValidationError(
  form: OnboardingFormState,
): OnboardingValidationErrors {
  // §O: non avere un'abilitazione è una risposta, non un errore.
  if (form.agentIsFederationLicensed && !form.agentFederation.trim()) {
    return {
      agentFederation: "Seleziona la federazione o l'ente.",
    };
  }

  return {};
}

function mapAgentPortfolioValidationError(
  form: OnboardingFormState,
): OnboardingValidationErrors {
  // §U: la fascia è obbligatoria, i collegamenti no.
  if (!form.agentPortfolioRange) {
    return {
      agentPortfolioRange: "Seleziona la dimensione del portfolio.",
    };
  }

  return {};
}

function mapAgentActivityValidationError(
  form: OnboardingFormState,
): OnboardingValidationErrors {
  const errors: OnboardingValidationErrors = {};

  if (form.agentActivityScopes.length === 0) {
    errors.agentActivityScopes = "Seleziona almeno un ambito di attività.";
  }

  if (!form.agentOperatingAreaType) {
    errors.agentOperatingAreaType = "Seleziona almeno un'area operativa.";
    return errors;
  }

  if (
    form.agentOperatingAreaType === "REGIONS" &&
    fromDelimitedString(form.agentOperatingRegions).length === 0
  ) {
    errors.agentOperatingAreaType = "Seleziona almeno una regione.";
  }

  if (
    form.agentOperatingAreaType === "PROVINCES" &&
    fromDelimitedString(form.agentOperatingProvinces).length === 0
  ) {
    errors.agentOperatingAreaType = "Seleziona almeno una provincia.";
  }

  return errors;
}

function mapAgentPreviousExperiencesValidationError(
  form: OnboardingFormState,
): OnboardingValidationErrors {
  // §AK: "Nessuna esperienza precedente" è già una risposta completa.
  if (form.agentHasNoPreviousExperience || form.agentPreviousRoles.length > 0) {
    return {};
  }

  return {
    agentPreviousRoles: "Seleziona almeno un'opzione per continuare.",
  };
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
