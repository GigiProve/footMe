import type {
  AppRole,
  ProfileGender,
  StaffSpecialization,
} from "../onboarding/create-initial-profile";

import { slugify } from "../../lib/slugify";
import { supabase } from "../../lib/supabase";
import {
  DEFAULT_PLAYER_PRIMARY_POSITION,
  isPlayerPosition,
  normalizePlayerPositions,
  type PlayerExperiencePayload,
  type PlayerPosition,
  type PreferredFoot,
  type TeamAutocompleteOption,
} from "./player-sports";
import {
  normalizeCoachMediaItems,
  type CoachMediaItemRecord,
} from "./coach-media";
import type {
  AgentCareerEntryInput,
  AgentCareerEntryRecord,
  AgentManagedPlayerEntryRecord,
  AgentPlayerCandidate,
  AgentProfileRecord,
} from "./agent-profile";
import {
  normalizeAgentMediaItems,
  type AgentMediaItemRecord,
} from "./agent-media";
import {
  normalizePlayerMediaItems,
  type PlayerMediaItemRecord,
} from "./player-media";
import {
  normalizeStaffMediaItems,
  type StaffMediaItemRecord,
} from "./staff-media";
import {
  normalizeDirectorMediaItems,
  type DirectorMediaItemRecord,
  type DirectorMediaTargetCandidate,
} from "./director-media";

export type {
  AgentCareerEntryInput,
  AgentCareerEntryRecord,
  AgentManagedPlayerEntryRecord,
  AgentPlayerCandidate,
  AgentProfileRecord,
} from "./agent-profile";

type BaseProfileRecord = {
  age: number | null;
  avatar_url: string | null;
  bio: string | null;
  birth_date: string | null;
  city: string | null;
  // Optional: keeps existing BaseProfileRecord literals (test fixtures across
  // other profile-* modules) source-compatible without needing every one of
  // them updated. Always populated (string | null) by normalizeBaseProfileRecord.
  cover_url?: string | null;
  current_location_city: string | null;
  current_location_country: string | null;
  domicile: string | null;
  full_name: string;
  gender: ProfileGender | null;
  id: string;
  is_open_to_transfer: boolean;
  legal_status: string | null;
  languages: string[];
  nationality: string | null;
  region: string | null;
  residence: string | null;
  residence_country: string | null;
  role: AppRole;
};

export type UserContactsRecord = {
  email: string;
  facebook: string;
  instagram: string;
  /** REV-PROF-16: ottavo canale, nello stesso modello degli altri social. */
  linkedin?: string;
  phone: string;
  tiktok?: string;
  website?: string;
  youtube?: string;
  showEmail: boolean;
  showFacebook: boolean;
  showInstagram: boolean;
  showLinkedIn?: boolean;
  showTikTok?: boolean;
  showWebsite?: boolean;
  showYouTube?: boolean;
  /**
   * REV-PROF-05: il numero resta in `profile_private_contacts`, questa è la
   * sola preferenza che ne autorizza la pubblicazione. Spenta per default.
   */
  showPhone?: boolean;
};

type PlayerProfileRecord = {
  availability_type: string;
  contract_expiry: string | null;
  contract_status: string | null;
  current_condition: string | null;
  height_cm: number | null;
  highlight_video_url: string | null;
  media_items: PlayerMediaItemRecord[];
  media_urls: string[];
  open_to_trials: boolean;
  player_objectives: string[];
  preferred_categories: string[];
  preferred_foot: PreferredFoot | null;
  primary_position: PlayerPosition;
  profile_id: string;
  secondary_positions: PlayerPosition[];
  transfer_provinces: string[];
  show_transfer_badge: boolean;
  show_regions_badge: boolean;
  transfer_regions: string[];
  weight_kg: number | null;
  willing_to_change_club: boolean;
};

export type PlayerPalmaresRecord = {
  id: string;
  player_profile_id: string;
  competition_name: string;
  season_label: string;
  club_name: string;
  palmares_type: string;
  sort_order: number;
};

export type CoachCareerEntryRecord = {
  id: string;
  coach_profile_id: string;
  /**
   * REV-PROF-04: raggruppa le assegnazioni nate da una sola operazione. È un
   * livello di presentazione, non un vincolo — ogni riga resta modificabile da
   * sola. `null` sulle righe scritte prima della migrazione.
   */
  experience_group_id: string | null;
  team_name: string;
  team_logo_url: string | null;
  club_id: string | null;
  category: string | null;
  role: string;
  experience_type: "MULTI_SEASON" | "SINGLE_SEASON" | "CUSTOM_PERIOD";
  seasons: string[];
  period_start_month: string | null;
  period_start_year: number | null;
  period_end_month: string | null;
  period_end_year: number | null;
  season_details: Record<string, { category?: string; role?: string }>;
  results: { label?: string; variant?: string; seasonLabel?: string }[];
  description: string | null;
  sort_order: number;
};

export type StaffCareerEntryRecord = {
  id: string;
  staff_profile_id: string;
  /**
   * Assegnazioni nate da una sola operazione (REV-PROF-07). Raggruppa, non
   * vincola: ogni riga resta modificabile ed eliminabile da sola. `text` e non
   * `uuid` perché nasce nel client, come per l'Allenatore.
   */
  experience_group_id: string | null;
  team_name: string;
  team_logo_url: string | null;
  club_id: string | null;
  category: string | null;
  role: string;
  experience_type: "MULTI_SEASON" | "SINGLE_SEASON" | "CUSTOM_PERIOD";
  seasons: string[];
  period_start_month: string | null;
  period_start_year: number | null;
  period_end_month: string | null;
  period_end_year: number | null;
  season_details: Record<string, { category?: string; role?: string }>;
  results: { label?: string; variant?: string; seasonLabel?: string }[];
  description: string | null;
  head_coach_name: string | null;
  sort_order: number;
};

// Allenatore sub-role — identical shape
export type StaffCoachCareerEntryRecord = StaffCareerEntryRecord;

export type StaffPlayerCareerEntryRecord = {
  id: string;
  staff_profile_id: string;
  /** Vedi `StaffCareerEntryRecord.experience_group_id`. */
  experience_group_id: string | null;
  /** Modalità temporale dell'esperienza a cui la riga appartiene. */
  career_type: "MULTI_SEASON" | "SINGLE_SEASON" | "CUSTOM_PERIOD" | null;
  team_name: string;
  team_logo_url: string | null;
  season: string;
  season_period: "full" | "partial";
  period_start_month: number | null;
  period_end_month: number | null;
  category: string | null;
  position: string | null;
  /** REV-PROF-07: `null` = statistica non disponibile, `0` = zero dichiarato. */
  appearances: number | null;
  goals: number | null;
  assists: number | null;
  minutes_played: number | null;
  awards: string | null;
  sort_order: number;
};

export type CoachPlayerCareerEntryRecord = {
  id: string;
  coach_profile_id: string;
  /** Vedi `CoachCareerEntryRecord.experience_group_id`. */
  experience_group_id: string | null;
  /** Modalità temporale dichiarata dell'esperienza a cui la riga appartiene. */
  career_type: "MULTI_SEASON" | "SINGLE_SEASON" | "CUSTOM_PERIOD" | null;
  team_name: string;
  team_logo_url: string | null;
  season: string;
  season_period: "full" | "partial";
  period_start_month: number | null;
  period_end_month: number | null;
  category: string | null;
  position: string | null;
  /** REV-PROF-04: `null` = statistica non disponibile, `0` = zero dichiarato. */
  appearances: number | null;
  goals: number | null;
  assists: number | null;
  minutes_played: number | null;
  awards: string | null;
  sort_order: number;
};

export type CoachDirectorCareerEntryRecord = {
  id: string;
  coach_profile_id: string;
  team_name: string;
  team_logo_url: string | null;
  role: string;
  seasons: string[];
  category: string | null;
  description: string | null;
  sort_order: number;
};

/**
 * Riconoscimento del palmarès Allenatore.
 *
 * REV-PROF-05 ha reso strutturati competizione, stagione e società: erano
 * dentro `label`, che resta scritto ma ora è un titolo *derivato* dagli altri
 * campi, non una cosa che l utente digita. `playoff` e `altro` non sono più
 * offerti dall editor ma restano validi: esistono già sul database.
 */
export type CoachAchievementRecord = {
  id: string;
  coach_profile_id: string;
  achievement_type:
    | "campionato"
    | "promozione"
    | "coppa"
    | "premio_personale"
    | "playoff"
    | "altro";
  label: string;
  description: string | null;
  competition_name: string | null;
  season_label: string | null;
  club_name: string | null;
  club_id: string | null;
  sort_order: number;
  created_at: string;
};

type CoachProfileRecord = {
  achievements: CoachAchievementRecord[];
  availability_type: string | null;
  available_from: string | null;
  coached_categories: string[];
  coached_clubs: string[];
  contract_end: string | null;
  current_club: string | null;
  game_philosophy: string | null;
  licenses: string[];
  media_items: CoachMediaItemRecord[];
  open_to_new_role: boolean;
  play_styles: string[];
  preferred_categories: string[];
  preferred_formation: string | null;
  preferred_provinces: string[];
  preferred_regions: string[];
  primary_role: string | null;
  profile_id: string;
  secondary_formations: string[];
  technical_video_url: string | null;
};

export type StaffProfileRecord = {
  availability_type: string | null;
  available_from: string | null;
  certifications: string[];
  experience_entries: unknown[];
  experience_summary: string | null;
  media_items: StaffMediaItemRecord[];
  open_to_work: boolean;
  primary_staff_role: string | null;
  preferred_categories: string[];
  preferred_provinces: string[];
  preferred_regions: string[];
  profile_id: string;
  specialization: StaffSpecialization;
  staff_roles: string[];
};

export type DirectorProfileRecord = {
  /** REV-PROF-11: ITALY | REGIONS | PROVINCES. NULL vale ITALY. */
  availability_type: string | null;
  career_entries: unknown[];
  coach_career_entries: unknown[];
  club_types: string[];
  director_roles: string[];
  experience_categories: string[];
  has_other_football_experience: boolean;
  has_played_football: boolean;
  main_focus: string | null;
  market_involvement: string | null;
  media_items: DirectorMediaItemRecord[];
  /** REV-ONB-07 §M: da chi il dirigente accetta di ricevere contatti. */
  open_to_clubs: boolean;
  open_to_others: boolean;
  open_to_players: boolean;
  open_to_staff: boolean;
  /**
   * REV-PROF-11: disponibilità generale, distinta dai destinatari. Spegnerla
   * non cancella le preferenze, così riaccendendola si ritrovano.
   */
  open_to_work: boolean;
  /** REV-ONB-07 §AG: esperienze in ruoli senza un flusso carriera dedicato. */
  other_career_entries: unknown[];
  other_football_roles: string[];
  /** REV-ONB-07 §H: ruolo dichiarato scegliendo "Altro". */
  other_role_label: string | null;
  player_career_entries: unknown[];
  /** REV-PROF-11: province dell'area operativa, usate solo in PROVINCES. */
  preferred_provinces: string[];
  /** REV-PROF-11: regioni dell'area operativa, usate solo in REGIONS. */
  preferred_regions: string[];
  /** REV-ONB-07 §AA: altre esperienze nel calcio, selezione multipla. */
  previous_roles: string[];
  primary_role: string | null;
  profile_id: string;
  responsibilities: string[];
  /** REV-ONB-07 §AE: esperienze nel ramo Staff tecnico. */
  staff_career_entries: unknown[];
};

export type FanProfileRecord = {
  favorite_club_id: string | null;
  favorite_team_name: string | null;
  /**
   * REV-ONB-08 §AF: macro-categorie di calcio seguite —
   * professional / amateur / women / youth.
   */
  football_types: string[];
  /** §R: ITALY, REGIONS o PROVINCES. Una sola modalità è attiva. */
  geo_scope: string;
  /**
   * Categorie del vecchio flusso Appassionato. Non più alimentate
   * dall'onboarding: restano per i profili creati prima di REV-ONB-08.
   */
  interest_categories: string[];
  interest_provinces: string[];
  interest_regions: string[];
  profile_id: string;
};

export type MediaProfileRecord = {
  affiliation_name: string | null;
  affiliation_type: string | null;
  covered_competitions: string[];
  covered_teams: string[];
  covered_territories: string[];
  covered_topics: string[];
  content_types: string[];
  /** REV-ONB-09 §13: tipologia strutturata; null sui profili precedenti. */
  creator_type: string | null;
  creator_type_other: string | null;
  editorial_type: string | null;
  entity_name: string | null;
  focus_areas: string[];
  logo_url: string | null;
  profile_id: string;
  short_description: string | null;
  verification_status: string;
};

export type MediaProfileChannelRecord = {
  channel_type: string;
  id: string;
  is_public: boolean;
  label: string;
  media_profile_id: string;
  sort_order: number;
  url: string;
};

export type MediaProfileAuthorRecord = {
  avatar_url: string | null;
  display_name: string;
  id: string;
  is_public: boolean;
  is_verified: boolean;
  media_profile_id: string;
  profile_id: string | null;
  role_label: string | null;
  sort_order: number;
};

export type MediaProfileContactRecord = {
  contact_type: string;
  href: string | null;
  id: string;
  is_public: boolean;
  label: string;
  media_profile_id: string;
  sort_order: number;
  value: string;
};

export type MediaProfileVerificationRecord = {
  id: string;
  is_public: boolean;
  label: string;
  media_profile_id: string;
  sort_order: number;
  status: string;
  verification_type: string;
  verified_at: string | null;
};

type ClubRecord = {
  category: string | null;
  city: string;
  club_colors: string | null;
  club_email: string | null;
  club_phone: string | null;
  country: string;
  description: string | null;
  field_address: string | null;
  founding_year: number | null;
  gallery_urls: string[];
  headquarters_address: string | null;
  id: string;
  key_results: string[];
  league: string | null;
  logo_url: string | null;
  name: string;
  owner_profile_id: string;
  region: string;
  sports_focus: string | null;
  stadium: string | null;
  top_level_reached: string | null;
  verification_status: string;
  website_url: string | null;
};

export type PlayerCareerEntryRecord = {
  /**
   * REV-PROF-01 §19: `null` significa "dato non disponibile", `0` è uno zero
   * dichiarato. Le due cose non devono collassare nella stessa cella.
   */
  appearances: number | null;
  assists: number | null;
  awards: string | null;
  /** REV-PROF-01 §17: tipologia dichiarata in REV-ONB-02, ora persistita. */
  career_type: "MULTI_SEASON" | "SINGLE_SEASON" | "CUSTOM_PERIOD" | null;
  club_id: string | null;
  club_name: string;
  competition_name: string | null;
  /**
   * REV-PROF-01 §12: identità dell'esperienza a cui la stagione appartiene.
   * Due periodi distinti nello stesso club hanno gruppi diversi.
   */
  experience_group_id: string | null;
  goals: number | null;
  id: string;
  minutes_played: number | null;
  period_end_month: number | null;
  period_start_month: number | null;
  player_profile_id: string;
  season_label: string;
  season_period: string;
  sort_order: number;
  team_logo_url: string | null;
};

export type ClubSeasonEntryRecord = {
  category: string;
  club_id: string;
  end_year: number | null;
  id: string;
  league: string | null;
  notes: string | null;
  sort_order: number;
  start_year: number;
};

export type CompleteProfessionalProfile = {
  agentCareerEntries: AgentCareerEntryRecord[];
  agentManagedPlayerEntries: AgentManagedPlayerEntryRecord[];
  agentProfile: AgentProfileRecord | null;
  club: ClubRecord | null;
  clubSeasonEntries: ClubSeasonEntryRecord[];
  coachCareerEntries: CoachCareerEntryRecord[];
  coachDirectorCareerEntries: CoachDirectorCareerEntryRecord[];
  coachPlayerCareerEntries: CoachPlayerCareerEntryRecord[];
  coachProfile: CoachProfileRecord | null;
  directorProfile: DirectorProfileRecord | null;
  fanProfile?: FanProfileRecord | null;
  mediaProfile?: MediaProfileRecord | null;
  mediaProfileAuthors?: MediaProfileAuthorRecord[];
  mediaProfileChannels?: MediaProfileChannelRecord[];
  mediaProfileContacts?: MediaProfileContactRecord[];
  mediaProfileVerifications?: MediaProfileVerificationRecord[];
  playerCareerEntries: PlayerCareerEntryRecord[];
  playerPalmares: PlayerPalmaresRecord[];
  playerProfile: PlayerProfileRecord | null;
  profile: BaseProfileRecord;
  staffCareerEntries: StaffCareerEntryRecord[];
  staffCoachCareerEntries: StaffCoachCareerEntryRecord[];
  staffPlayerCareerEntries: StaffPlayerCareerEntryRecord[];
  staffProfile: StaffProfileRecord | null;
  userContacts: UserContactsRecord;
};

