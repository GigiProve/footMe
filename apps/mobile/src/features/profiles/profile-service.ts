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
  normalizePlayerMediaItems,
  type PlayerMediaItemRecord,
} from "./player-media";

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

type CoachProfileRecord = {
  availability_type: string | null;
  coached_categories: string[];
  coached_clubs: string[];
  game_philosophy: string | null;
  licenses: string[];
  open_to_new_role: boolean;
  preferred_provinces: string[];
  preferred_regions: string[];
  profile_id: string;
  technical_video_url: string | null;
};

type StaffProfileRecord = {
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
  club: ClubRecord | null;
  clubSeasonEntries: ClubSeasonEntryRecord[];
  coachProfile: CoachProfileRecord | null;
  playerCareerEntries: PlayerCareerEntryRecord[];
  playerPalmares: PlayerPalmaresRecord[];
  playerProfile: PlayerProfileRecord | null;
  profile: BaseProfileRecord;
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
    federation: string | null;
    has_other_football_experience: boolean;
    has_played_football: boolean;
    is_federation_licensed: boolean;
    main_player_roles: PlayerPosition[];
    managed_players_count: string | null;
    open_to_clubs: boolean;
    open_to_players: boolean;
    other_football_roles: string[];
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
  clubSeasonEntries: ClubSeasonEntryInput[];
  coachProfile: {
    availability_type: string | null;
    coached_categories: string[];
    coached_clubs: string[];
    game_philosophy: string | null;
    licenses: string[];
    open_to_new_role: boolean;
    preferred_provinces: string[];
    preferred_regions: string[];
    technical_video_url: string | null;
  } | null;
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

function normalizeCoachProfileRecord(
  profileId: string,
  rawProfile: Partial<CoachProfileRecord> | null | undefined,
) {
  if (!rawProfile) {
    return null;
  }

  return {
    availability_type: normalizeOptionalText(rawProfile.availability_type),
    coached_categories: normalizeStringArray(rawProfile.coached_categories),
    coached_clubs: normalizeStringArray(rawProfile.coached_clubs),
    game_philosophy: normalizeOptionalText(rawProfile.game_philosophy),
    licenses: normalizeStringArray(rawProfile.licenses),
    open_to_new_role: normalizeBoolean(rawProfile.open_to_new_role),
    preferred_provinces: normalizeStringArray(rawProfile.preferred_provinces),
    preferred_regions: normalizeStringArray(rawProfile.preferred_regions),
    profile_id: normalizeRequiredText(rawProfile.profile_id, profileId),
    technical_video_url: normalizeOptionalText(rawProfile.technical_video_url),
  } satisfies CoachProfileRecord;
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
  club?: Partial<ClubRecord> | null;
  clubSeasonEntries?: ClubSeasonEntryRecord[];
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
  staffProfile?: Partial<StaffProfileRecord> | null;
}): CompleteProfessionalProfile {
  return {
    club: normalizeClubRecord(input.profileId, input.club),
    clubSeasonEntries: input.clubSeasonEntries ?? [],
    coachProfile: normalizeCoachProfileRecord(input.profileId, input.coachProfile),
    playerCareerEntries: (input.playerCareerEntries ?? []).map((entry, index) =>
      normalizePlayerCareerEntryRecord(input.profileId, entry, index),
    ),
    playerPalmares: (input.playerPalmares ?? []).map((entry, index) =>
      normalizePlayerPalmaresRecord(input.profileId, entry, index),
    ),
    playerProfile: normalizePlayerProfileRecord(input.profileId, input.playerProfile),
    profile: normalizeBaseProfileRecord(input.profileId, input.profile),
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
  const [playerProfile, coachProfile, staffProfile, club, profileContacts, privateContacts] =
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
            "profile_id, licenses, coached_clubs, coached_categories, game_philosophy, technical_video_url, preferred_regions, preferred_provinces, availability_type, open_to_new_role",
          )
          .eq("profile_id", profileId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    profile.role === "staff"
      ? supabase
          .from("staff_profiles")
          .select(
            "profile_id, specialization, availability_type, available_from, preferred_categories, preferred_provinces, primary_staff_role, staff_roles, experience_entries, experience_summary, certifications, preferred_regions, open_to_work",
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
    club: (club.data as Partial<ClubRecord> | null) ?? null,
    clubSeasonEntries,
    coachProfile: (coachProfile.data as Partial<CoachProfileRecord> | null) ?? null,
    playerCareerEntries,
    playerPalmares,
    playerProfile: (playerProfile.data as Partial<PlayerProfileRecord> | null) ?? null,
    privateContacts: privateContacts.data,
    profile,
    profileContacts: profileContacts.data,
    profileId,
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
    const { error } = await supabase.from("coach_profiles").upsert({
      availability_type: input.coachProfile.availability_type,
      coached_categories: input.coachProfile.coached_categories,
      coached_clubs: input.coachProfile.coached_clubs,
      game_philosophy: input.coachProfile.game_philosophy,
      licenses: input.coachProfile.licenses,
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

  if (input.role === "staff" && input.staffProfile) {
    const { error } = await supabase.from("staff_profiles").upsert({
      availability_type: input.staffProfile.availability_type,
      available_from: input.staffProfile.available_from,
      certifications: input.staffProfile.certifications,
      experience_entries: input.staffProfile.experience_entries,
      experience_summary: input.staffProfile.experience_summary,
      open_to_work: input.staffProfile.open_to_work,
      primary_staff_role: input.staffProfile.primary_staff_role,
      preferred_categories: input.staffProfile.preferred_categories,
      preferred_provinces: input.staffProfile.preferred_provinces,
      preferred_regions: input.staffProfile.preferred_regions,
      profile_id: input.profileId,
      specialization: input.staffProfile.specialization,
      staff_roles: input.staffProfile.staff_roles,
    });

    if (error) {
      throw error;
    }
  }

  if (input.role === "agent" && input.agentProfile) {
    const { error } = await supabase.from("agent_profiles").upsert({
      agency_logo_url: input.agentProfile.agency_logo_url,
      agency_name: input.agentProfile.agency_name,
      federation: input.agentProfile.federation,
      has_other_football_experience:
        input.agentProfile.has_other_football_experience,
      has_played_football: input.agentProfile.has_played_football,
      is_federation_licensed: input.agentProfile.is_federation_licensed,
      main_player_roles: input.agentProfile.main_player_roles,
      managed_players_count: input.agentProfile.managed_players_count,
      open_to_clubs: input.agentProfile.open_to_clubs,
      open_to_players: input.agentProfile.open_to_players,
      other_football_roles: input.agentProfile.other_football_roles,
      player_career_entries: input.agentProfile.player_career_entries,
      player_types: input.agentProfile.player_types,
      profile_id: input.profileId,
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
