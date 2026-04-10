import type {
  AppRole,
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
  AgentCareerEntryRecord,
  AgentManagedPlayerEntryRecord,
  AgentPlayerCandidate,
  AgentProfileRecord,
} from "./agent-profile";
import {
  normalizePlayerMediaItems,
  type PlayerMediaItemRecord,
} from "./player-media";
import {
  normalizeStaffMediaItems,
  type StaffMediaItemRecord,
} from "./staff-media";

export type {
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
  full_name: string;
  id: string;
  is_open_to_transfer: boolean;
  languages: string[];
  nationality: string | null;
  region: string | null;
  role: AppRole;
};

export type UserContactsRecord = {
  email: string;
  facebook: string;
  instagram: string;
  phone: string;
  tiktok?: string;
  website?: string;
  youtube?: string;
  showEmail: boolean;
  showFacebook: boolean;
  showInstagram: boolean;
  showTikTok?: boolean;
  showWebsite?: boolean;
  showYouTube?: boolean;
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
  team_name: string;
  team_logo_url: string | null;
  season: string;
  category: string | null;
  position: string | null;
  appearances: number;
  goals: number;
  assists: number;
  sort_order: number;
};

export type CoachPlayerCareerEntryRecord = {
  id: string;
  coach_profile_id: string;
  team_name: string;
  team_logo_url: string | null;
  season: string;
  category: string | null;
  position: string | null;
  appearances: number;
  goals: number;
  assists: number;
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

export type CoachAchievementRecord = {
  id: string;
  coach_profile_id: string;
  achievement_type: 'campionato' | 'promozione' | 'coppa' | 'playoff' | 'altro';
  label: string;
  description: string | null;
  sort_order: number;
  created_at: string;
};

type CoachProfileRecord = {
  achievements: CoachAchievementRecord[];
  availability_type: string | null;
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
  league: string | null;
  logo_url: string | null;
  name: string;
  owner_profile_id: string;
  region: string;
  verification_status: string;
  website_url: string | null;
};

export type PlayerCareerEntryRecord = {
  appearances: number;
  assists: number;
  awards: string | null;
  club_id: string | null;
  club_name: string;
  competition_name: string | null;
  goals: number;
  id: string;
  minutes_played: number;
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
    agency_logo_url: string | null;
    agency_name: string | null;
    agency_role: string | null;
    federation: string | null;
    has_other_football_experience: boolean;
    has_played_football: boolean;
    is_federation_licensed: boolean;
    main_player_roles: PlayerPosition[];
    managed_players_count: string | null;
    open_to_clubs: boolean;
    open_to_players: boolean;
    operational_focuses: string[];
    operational_note: string | null;
    operating_macro_areas: string[];
    operating_regions: string[];
    other_football_roles: string[];
    period_end_month: string | null;
    period_end_year: number | null;
    period_start_month: string | null;
    period_start_year: number | null;
    player_career_entries: unknown[];
    player_types: string[];
  } | null;
  directorProfile?: {
    career_entries: unknown[];
    club_types: string[];
    director_roles: string[];
    experience_categories: string[];
    has_other_football_experience: boolean;
    has_played_football: boolean;
    main_focus: string | null;
    market_involvement: string | null;
    other_football_roles: string[];
    player_career_entries: unknown[];
    primary_role: string | null;
    responsibilities: string[];
  } | null;
  fanProfile?: {
    interest_categories: string[];
    interest_regions: string[];
  } | null;
  mediaProfile?: {
    affiliation_name: string | null;
    affiliation_type: string | null;
    content_types: string[];
    entity_name: string | null;
    focus_areas: string[];
    logo_url: string | null;
    short_description: string | null;
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
  agentCareerEntries?: AgentCareerEntryRecord[];
  agentManagedPlayerEntries?: AgentManagedPlayerEntryRecord[];
  clubSeasonEntries: ClubSeasonEntryInput[];
  coachProfile: {
    availability_type: string | null;
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
    full_name: string;
    is_open_to_transfer: boolean;
    languages: string[];
    nationality: string | null;
    region: string | null;
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
    club_id: entry.club_id,
    club_name: entry.club_name,
    competition_name: entry.competition_name,
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
    full_name: normalizeRequiredText(rawProfile?.full_name, "Profilo FootMe"),
    id: normalizeRequiredText(rawProfile?.id, profileId),
    is_open_to_transfer: normalizeBoolean(rawProfile?.is_open_to_transfer),
    languages: normalizeStringArray(rawProfile?.languages),
    nationality: normalizeOptionalText(rawProfile?.nationality),
    region: normalizeOptionalText(rawProfile?.region),
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
  const validTypes = ['campionato', 'promozione', 'coppa', 'playoff', 'altro'] as const;
  return {
    id: normalizeRequiredText(rawEntry.id, `${profileId}-achievement-${index}`),
    coach_profile_id: normalizeRequiredText(rawEntry.coach_profile_id, profileId),
    achievement_type: validTypes.includes(rawEntry.achievement_type as typeof validTypes[number])
      ? (rawEntry.achievement_type as CoachAchievementRecord['achievement_type'])
      : 'altro',
    label: normalizeRequiredText(rawEntry.label, ''),
    description: normalizeOptionalText(rawEntry.description),
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
    agency_logo_url: normalizeOptionalText(rawProfile.agency_logo_url),
    agency_name: normalizeOptionalText(rawProfile.agency_name),
    agency_role: normalizeOptionalText(rawProfile.agency_role),
    federation: normalizeOptionalText(rawProfile.federation),
    has_other_football_experience: normalizeBoolean(
      rawProfile.has_other_football_experience,
    ),
    has_played_football: normalizeBoolean(rawProfile.has_played_football),
    is_federation_licensed: normalizeBoolean(rawProfile.is_federation_licensed),
    main_player_roles: normalizePlayerPositions(rawProfile.main_player_roles),
    managed_players_count: normalizeOptionalText(rawProfile.managed_players_count),
    open_to_clubs: normalizeBoolean(rawProfile.open_to_clubs, true),
    open_to_players: normalizeBoolean(rawProfile.open_to_players, true),
    operational_focuses: normalizeStringArray(rawProfile.operational_focuses),
    operational_note: normalizeOptionalText(rawProfile.operational_note),
    operating_macro_areas: normalizeStringArray(rawProfile.operating_macro_areas),
    operating_regions: normalizeStringArray(rawProfile.operating_regions),
    other_football_roles: normalizeStringArray(rawProfile.other_football_roles),
    period_end_month: normalizeOptionalText(rawProfile.period_end_month),
    period_end_year: normalizeNumber(rawProfile.period_end_year),
    period_start_month: normalizeOptionalText(rawProfile.period_start_month),
    period_start_year: normalizeNumber(rawProfile.period_start_year),
    player_career_entries: Array.isArray(rawProfile.player_career_entries)
      ? rawProfile.player_career_entries
      : [],
    player_types: normalizeStringArray(rawProfile.player_types),
    profile_id: normalizeRequiredText(rawProfile.profile_id, profileId),
  } satisfies AgentProfileRecord;
}

function normalizeAgentCareerEntryRecord(
  profileId: string,
  rawEntry: Partial<AgentCareerEntryRecord>,
  index: number,
) {
  return {
    agency_logo_url: normalizeOptionalText(rawEntry.agency_logo_url),
    agency_name: normalizeRequiredText(rawEntry.agency_name, ""),
    agent_profile_id: normalizeRequiredText(rawEntry.agent_profile_id, profileId),
    id: normalizeRequiredText(rawEntry.id, `${profileId}-agent-career-${index}`),
    period_end_month: normalizeOptionalText(rawEntry.period_end_month),
    period_end_year: normalizeNumber(rawEntry.period_end_year),
    period_start_month: normalizeOptionalText(rawEntry.period_start_month),
    period_start_year: normalizeNumber(rawEntry.period_start_year),
    role: normalizeRequiredText(rawEntry.role, "Agente"),
    sort_order: normalizeNumber(rawEntry.sort_order) ?? index,
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

function normalizeCoachCareerEntryRecord(
  profileId: string,
  rawEntry: Partial<CoachCareerEntryRecord>,
  index: number,
) {
  return {
    id: normalizeRequiredText(rawEntry.id, `${profileId}-coach-career-${index}`),
    coach_profile_id: normalizeRequiredText(rawEntry.coach_profile_id, profileId),
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
    team_name: normalizeRequiredText(rawEntry.team_name, ""),
    team_logo_url: normalizeOptionalText(rawEntry.team_logo_url),
    season: normalizeRequiredText(rawEntry.season, ""),
    category: normalizeOptionalText(rawEntry.category),
    position: normalizeOptionalText(rawEntry.position),
    appearances: normalizeNumber(rawEntry.appearances) ?? 0,
    goals: normalizeNumber(rawEntry.goals) ?? 0,
    assists: normalizeNumber(rawEntry.assists) ?? 0,
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
    team_name: normalizeRequiredText(rawEntry.team_name, ""),
    team_logo_url: normalizeOptionalText(rawEntry.team_logo_url),
    season: normalizeRequiredText(rawEntry.season, ""),
    category: normalizeOptionalText(rawEntry.category),
    position: normalizeOptionalText(rawEntry.position),
    appearances: normalizeNumber(rawEntry.appearances) ?? 0,
    goals: normalizeNumber(rawEntry.goals) ?? 0,
    assists: normalizeNumber(rawEntry.assists) ?? 0,
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
    league: normalizeOptionalText(rawClub.league),
    logo_url: normalizeOptionalText(rawClub.logo_url),
    name: normalizeRequiredText(rawClub.name, ""),
    owner_profile_id: normalizeRequiredText(rawClub.owner_profile_id, profileId),
    region: normalizeRequiredText(rawClub.region, ""),
    verification_status: normalizeRequiredText(rawClub.verification_status, "unverified"),
    website_url: normalizeOptionalText(rawClub.website_url),
  } satisfies ClubRecord;
}

function normalizePlayerCareerEntryRecord(
  profileId: string,
  rawEntry: Partial<PlayerCareerEntryRecord>,
  index: number,
) {
  return {
    appearances: normalizeNumber(rawEntry.appearances) ?? 0,
    assists: normalizeNumber(rawEntry.assists) ?? 0,
    awards: normalizeOptionalText(rawEntry.awards),
    club_id:
      typeof rawEntry.club_id === "string" && rawEntry.club_id.trim()
        ? rawEntry.club_id
        : null,
    club_name: normalizeRequiredText(rawEntry.club_name, ""),
    competition_name: normalizeOptionalText(rawEntry.competition_name),
    goals: normalizeNumber(rawEntry.goals) ?? 0,
    id: normalizeRequiredText(rawEntry.id, `${profileId}-career-${index}`),
    minutes_played: normalizeNumber(rawEntry.minutes_played) ?? 0,
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
  playerCareerEntries?: Partial<PlayerCareerEntryRecord>[] | null;
  playerPalmares?: Partial<PlayerPalmaresRecord>[] | null;
  playerProfile?: Partial<PlayerProfileRecord> | null;
  profile: Partial<BaseProfileRecord> | null | undefined;
  profileId: string;
  profileContacts?: {
    email?: string | null;
    facebook?: string | null;
    instagram?: string | null;
    tiktok?: string | null;
    website?: string | null;
    youtube?: string | null;
    show_email?: boolean | null;
    show_facebook?: boolean | null;
    show_instagram?: boolean | null;
    show_tiktok?: boolean | null;
    show_website?: boolean | null;
    show_youtube?: boolean | null;
  } | null;
  privateContacts?: {
    phone?: string | null;
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
      phone: input.privateContacts?.phone ?? "",
      tiktok: input.profileContacts?.tiktok ?? "",
      website: input.profileContacts?.website ?? "",
      youtube: input.profileContacts?.youtube ?? "",
      showEmail: normalizeBoolean(input.profileContacts?.show_email),
      showFacebook: normalizeBoolean(input.profileContacts?.show_facebook),
      showInstagram: normalizeBoolean(input.profileContacts?.show_instagram),
      showTikTok: normalizeBoolean(input.profileContacts?.show_tiktok),
      showWebsite: normalizeBoolean(input.profileContacts?.show_website),
      showYouTube: normalizeBoolean(input.profileContacts?.show_youtube),
    },
  };
}

export async function getCompleteProfessionalProfile(profileId: string) {
  const { data: profileData, error: profileError } = await supabase
    .from("profiles_with_age")
    .select(
      "id, full_name, role, birth_date, age, nationality, bio, avatar_url, region, city, is_open_to_transfer, languages",
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
            "profile_id, licenses, coached_clubs, coached_categories, game_philosophy, technical_video_url, media_items, preferred_regions, preferred_provinces, availability_type, open_to_new_role, preferred_formation, secondary_formations, play_styles, current_club, contract_end, preferred_categories",
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
            "profile_id, agency_name, agency_logo_url, agency_role, managed_players_count, has_other_football_experience, other_football_roles, has_played_football, player_career_entries, player_types, main_player_roles, open_to_clubs, open_to_players, is_federation_licensed, federation, period_start_month, period_start_year, period_end_month, period_end_year, operational_focuses, operational_note, operating_macro_areas, operating_regions",
          )
          .eq("profile_id", profileId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    profile.role === "club_admin"
      ? supabase
          .from("clubs")
          .select(
            "id, owner_profile_id, name, city, region, category, league, description, logo_url, gallery_urls, founding_year, club_colors, country, headquarters_address, club_email, club_phone, website_url, field_address, verification_status",
          )
          .eq("owner_profile_id", profileId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("profile_contacts")
      .select(
        "instagram, facebook, email, tiktok, youtube, website, show_instagram, show_facebook, show_email, show_tiktok, show_youtube, show_website",
      )
      .eq("profile_id", profileId)
      .maybeSingle(),
    supabase
      .from("profile_private_contacts")
      .select("phone")
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
          "id, player_profile_id, season_label, club_id, club_name, competition_name, appearances, goals, assists, minutes_played, awards, sort_order, team_logo_url, season_period, period_start_month, period_end_month",
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
          "id, coach_profile_id, team_name, team_logo_url, club_id, category, role, experience_type, seasons, period_start_month, period_start_year, period_end_month, period_end_year, season_details, results, description, sort_order",
        )
        .eq("coach_profile_id", profileId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false }),
      supabase
        .from("coach_player_career_entries")
        .select(
          "id, coach_profile_id, team_name, team_logo_url, season, category, position, appearances, goals, assists, sort_order",
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
          "id, coach_profile_id, achievement_type, label, description, sort_order, created_at",
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
          "id, staff_profile_id, team_name, team_logo_url, club_id, category, role, experience_type, seasons, period_start_month, period_start_year, period_end_month, period_end_year, season_details, results, description, head_coach_name, sort_order",
        )
        .eq("staff_profile_id", profileId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("staff_coach_career_entries")
        .select(
          "id, staff_profile_id, team_name, team_logo_url, club_id, category, role, experience_type, seasons, period_start_month, period_start_year, period_end_month, period_end_year, season_details, results, description, head_coach_name, sort_order",
        )
        .eq("staff_profile_id", profileId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("staff_player_career_entries")
        .select(
          "id, staff_profile_id, team_name, team_logo_url, season, category, position, appearances, goals, assists, sort_order",
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
          "id, agent_profile_id, agency_name, agency_logo_url, role, period_start_month, period_start_year, period_end_month, period_end_year, sort_order",
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
    playerCareerEntries,
    playerPalmares,
    playerProfile: (playerProfile.data as Partial<PlayerProfileRecord> | null) ?? null,
    privateContacts: privateContacts.data,
    profile,
    profileContacts: profileContacts.data,
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
  const { data: updatedProfile, error: profileError } = await supabase
    .from("profiles")
    .update({
      avatar_url: input.profile.avatar_url,
      bio: input.profile.bio,
      birth_date: input.profile.birth_date,
      city: input.profile.city,
      full_name: input.profile.full_name,
      is_open_to_transfer: input.profile.is_open_to_transfer,
      languages: input.profile.languages,
      nationality: input.profile.nationality,
      region: input.profile.region,
    })
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
      tiktok: input.userContacts.tiktok || null,
      website: input.userContacts.website || null,
      youtube: input.userContacts.youtube || null,
      profile_id: input.profileId,
      show_email: input.userContacts.showEmail,
      show_facebook: input.userContacts.showFacebook,
      show_instagram: input.userContacts.showInstagram,
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
        club_id: entry.club_id,
        description: entry.description,
        experience_type: entry.experience_type,
        id: entry.id,
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
        id: entry.id,
        role: entry.role,
        seasons: entry.seasons,
        sort_order: entry.sort_order,
        team_logo_url: entry.team_logo_url,
        team_name: entry.team_name,
      })),
      p_player_career_entries: (input.coachPlayerCareerEntries ?? []).map((entry) => ({
        appearances: entry.appearances,
        assists: entry.assists,
        category: entry.category,
        goals: entry.goals,
        id: entry.id,
        position: entry.position,
        season: entry.season,
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
        category: entry.category,
        goals: entry.goals,
        ...(isUuidLike(entry.id) ? { id: entry.id } : {}),
        position: entry.position,
        season: entry.season,
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
    const { error } = await supabase.rpc("save_agent_profile_details", {
      p_agent_profile: input.agentProfile,
      p_career_entries: (input.agentCareerEntries ?? []).map((entry, index) => ({
        agency_logo_url: entry.agency_logo_url,
        agency_name: entry.agency_name,
        ...(isUuidLike(entry.id) ? { id: entry.id } : {}),
        period_end_month: entry.period_end_month,
        period_end_year: entry.period_end_year,
        period_start_month: entry.period_start_month,
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
      career_entries: input.directorProfile.career_entries,
      club_types: input.directorProfile.club_types,
      director_roles: input.directorProfile.director_roles,
      experience_categories: input.directorProfile.experience_categories,
      has_other_football_experience:
        input.directorProfile.has_other_football_experience,
      has_played_football: input.directorProfile.has_played_football,
      main_focus: input.directorProfile.main_focus,
      market_involvement: input.directorProfile.market_involvement,
      other_football_roles: input.directorProfile.other_football_roles,
      player_career_entries: input.directorProfile.player_career_entries,
      primary_role: input.directorProfile.primary_role,
      profile_id: input.profileId,
      responsibilities: input.directorProfile.responsibilities,
    });

    if (error) {
      throw error;
    }
  }

  if (input.role === "fan" && input.fanProfile) {
    const { error } = await supabase.from("fan_profiles").upsert({
      interest_categories: input.fanProfile.interest_categories,
      interest_regions: input.fanProfile.interest_regions,
      profile_id: input.profileId,
    });

    if (error) {
      throw error;
    }
  }

  if (input.role === "media" && input.mediaProfile) {
    const { error } = await supabase.from("media_profiles").upsert({
      affiliation_name: input.mediaProfile.affiliation_name,
      affiliation_type: input.mediaProfile.affiliation_type,
      content_types: input.mediaProfile.content_types,
      entity_name: input.mediaProfile.entity_name,
      focus_areas: input.mediaProfile.focus_areas,
      logo_url: input.mediaProfile.logo_url,
      profile_id: input.profileId,
      short_description: input.mediaProfile.short_description,
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
    coached_categories: input.coachProfile.coached_categories,
    coached_clubs: input.coachProfile.coached_clubs,
    game_philosophy: input.coachProfile.game_philosophy,
    licenses: input.coachProfile.licenses,
    media_items: input.mediaItems,
    open_to_new_role: input.coachProfile.open_to_new_role,
    preferred_provinces: input.coachProfile.preferred_provinces,
    preferred_regions: input.coachProfile.preferred_regions,
    profile_id: input.profileId,
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

export async function upsertCoachAchievement(
  data: Omit<CoachAchievementRecord, 'id' | 'created_at'>,
): Promise<CoachAchievementRecord> {
  const { data: result, error } = await supabase
    .from("coach_achievements")
    .upsert({
      coach_profile_id: data.coach_profile_id,
      achievement_type: data.achievement_type,
      label: data.label,
      description: data.description ?? null,
      sort_order: data.sort_order,
    })
    .select("id, coach_profile_id, achievement_type, label, description, sort_order, created_at")
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