export type PlayerCareerEntryInput = PlayerExperiencePayload;

export type ClubSeasonEntryInput = {
  category: string;
  end_year: number | null;
  id?: string;
  league: string | null;
  notes: string | null;
  sort_order: number;
  start_year: number;
};

export type PlayerPalmaresInput = {
  id: string;
  competition_name: string;
  season_label: string;
  club_name: string;
  palmares_type: string;
  sort_order: number;
};

export type CompleteProfessionalProfileUpdate = {
  agentProfile?: {
    activity_scopes: string[];
    agency_logo_url: string | null;
    agency_name: string | null;
    agency_role: string | null;
    federation: string | null;
    has_no_previous_experience: boolean;
    has_other_football_experience: boolean;
    has_played_football: boolean;
    is_federation_licensed: boolean;
    license_number: string | null;
    main_player_roles: PlayerPosition[];
    managed_players_count: string | null;
    open_to_clubs: boolean;
    open_to_players: boolean;
    operating_area_type: string | null;
    operating_countries: string[];
    operating_macro_areas: string[];
    operating_provinces: string[];
    operating_regions: string[];
    operational_focuses: string[];
    operational_note: string | null;
    other_football_roles: string[];
    period_end_month: string | null;
    period_end_year: number | null;
    period_start_month: string | null;
    period_start_year: number | null;
    player_career_entries: unknown[];
    player_types: string[];
    portfolio_range: string | null;
    previous_roles: string[];
    professional_mode: string | null;
    works_abroad: boolean;
  } | null;
  directorProfile?: {
    availability_type?: string | null;
    career_entries: unknown[];
    coach_career_entries: unknown[];
    club_types: string[];
    director_roles: string[];
    experience_categories: string[];
    has_other_football_experience: boolean;
    has_played_football: boolean;
    main_focus: string | null;
    market_involvement: string | null;
    media_items?: DirectorMediaItemRecord[];
    open_to_clubs: boolean;
    open_to_others: boolean;
    open_to_players: boolean;
    open_to_staff: boolean;
    open_to_work?: boolean;
    other_career_entries?: unknown[];
    other_football_roles: string[];
    other_role_label?: string | null;
    player_career_entries: unknown[];
    preferred_provinces?: string[];
    preferred_regions?: string[];
    previous_roles?: string[];
    primary_role: string | null;
    responsibilities: string[];
    staff_career_entries?: unknown[];
  } | null;
  /**
   * REV-ONB-08 §O, §P: squadra tifata e interessi liberi non si chiedono più.
   * `interest_categories` non compare qui perché nessun flusso la scrive: la
   * colonna resta popolata per i profili storici, e un upsert che non la
   * nomina non la cancella.
   */
  fanProfile?: {
    favorite_club_id?: string | null;
    favorite_team_name?: string | null;
    football_types?: string[];
    geo_scope?: string;
    interest_provinces?: string[];
    interest_regions: string[];
  } | null;
  mediaProfile?: {
    affiliation_name?: string | null;
    affiliation_type?: string | null;
    covered_competitions?: string[];
    covered_teams?: string[];
    covered_territories?: string[];
    covered_topics?: string[];
    content_types: string[];
    /** REV-ONB-09 §13: tipologia strutturata del progetto. */
    creator_type?: string | null;
    creator_type_other?: string | null;
    editorial_type?: string | null;
    entity_name: string | null;
    focus_areas: string[];
    logo_url: string | null;
    /** Derivata da `creator_type`: vocabolario di ricerca (CER-05). */
    media_kind?: string | null;
    short_description: string | null;
    verification_status?: string | null;
  } | null;
  club: {
    category: string | null;
    city: string;
    club_colors: string | null;
    club_email: string | null;
    club_phone: string | null;
    country: string;
    description: string | null;
    field_address: string | null;
    founding_year: number | null;
    gallery_urls: string[];
    headquarters_address: string | null;
    id?: string;
    league: string | null;
    logo_url: string | null;
    name: string;
    region: string;
    website_url: string | null;
  } | null;
  /**
   * REV-PROF-13: lo stato canonico dell'esperienza — in corso, principale,
   * modalità organizzativa, visibilità — è derivato dal database, non scritto
   * dagli editor. Chi salva la carriera manda i soli campi che modifica.
   */
  agentCareerEntries?: AgentCareerEntryInput[];
  agentManagedPlayerEntries?: AgentManagedPlayerEntryRecord[];
  clubSeasonEntries: ClubSeasonEntryInput[];
  coachProfile: {
    availability_type: string | null;
    available_from: string | null;
    coached_categories: string[];
    coached_clubs: string[];
    contract_end: string | null;
    current_club: string | null;
    game_philosophy: string | null;
    licenses: string[];
    media_items: CoachMediaItemRecord[];
    open_to_new_role: boolean;
    play_styles: string[];
    preferred_categories: string[];
    preferred_formation: string | null;
    preferred_provinces: string[];
    preferred_regions: string[];
    primary_role: string | null;
    secondary_formations: string[];
    technical_video_url: string | null;
  } | null;
  coachCareerEntries?: CoachCareerEntryRecord[];
  coachDirectorCareerEntries?: CoachDirectorCareerEntryRecord[];
  coachPlayerCareerEntries?: CoachPlayerCareerEntryRecord[];
  staffCareerEntries?: StaffCareerEntryRecord[];
  staffCoachCareerEntries?: StaffCoachCareerEntryRecord[];
  staffPlayerCareerEntries?: StaffPlayerCareerEntryRecord[];
  playerCareerEntries: PlayerCareerEntryInput[];
  playerPalmares?: PlayerPalmaresInput[];
  playerProfile: {
    availability_type: string;
    contract_expiry: string | null;
    contract_status: string | null;
    current_condition: string | null;
    height_cm: number | null;
    highlight_video_url: string | null;
    media_items: PlayerMediaItemRecord[];
    media_urls: string[];
    open_to_trials: boolean;
    player_objectives: string[];
    preferred_categories: string[];
    preferred_foot: PreferredFoot | null;
    primary_position: PlayerPosition;
    secondary_positions: PlayerPosition[];
    show_transfer_badge: boolean;
    show_regions_badge: boolean;
    transfer_provinces: string[];
    transfer_regions: string[];
    weight_kg: number | null;
    willing_to_change_club: boolean;
  } | null;
  profile: {
    avatar_url: string | null;
    bio: string | null;
    birth_date: string | null;
    city: string | null;
    cover_url?: string | null;
    current_location_city?: string | null;
    current_location_country?: string | null;
    domicile?: string | null;
    full_name: string;
    gender?: ProfileGender | null;
    is_open_to_transfer: boolean;
    legal_status?: string | null;
    languages: string[];
    nationality: string | null;
    region: string | null;
    residence?: string | null;
    residence_country?: string | null;
  };
  profileId: string;
  role: AppRole;
  staffProfile: {
    availability_type: string | null;
    available_from: string | null;
    certifications: string[];
    experience_entries: unknown[];
    experience_summary: string | null;
    open_to_work: boolean;
    primary_staff_role: string | null;
    preferred_categories: string[];
    preferred_provinces: string[];
    preferred_regions: string[];
    specialization: StaffSpecialization;
    staff_roles: string[];
  } | null;
  userContacts: UserContactsRecord;
};

type SupabaseErrorLike = {
  code?: string;
  details?: string | null;
  hint?: string | null;
  message?: string;
};

function getSupabaseErrorText(error: unknown) {
  if (!error || typeof error !== "object") {
    return "";
  }

  const candidate = error as SupabaseErrorLike;

  return [candidate.code, candidate.message, candidate.details, candidate.hint]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();
}

function shouldFallbackToLegacyStaffSave(error: unknown) {
  const errorText = getSupabaseErrorText(error);

  if (!errorText) {
    return false;
  }

  const referencesStaffCareerStorage =
    errorText.includes("save_staff_career_details") ||
    errorText.includes("staff_career_entries") ||
    errorText.includes("staff_coach_career_entries") ||
    errorText.includes("staff_player_career_entries");

  if (!referencesStaffCareerStorage) {
    return false;
  }

  return (
    errorText.includes("could not find the function") ||
    errorText.includes("schema cache") ||
    errorText.includes("does not exist") ||
    errorText.includes("relation") ||
    errorText.includes("column") ||
    errorText.includes("pgrst202") ||
    errorText.includes("pgrst204")
  );
}

async function saveLegacyStaffProfile(input: CompleteProfessionalProfileUpdate) {
  if (!input.staffProfile) {
    return;
  }

  const { error } = await supabase.from("staff_profiles").upsert({
    availability_type: input.staffProfile.availability_type,
    available_from: input.staffProfile.available_from,
    certifications: input.staffProfile.certifications,
    experience_entries: input.staffProfile.experience_entries,
    experience_summary: input.staffProfile.experience_summary,
    open_to_work: input.staffProfile.open_to_work,
    preferred_categories: input.staffProfile.preferred_categories,
    preferred_provinces: input.staffProfile.preferred_provinces,
    preferred_regions: input.staffProfile.preferred_regions,
    primary_staff_role: input.staffProfile.primary_staff_role,
    profile_id: input.profileId,
    specialization: input.staffProfile.specialization,
    staff_roles: input.staffProfile.staff_roles,
  });

  if (error) {
    throw error;
  }
}

function toPlayerCareerEntryRpcPayload(
  entry: PlayerCareerEntryInput,
  { includeId = true }: { includeId?: boolean } = {},
) {
  return {
    appearances: entry.appearances,
    assists: entry.assists,
    awards: entry.awards,
    career_type: entry.career_type,
    club_id: entry.club_id,
    club_name: entry.club_name,
    competition_name: entry.competition_name,
    experience_group_id: entry.experience_group_id,
    goals: entry.goals,
    ...(includeId ? { id: entry.id } : {}),
    minutes_played: entry.minutes_played,
    period_end_month: entry.period_end_month,
    period_start_month: entry.period_start_month,
    season_label: entry.season_label,
    season_period: entry.season_period,
    sort_order: entry.sort_order,
    team_logo_url: entry.team_logo_url,
  };
}

function normalizeOptionalText(value: unknown) {
  return typeof value === "string" ? value : null;
}

function normalizeRequiredText(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
}

function normalizeBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function isUuidLike(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function normalizeRole(value: unknown): AppRole {
  return value === "coach" ||
    value === "staff" ||
    value === "club_admin" ||
    value === "agent" ||
    value === "director" ||
    value === "fan" ||
    value === "media"
    ? value
    : "player";
}

function normalizeProfileGender(value: unknown): ProfileGender | null {
  return value === "male" ||
    value === "female" ||
    value === "non_binary" ||
    value === "prefer_not_to_say"
    ? value
    : null;
}

function normalizeBaseProfileRecord(
  profileId: string,
  rawProfile: Partial<BaseProfileRecord> | null | undefined,
): BaseProfileRecord {
  return {
    age: normalizeNumber(rawProfile?.age),
    avatar_url: normalizeOptionalText(rawProfile?.avatar_url),
    bio: normalizeOptionalText(rawProfile?.bio),
    birth_date: normalizeOptionalText(rawProfile?.birth_date),
    city: normalizeOptionalText(rawProfile?.city),
    cover_url: normalizeOptionalText(rawProfile?.cover_url),
    current_location_city: normalizeOptionalText(rawProfile?.current_location_city),
    current_location_country: normalizeOptionalText(rawProfile?.current_location_country),
    domicile: normalizeOptionalText(rawProfile?.domicile),
    full_name: normalizeRequiredText(rawProfile?.full_name, "Profilo ProLink"),
    gender: normalizeProfileGender(rawProfile?.gender),
    id: normalizeRequiredText(rawProfile?.id, profileId),
    is_open_to_transfer: normalizeBoolean(rawProfile?.is_open_to_transfer),
    legal_status: normalizeOptionalText(rawProfile?.legal_status),
    languages: normalizeStringArray(rawProfile?.languages),
    nationality: normalizeOptionalText(rawProfile?.nationality),
    region: normalizeOptionalText(rawProfile?.region),
    residence: normalizeOptionalText(rawProfile?.residence),
    residence_country: normalizeOptionalText(rawProfile?.residence_country),
    role: normalizeRole(rawProfile?.role),
  };
}

function normalizePlayerProfileRecord(
  profileId: string,
  rawProfile: Partial<PlayerProfileRecord> | null | undefined,
) {
  if (!rawProfile) {
    return null;
  }

  const normalizedSecondaryPositions = normalizePlayerPositions(rawProfile.secondary_positions);

  return {
    availability_type: typeof rawProfile.availability_type === "string" ? rawProfile.availability_type : "ITALY",
    contract_expiry: normalizeOptionalText(rawProfile.contract_expiry),
    contract_status: normalizeOptionalText(rawProfile.contract_status),
    current_condition: normalizeOptionalText(rawProfile.current_condition),
    height_cm: normalizeNumber(rawProfile.height_cm),
    highlight_video_url: normalizeOptionalText(rawProfile.highlight_video_url),
    media_items: normalizePlayerMediaItems(rawProfile.media_items, normalizeStringArray(rawProfile.media_urls)),
    media_urls: normalizeStringArray(rawProfile.media_urls),
    open_to_trials: normalizeBoolean(rawProfile.open_to_trials),
    player_objectives: normalizeStringArray(rawProfile.player_objectives),
    preferred_categories: normalizeStringArray(rawProfile.preferred_categories),
    preferred_foot:
      rawProfile.preferred_foot === "right" ||
      rawProfile.preferred_foot === "left" ||
      rawProfile.preferred_foot === "both"
        ? rawProfile.preferred_foot
        : null,
    primary_position: isPlayerPosition(rawProfile.primary_position)
      ? rawProfile.primary_position
      : DEFAULT_PLAYER_PRIMARY_POSITION,
    profile_id: normalizeRequiredText(rawProfile.profile_id, profileId),
    secondary_positions: normalizedSecondaryPositions,
    show_transfer_badge: rawProfile?.show_transfer_badge ?? false,
    show_regions_badge: rawProfile?.show_regions_badge ?? false,
    transfer_provinces: normalizeStringArray(rawProfile.transfer_provinces),
    transfer_regions: normalizeStringArray(rawProfile.transfer_regions),
    weight_kg: normalizeNumber(rawProfile.weight_kg),
    willing_to_change_club: normalizeBoolean(rawProfile.willing_to_change_club),
  } satisfies PlayerProfileRecord;
}

function normalizePlayerPalmaresRecord(
  profileId: string,
  rawEntry: Partial<PlayerPalmaresRecord>,
  index: number,
): PlayerPalmaresRecord {
  return {
    id: normalizeRequiredText(rawEntry.id, `${profileId}-palmares-${index}`),
    player_profile_id: normalizeRequiredText(rawEntry.player_profile_id, profileId),
    competition_name: normalizeRequiredText(rawEntry.competition_name, ""),
    season_label: normalizeRequiredText(rawEntry.season_label, ""),
    club_name: normalizeRequiredText(rawEntry.club_name, ""),
    palmares_type: normalizeRequiredText(rawEntry.palmares_type, "trophy"),
    sort_order: normalizeNumber(rawEntry.sort_order) ?? index,
  };
}

function normalizeCoachAchievementRecord(
  profileId: string,
  rawEntry: Partial<CoachAchievementRecord>,
  index: number,
): CoachAchievementRecord {
  const validTypes = [
    "campionato",
    "promozione",
    "coppa",
    "premio_personale",
    "playoff",
    "altro",
  ] as const;

  return {
    id: normalizeRequiredText(rawEntry.id, `${profileId}-achievement-${index}`),
    coach_profile_id: normalizeRequiredText(rawEntry.coach_profile_id, profileId),
    achievement_type: validTypes.includes(rawEntry.achievement_type as typeof validTypes[number])
      ? (rawEntry.achievement_type as CoachAchievementRecord["achievement_type"])
      : "altro",
    label: normalizeRequiredText(rawEntry.label, ""),
    description: normalizeOptionalText(rawEntry.description),
    /*
      Le righe salvate prima di REV-PROF-05 non hanno la competizione come
      campo: il titolo era tutto quello che esisteva, e riaprendole è quello
      che l editor deve mostrare invece di un campo vuoto.
    */
    competition_name:
      normalizeOptionalText(rawEntry.competition_name) ??
      normalizeOptionalText(rawEntry.label),
    season_label: normalizeOptionalText(rawEntry.season_label),
    club_name: normalizeOptionalText(rawEntry.club_name),
    club_id: normalizeOptionalText(rawEntry.club_id),
    sort_order: normalizeNumber(rawEntry.sort_order) ?? index,
    created_at: normalizeRequiredText(rawEntry.created_at, new Date().toISOString()),
  };
}

function normalizeCoachProfileRecord(
  profileId: string,
  rawProfile: Partial<CoachProfileRecord> | null | undefined,
) {
  if (!rawProfile) {
    return null;
  }

  return {
    achievements: Array.isArray(rawProfile.achievements)
      ? (rawProfile.achievements as CoachAchievementRecord[]).map((a, i) =>
          normalizeCoachAchievementRecord(profileId, a, i),
        )
      : [],
    availability_type: normalizeOptionalText(rawProfile.availability_type),
    available_from: normalizeOptionalText(rawProfile.available_from),
    coached_categories: normalizeStringArray(rawProfile.coached_categories),
    coached_clubs: normalizeStringArray(rawProfile.coached_clubs),
    contract_end: normalizeOptionalText(rawProfile.contract_end),
    current_club: normalizeOptionalText(rawProfile.current_club),
    game_philosophy: normalizeOptionalText(rawProfile.game_philosophy),
    licenses: normalizeStringArray(rawProfile.licenses),
    media_items: normalizeCoachMediaItems(rawProfile.media_items, []),
    open_to_new_role: normalizeBoolean(rawProfile.open_to_new_role),
    play_styles: normalizeStringArray(rawProfile.play_styles),
    preferred_categories: normalizeStringArray(rawProfile.preferred_categories),
    preferred_formation: normalizeOptionalText(rawProfile.preferred_formation),
    preferred_provinces: normalizeStringArray(rawProfile.preferred_provinces),
    preferred_regions: normalizeStringArray(rawProfile.preferred_regions),
    primary_role: normalizeOptionalText(rawProfile.primary_role),
    profile_id: normalizeRequiredText(rawProfile.profile_id, profileId),
    secondary_formations: normalizeStringArray(rawProfile.secondary_formations),
    technical_video_url: normalizeOptionalText(rawProfile.technical_video_url),
  } satisfies CoachProfileRecord;
}

function normalizeAgentProfileRecord(
  profileId: string,
  rawProfile: Partial<AgentProfileRecord> | null | undefined,
) {
  if (!rawProfile) {
    return null;
  }

  return {
    activity_scopes: normalizeStringArray(rawProfile.activity_scopes),
    agency_logo_url: normalizeOptionalText(rawProfile.agency_logo_url),
    agency_name: normalizeOptionalText(rawProfile.agency_name),
    agency_role: normalizeOptionalText(rawProfile.agency_role),
    career_migrated_at: normalizeOptionalText(rawProfile.career_migrated_at),
    coach_career_entries: Array.isArray(rawProfile.coach_career_entries)
      ? rawProfile.coach_career_entries
      : [],
    director_career_entries: Array.isArray(rawProfile.director_career_entries)
      ? rawProfile.director_career_entries
      : [],
    federation: normalizeOptionalText(rawProfile.federation),
    has_no_previous_experience: normalizeBoolean(
      rawProfile.has_no_previous_experience,
    ),
    has_other_football_experience: normalizeBoolean(
      rawProfile.has_other_football_experience,
    ),
    has_played_football: normalizeBoolean(rawProfile.has_played_football),
    is_federation_licensed: normalizeBoolean(rawProfile.is_federation_licensed),
    main_player_roles: normalizePlayerPositions(rawProfile.main_player_roles),
    managed_players_count: normalizeOptionalText(rawProfile.managed_players_count),
    media_items: normalizeAgentMediaItems(rawProfile.media_items),
    open_to_clubs: normalizeBoolean(rawProfile.open_to_clubs, true),
    open_to_players: normalizeBoolean(rawProfile.open_to_players, true),
    operating_area_type: normalizeOptionalText(rawProfile.operating_area_type),
    operating_countries: normalizeStringArray(rawProfile.operating_countries),
    operating_macro_areas: normalizeStringArray(rawProfile.operating_macro_areas),
    operating_provinces: normalizeStringArray(rawProfile.operating_provinces),
    operating_regions: normalizeStringArray(rawProfile.operating_regions),
    operational_focuses: normalizeStringArray(rawProfile.operational_focuses),
    operational_note: normalizeOptionalText(rawProfile.operational_note),
    other_football_roles: normalizeStringArray(rawProfile.other_football_roles),
    period_end_month: normalizeOptionalText(rawProfile.period_end_month),
    period_end_year: normalizeNumber(rawProfile.period_end_year),
    period_start_month: normalizeOptionalText(rawProfile.period_start_month),
    period_start_year: normalizeNumber(rawProfile.period_start_year),
    player_career_entries: Array.isArray(rawProfile.player_career_entries)
      ? rawProfile.player_career_entries
      : [],
    player_types: normalizeStringArray(rawProfile.player_types),
    portfolio_range: normalizeOptionalText(rawProfile.portfolio_range),
    primary_activities: normalizeStringArray(rawProfile.primary_activities),
    previous_roles: normalizeStringArray(rawProfile.previous_roles),
    professional_mode: normalizeOptionalText(rawProfile.professional_mode),
    profile_id: normalizeRequiredText(rawProfile.profile_id, profileId),
    staff_career_entries: Array.isArray(rawProfile.staff_career_entries)
      ? rawProfile.staff_career_entries
      : [],
    works_abroad: normalizeBoolean(rawProfile.works_abroad),
  } satisfies AgentProfileRecord;
}

function normalizeAgentCareerEntryRecord(
  profileId: string,
  rawEntry: Partial<AgentCareerEntryRecord>,
  index: number,
) {
  return {
    agency_logo_url: normalizeOptionalText(rawEntry.agency_logo_url),
    agency_name: normalizeOptionalText(rawEntry.agency_name),
    agent_profile_id: normalizeRequiredText(rawEntry.agent_profile_id, profileId),
    description: normalizeOptionalText(rawEntry.description),
    id: normalizeRequiredText(rawEntry.id, `${profileId}-agent-career-${index}`),
    /*
      Un record scritto prima di REV-PROF-13 non porta questi campi: l'assenza
      di una data di fine resta la lettura di riserva di "in corso", la stessa
      che la migrazione usa per il backfill.
    */
    is_current:
      typeof rawEntry.is_current === "boolean"
        ? rawEntry.is_current
        : rawEntry.period_end_year == null && rawEntry.period_end_month == null,
    is_primary: rawEntry.is_primary === true,
    manual_organization_id: normalizeOptionalText(rawEntry.manual_organization_id),
    organization_city: normalizeOptionalText(rawEntry.organization_city),
    organization_club_id: normalizeOptionalText(rawEntry.organization_club_id),
    organization_country: normalizeOptionalText(rawEntry.organization_country),
    organization_mode:
      rawEntry.organization_mode === "independent" ? "independent" : "agency",
    period_end_month: normalizeOptionalText(rawEntry.period_end_month),
    /*
      REV-PROF-15: un record senza mese non e un record a cui manca un mese, e
      un dato annuale. In assenza della colonna si deduce dal dato stesso,
      mai inventando gennaio o dicembre.
    */
    period_end_precision:
      rawEntry.period_end_precision === "year" ||
      (rawEntry.period_end_precision == null &&
        normalizeOptionalText(rawEntry.period_end_month) === null)
        ? "year"
        : "month",
    period_end_year: normalizeNumber(rawEntry.period_end_year),
    period_start_month: normalizeOptionalText(rawEntry.period_start_month),
    period_start_precision:
      rawEntry.period_start_precision === "year" ||
      (rawEntry.period_start_precision == null &&
        normalizeOptionalText(rawEntry.period_start_month) === null)
        ? "year"
        : "month",
    period_start_year: normalizeNumber(rawEntry.period_start_year),
    role: normalizeRequiredText(rawEntry.role, "Procuratore"),
    sort_order: normalizeNumber(rawEntry.sort_order) ?? index,
    visibility: rawEntry.visibility === "private" ? "private" : "public",
  } satisfies AgentCareerEntryRecord;
}

function normalizeAgentManagedPlayerEntryRecord(
  profileId: string,
  rawEntry: Partial<AgentManagedPlayerEntryRecord>,
  index: number,
) {
  return {
    agent_profile_id: normalizeRequiredText(rawEntry.agent_profile_id, profileId),
    avatar_url: normalizeOptionalText(rawEntry.avatar_url),
    birth_year: normalizeNumber(rawEntry.birth_year),
    category_label: normalizeOptionalText(rawEntry.category_label),
    display_name: normalizeRequiredText(rawEntry.display_name, "Calciatore"),
    id: normalizeRequiredText(rawEntry.id, `${profileId}-agent-player-${index}`),
    is_free_agent: normalizeBoolean(rawEntry.is_free_agent),
    linked_profile_id:
      typeof rawEntry.linked_profile_id === "string" && rawEntry.linked_profile_id.trim()
        ? rawEntry.linked_profile_id
        : null,
    primary_position: isPlayerPosition(rawEntry.primary_position)
      ? rawEntry.primary_position
      : null,
    sort_order: normalizeNumber(rawEntry.sort_order) ?? index,
  } satisfies AgentManagedPlayerEntryRecord;
}

function normalizeDirectorProfileRecord(
  profileId: string,
  rawProfile: Partial<DirectorProfileRecord> | null | undefined,
) {
  if (!rawProfile) {
    return null;
  }

  return {
    availability_type: normalizeOptionalText(rawProfile.availability_type),
    career_entries: Array.isArray(rawProfile.career_entries)
      ? rawProfile.career_entries
      : [],
    coach_career_entries: Array.isArray(rawProfile.coach_career_entries)
      ? rawProfile.coach_career_entries
      : [],
    club_types: normalizeStringArray(rawProfile.club_types),
    director_roles: normalizeStringArray(rawProfile.director_roles),
    experience_categories: normalizeStringArray(rawProfile.experience_categories),
    has_other_football_experience: normalizeBoolean(
      rawProfile.has_other_football_experience,
    ),
    has_played_football: normalizeBoolean(rawProfile.has_played_football),
    main_focus: normalizeOptionalText(rawProfile.main_focus),
    market_involvement: normalizeOptionalText(rawProfile.market_involvement),
    media_items: normalizeDirectorMediaItems(rawProfile.media_items),
    /**
     * REV-ONB-07 §M: un profilo salvato prima della review non porta queste
     * colonne. L'assenza vale "contattabile", che è il default del passo.
     */
    open_to_clubs: rawProfile.open_to_clubs !== false,
    open_to_others: rawProfile.open_to_others !== false,
    open_to_players: rawProfile.open_to_players !== false,
    open_to_staff: rawProfile.open_to_staff !== false,
    /*
      REV-PROF-11: prima della colonna la disponibilità era derivata dai
      destinatari. Una riga che non la porta ancora torna a quella regola
      invece di risultare indisponibile.
    */
    open_to_work:
      typeof rawProfile.open_to_work === "boolean"
        ? rawProfile.open_to_work
        : rawProfile.open_to_clubs !== false ||
          rawProfile.open_to_staff !== false ||
          rawProfile.open_to_players !== false ||
          rawProfile.open_to_others !== false,
    other_career_entries: Array.isArray(rawProfile.other_career_entries)
      ? rawProfile.other_career_entries
      : [],
    other_football_roles: normalizeStringArray(rawProfile.other_football_roles),
    other_role_label: normalizeOptionalText(rawProfile.other_role_label),
    player_career_entries: Array.isArray(rawProfile.player_career_entries)
      ? rawProfile.player_career_entries
      : [],
    preferred_provinces: normalizeStringArray(rawProfile.preferred_provinces),
    preferred_regions: normalizeStringArray(rawProfile.preferred_regions),
    previous_roles: normalizeStringArray(rawProfile.previous_roles),
    primary_role: normalizeOptionalText(rawProfile.primary_role),
    profile_id: normalizeRequiredText(rawProfile.profile_id, profileId),
    responsibilities: normalizeStringArray(rawProfile.responsibilities),
    staff_career_entries: Array.isArray(rawProfile.staff_career_entries)
      ? rawProfile.staff_career_entries
      : [],
  } satisfies DirectorProfileRecord;
}

/**
 * REV-ONB-08 §R: una modalità sconosciuta non deve diventare uno stato
 * geografico inventato. In dubbio si torna alla scelta nazionale, che è
 * l'unica che non promette un dettaglio che non abbiamo.
 */
function normalizeFanGeoScope(value: unknown): string {
  return value === "REGIONS" || value === "PROVINCES" ? value : "ITALY";
}

function normalizeFanProfileRecord(
  profileId: string,
  rawProfile: Partial<FanProfileRecord> | null | undefined,
) {
  if (!rawProfile) {
    return null;
  }

  return {
    favorite_club_id:
      typeof rawProfile.favorite_club_id === "string" &&
      rawProfile.favorite_club_id.trim()
        ? rawProfile.favorite_club_id
        : null,
    favorite_team_name: normalizeOptionalText(rawProfile.favorite_team_name),
    football_types: normalizeStringArray(rawProfile.football_types),
    geo_scope: normalizeFanGeoScope(rawProfile.geo_scope),
    interest_categories: normalizeStringArray(rawProfile.interest_categories),
    interest_provinces: normalizeStringArray(rawProfile.interest_provinces),
    interest_regions: normalizeStringArray(rawProfile.interest_regions),
    profile_id: normalizeRequiredText(rawProfile.profile_id, profileId),
  } satisfies FanProfileRecord;
}

function normalizeMediaProfileRecord(
  profileId: string,
  rawProfile: Partial<MediaProfileRecord> | null | undefined,
) {
  if (!rawProfile) {
    return null;
  }

  return {
    affiliation_name: normalizeOptionalText(rawProfile.affiliation_name),
    affiliation_type: normalizeOptionalText(rawProfile.affiliation_type),
    covered_competitions: normalizeStringArray(rawProfile.covered_competitions),
    covered_teams: normalizeStringArray(rawProfile.covered_teams),
    covered_territories: normalizeStringArray(rawProfile.covered_territories),
    covered_topics: normalizeStringArray(rawProfile.covered_topics),
    content_types: normalizeStringArray(rawProfile.content_types),
    creator_type: normalizeOptionalText(rawProfile.creator_type),
    creator_type_other: normalizeOptionalText(rawProfile.creator_type_other),
    editorial_type: normalizeOptionalText(rawProfile.editorial_type),
    entity_name: normalizeOptionalText(rawProfile.entity_name),
    focus_areas: normalizeStringArray(rawProfile.focus_areas),
    logo_url: normalizeOptionalText(rawProfile.logo_url),
    profile_id: normalizeRequiredText(rawProfile.profile_id, profileId),
    short_description: normalizeOptionalText(rawProfile.short_description),
    verification_status: normalizeRequiredText(
      rawProfile.verification_status,
      "unverified",
    ),
  } satisfies MediaProfileRecord;
}

function normalizeMediaProfileChannelRecord(
  profileId: string,
  rawChannel: Partial<MediaProfileChannelRecord>,
  index: number,
) {
  return {
    channel_type: normalizeRequiredText(rawChannel.channel_type, "other"),
    id: normalizeRequiredText(rawChannel.id, `${profileId}-channel-${index}`),
    is_public: normalizeBoolean(rawChannel.is_public ?? true),
    label: normalizeRequiredText(rawChannel.label, ""),
    media_profile_id: normalizeRequiredText(rawChannel.media_profile_id, profileId),
    sort_order: normalizeNumber(rawChannel.sort_order) ?? index,
    url: normalizeRequiredText(rawChannel.url, ""),
  } satisfies MediaProfileChannelRecord;
}

function normalizeMediaProfileAuthorRecord(
  profileId: string,
  rawAuthor: Partial<MediaProfileAuthorRecord>,
  index: number,
) {
  return {
    avatar_url: normalizeOptionalText(rawAuthor.avatar_url),
    display_name: normalizeRequiredText(rawAuthor.display_name, ""),
    id: normalizeRequiredText(rawAuthor.id, `${profileId}-author-${index}`),
    is_public: normalizeBoolean(rawAuthor.is_public ?? true),
    is_verified: normalizeBoolean(rawAuthor.is_verified),
    media_profile_id: normalizeRequiredText(rawAuthor.media_profile_id, profileId),
    profile_id:
      typeof rawAuthor.profile_id === "string" && rawAuthor.profile_id.trim()
        ? rawAuthor.profile_id
        : null,
    role_label: normalizeOptionalText(rawAuthor.role_label),
    sort_order: normalizeNumber(rawAuthor.sort_order) ?? index,
  } satisfies MediaProfileAuthorRecord;
}

function normalizeMediaProfileContactRecord(
  profileId: string,
  rawContact: Partial<MediaProfileContactRecord>,
  index: number,
) {
  return {
    contact_type: normalizeRequiredText(rawContact.contact_type, "other"),
    href: normalizeOptionalText(rawContact.href),
    id: normalizeRequiredText(rawContact.id, `${profileId}-contact-${index}`),
    is_public: normalizeBoolean(rawContact.is_public ?? true),
    label: normalizeRequiredText(rawContact.label, ""),
    media_profile_id: normalizeRequiredText(rawContact.media_profile_id, profileId),
    sort_order: normalizeNumber(rawContact.sort_order) ?? index,
    value: normalizeRequiredText(rawContact.value, ""),
  } satisfies MediaProfileContactRecord;
}

function normalizeMediaProfileVerificationRecord(
  profileId: string,
  rawVerification: Partial<MediaProfileVerificationRecord>,
  index: number,
) {
  return {
    id: normalizeRequiredText(rawVerification.id, `${profileId}-verification-${index}`),
    is_public: normalizeBoolean(rawVerification.is_public ?? true),
    label: normalizeRequiredText(rawVerification.label, ""),
    media_profile_id: normalizeRequiredText(
      rawVerification.media_profile_id,
      profileId,
    ),
    sort_order: normalizeNumber(rawVerification.sort_order) ?? index,
    status: normalizeRequiredText(rawVerification.status, "verified"),
    verification_type: normalizeRequiredText(
      rawVerification.verification_type,
      "other",
    ),
    verified_at: normalizeOptionalText(rawVerification.verified_at),
  } satisfies MediaProfileVerificationRecord;
}

function normalizeCoachCareerEntryRecord(
  profileId: string,
  rawEntry: Partial<CoachCareerEntryRecord>,
  index: number,
) {
  return {
    id: normalizeRequiredText(rawEntry.id, `${profileId}-coach-career-${index}`),
    coach_profile_id: normalizeRequiredText(rawEntry.coach_profile_id, profileId),
    experience_group_id: normalizeOptionalText(rawEntry.experience_group_id),
    team_name: normalizeRequiredText(rawEntry.team_name, ""),
    team_logo_url: normalizeOptionalText(rawEntry.team_logo_url),
    club_id:
      typeof rawEntry.club_id === "string" && rawEntry.club_id.trim()
        ? rawEntry.club_id
        : null,
    category: normalizeOptionalText(rawEntry.category),
    role: normalizeRequiredText(rawEntry.role, "Allenatore"),
    experience_type:
      rawEntry.experience_type === "MULTI_SEASON" ||
      rawEntry.experience_type === "CUSTOM_PERIOD"
        ? rawEntry.experience_type
        : "SINGLE_SEASON",
    seasons: normalizeStringArray(rawEntry.seasons),
    period_start_month: normalizeOptionalText(rawEntry.period_start_month),
    period_start_year: normalizeNumber(rawEntry.period_start_year),
    period_end_month: normalizeOptionalText(rawEntry.period_end_month),
    period_end_year: normalizeNumber(rawEntry.period_end_year),
    season_details:
      rawEntry.season_details && typeof rawEntry.season_details === "object"
        ? rawEntry.season_details
        : {},
    results: Array.isArray(rawEntry.results) ? rawEntry.results : [],
    description: normalizeOptionalText(rawEntry.description),
    sort_order: normalizeNumber(rawEntry.sort_order) ?? index,
  } satisfies CoachCareerEntryRecord;
}

function normalizeCoachPlayerCareerEntryRecord(
  profileId: string,
  rawEntry: Partial<CoachPlayerCareerEntryRecord>,
  index: number,
) {
  return {
    id: normalizeRequiredText(rawEntry.id, `${profileId}-coach-player-${index}`),
    coach_profile_id: normalizeRequiredText(rawEntry.coach_profile_id, profileId),
    experience_group_id: normalizeOptionalText(rawEntry.experience_group_id),
    career_type:
      rawEntry.career_type === "MULTI_SEASON" ||
      rawEntry.career_type === "SINGLE_SEASON" ||
      rawEntry.career_type === "CUSTOM_PERIOD"
        ? rawEntry.career_type
        : null,
    team_name: normalizeRequiredText(rawEntry.team_name, ""),
    team_logo_url: normalizeOptionalText(rawEntry.team_logo_url),
    season: normalizeRequiredText(rawEntry.season, ""),
    season_period: rawEntry.season_period === "partial" ? "partial" : "full",
    period_start_month: normalizeNumber(rawEntry.period_start_month),
    period_end_month: normalizeNumber(rawEntry.period_end_month),
    category: normalizeOptionalText(rawEntry.category),
    position: normalizeOptionalText(rawEntry.position),
    // Nessun `?? 0`: schiacciare a zero renderebbe di nuovo indistinguibile la
    // statistica mai inserita da quella dichiarata pari a zero.
    appearances: normalizeNumber(rawEntry.appearances),
    goals: normalizeNumber(rawEntry.goals),
    assists: normalizeNumber(rawEntry.assists),
    minutes_played: normalizeNumber(rawEntry.minutes_played),
    awards: normalizeOptionalText(rawEntry.awards),
    sort_order: normalizeNumber(rawEntry.sort_order) ?? index,
  } satisfies CoachPlayerCareerEntryRecord;
}

function normalizeCoachDirectorCareerEntryRecord(
  profileId: string,
  rawEntry: Partial<CoachDirectorCareerEntryRecord>,
  index: number,
) {
  return {
    id: normalizeRequiredText(rawEntry.id, `${profileId}-coach-director-${index}`),
    coach_profile_id: normalizeRequiredText(rawEntry.coach_profile_id, profileId),
    team_name: normalizeRequiredText(rawEntry.team_name, ""),
    team_logo_url: normalizeOptionalText(rawEntry.team_logo_url),
    role: normalizeRequiredText(rawEntry.role, "Dirigente"),
    seasons: normalizeStringArray(rawEntry.seasons),
    category: normalizeOptionalText(rawEntry.category),
    description: normalizeOptionalText(rawEntry.description),
    sort_order: normalizeNumber(rawEntry.sort_order) ?? index,
  } satisfies CoachDirectorCareerEntryRecord;
}

function normalizeStaffCareerEntryRecord(
  profileId: string,
  rawEntry: Record<string, unknown>,
  index: number,
): StaffCareerEntryRecord {
  return {
    id: normalizeRequiredText(rawEntry.id, `${profileId}-staff-career-${index}`),
    staff_profile_id: normalizeRequiredText(rawEntry.staff_profile_id, profileId),
    experience_group_id: normalizeOptionalText(rawEntry.experience_group_id),
    team_name: normalizeRequiredText(rawEntry.team_name, ""),
    team_logo_url: normalizeOptionalText(rawEntry.team_logo_url),
    club_id:
      typeof rawEntry.club_id === "string" && rawEntry.club_id.trim()
        ? rawEntry.club_id
        : null,
    category: normalizeOptionalText(rawEntry.category),
    role: normalizeRequiredText(rawEntry.role, ""),
    experience_type:
      rawEntry.experience_type === "MULTI_SEASON" ||
      rawEntry.experience_type === "CUSTOM_PERIOD"
        ? rawEntry.experience_type
        : "SINGLE_SEASON",
    seasons: normalizeStringArray(rawEntry.seasons),
    period_start_month: normalizeOptionalText(rawEntry.period_start_month),
    period_start_year: normalizeNumber(rawEntry.period_start_year),
    period_end_month: normalizeOptionalText(rawEntry.period_end_month),
    period_end_year: normalizeNumber(rawEntry.period_end_year),
    season_details:
      typeof rawEntry.season_details === "object" &&
      rawEntry.season_details !== null &&
      !Array.isArray(rawEntry.season_details)
        ? (rawEntry.season_details as Record<string, { category?: string; role?: string }>)
        : {},
    results: Array.isArray(rawEntry.results) ? rawEntry.results : [],
    description: normalizeOptionalText(rawEntry.description),
    head_coach_name: typeof rawEntry.head_coach_name === "string" ? rawEntry.head_coach_name : null,
    sort_order: normalizeNumber(rawEntry.sort_order) ?? index,
  };
}

function normalizeStaffCoachCareerEntryRecord(
  profileId: string,
  rawEntry: Record<string, unknown>,
  index: number,
): StaffCareerEntryRecord {
  return normalizeStaffCareerEntryRecord(profileId, rawEntry, index);
}

function normalizeStaffPlayerCareerEntryRecord(
  profileId: string,
  rawEntry: Record<string, unknown>,
  index: number,
): StaffPlayerCareerEntryRecord {
  return {
    id: normalizeRequiredText(rawEntry.id, `${profileId}-staff-player-${index}`),
    staff_profile_id: normalizeRequiredText(rawEntry.staff_profile_id, profileId),
    experience_group_id: normalizeOptionalText(rawEntry.experience_group_id),
    career_type:
      rawEntry.career_type === "MULTI_SEASON" ||
      rawEntry.career_type === "SINGLE_SEASON" ||
      rawEntry.career_type === "CUSTOM_PERIOD"
        ? rawEntry.career_type
        : null,
    team_name: normalizeRequiredText(rawEntry.team_name, ""),
    team_logo_url: normalizeOptionalText(rawEntry.team_logo_url),
    season: normalizeRequiredText(rawEntry.season, ""),
    season_period: rawEntry.season_period === "partial" ? "partial" : "full",
    period_start_month: normalizeNumber(rawEntry.period_start_month),
    period_end_month: normalizeNumber(rawEntry.period_end_month),
    category: normalizeOptionalText(rawEntry.category),
    position: normalizeOptionalText(rawEntry.position),
    // `null` non diventa `0`: una statistica mai inserita resta vuota.
    appearances: normalizeNumber(rawEntry.appearances),
    goals: normalizeNumber(rawEntry.goals),
    assists: normalizeNumber(rawEntry.assists),
    minutes_played: normalizeNumber(rawEntry.minutes_played),
    awards: normalizeOptionalText(rawEntry.awards),
    sort_order: normalizeNumber(rawEntry.sort_order) ?? index,
  };
}

function normalizeStaffProfileRecord(
  profileId: string,
  rawProfile: Partial<StaffProfileRecord> | null | undefined,
) {
  if (!rawProfile) {
    return null;
  }

  return {
    availability_type: normalizeOptionalText(rawProfile.availability_type),
    available_from: normalizeOptionalText(rawProfile.available_from),
    certifications: normalizeStringArray(rawProfile.certifications),
    experience_entries: Array.isArray(rawProfile.experience_entries)
      ? rawProfile.experience_entries
      : [],
    experience_summary: normalizeOptionalText(rawProfile.experience_summary),
    media_items: normalizeStaffMediaItems(rawProfile.media_items),
    open_to_work: normalizeBoolean(rawProfile.open_to_work),
    primary_staff_role: normalizeOptionalText(rawProfile.primary_staff_role),
    preferred_categories: normalizeStringArray(rawProfile.preferred_categories),
    preferred_provinces: normalizeStringArray(rawProfile.preferred_provinces),
    preferred_regions: normalizeStringArray(rawProfile.preferred_regions),
    profile_id: normalizeRequiredText(rawProfile.profile_id, profileId),
    specialization:
      rawProfile.specialization === "goalkeeper_coach" ||
      rawProfile.specialization === "physiotherapist" ||
      rawProfile.specialization === "match_analyst" ||
      rawProfile.specialization === "team_manager" ||
      rawProfile.specialization === "other"
        ? rawProfile.specialization
        : "fitness_coach",
    staff_roles: normalizeStringArray(rawProfile.staff_roles),
  } satisfies StaffProfileRecord;
}

function normalizeClubRecord(profileId: string, rawClub: Partial<ClubRecord> | null | undefined) {
  if (!rawClub) {
    return null;
  }

  return {
    category: normalizeOptionalText(rawClub.category),
    city: normalizeRequiredText(rawClub.city, ""),
    club_colors: normalizeOptionalText(rawClub.club_colors),
    club_email: normalizeOptionalText(rawClub.club_email),
    club_phone: normalizeOptionalText(rawClub.club_phone),
    country: normalizeRequiredText(rawClub.country, "IT"),
    description: normalizeOptionalText(rawClub.description),
    field_address: normalizeOptionalText(rawClub.field_address),
    founding_year: normalizeNumber(rawClub.founding_year),
    gallery_urls: normalizeStringArray(rawClub.gallery_urls),
    headquarters_address: normalizeOptionalText(rawClub.headquarters_address),
    id: normalizeRequiredText(rawClub.id, profileId),
    key_results: normalizeStringArray(rawClub.key_results),
    league: normalizeOptionalText(rawClub.league),
    logo_url: normalizeOptionalText(rawClub.logo_url),
    name: normalizeRequiredText(rawClub.name, ""),
    owner_profile_id: normalizeRequiredText(rawClub.owner_profile_id, profileId),
    region: normalizeRequiredText(rawClub.region, ""),
    sports_focus: normalizeOptionalText(rawClub.sports_focus),
    stadium: normalizeOptionalText(rawClub.stadium),
    top_level_reached: normalizeOptionalText(rawClub.top_level_reached),
    verification_status: normalizeRequiredText(rawClub.verification_status, "unverified"),
    website_url: normalizeOptionalText(rawClub.website_url),
  } satisfies ClubRecord;
}

function normalizePlayerCareerType(
  value: unknown,
): PlayerCareerEntryRecord["career_type"] {
  return value === "MULTI_SEASON" ||
    value === "SINGLE_SEASON" ||
    value === "CUSTOM_PERIOD"
    ? value
    : null;
}

function normalizePlayerCareerEntryRecord(
  profileId: string,
  rawEntry: Partial<PlayerCareerEntryRecord>,
  index: number,
) {
  return {
    // Nessun `?? 0`: una statistica assente resta assente (REV-PROF-01 §19).
    appearances: normalizeNumber(rawEntry.appearances),
    assists: normalizeNumber(rawEntry.assists),
    awards: normalizeOptionalText(rawEntry.awards),
    career_type: normalizePlayerCareerType(rawEntry.career_type),
    club_id:
      typeof rawEntry.club_id === "string" && rawEntry.club_id.trim()
        ? rawEntry.club_id
        : null,
    club_name: normalizeRequiredText(rawEntry.club_name, ""),
    competition_name: normalizeOptionalText(rawEntry.competition_name),
    experience_group_id:
      typeof rawEntry.experience_group_id === "string" &&
      rawEntry.experience_group_id.trim()
        ? rawEntry.experience_group_id
        : null,
    goals: normalizeNumber(rawEntry.goals),
    id: normalizeRequiredText(rawEntry.id, `${profileId}-career-${index}`),
    minutes_played: normalizeNumber(rawEntry.minutes_played),
    period_end_month: normalizeNumber(rawEntry.period_end_month),
    period_start_month: normalizeNumber(rawEntry.period_start_month),
    player_profile_id: normalizeRequiredText(rawEntry.player_profile_id, profileId),
    season_label: normalizeRequiredText(rawEntry.season_label, ""),
    season_period: typeof rawEntry.season_period === "string" ? rawEntry.season_period : "full",
    sort_order: normalizeNumber(rawEntry.sort_order) ?? index,
    team_logo_url: normalizeOptionalText(rawEntry.team_logo_url),
  } satisfies PlayerCareerEntryRecord;
}

export function normalizeUserProfile(input: {
  agentCareerEntries?: Partial<AgentCareerEntryRecord>[] | null;
  agentManagedPlayerEntries?: Partial<AgentManagedPlayerEntryRecord>[] | null;
  agentProfile?: Partial<AgentProfileRecord> | null;
  club?: Partial<ClubRecord> | null;
  clubSeasonEntries?: ClubSeasonEntryRecord[];
  coachCareerEntries?: Partial<CoachCareerEntryRecord>[] | null;
  coachDirectorCareerEntries?: Partial<CoachDirectorCareerEntryRecord>[] | null;
  coachPlayerCareerEntries?: Partial<CoachPlayerCareerEntryRecord>[] | null;
  coachProfile?: Partial<CoachProfileRecord> | null;
  directorProfile?: Partial<DirectorProfileRecord> | null;
  fanProfile?: Partial<FanProfileRecord> | null;
  mediaProfile?: Partial<MediaProfileRecord> | null;
  mediaProfileAuthors?: Partial<MediaProfileAuthorRecord>[] | null;
  mediaProfileChannels?: Partial<MediaProfileChannelRecord>[] | null;
  mediaProfileContacts?: Partial<MediaProfileContactRecord>[] | null;
  mediaProfileVerifications?: Partial<MediaProfileVerificationRecord>[] | null;
  playerCareerEntries?: Partial<PlayerCareerEntryRecord>[] | null;
  playerPalmares?: Partial<PlayerPalmaresRecord>[] | null;
  playerProfile?: Partial<PlayerProfileRecord> | null;
  profile: Partial<BaseProfileRecord> | null | undefined;
  profileId: string;
  profileContacts?: {
    email?: string | null;
    facebook?: string | null;
    instagram?: string | null;
    linkedin?: string | null;
    tiktok?: string | null;
    website?: string | null;
    youtube?: string | null;
    show_email?: boolean | null;
    show_facebook?: boolean | null;
    show_instagram?: boolean | null;
    show_linkedin?: boolean | null;
    show_tiktok?: boolean | null;
    show_website?: boolean | null;
    show_youtube?: boolean | null;
  } | null;
  privateContacts?: {
    phone?: string | null;
    show_phone?: boolean | null;
  } | null;
  staffCareerEntries?: Record<string, unknown>[] | null;
  staffCoachCareerEntries?: Record<string, unknown>[] | null;
  staffPlayerCareerEntries?: Record<string, unknown>[] | null;
  staffProfile?: Partial<StaffProfileRecord> | null;
}): CompleteProfessionalProfile {
  return {
    agentCareerEntries: (input.agentCareerEntries ?? []).map((entry, index) =>
      normalizeAgentCareerEntryRecord(input.profileId, entry, index),
    ),
    agentManagedPlayerEntries: (input.agentManagedPlayerEntries ?? []).map((entry, index) =>
      normalizeAgentManagedPlayerEntryRecord(input.profileId, entry, index),
    ),
    agentProfile: normalizeAgentProfileRecord(input.profileId, input.agentProfile),
    club: normalizeClubRecord(input.profileId, input.club),
    clubSeasonEntries: input.clubSeasonEntries ?? [],
    coachCareerEntries: (input.coachCareerEntries ?? []).map((entry, index) =>
      normalizeCoachCareerEntryRecord(input.profileId, entry, index),
    ),
    coachDirectorCareerEntries: (input.coachDirectorCareerEntries ?? []).map((entry, index) =>
      normalizeCoachDirectorCareerEntryRecord(input.profileId, entry, index),
    ),
    coachPlayerCareerEntries: (input.coachPlayerCareerEntries ?? []).map((entry, index) =>
      normalizeCoachPlayerCareerEntryRecord(input.profileId, entry, index),
    ),
    coachProfile: normalizeCoachProfileRecord(input.profileId, input.coachProfile),
    directorProfile: normalizeDirectorProfileRecord(
      input.profileId,
      input.directorProfile,
    ),
    fanProfile: normalizeFanProfileRecord(input.profileId, input.fanProfile),
    mediaProfile: normalizeMediaProfileRecord(input.profileId, input.mediaProfile),
    mediaProfileAuthors: (input.mediaProfileAuthors ?? []).map((author, index) =>
      normalizeMediaProfileAuthorRecord(input.profileId, author, index),
    ),
    mediaProfileChannels: (input.mediaProfileChannels ?? []).map((channel, index) =>
      normalizeMediaProfileChannelRecord(input.profileId, channel, index),
    ),
    mediaProfileContacts: (input.mediaProfileContacts ?? []).map((contact, index) =>
      normalizeMediaProfileContactRecord(input.profileId, contact, index),
    ),
    mediaProfileVerifications: (input.mediaProfileVerifications ?? []).map(
      (verification, index) =>
        normalizeMediaProfileVerificationRecord(input.profileId, verification, index),
    ),
    playerCareerEntries: (input.playerCareerEntries ?? []).map((entry, index) =>
      normalizePlayerCareerEntryRecord(input.profileId, entry, index),
    ),
    playerPalmares: (input.playerPalmares ?? []).map((entry, index) =>
      normalizePlayerPalmaresRecord(input.profileId, entry, index),
    ),
    playerProfile: normalizePlayerProfileRecord(input.profileId, input.playerProfile),
    profile: normalizeBaseProfileRecord(input.profileId, input.profile),
    staffCareerEntries: (input.staffCareerEntries ?? []).map((entry, index) =>
      normalizeStaffCareerEntryRecord(input.profileId, entry, index),
    ),
    staffCoachCareerEntries: (input.staffCoachCareerEntries ?? []).map((entry, index) =>
      normalizeStaffCoachCareerEntryRecord(input.profileId, entry, index),
    ),
    staffPlayerCareerEntries: (input.staffPlayerCareerEntries ?? []).map((entry, index) =>
      normalizeStaffPlayerCareerEntryRecord(input.profileId, entry, index),
    ),
    staffProfile: normalizeStaffProfileRecord(input.profileId, input.staffProfile),
    userContacts: {
      email: input.profileContacts?.email ?? "",
      facebook: input.profileContacts?.facebook ?? "",
      instagram: input.profileContacts?.instagram ?? "",
      linkedin: input.profileContacts?.linkedin ?? "",
      phone: input.privateContacts?.phone ?? "",
      showPhone: normalizeBoolean(input.privateContacts?.show_phone),
      tiktok: input.profileContacts?.tiktok ?? "",
      website: input.profileContacts?.website ?? "",
      youtube: input.profileContacts?.youtube ?? "",
      showEmail: normalizeBoolean(input.profileContacts?.show_email),
      showFacebook: normalizeBoolean(input.profileContacts?.show_facebook),
      showInstagram: normalizeBoolean(input.profileContacts?.show_instagram),
      showLinkedIn: normalizeBoolean(input.profileContacts?.show_linkedin),
      showTikTok: normalizeBoolean(input.profileContacts?.show_tiktok),
      showWebsite: normalizeBoolean(input.profileContacts?.show_website),
      showYouTube: normalizeBoolean(input.profileContacts?.show_youtube),
    },
  };
}

/**
 * Contatti pubblici di un profilo altrui.
 *
 * Restituisce soltanto i canali che il proprietario ha reso visibili: è la
 * funzione SQL a filtrarli, non questo codice. I flag `show_*` vengono
 * ricostruiti dalla presenza del valore, perché un canale che arriva fin qui
 * è per definizione pubblico.
 */
async function fetchPublicProfileContacts(profileId: string) {
  /*
    Best effort su tutta la linea: la funzione può non essere ancora stata
    deployata, e un client che non conosce questa RPC non deve far fallire il
    caricamento di un profilo. In entrambi i casi il Visitor vede quello che
    vedeva prima, cioè nessun contatto.
  */
  let row: Record<string, string | null> | undefined;

  try {
    const { data, error } = await supabase.rpc("get_profile_public_contacts", {
      target_profile_id: profileId,
    });

    if (error || !data) {
      return null;
    }

    row = (Array.isArray(data) ? data[0] : data) as
      | Record<string, string | null>
      | undefined;
  } catch {
    return null;
  }

  if (!row) {
    return null;
  }

  return {
    privateContacts: {
      phone: row.phone ?? null,
      show_phone: Boolean(row.phone),
    },
    profileContacts: {
      email: row.email ?? null,
      facebook: row.facebook ?? null,
      instagram: row.instagram ?? null,
      linkedin: row.linkedin ?? null,
      show_email: Boolean(row.email),
      show_facebook: Boolean(row.facebook),
      show_instagram: Boolean(row.instagram),
      show_linkedin: Boolean(row.linkedin),
      show_tiktok: Boolean(row.tiktok),
      show_website: Boolean(row.website),
      show_youtube: Boolean(row.youtube),
      tiktok: row.tiktok ?? null,
      website: row.website ?? null,
      youtube: row.youtube ?? null,
    },
  };
}

export async function getCompleteProfessionalProfile(profileId: string) {
  const { data: profileData, error: profileError } = await supabase
    .from("profiles_with_age")
    .select(
      "id, full_name, role, birth_date, age, nationality, bio, avatar_url, cover_url, region, city, gender, residence, domicile, residence_country, current_location_country, current_location_city, legal_status, is_open_to_transfer, languages",
    )
    .eq("id", profileId)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profileData) {
    throw new Error("Profilo non trovato.");
  }

  const profile = normalizeBaseProfileRecord(profileId, profileData as Partial<BaseProfileRecord>);
  const [
    playerProfile,
    coachProfile,
    staffProfile,
    agentProfile,
    directorProfile,
    fanProfile,
    mediaProfile,
    mediaProfileChannels,
    mediaProfileAuthors,
    mediaProfileContacts,
    mediaProfileVerifications,
    club,
    profileContacts,
    privateContacts,
  ] =
    await Promise.all([
    profile.role === "player"
      ? supabase
          .from("player_profiles")
          .select(
            "profile_id, preferred_foot, height_cm, weight_kg, primary_position, secondary_positions, willing_to_change_club, availability_type, transfer_regions, transfer_provinces, preferred_categories, highlight_video_url, media_urls, media_items, open_to_trials, player_objectives, contract_status, contract_expiry, current_condition, show_transfer_badge, show_regions_badge",
          )
          .eq("profile_id", profileId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    profile.role === "coach"
      ? supabase
          .from("coach_profiles")
          .select(
            "profile_id, licenses, coached_clubs, coached_categories, game_philosophy, technical_video_url, media_items, preferred_regions, preferred_provinces, availability_type, available_from, open_to_new_role, primary_role, preferred_formation, secondary_formations, play_styles, current_club, contract_end, preferred_categories",
          )
          .eq("profile_id", profileId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    profile.role === "staff"
      ? supabase
          .from("staff_profiles")
          .select(
            "profile_id, specialization, availability_type, available_from, preferred_categories, preferred_provinces, primary_staff_role, staff_roles, experience_entries, experience_summary, certifications, preferred_regions, open_to_work, media_items",
          )
          .eq("profile_id", profileId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    profile.role === "agent"
      ? supabase
          .from("agent_profiles")
          .select(
            "profile_id, agency_name, agency_logo_url, agency_role, managed_players_count, media_items, has_other_football_experience, other_football_roles, has_played_football, player_career_entries, coach_career_entries, staff_career_entries, director_career_entries, career_migrated_at, player_types, main_player_roles, open_to_clubs, open_to_players, is_federation_licensed, federation, period_start_month, period_start_year, period_end_month, period_end_year, operational_focuses, operational_note, operating_macro_areas, operating_regions, operating_provinces, operating_area_type, operating_countries, works_abroad, activity_scopes, primary_activities, portfolio_range, professional_mode, previous_roles, has_no_previous_experience",
          )
          .eq("profile_id", profileId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    profile.role === "director"
      ? supabase
          .from("director_profiles")
          .select(
            "profile_id, director_roles, primary_role, other_role_label, responsibilities, experience_categories, main_focus, market_involvement, media_items, career_entries, coach_career_entries, staff_career_entries, other_career_entries, has_other_football_experience, other_football_roles, previous_roles, has_played_football, player_career_entries, club_types, open_to_clubs, open_to_staff, open_to_players, open_to_others, open_to_work, availability_type, preferred_regions, preferred_provinces",
          )
          .eq("profile_id", profileId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    profile.role === "fan"
      ? supabase
          .from("fan_profiles")
          .select(
            "profile_id, interest_categories, interest_regions, interest_provinces, football_types, geo_scope, favorite_team_name, favorite_club_id",
          )
          .eq("profile_id", profileId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    profile.role === "media"
      ? supabase
          .from("media_profiles")
          .select(
            "profile_id, entity_name, short_description, logo_url, content_types, focus_areas, affiliation_type, affiliation_name, creator_type, creator_type_other, editorial_type, verification_status, covered_competitions, covered_teams, covered_territories, covered_topics",
          )
          .eq("profile_id", profileId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    profile.role === "media"
      ? supabase
          .from("media_profile_channels")
          .select("id, media_profile_id, channel_type, label, url, is_public, sort_order")
          .eq("media_profile_id", profileId)
          .eq("is_public", true)
          .order("sort_order", { ascending: true })
          .order("label", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    profile.role === "media"
      ? supabase
          .from("media_profile_authors")
          .select(
            "id, media_profile_id, profile_id, display_name, role_label, avatar_url, is_verified, is_public, sort_order",
          )
          .eq("media_profile_id", profileId)
          .eq("is_public", true)
          .order("sort_order", { ascending: true })
          .order("display_name", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    profile.role === "media"
      ? supabase
          .from("media_profile_contacts")
          .select("id, media_profile_id, contact_type, label, value, href, is_public, sort_order")
          .eq("media_profile_id", profileId)
          .eq("is_public", true)
          .order("sort_order", { ascending: true })
          .order("label", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    profile.role === "media"
      ? supabase
          .from("media_profile_verifications")
          .select(
            "id, media_profile_id, verification_type, label, status, is_public, sort_order, verified_at",
          )
          .eq("media_profile_id", profileId)
          .eq("is_public", true)
          .eq("status", "verified")
          .order("sort_order", { ascending: true })
          .order("label", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    profile.role === "club_admin"
      ? supabase
          .from("clubs")
          .select(
            "id, owner_profile_id, name, city, region, category, league, stadium, description, logo_url, gallery_urls, founding_year, club_colors, country, headquarters_address, club_email, club_phone, website_url, field_address, verification_status, sports_focus, top_level_reached, key_results",
          )
          .eq("owner_profile_id", profileId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("profile_contacts")
      .select(
        "instagram, facebook, email, tiktok, youtube, website, linkedin, show_instagram, show_facebook, show_email, show_tiktok, show_youtube, show_website, show_linkedin",
      )
      .eq("profile_id", profileId)
      .maybeSingle(),
    supabase
      .from("profile_private_contacts")
      .select("phone, show_phone")
      .eq("profile_id", profileId)
      .maybeSingle(),
    ]);

  if (playerProfile.error) {
    throw playerProfile.error;
  }

  if (coachProfile.error) {
    throw coachProfile.error;
  }

  if (staffProfile.error) {
    throw staffProfile.error;
  }

  if (agentProfile.error) {
    throw agentProfile.error;
  }

  if (directorProfile.error) {
    throw directorProfile.error;
  }

  if (fanProfile.error) {
    throw fanProfile.error;
  }

  if (mediaProfile.error) {
    throw mediaProfile.error;
  }

  if (mediaProfileChannels.error) {
    throw mediaProfileChannels.error;
  }

  if (mediaProfileAuthors.error) {
    throw mediaProfileAuthors.error;
  }

  if (mediaProfileContacts.error) {
    throw mediaProfileContacts.error;
  }

  if (mediaProfileVerifications.error) {
    throw mediaProfileVerifications.error;
  }

  if (club.error) {
    throw club.error;
  }

  if (profileContacts.error) {
    throw profileContacts.error;
  }

  if (privateContacts.error) {
    throw privateContacts.error;
  }

  let playerCareerEntries: PlayerCareerEntryRecord[] = [];
  let playerPalmares: PlayerPalmaresRecord[] = [];
  let agentCareerEntries: AgentCareerEntryRecord[] = [];
  let agentManagedPlayerEntries: AgentManagedPlayerEntryRecord[] = [];
  let coachCareerEntries: CoachCareerEntryRecord[] = [];
  let coachPlayerCareerEntries: CoachPlayerCareerEntryRecord[] = [];
  let coachDirectorCareerEntries: CoachDirectorCareerEntryRecord[] = [];
  let staffCareerEntries: StaffCareerEntryRecord[] = [];
  let staffCoachCareerEntries: StaffCoachCareerEntryRecord[] = [];
  let staffPlayerCareerEntries: StaffPlayerCareerEntryRecord[] = [];

  if (profile.role === "player") {
    const [careerResult, palmaresResult] = await Promise.all([
      supabase
        .from("player_career_entries")
        .select(
          "id, player_profile_id, season_label, club_id, club_name, competition_name, appearances, goals, assists, minutes_played, awards, sort_order, team_logo_url, season_period, period_start_month, period_end_month, experience_group_id, career_type",
        )
        .eq("player_profile_id", profileId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false }),
      supabase
        .from("player_palmares")
        .select("id, player_profile_id, competition_name, season_label, club_name, palmares_type, sort_order")
        .eq("player_profile_id", profileId)
        .order("sort_order", { ascending: true }),
    ]);

    if (careerResult.error) {
      throw careerResult.error;
    }

    if (palmaresResult.error) {
      throw palmaresResult.error;
    }

    playerCareerEntries = (careerResult.data ?? []).map((entry, index) =>
      normalizePlayerCareerEntryRecord(profileId, entry as Partial<PlayerCareerEntryRecord>, index),
    );

    playerPalmares = (palmaresResult.data ?? []).map((entry, index) =>
      normalizePlayerPalmaresRecord(profileId, entry as Partial<PlayerPalmaresRecord>, index),
    );
  }

  if (profile.role === "coach") {
    const [careerResult, playerCareerResult, directorCareerResult, achievementsResult] = await Promise.all([
      supabase
        .from("coach_career_entries")
        .select(
          "id, coach_profile_id, experience_group_id, team_name, team_logo_url, club_id, category, role, experience_type, seasons, period_start_month, period_start_year, period_end_month, period_end_year, season_details, results, description, sort_order",
        )
        .eq("coach_profile_id", profileId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false }),
      supabase
        .from("coach_player_career_entries")
        .select(
          "id, coach_profile_id, experience_group_id, career_type, team_name, team_logo_url, season, season_period, period_start_month, period_end_month, category, position, appearances, goals, assists, minutes_played, awards, sort_order",
        )
        .eq("coach_profile_id", profileId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false }),
      supabase
        .from("coach_director_career_entries")
        .select(
          "id, coach_profile_id, team_name, team_logo_url, role, seasons, category, description, sort_order",
        )
        .eq("coach_profile_id", profileId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false }),
      supabase
        .from("coach_achievements")
        .select(
          "id, coach_profile_id, achievement_type, label, description, competition_name, season_label, club_name, club_id, sort_order, created_at",
        )
        .eq("coach_profile_id", profileId)
        .order("sort_order", { ascending: true }),
    ]);

    if (careerResult.error) {
      throw careerResult.error;
    }

    if (playerCareerResult.error) {
      throw playerCareerResult.error;
    }

    if (directorCareerResult.error) {
      throw directorCareerResult.error;
    }

    if (achievementsResult.error) {
      throw achievementsResult.error;
    }

    coachCareerEntries = (careerResult.data ?? []).map((entry, index) =>
      normalizeCoachCareerEntryRecord(profileId, entry as Partial<CoachCareerEntryRecord>, index),
    );

    coachPlayerCareerEntries = (playerCareerResult.data ?? []).map((entry, index) =>
      normalizeCoachPlayerCareerEntryRecord(
        profileId,
        entry as Partial<CoachPlayerCareerEntryRecord>,
        index,
      ),
    );

    coachDirectorCareerEntries = (directorCareerResult.data ?? []).map((entry, index) =>
      normalizeCoachDirectorCareerEntryRecord(
        profileId,
        entry as Partial<CoachDirectorCareerEntryRecord>,
        index,
      ),
    );

    if (coachProfile.data) {
      (coachProfile.data as Record<string, unknown>).achievements = achievementsResult.data ?? [];
    }
  }

  if (profile.role === "staff") {
    const [staffCareerResult, staffCoachCareerResult, staffPlayerCareerResult] = await Promise.all([
      supabase
        .from("staff_career_entries")
        .select(
          "id, staff_profile_id, experience_group_id, team_name, team_logo_url, club_id, category, role, experience_type, seasons, period_start_month, period_start_year, period_end_month, period_end_year, season_details, results, description, head_coach_name, sort_order",
        )
        .eq("staff_profile_id", profileId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("staff_coach_career_entries")
        .select(
          "id, staff_profile_id, experience_group_id, team_name, team_logo_url, club_id, category, role, experience_type, seasons, period_start_month, period_start_year, period_end_month, period_end_year, season_details, results, description, head_coach_name, sort_order",
        )
        .eq("staff_profile_id", profileId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("staff_player_career_entries")
        .select(
          "id, staff_profile_id, experience_group_id, career_type, team_name, team_logo_url, season, season_period, period_start_month, period_end_month, category, position, appearances, goals, assists, minutes_played, awards, sort_order",
        )
        .eq("staff_profile_id", profileId)
        .order("sort_order", { ascending: true }),
    ]);

    if (staffCareerResult.error) {
      throw staffCareerResult.error;
    }

    if (staffCoachCareerResult.error) {
      throw staffCoachCareerResult.error;
    }

    if (staffPlayerCareerResult.error) {
      throw staffPlayerCareerResult.error;
    }

    staffCareerEntries = (staffCareerResult.data ?? []).map((entry, index) =>
      normalizeStaffCareerEntryRecord(profileId, entry as Record<string, unknown>, index),
    );

    staffCoachCareerEntries = (staffCoachCareerResult.data ?? []).map((entry, index) =>
      normalizeStaffCoachCareerEntryRecord(profileId, entry as Record<string, unknown>, index),
    );

    staffPlayerCareerEntries = (staffPlayerCareerResult.data ?? []).map((entry, index) =>
      normalizeStaffPlayerCareerEntryRecord(profileId, entry as Record<string, unknown>, index),
    );
  }

  if (profile.role === "agent") {
    const [careerResult, managedPlayersResult] = await Promise.all([
      supabase
        .from("agent_career_entries")
        .select(
          "id, agent_profile_id, agency_name, agency_logo_url, organization_club_id, manual_organization_id, organization_city, organization_country, description, role, period_start_month, period_start_year, period_start_precision, period_end_month, period_end_year, period_end_precision, sort_order, is_current, is_primary, organization_mode, visibility",
        )
        .eq("agent_profile_id", profileId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("agent_managed_player_entries")
        .select(
          "id, agent_profile_id, linked_profile_id, display_name, avatar_url, primary_position, birth_year, category_label, is_free_agent, sort_order",
        )
        .eq("agent_profile_id", profileId)
        .order("sort_order", { ascending: true }),
    ]);

    if (careerResult.error) {
      throw careerResult.error;
    }

    if (managedPlayersResult.error) {
      throw managedPlayersResult.error;
    }

    agentCareerEntries = (careerResult.data ?? []).map((entry, index) =>
      normalizeAgentCareerEntryRecord(
        profileId,
        entry as Partial<AgentCareerEntryRecord>,
        index,
      ),
    );

    agentManagedPlayerEntries = (managedPlayersResult.data ?? []).map((entry, index) =>
      normalizeAgentManagedPlayerEntryRecord(
        profileId,
        entry as Partial<AgentManagedPlayerEntryRecord>,
        index,
      ),
    );
  }

  let clubSeasonEntries: ClubSeasonEntryRecord[] = [];

  if (profile.role === "club_admin" && club.data) {
    const clubId = (club.data as { id: string }).id;
    const { data: seasonData, error: seasonError } = await supabase
      .from("club_season_entries")
      .select("id, club_id, start_year, end_year, category, league, notes, sort_order")
      .eq("club_id", clubId)
      .order("start_year", { ascending: false });

    if (seasonError) {
      throw seasonError;
    }

    clubSeasonEntries = (seasonData ?? []) as ClubSeasonEntryRecord[];
  }

  /*
    La RLS di `profile_contacts` è owner-only: a chi non è il proprietario la
    select qui sopra non restituisce nulla, nemmeno i canali che il
    proprietario ha reso pubblici. In quel caso — e solo in quello — si passa
    da `get_profile_public_contacts`, che è l unica porta autorizzata e
    applica la privacy nel backend: un canale con il flag spento torna NULL,
    quindi il suo valore non lascia mai il database (REV-PROF-05, "Privacy dei
    contatti").

    Best effort: se la funzione non è ancora stata deployata il Visitor vede
    quello che vedeva prima, cioè nessun contatto.
  */
  const publicContacts = profileContacts.data
    ? null
    : await fetchPublicProfileContacts(profileId);

  return normalizeUserProfile({
    agentCareerEntries,
    agentManagedPlayerEntries,
    agentProfile: (agentProfile.data as Partial<AgentProfileRecord> | null) ?? null,
    club: (club.data as Partial<ClubRecord> | null) ?? null,
    clubSeasonEntries,
    coachCareerEntries,
    coachDirectorCareerEntries,
    coachPlayerCareerEntries,
    coachProfile: (coachProfile.data as Partial<CoachProfileRecord> | null) ?? null,
    directorProfile: (directorProfile.data as Partial<DirectorProfileRecord> | null) ?? null,
    fanProfile: (fanProfile.data as Partial<FanProfileRecord> | null) ?? null,
    mediaProfile: (mediaProfile.data as Partial<MediaProfileRecord> | null) ?? null,
    mediaProfileAuthors:
      (mediaProfileAuthors.data as Partial<MediaProfileAuthorRecord>[] | null) ?? [],
    mediaProfileChannels:
      (mediaProfileChannels.data as Partial<MediaProfileChannelRecord>[] | null) ?? [],
    mediaProfileContacts:
      (mediaProfileContacts.data as Partial<MediaProfileContactRecord>[] | null) ?? [],
    mediaProfileVerifications:
      (mediaProfileVerifications.data as
        | Partial<MediaProfileVerificationRecord>[]
        | null) ?? [],
    playerCareerEntries,
    playerPalmares,
    playerProfile: (playerProfile.data as Partial<PlayerProfileRecord> | null) ?? null,
    privateContacts: privateContacts.data ?? publicContacts?.privateContacts,
    profile,
    profileContacts: profileContacts.data ?? publicContacts?.profileContacts,
    profileId,
    staffCareerEntries,
    staffCoachCareerEntries,
    staffPlayerCareerEntries,
    staffProfile: (staffProfile.data as Partial<StaffProfileRecord> | null) ?? null,
  });
}

export async function updateCompleteProfessionalProfile(
  input: CompleteProfessionalProfileUpdate,
) {
  const profileUpdatePayload: Record<string, unknown> = {
    avatar_url: input.profile.avatar_url,
    bio: input.profile.bio,
    birth_date: input.profile.birth_date,
    city: input.profile.city,
    full_name: input.profile.full_name,
    is_open_to_transfer: input.profile.is_open_to_transfer,
    languages: input.profile.languages,
    nationality: input.profile.nationality,
    region: input.profile.region,
  };

  if ("current_location_city" in input.profile) {
    profileUpdatePayload.current_location_city = input.profile.current_location_city ?? null;
  }

  if ("current_location_country" in input.profile) {
    profileUpdatePayload.current_location_country =
      input.profile.current_location_country ?? null;
  }

  // La copertina era di sola lettura: letta dal profilo, mai riscritta.
  if ("cover_url" in input.profile) {
    profileUpdatePayload.cover_url = input.profile.cover_url ?? null;
  }

  if ("domicile" in input.profile) {
    profileUpdatePayload.domicile = input.profile.domicile ?? null;
  }

  if ("gender" in input.profile) {
    profileUpdatePayload.gender = input.profile.gender ?? null;
  }

  if ("legal_status" in input.profile) {
    profileUpdatePayload.legal_status = input.profile.legal_status ?? null;
  }

  if ("residence" in input.profile) {
    profileUpdatePayload.residence = input.profile.residence ?? null;
  }

  if ("residence_country" in input.profile) {
    profileUpdatePayload.residence_country = input.profile.residence_country ?? null;
  }

  const { data: updatedProfile, error: profileError } = await supabase
    .from("profiles")
    .update(profileUpdatePayload)
    .eq("id", input.profileId)
    .select("id")
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!updatedProfile) {
    throw new Error("Profilo non trovato. Riprova dal primo passaggio.");
  }

  const { error: profileContactsError } = await supabase
    .from("profile_contacts")
    .upsert({
      email: input.userContacts.email || null,
      facebook: input.userContacts.facebook || null,
      instagram: input.userContacts.instagram || null,
      linkedin: input.userContacts.linkedin || null,
      tiktok: input.userContacts.tiktok || null,
      website: input.userContacts.website || null,
      youtube: input.userContacts.youtube || null,
      profile_id: input.profileId,
      show_email: input.userContacts.showEmail,
      show_facebook: input.userContacts.showFacebook,
      show_instagram: input.userContacts.showInstagram,
      show_linkedin: input.userContacts.showLinkedIn ?? false,
      show_tiktok: input.userContacts.showTikTok ?? false,
      show_website: input.userContacts.showWebsite ?? false,
      show_youtube: input.userContacts.showYouTube ?? false,
    });

  if (profileContactsError) {
    throw profileContactsError;
  }

  const { error: privateContactsError } = await supabase
    .from("profile_private_contacts")
    .upsert({
      phone: input.userContacts.phone || null,
      profile_id: input.profileId,
      show_phone: input.userContacts.showPhone ?? false,
    });

  if (privateContactsError) {
    throw privateContactsError;
  }

  if (input.role === "player" && input.playerProfile) {
    const { error: playerProfileError } = await supabase.rpc(
      "save_player_profile_details",
      {
        p_career_entries: input.playerCareerEntries.map((entry) =>
          toPlayerCareerEntryRpcPayload(entry, { includeId: Boolean(entry.id) }),
        ),
        p_player_profile: input.playerProfile,
        p_profile_id: input.profileId,
      },
    );

    if (playerProfileError) {
      throw playerProfileError;
    }
  }

  if (input.role === "player" && input.playerPalmares !== undefined) {
    const { error: palmaresError } = await supabase.rpc("save_player_palmares", {
      p_profile_id: input.profileId,
      p_entries: input.playerPalmares.map((entry, index) => ({
        competition_name: entry.competition_name,
        season_label: entry.season_label,
        club_name: entry.club_name,
        palmares_type: entry.palmares_type,
        sort_order: entry.sort_order ?? index,
      })),
    });

    if (palmaresError) {
      throw palmaresError;
    }
  }

  if (input.role === "coach" && input.coachProfile) {
    const { error } = await supabase.rpc("save_coach_career_details", {
      p_profile_id: input.profileId,
      p_coach_profile: input.coachProfile,
      p_career_entries: (input.coachCareerEntries ?? []).map((entry) => ({
        category: entry.category,
        // L'RPC legge id e club_id come uuid: gli id locali delle bozze
        // (`coach-<timestamp>-<n>`) vanno omessi, non inoltrati.
        ...(isUuidLike(entry.club_id) ? { club_id: entry.club_id } : {}),
        description: entry.description,
        experience_group_id: entry.experience_group_id,
        experience_type: entry.experience_type,
        ...(isUuidLike(entry.id) ? { id: entry.id } : {}),
        period_end_month: entry.period_end_month,
        period_end_year: entry.period_end_year,
        period_start_month: entry.period_start_month,
        period_start_year: entry.period_start_year,
        results: entry.results,
        role: entry.role,
        season_details: entry.season_details,
        seasons: entry.seasons,
        sort_order: entry.sort_order,
        team_logo_url: entry.team_logo_url,
        team_name: entry.team_name,
      })),
      p_director_entries: (input.coachDirectorCareerEntries ?? []).map((entry) => ({
        category: entry.category,
        description: entry.description,
        ...(isUuidLike(entry.id) ? { id: entry.id } : {}),
        role: entry.role,
        seasons: entry.seasons,
        sort_order: entry.sort_order,
        team_logo_url: entry.team_logo_url,
        team_name: entry.team_name,
      })),
      p_player_career_entries: (input.coachPlayerCareerEntries ?? []).map((entry) => ({
        appearances: entry.appearances,
        assists: entry.assists,
        awards: entry.awards,
        career_type: entry.career_type,
        category: entry.category,
        experience_group_id: entry.experience_group_id,
        goals: entry.goals,
        ...(isUuidLike(entry.id) ? { id: entry.id } : {}),
        minutes_played: entry.minutes_played,
        period_end_month: entry.period_end_month,
        period_start_month: entry.period_start_month,
        position: entry.position,
        season: entry.season,
        season_period: entry.season_period,
        sort_order: entry.sort_order,
        team_logo_url: entry.team_logo_url,
        team_name: entry.team_name,
      })),
    });

    if (error) {
      throw error;
    }
  }

  if (input.role === "staff" && input.staffProfile) {
    const { error } = await supabase.rpc("save_staff_career_details", {
      p_profile_id: input.profileId,
      p_staff_profile: {
        availability_type: input.staffProfile.availability_type,
        available_from: input.staffProfile.available_from,
        certifications: input.staffProfile.certifications,
        experience_summary: input.staffProfile.experience_summary,
        open_to_work: input.staffProfile.open_to_work,
        preferred_categories: input.staffProfile.preferred_categories,
        preferred_provinces: input.staffProfile.preferred_provinces,
        preferred_regions: input.staffProfile.preferred_regions,
        primary_staff_role: input.staffProfile.primary_staff_role,
        specialization: input.staffProfile.specialization,
        staff_roles: input.staffProfile.staff_roles,
      },
      p_career_entries: (input.staffCareerEntries ?? []).map((entry) => ({
        category: entry.category,
        ...(isUuidLike(entry.club_id) ? { club_id: entry.club_id } : {}),
        description: entry.description,
        experience_group_id: entry.experience_group_id,
        experience_type: entry.experience_type,
        head_coach_name: entry.head_coach_name,
        ...(isUuidLike(entry.id) ? { id: entry.id } : {}),
        period_end_month: entry.period_end_month,
        period_end_year: entry.period_end_year,
        period_start_month: entry.period_start_month,
        period_start_year: entry.period_start_year,
        results: entry.results,
        role: entry.role,
        season_details: entry.season_details,
        seasons: entry.seasons,
        sort_order: entry.sort_order,
        team_logo_url: entry.team_logo_url,
        team_name: entry.team_name,
      })),
      p_coach_career_entries: (input.staffCoachCareerEntries ?? []).map((entry) => ({
        category: entry.category,
        ...(isUuidLike(entry.club_id) ? { club_id: entry.club_id } : {}),
        description: entry.description,
        experience_group_id: entry.experience_group_id,
        experience_type: entry.experience_type,
        head_coach_name: entry.head_coach_name,
        ...(isUuidLike(entry.id) ? { id: entry.id } : {}),
        period_end_month: entry.period_end_month,
        period_end_year: entry.period_end_year,
        period_start_month: entry.period_start_month,
        period_start_year: entry.period_start_year,
        results: entry.results,
        role: entry.role,
        season_details: entry.season_details,
        seasons: entry.seasons,
        sort_order: entry.sort_order,
        team_logo_url: entry.team_logo_url,
        team_name: entry.team_name,
      })),
      p_player_career_entries: (input.staffPlayerCareerEntries ?? []).map((entry) => ({
        appearances: entry.appearances,
        assists: entry.assists,
        awards: entry.awards,
        career_type: entry.career_type,
        category: entry.category,
        experience_group_id: entry.experience_group_id,
        goals: entry.goals,
        ...(isUuidLike(entry.id) ? { id: entry.id } : {}),
        minutes_played: entry.minutes_played,
        period_end_month: entry.period_end_month,
        period_start_month: entry.period_start_month,
        position: entry.position,
        season: entry.season,
        season_period: entry.season_period,
        sort_order: entry.sort_order,
        team_logo_url: entry.team_logo_url,
        team_name: entry.team_name,
      })),
    });

    if (error) {
      if (shouldFallbackToLegacyStaffSave(error)) {
        await saveLegacyStaffProfile(input);
      } else {
        throw error;
      }
    }
  }

  if (input.role === "agent" && input.agentProfile) {
    /*
      REV-PROF-16: il numero di licenza non entra in `agent_profiles`, che è
      leggibile da chiunque. Viene estratto dal payload e scritto nella
      tabella owner-only prima della RPC, così nessun chiamante — onboarding
      compreso — deve ricordarsene.
    */
    const { license_number: licenseNumber, ...agentProfilePayload } =
      input.agentProfile;

    await saveAgentLicenseNumber({
      licenseNumber: licenseNumber ?? null,
      profileId: input.profileId,
    });

    const { error } = await supabase.rpc("save_agent_profile_details", {
      p_agent_profile: agentProfilePayload,
      /*
        REV-PROF-15: la carriera appartiene alla Gestione carriera, non
        all'editor di profilo. `null` dice alla RPC di non toccarla: senza,
        un salvataggio del profilo cancellerebbe gli incarichi scritti da
        quel modulo. Chi la possiede davvero — l'onboarding — continua a
        passare l'elenco completo, comprese le colonne canoniche.
      */
      p_career_entries:
        input.agentCareerEntries === undefined
          ? null
          : input.agentCareerEntries.map((entry, index) => ({
              agency_logo_url: entry.agency_logo_url,
              agency_name: entry.agency_name,
              description: entry.description ?? null,
              ...(isUuidLike(entry.id) ? { id: entry.id } : {}),
              is_current: entry.is_current ?? null,
              is_primary: entry.is_primary ?? null,
              manual_organization_id: entry.manual_organization_id ?? null,
              organization_city: entry.organization_city ?? null,
              organization_club_id: entry.organization_club_id ?? null,
              organization_country: entry.organization_country ?? null,
              organization_mode: entry.organization_mode ?? null,
              period_end_month: entry.period_end_month,
              period_end_precision: entry.period_end_precision ?? null,
              period_end_year: entry.period_end_year,
              period_start_month: entry.period_start_month,
              period_start_precision: entry.period_start_precision ?? null,
              period_start_year: entry.period_start_year,
              role: entry.role,
              sort_order: entry.sort_order ?? index,
            })),
      p_managed_player_entries: (input.agentManagedPlayerEntries ?? []).map((entry, index) => ({
        avatar_url: entry.avatar_url,
        birth_year: entry.birth_year,
        category_label: entry.category_label,
        display_name: entry.display_name,
        ...(isUuidLike(entry.id) ? { id: entry.id } : {}),
        is_free_agent: entry.is_free_agent,
        ...(isUuidLike(entry.linked_profile_id) ? { linked_profile_id: entry.linked_profile_id } : {}),
        primary_position: entry.primary_position,
        sort_order: entry.sort_order ?? index,
      })),
      p_profile_id: input.profileId,
    });

    if (error) {
      throw error;
    }
  }

  if (input.role === "director" && input.directorProfile) {
    const { error } = await supabase.from("director_profiles").upsert({
      availability_type: input.directorProfile.availability_type ?? null,
      career_entries: input.directorProfile.career_entries,
      coach_career_entries: input.directorProfile.coach_career_entries,
      club_types: input.directorProfile.club_types,
      director_roles: input.directorProfile.director_roles,
      experience_categories: input.directorProfile.experience_categories,
      has_other_football_experience:
        input.directorProfile.has_other_football_experience,
      has_played_football: input.directorProfile.has_played_football,
      main_focus: input.directorProfile.main_focus,
      market_involvement: input.directorProfile.market_involvement,
      media_items: input.directorProfile.media_items ?? [],
      open_to_clubs: input.directorProfile.open_to_clubs,
      open_to_others: input.directorProfile.open_to_others,
      open_to_players: input.directorProfile.open_to_players,
      open_to_staff: input.directorProfile.open_to_staff,
      open_to_work: input.directorProfile.open_to_work ?? true,
      other_career_entries: input.directorProfile.other_career_entries ?? [],
      other_football_roles: input.directorProfile.other_football_roles,
      other_role_label: input.directorProfile.other_role_label ?? null,
      player_career_entries: input.directorProfile.player_career_entries,
      preferred_provinces: input.directorProfile.preferred_provinces ?? [],
      preferred_regions: input.directorProfile.preferred_regions ?? [],
      previous_roles: input.directorProfile.previous_roles ?? [],
      primary_role: input.directorProfile.primary_role,
      profile_id: input.profileId,
      responsibilities: input.directorProfile.responsibilities,
      staff_career_entries: input.directorProfile.staff_career_entries ?? [],
    });

    if (error) {
      throw error;
    }
  }

  if (input.role === "fan" && input.fanProfile) {
    const { error } = await supabase.from("fan_profiles").upsert({
      favorite_club_id:
        typeof input.fanProfile.favorite_club_id === "string" &&
        input.fanProfile.favorite_club_id.trim()
          ? input.fanProfile.favorite_club_id.trim()
          : null,
      favorite_team_name:
        typeof input.fanProfile.favorite_team_name === "string" &&
        input.fanProfile.favorite_team_name.trim()
          ? input.fanProfile.favorite_team_name.trim()
          : null,
      football_types: input.fanProfile.football_types ?? [],
      geo_scope: normalizeFanGeoScope(input.fanProfile.geo_scope),
      // §R: solo la modalità attiva porta un elenco. Le selezioni della
      // modalità abbandonata restano nella bozza, non nel database.
      interest_provinces:
        input.fanProfile.geo_scope === "PROVINCES"
          ? (input.fanProfile.interest_provinces ?? [])
          : [],
      interest_regions:
        input.fanProfile.geo_scope === "REGIONS"
          ? input.fanProfile.interest_regions
          : [],
      profile_id: input.profileId,
    });

    if (error) {
      throw error;
    }
  }

  if (input.role === "media" && input.mediaProfile) {
    const { error } = await supabase.from("media_profiles").upsert({
      affiliation_name: input.mediaProfile.affiliation_name ?? null,
      affiliation_type: input.mediaProfile.affiliation_type ?? null,
      covered_competitions: input.mediaProfile.covered_competitions ?? [],
      covered_teams: input.mediaProfile.covered_teams ?? [],
      covered_territories: input.mediaProfile.covered_territories ?? [],
      covered_topics: input.mediaProfile.covered_topics ?? [],
      content_types: input.mediaProfile.content_types,
      creator_type: input.mediaProfile.creator_type ?? null,
      creator_type_other: input.mediaProfile.creator_type_other ?? null,
      editorial_type: input.mediaProfile.editorial_type ?? null,
      entity_name: input.mediaProfile.entity_name,
      focus_areas: input.mediaProfile.focus_areas,
      logo_url: input.mediaProfile.logo_url,
      media_kind: input.mediaProfile.media_kind ?? null,
      profile_id: input.profileId,
      short_description: input.mediaProfile.short_description,
      verification_status: input.mediaProfile.verification_status ?? "unverified",
    });

    if (error) {
      throw error;
    }
  }

  if (input.role === "club_admin" && input.club) {
    let clubId = input.club.id;

    if (!clubId) {
      const { data: existingClub, error: existingClubError } = await supabase
        .from("clubs")
        .select("id")
        .eq("owner_profile_id", input.profileId)
        .maybeSingle();

      if (existingClubError) {
        throw existingClubError;
      }

      clubId = existingClub?.id;
    }

    if (clubId) {
      const { error } = await supabase
        .from("clubs")
        .update({
          category: input.club.category,
          city: input.club.city,
          club_colors: input.club.club_colors,
          club_email: input.club.club_email,
          club_phone: input.club.club_phone,
          country: input.club.country,
          description: input.club.description,
          field_address: input.club.field_address,
          founding_year: input.club.founding_year,
          gallery_urls: input.club.gallery_urls,
          headquarters_address: input.club.headquarters_address,
          league: input.club.league,
          logo_url: input.club.logo_url,
          name: input.club.name,
          region: input.club.region,
          website_url: input.club.website_url,
        })
        .eq("id", clubId)
        .eq("owner_profile_id", input.profileId);

      if (error) {
        throw error;
      }
    } else {
      const { error } = await supabase.from("clubs").insert({
        category: input.club.category,
        city: input.club.city,
        club_colors: input.club.club_colors,
        club_email: input.club.club_email,
        club_phone: input.club.club_phone,
        country: input.club.country,
        description: input.club.description,
        field_address: input.club.field_address,
        founding_year: input.club.founding_year,
        gallery_urls: input.club.gallery_urls,
        headquarters_address: input.club.headquarters_address,
        league: input.club.league,
        logo_url: input.club.logo_url,
        name: input.club.name,
        owner_profile_id: input.profileId,
        region: input.club.region,
        slug: slugify(input.club.name),
        verification_status: "pending_review",
        website_url: input.club.website_url,
      });

      if (error) {
        throw error;
      }
    }
  }

  // Sync club season entries
  if (input.clubSeasonEntries.length > 0 || input.club) {
    const { data: clubRow } = await supabase
      .from("clubs")
      .select("id")
      .eq("owner_profile_id", input.profileId)
      .maybeSingle();

    if (clubRow) {
      // Delete existing entries
      const { error: deleteError } = await supabase
        .from("club_season_entries")
        .delete()
        .eq("club_id", clubRow.id);

      if (deleteError) {
        throw deleteError;
      }

      // Insert new entries
      if (input.clubSeasonEntries.length > 0) {
        const { error: insertError } = await supabase
          .from("club_season_entries")
          .insert(
            input.clubSeasonEntries.map((entry, index) => ({
              category: entry.category,
              club_id: clubRow.id,
              end_year: entry.end_year,
              league: entry.league,
              notes: entry.notes,
              sort_order: entry.sort_order ?? index,
              start_year: entry.start_year,
            })),
          );

        if (insertError) {
          throw insertError;
        }
      }
    }
  }
}

export async function updateFanFavoriteTeam(input: {
  favoriteClubId?: string | null;
  favoriteTeamName: string;
  profileId: string;
}) {
  const trimmedFavoriteTeamName = input.favoriteTeamName.trim();
  const favoriteTeamName =
    trimmedFavoriteTeamName.length > 0 ? trimmedFavoriteTeamName : null;
  const favoriteClubId =
    typeof input.favoriteClubId === "string" && input.favoriteClubId.trim()
      ? input.favoriteClubId.trim()
      : null;

  const { error } = await supabase.from("fan_profiles").upsert({
    favorite_club_id: favoriteClubId,
    favorite_team_name: favoriteTeamName,
    profile_id: input.profileId,
  });

  if (error) {
    throw error;
  }
}

export async function savePlayerProfileMedia(input: {
  mediaItems: PlayerMediaItemRecord[];
  playerProfile: NonNullable<CompleteProfessionalProfile["playerProfile"]>;
  profileId: string;
}) {
  const { error } = await supabase.from("player_profiles").upsert({
    availability_type: input.playerProfile.availability_type,
    height_cm: input.playerProfile.height_cm,
    highlight_video_url: input.playerProfile.highlight_video_url,
    media_items: input.mediaItems,
    media_urls: input.mediaItems.map((item) => item.url),
    preferred_categories: input.playerProfile.preferred_categories,
    preferred_foot: input.playerProfile.preferred_foot,
    primary_position: input.playerProfile.primary_position,
    profile_id: input.profileId,
    secondary_positions: input.playerProfile.secondary_positions,
    transfer_provinces: input.playerProfile.transfer_provinces,
    transfer_regions: input.playerProfile.transfer_regions,
    weight_kg: input.playerProfile.weight_kg,
    willing_to_change_club: input.playerProfile.willing_to_change_club,
  });

  if (error) {
    throw error;
  }
}

export async function saveCoachProfileMedia(input: {
  coachProfile: NonNullable<CompleteProfessionalProfile["coachProfile"]>;
  mediaItems: CoachMediaItemRecord[];
  profileId: string;
}) {
  const { error } = await supabase.from("coach_profiles").upsert({
    availability_type: input.coachProfile.availability_type,
    available_from: input.coachProfile.available_from,
    coached_categories: input.coachProfile.coached_categories,
    coached_clubs: input.coachProfile.coached_clubs,
    contract_end: input.coachProfile.contract_end,
    current_club: input.coachProfile.current_club,
    game_philosophy: input.coachProfile.game_philosophy,
    licenses: input.coachProfile.licenses,
    media_items: input.mediaItems,
    open_to_new_role: input.coachProfile.open_to_new_role,
    play_styles: input.coachProfile.play_styles,
    preferred_categories: input.coachProfile.preferred_categories,
    preferred_formation: input.coachProfile.preferred_formation,
    preferred_provinces: input.coachProfile.preferred_provinces,
    preferred_regions: input.coachProfile.preferred_regions,
    primary_role: input.coachProfile.primary_role,
    profile_id: input.profileId,
    secondary_formations: input.coachProfile.secondary_formations,
    technical_video_url: input.coachProfile.technical_video_url,
  });

  if (error) {
    throw error;
  }
}

export async function saveStaffProfileMedia(input: {
  mediaItems: StaffMediaItemRecord[];
  staffProfile: NonNullable<CompleteProfessionalProfile["staffProfile"]>;
  profileId: string;
}) {
  const { error } = await supabase.from("staff_profiles").upsert({
    availability_type: input.staffProfile.availability_type,
    certifications: input.staffProfile.certifications,
    experience_summary: input.staffProfile.experience_summary,
    media_items: input.mediaItems,
    open_to_work: input.staffProfile.open_to_work,
    preferred_categories: input.staffProfile.preferred_categories,
    preferred_provinces: input.staffProfile.preferred_provinces,
    preferred_regions: input.staffProfile.preferred_regions,
    primary_staff_role: input.staffProfile.primary_staff_role,
    profile_id: input.profileId,
    specialization: input.staffProfile.specialization,
    staff_roles: input.staffProfile.staff_roles,
  });

  if (error) {
    throw error;
  }
}

/**
 * Campi che un modulo della Modifica profilo Procuratore puo riscrivere da
 * solo (REV-PROF-16 §"Architettura del salvataggio").
 *
 * Nessuna colonna della carriera, del portfolio o dei media: quei dati hanno
 * i loro moduli, e un campo assente da questo tipo non puo finire nel patch
 * per distrazione.
 *
 * `license_number` e l'unico che non sta su `agent_profiles`: viaggia qui
 * perche per chi scrive e un campo della stessa schermata, ma
 * `saveAgentProfilePatch` lo dirotta sulla tabella owner-only.
 */
export type AgentProfilePatchInput = {
  activity_scopes?: string[];
  federation?: string | null;
  is_federation_licensed?: boolean;
  license_number?: string | null;
  open_to_clubs?: boolean;
  open_to_players?: boolean;
  operating_area_type?: string | null;
  operating_countries?: string[];
  operating_provinces?: string[];
  operating_regions?: string[];
  primary_activities?: string[];
  works_abroad?: boolean;
};

/**
 * Patch parziale di `agent_profiles` (REV-PROF-16).
 *
 * `save_agent_profile_details` riscrive la riga intera e ricostruisce il
 * portfolio: va bene per l'onboarding, che quei dati li possiede tutti, ma un
 * modulo che cambia due colonne non deve rimandare indietro le altre trenta —
 * e soprattutto non deve passare dalla RPC che cancella e reinserisce
 * `agent_managed_player_entries`. Un `update` mirato tocca solo ciò che il
 * modulo governa; la RLS `agents can manage own profile` resta la stessa
 * autorizzazione di sempre.
 */
export async function saveAgentProfilePatch(input: {
  patch: AgentProfilePatchInput;
  profileId: string;
}) {
  /*
    Il numero di licenza non sta su `agent_profiles`: quella tabella è
    leggibile da chiunque sia autenticato. Viaggia nello stesso patch perché
    per chi scrive è un campo della stessa schermata, ma finisce nella tabella
    owner-only, e la rotta è decisa qui una volta sola.
  */
  const { license_number: licenseNumber, ...agentPatch } = input.patch;

  if (licenseNumber !== undefined) {
    await saveAgentLicenseNumber({
      licenseNumber,
      profileId: input.profileId,
    });
  }

  if (Object.keys(agentPatch).length === 0) {
    return;
  }

  const { error } = await supabase
    .from("agent_profiles")
    .update(agentPatch)
    .eq("profile_id", input.profileId);

  if (error) {
    throw error;
  }
}

/**
 * Numero di licenza del Procuratore (REV-PROF-16 §"Numero di licenza").
 *
 * Vive in `agent_license_credentials`, che ha una RLS owner-only: non esce
 * mai nella proiezione pubblica del profilo, e un visitor che provasse a
 * leggerlo riceverebbe zero righe — non il valore.
 */
export async function fetchAgentLicenseNumber(
  profileId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("agent_license_credentials")
    .select("license_number")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data?.license_number as string | null) ?? "";
}

export async function saveAgentLicenseNumber(input: {
  licenseNumber: string | null;
  profileId: string;
}) {
  const { error } = await supabase.from("agent_license_credentials").upsert({
    license_number: input.licenseNumber || null,
    profile_id: input.profileId,
  });

  if (error) {
    throw error;
  }
}

export async function saveAgentProfileMedia(input: {
  agentProfile: NonNullable<CompleteProfessionalProfile["agentProfile"]>;
  mediaItems: AgentMediaItemRecord[];
  profileId: string;
}) {
  const { error } = await supabase.from("agent_profiles").upsert({
    activity_scopes: input.agentProfile.activity_scopes,
    agency_logo_url: input.agentProfile.agency_logo_url,
    agency_name: input.agentProfile.agency_name,
    agency_role: input.agentProfile.agency_role,
    federation: input.agentProfile.federation,
    has_no_previous_experience: input.agentProfile.has_no_previous_experience,
    has_other_football_experience: input.agentProfile.has_other_football_experience,
    has_played_football: input.agentProfile.has_played_football,
    is_federation_licensed: input.agentProfile.is_federation_licensed,
    main_player_roles: input.agentProfile.main_player_roles,
    managed_players_count: input.agentProfile.managed_players_count,
    media_items: input.mediaItems,
    open_to_clubs: input.agentProfile.open_to_clubs,
    open_to_players: input.agentProfile.open_to_players,
    operating_area_type: input.agentProfile.operating_area_type,
    operating_countries: input.agentProfile.operating_countries,
    operating_macro_areas: input.agentProfile.operating_macro_areas,
    operating_provinces: input.agentProfile.operating_provinces,
    operating_regions: input.agentProfile.operating_regions,
    operational_focuses: input.agentProfile.operational_focuses,
    operational_note: input.agentProfile.operational_note,
    other_football_roles: input.agentProfile.other_football_roles,
    period_end_month: input.agentProfile.period_end_month,
    period_end_year: input.agentProfile.period_end_year,
    period_start_month: input.agentProfile.period_start_month,
    period_start_year: input.agentProfile.period_start_year,
    player_career_entries: input.agentProfile.player_career_entries,
    player_types: input.agentProfile.player_types,
    portfolio_range: input.agentProfile.portfolio_range,
    primary_activities: input.agentProfile.primary_activities,
    previous_roles: input.agentProfile.previous_roles,
    professional_mode: input.agentProfile.professional_mode,
    profile_id: input.profileId,
    works_abroad: input.agentProfile.works_abroad,
  });

  if (error) {
    throw error;
  }
}

export async function saveDirectorProfileMedia(input: {
  directorProfile: NonNullable<CompleteProfessionalProfile["directorProfile"]>;
  mediaItems: DirectorMediaItemRecord[];
  profileId: string;
}) {
  const { error } = await supabase.from("director_profiles").upsert({
    availability_type: input.directorProfile.availability_type,
    career_entries: input.directorProfile.career_entries,
    coach_career_entries: input.directorProfile.coach_career_entries,
    club_types: input.directorProfile.club_types,
    director_roles: input.directorProfile.director_roles,
    experience_categories: input.directorProfile.experience_categories,
    has_other_football_experience:
      input.directorProfile.has_other_football_experience,
    has_played_football: input.directorProfile.has_played_football,
    main_focus: input.directorProfile.main_focus,
    market_involvement: input.directorProfile.market_involvement,
    media_items: input.mediaItems,
    open_to_clubs: input.directorProfile.open_to_clubs,
    open_to_others: input.directorProfile.open_to_others,
    open_to_players: input.directorProfile.open_to_players,
    open_to_staff: input.directorProfile.open_to_staff,
    open_to_work: input.directorProfile.open_to_work,
    other_career_entries: input.directorProfile.other_career_entries,
    other_football_roles: input.directorProfile.other_football_roles,
    other_role_label: input.directorProfile.other_role_label,
    player_career_entries: input.directorProfile.player_career_entries,
    preferred_provinces: input.directorProfile.preferred_provinces,
    preferred_regions: input.directorProfile.preferred_regions,
    previous_roles: input.directorProfile.previous_roles,
    primary_role: input.directorProfile.primary_role,
    profile_id: input.profileId,
    responsibilities: input.directorProfile.responsibilities,
    staff_career_entries: input.directorProfile.staff_career_entries,
  });

  if (error) {
    throw error;
  }
}

/** Le cinque corsie di carriera del Dirigente, tutte `jsonb` sulla stessa riga. */
export type DirectorCareerColumns = {
  career_entries: unknown[];
  coach_career_entries: unknown[];
  other_career_entries: unknown[];
  player_career_entries: unknown[];
  staff_career_entries: unknown[];
};

/**
 * Scrive la carriera del Dirigente (REV-PROF-10).
 *
 * **Qui sta l'atomicità del salvataggio multi-stagione**, e non è costruita
 * lato client: le cinque corsie sono cinque colonne della stessa riga di
 * `director_profiles`, quindi un `upsert` è una singola istruzione. Tre
 * stagioni entrano tutte o non entra nessuna — non esiste uno stato in cui
 * due sono salvate e la terza no, e un retry riscrive lo stesso insieme
 * invece di aggiungerne una copia.
 *
 * Le colonne non di carriera vengono riscritte con i valori appena letti,
 * come fa `saveDirectorProfileMedia`: l'upsert sostituisce la riga, quindi
 * ometterle le azzererebbe.
 */
export async function saveDirectorProfileCareer(input: {
  career: DirectorCareerColumns;
  directorProfile: NonNullable<CompleteProfessionalProfile["directorProfile"]>;
  profileId: string;
}) {
  const { error } = await supabase.from("director_profiles").upsert({
    availability_type: input.directorProfile.availability_type,
    career_entries: input.career.career_entries,
    club_types: input.directorProfile.club_types,
    coach_career_entries: input.career.coach_career_entries,
    director_roles: input.directorProfile.director_roles,
    experience_categories: input.directorProfile.experience_categories,
    has_other_football_experience:
      input.directorProfile.has_other_football_experience,
    has_played_football: input.directorProfile.has_played_football,
    main_focus: input.directorProfile.main_focus,
    market_involvement: input.directorProfile.market_involvement,
    media_items: input.directorProfile.media_items,
    open_to_clubs: input.directorProfile.open_to_clubs,
    open_to_others: input.directorProfile.open_to_others,
    open_to_players: input.directorProfile.open_to_players,
    open_to_staff: input.directorProfile.open_to_staff,
    open_to_work: input.directorProfile.open_to_work,
    other_career_entries: input.career.other_career_entries,
    other_football_roles: input.directorProfile.other_football_roles,
    other_role_label: input.directorProfile.other_role_label,
    player_career_entries: input.career.player_career_entries,
    preferred_provinces: input.directorProfile.preferred_provinces,
    preferred_regions: input.directorProfile.preferred_regions,
    previous_roles: input.directorProfile.previous_roles,
    primary_role: input.directorProfile.primary_role,
    profile_id: input.profileId,
    responsibilities: input.directorProfile.responsibilities,
    staff_career_entries: input.career.staff_career_entries,
  });

  if (error) {
    throw error;
  }
}

export async function searchTeams(query: string, limit = 5) {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length < 2) {
    return [] as TeamAutocompleteOption[];
  }

  const { data, error } = await supabase.rpc("search_teams", {
    p_query: trimmedQuery,
    p_limit: limit,
  });

  if (error) {
    throw error;
  }

  return ((data ?? []) as {
    city: string | null;
    id: string | null;
    is_community: boolean;
    logo_url: string | null;
    name: string;
  }[]).map((row) => ({
    city: row.city,
    id: row.id,
    isCustom: row.is_community,
    logoUrl: row.logo_url,
    name: row.name,
  }));
}

export async function searchAgentPlayerCandidates(query: string, limit = 8) {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length < 2) {
    return [] as AgentPlayerCandidate[];
  }

  const { data, error } = await supabase.rpc("search_agent_player_candidates", {
    p_limit: limit,
    p_query: trimmedQuery,
  });

  if (error) {
    throw error;
  }

  return ((data ?? []) as {
    avatar_url: string | null;
    birth_year: number | null;
    category_label: string | null;
    full_name: string;
    is_free_agent: boolean | null;
    primary_position: PlayerPosition | null;
    profile_id: string;
    region: string | null;
  }[]).map((row) => ({
    avatar_url: row.avatar_url,
    birth_year: normalizeNumber(row.birth_year),
    category_label: row.category_label,
    full_name: row.full_name,
    is_free_agent: Boolean(row.is_free_agent),
    primary_position: isPlayerPosition(row.primary_position)
      ? row.primary_position
      : null,
    profile_id: row.profile_id,
    region: row.region,
  }));
}

export async function searchDirectorMediaTargets(query: string, limit = 8) {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length < 2) {
    return [] as DirectorMediaTargetCandidate[];
  }

  const [profilesResult, clubsResult] = await Promise.all([
    supabase
      .from("profiles_with_age")
      .select("id, full_name, avatar_url, role, city, region")
      .in("role", ["player", "coach", "staff"])
      .ilike("full_name", `%${trimmedQuery}%`)
      .limit(limit),
    supabase
      .from("clubs")
      .select("id, name, city, region, category, logo_url")
      .ilike("name", `%${trimmedQuery}%`)
      .limit(limit),
  ]);

  if (profilesResult.error) {
    throw profilesResult.error;
  }

  if (clubsResult.error) {
    throw clubsResult.error;
  }

  const profileTargets = ((profilesResult.data ?? []) as {
    avatar_url: string | null;
    city: string | null;
    full_name: string;
    id: string;
    region: string | null;
    role: string | null;
  }[]).map((row) => ({
    avatar_url: row.avatar_url,
    display_name: row.full_name,
    role: row.role,
    subtitle: formatDirectorMediaProfileSubtitle(row.role, row.city, row.region),
    target_id: row.id,
    target_type: "profile" as const,
  }));

  const clubTargets = ((clubsResult.data ?? []) as {
    category: string | null;
    city: string | null;
    id: string;
    logo_url: string | null;
    name: string;
    region: string | null;
  }[]).map((row) => ({
    avatar_url: row.logo_url,
    display_name: row.name,
    role: "club",
    subtitle: [row.category, row.city ?? row.region].filter(Boolean).join(" - ") || null,
    target_id: row.id,
    target_type: "club" as const,
  }));

  return [...profileTargets, ...clubTargets].slice(0, limit);
}

function formatDirectorMediaProfileSubtitle(
  role: string | null,
  city: string | null,
  region: string | null,
) {
  const roleLabel =
    role === "player"
      ? "Calciatore"
      : role === "coach"
        ? "Allenatore"
        : role === "staff"
          ? "Staff"
          : "Profilo";
  const location = city || region;

  return location ? `${roleLabel} - ${location}` : roleLabel;
}

const COACH_ACHIEVEMENT_COLUMNS =
  "id, coach_profile_id, achievement_type, label, description, competition_name, season_label, club_name, club_id, sort_order, created_at";

/**
 * Crea o aggiorna un riconoscimento.
 *
 * L id viaggia solo quando esiste: passarlo vuoto farebbe fallire l upsert
 * (la colonna è `uuid`), passarlo sempre trasformerebbe ogni creazione in un
 * aggiornamento della riga sbagliata.
 */
export async function upsertCoachAchievement(
  data: Omit<
    CoachAchievementRecord,
    "created_at" | "id" | "club_id" | "club_name" | "competition_name" | "season_label"
  > &
    Partial<
      Pick<
        CoachAchievementRecord,
        "club_id" | "club_name" | "competition_name" | "season_label"
      >
    > & { id?: string },
): Promise<CoachAchievementRecord> {
  const { data: result, error } = await supabase
    .from("coach_achievements")
    .upsert({
      ...(data.id ? { id: data.id } : {}),
      achievement_type: data.achievement_type,
      club_id: data.club_id ?? null,
      club_name: data.club_name ?? null,
      coach_profile_id: data.coach_profile_id,
      competition_name: data.competition_name ?? null,
      description: data.description ?? null,
      label: data.label,
      season_label: data.season_label ?? null,
      sort_order: data.sort_order,
    })
    .select(COACH_ACHIEVEMENT_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return result as CoachAchievementRecord;
}

export async function deleteCoachAchievement(id: string): Promise<void> {
  const { error } = await supabase
    .from("coach_achievements")
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function checkDuplicateClubs(clubName: string, city: string) {
  const normalizedName = slugify(clubName);

  if (!normalizedName) {
    return [];
  }

  const { data, error } = await supabase
    .from("clubs")
    .select("id, name, city")
    .eq("normalized_name", normalizedName)
    .limit(3);

  if (error) {
    return [];
  }

  return (data ?? []) as { id: string; name: string; city: string }[];
}
