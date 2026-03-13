import type { AppRole, StaffSpecialization } from "../onboarding/create-initial-profile";

import { slugify } from "../../lib/slugify";
import { supabase } from "../../lib/supabase";
import {
  DEFAULT_PLAYER_PRIMARY_POSITION,
  isPlayerPosition,
  type PlayerExperiencePayload,
  type PlayerPosition,
  type PreferredFoot,
  type TeamAutocompleteOption,
} from "./player-sports";

type BaseProfileRecord = {
  age: number | null;
  avatar_url: string | null;
  bio: string | null;
  birth_date: string | null;
  city: string | null;
  full_name: string;
  id: string;
  is_available: boolean;
  is_open_to_transfer: boolean;
  nationality: string | null;
  region: string | null;
  role: AppRole;
};

export type UserContactsRecord = {
  email: string;
  facebook: string;
  instagram: string;
  phone: string;
  showEmail: boolean;
  showFacebook: boolean;
  showInstagram: boolean;
};

type PlayerProfileRecord = {
  height_cm: number | null;
  highlight_video_url: string | null;
  preferred_categories: string[];
  preferred_foot: PreferredFoot | null;
  primary_position: PlayerPosition;
  profile_id: string;
  secondary_position: PlayerPosition | null;
  transfer_regions: string[];
  weight_kg: number | null;
  willing_to_change_club: boolean;
};

type CoachProfileRecord = {
  coached_categories: string[];
  coached_clubs: string[];
  game_philosophy: string | null;
  licenses: string[];
  open_to_new_role: boolean;
  preferred_regions: string[];
  profile_id: string;
  technical_video_url: string | null;
};

type StaffProfileRecord = {
  certifications: string[];
  experience_summary: string | null;
  open_to_work: boolean;
  preferred_regions: string[];
  profile_id: string;
  specialization: StaffSpecialization;
};

type ClubRecord = {
  category: string | null;
  city: string;
  description: string | null;
  gallery_urls: string[];
  id: string;
  league: string | null;
  logo_url: string | null;
  name: string;
  owner_profile_id: string;
  region: string;
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
  player_profile_id: string;
  season_label: string;
  sort_order: number;
  team_logo_url: string | null;
};

export type CompleteProfessionalProfile = {
  club: ClubRecord | null;
  coachProfile: CoachProfileRecord | null;
  playerCareerEntries: PlayerCareerEntryRecord[];
  playerProfile: PlayerProfileRecord | null;
  profile: BaseProfileRecord;
  staffProfile: StaffProfileRecord | null;
  userContacts: UserContactsRecord;
};

export type PlayerCareerEntryInput = PlayerExperiencePayload;

export type CompleteProfessionalProfileUpdate = {
  club: {
    category: string | null;
    city: string;
    description: string | null;
    gallery_urls: string[];
    id?: string;
    league: string | null;
    logo_url: string | null;
    name: string;
    region: string;
  } | null;
  coachProfile: {
    coached_categories: string[];
    coached_clubs: string[];
    game_philosophy: string | null;
    licenses: string[];
    open_to_new_role: boolean;
    preferred_regions: string[];
    technical_video_url: string | null;
  } | null;
  playerCareerEntries: PlayerCareerEntryInput[];
  playerProfile: {
    height_cm: number | null;
    highlight_video_url: string | null;
    preferred_categories: string[];
    preferred_foot: PreferredFoot | null;
    primary_position: PlayerPosition;
    secondary_position: PlayerPosition | null;
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
    is_available: boolean;
    is_open_to_transfer: boolean;
    nationality: string | null;
    region: string | null;
  };
  profileId: string;
  role: AppRole;
  staffProfile: {
    certifications: string[];
    experience_summary: string | null;
    open_to_work: boolean;
    preferred_regions: string[];
    specialization: StaffSpecialization;
  } | null;
  userContacts: UserContactsRecord;
};

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
  return value === "coach" || value === "staff" || value === "club_admin" ? value : "player";
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
    is_available: normalizeBoolean(rawProfile?.is_available),
    is_open_to_transfer: normalizeBoolean(rawProfile?.is_open_to_transfer),
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

  return {
    height_cm: normalizeNumber(rawProfile.height_cm),
    highlight_video_url: normalizeOptionalText(rawProfile.highlight_video_url),
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
    secondary_position: isPlayerPosition(rawProfile.secondary_position)
      ? rawProfile.secondary_position
      : null,
    transfer_regions: normalizeStringArray(rawProfile.transfer_regions),
    weight_kg: normalizeNumber(rawProfile.weight_kg),
    willing_to_change_club: normalizeBoolean(rawProfile.willing_to_change_club),
  } satisfies PlayerProfileRecord;
}

function normalizeCoachProfileRecord(
  profileId: string,
  rawProfile: Partial<CoachProfileRecord> | null | undefined,
) {
  if (!rawProfile) {
    return null;
  }

  return {
    coached_categories: normalizeStringArray(rawProfile.coached_categories),
    coached_clubs: normalizeStringArray(rawProfile.coached_clubs),
    game_philosophy: normalizeOptionalText(rawProfile.game_philosophy),
    licenses: normalizeStringArray(rawProfile.licenses),
    open_to_new_role: normalizeBoolean(rawProfile.open_to_new_role),
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
    certifications: normalizeStringArray(rawProfile.certifications),
    experience_summary: normalizeOptionalText(rawProfile.experience_summary),
    open_to_work: normalizeBoolean(rawProfile.open_to_work),
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
  } satisfies StaffProfileRecord;
}

function normalizeClubRecord(profileId: string, rawClub: Partial<ClubRecord> | null | undefined) {
  if (!rawClub) {
    return null;
  }

  return {
    category: normalizeOptionalText(rawClub.category),
    city: normalizeRequiredText(rawClub.city, ""),
    description: normalizeOptionalText(rawClub.description),
    gallery_urls: normalizeStringArray(rawClub.gallery_urls),
    id: normalizeRequiredText(rawClub.id, profileId),
    league: normalizeOptionalText(rawClub.league),
    logo_url: normalizeOptionalText(rawClub.logo_url),
    name: normalizeRequiredText(rawClub.name, ""),
    owner_profile_id: normalizeRequiredText(rawClub.owner_profile_id, profileId),
    region: normalizeRequiredText(rawClub.region, ""),
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
    player_profile_id: normalizeRequiredText(rawEntry.player_profile_id, profileId),
    season_label: normalizeRequiredText(rawEntry.season_label, ""),
    sort_order: normalizeNumber(rawEntry.sort_order) ?? index,
    team_logo_url: normalizeOptionalText(rawEntry.team_logo_url),
  } satisfies PlayerCareerEntryRecord;
}

export function normalizeUserProfile(input: {
  club?: Partial<ClubRecord> | null;
  coachProfile?: Partial<CoachProfileRecord> | null;
  playerCareerEntries?: Partial<PlayerCareerEntryRecord>[] | null;
  playerProfile?: Partial<PlayerProfileRecord> | null;
  profile: Partial<BaseProfileRecord> | null | undefined;
  profileId: string;
  profileContacts?: {
    email?: string | null;
    facebook?: string | null;
    instagram?: string | null;
    show_email?: boolean | null;
    show_facebook?: boolean | null;
    show_instagram?: boolean | null;
  } | null;
  privateContacts?: {
    phone?: string | null;
  } | null;
  staffProfile?: Partial<StaffProfileRecord> | null;
}): CompleteProfessionalProfile {
  return {
    club: normalizeClubRecord(input.profileId, input.club),
    coachProfile: normalizeCoachProfileRecord(input.profileId, input.coachProfile),
    playerCareerEntries: (input.playerCareerEntries ?? []).map((entry, index) =>
      normalizePlayerCareerEntryRecord(input.profileId, entry, index),
    ),
    playerProfile: normalizePlayerProfileRecord(input.profileId, input.playerProfile),
    profile: normalizeBaseProfileRecord(input.profileId, input.profile),
    staffProfile: normalizeStaffProfileRecord(input.profileId, input.staffProfile),
    userContacts: {
      email: input.profileContacts?.email ?? "",
      facebook: input.profileContacts?.facebook ?? "",
      instagram: input.profileContacts?.instagram ?? "",
      phone: input.privateContacts?.phone ?? "",
      showEmail: normalizeBoolean(input.profileContacts?.show_email),
      showFacebook: normalizeBoolean(input.profileContacts?.show_facebook),
      showInstagram: normalizeBoolean(input.profileContacts?.show_instagram),
    },
  };
}

export async function getCompleteProfessionalProfile(profileId: string) {
  const { data: profileData, error: profileError } = await supabase
    .from("profiles_with_age")
    .select(
      "id, full_name, role, birth_date, age, nationality, bio, avatar_url, region, city, is_available, is_open_to_transfer",
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
            "profile_id, preferred_foot, height_cm, weight_kg, primary_position, secondary_position, willing_to_change_club, transfer_regions, preferred_categories, highlight_video_url",
          )
          .eq("profile_id", profileId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    profile.role === "coach"
      ? supabase
          .from("coach_profiles")
          .select(
            "profile_id, licenses, coached_clubs, coached_categories, game_philosophy, technical_video_url, preferred_regions, open_to_new_role",
          )
          .eq("profile_id", profileId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    profile.role === "staff"
      ? supabase
          .from("staff_profiles")
          .select(
            "profile_id, specialization, experience_summary, certifications, preferred_regions, open_to_work",
          )
          .eq("profile_id", profileId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    profile.role === "club_admin"
      ? supabase
          .from("clubs")
          .select(
            "id, owner_profile_id, name, city, region, category, league, description, logo_url, gallery_urls",
          )
          .eq("owner_profile_id", profileId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("profile_contacts")
      .select("instagram, facebook, email, show_instagram, show_facebook, show_email")
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

  if (profile.role === "player") {
    const { data: careerData, error: careerError } = await supabase
      .from("player_career_entries")
      .select(
        "id, player_profile_id, season_label, club_id, club_name, competition_name, appearances, goals, assists, minutes_played, awards, sort_order, team_logo_url",
      )
      .eq("player_profile_id", profileId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (careerError) {
      throw careerError;
    }

    playerCareerEntries = (careerData ?? []).map((entry, index) =>
      normalizePlayerCareerEntryRecord(profileId, entry as Partial<PlayerCareerEntryRecord>, index),
    );
  }

  return normalizeUserProfile({
    club: (club.data as Partial<ClubRecord> | null) ?? null,
    coachProfile: (coachProfile.data as Partial<CoachProfileRecord> | null) ?? null,
    playerCareerEntries,
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
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      avatar_url: input.profile.avatar_url,
      bio: input.profile.bio,
      birth_date: input.profile.birth_date,
      city: input.profile.city,
      full_name: input.profile.full_name,
      is_available: input.profile.is_available,
      is_open_to_transfer: input.profile.is_open_to_transfer,
      nationality: input.profile.nationality,
      region: input.profile.region,
    })
    .eq("id", input.profileId);

  if (profileError) {
    throw profileError;
  }

  const { error: profileContactsError } = await supabase
    .from("profile_contacts")
    .upsert({
      email: input.userContacts.email || null,
      facebook: input.userContacts.facebook || null,
      instagram: input.userContacts.instagram || null,
      profile_id: input.profileId,
      show_email: input.userContacts.showEmail,
      show_facebook: input.userContacts.showFacebook,
      show_instagram: input.userContacts.showInstagram,
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
    const { error: playerProfileError } = await supabase
      .from("player_profiles")
      .upsert({
        height_cm: input.playerProfile.height_cm,
        highlight_video_url: input.playerProfile.highlight_video_url,
        preferred_categories: input.playerProfile.preferred_categories,
        preferred_foot: input.playerProfile.preferred_foot,
        primary_position: input.playerProfile.primary_position,
        profile_id: input.profileId,
        secondary_position: input.playerProfile.secondary_position,
        transfer_regions: input.playerProfile.transfer_regions,
        weight_kg: input.playerProfile.weight_kg,
        willing_to_change_club: input.playerProfile.willing_to_change_club,
      });

    if (playerProfileError) {
      throw playerProfileError;
    }

    const currentIds = input.playerCareerEntries
      .map((entry) => entry.id)
      .filter((entryId): entryId is string => !!entryId);

    const existingEntries = input.playerCareerEntries
      .filter((entry) => !!entry.id)
        .map((entry) => ({
          appearances: entry.appearances,
          assists: entry.assists,
          awards: entry.awards,
          club_id: entry.club_id,
          club_name: entry.club_name,
          competition_name: entry.competition_name,
          goals: entry.goals,
          id: entry.id,
          minutes_played: entry.minutes_played,
          player_profile_id: input.profileId,
          season_label: entry.season_label,
          sort_order: entry.sort_order,
          team_logo_url: entry.team_logo_url,
        }));
    const newEntries = input.playerCareerEntries
      .filter((entry) => !entry.id)
      .map((entry) => ({
        appearances: entry.appearances,
        assists: entry.assists,
        awards: entry.awards,
        club_id: entry.club_id,
        club_name: entry.club_name,
        competition_name: entry.competition_name,
        goals: entry.goals,
        minutes_played: entry.minutes_played,
        player_profile_id: input.profileId,
        season_label: entry.season_label,
        sort_order: entry.sort_order,
        team_logo_url: entry.team_logo_url,
      }));

    if (existingEntries.length > 0) {
      const { error: careerUpsertError } = await supabase
        .from("player_career_entries")
        .upsert(existingEntries);

      if (careerUpsertError) {
        throw careerUpsertError;
      }
    }

    if (newEntries.length > 0) {
      const { error: careerInsertError } = await supabase
        .from("player_career_entries")
        .insert(newEntries);

      if (careerInsertError) {
        throw careerInsertError;
      }
    }

    const { data: existingCareerRows, error: existingCareerError } = await supabase
      .from("player_career_entries")
      .select("id")
      .eq("player_profile_id", input.profileId);

    if (existingCareerError) {
      throw existingCareerError;
    }

    const removableIds = (existingCareerRows ?? [])
      .map((entry) => entry.id as string)
      .filter((entryId) => !currentIds.includes(entryId));

    if (removableIds.length > 0) {
      const { error: deleteCareerError } = await supabase
        .from("player_career_entries")
        .delete()
        .eq("player_profile_id", input.profileId)
        .in("id", removableIds);

      if (deleteCareerError) {
        throw deleteCareerError;
      }
    }
  }

  if (input.role === "coach" && input.coachProfile) {
    const { error } = await supabase.from("coach_profiles").upsert({
      coached_categories: input.coachProfile.coached_categories,
      coached_clubs: input.coachProfile.coached_clubs,
      game_philosophy: input.coachProfile.game_philosophy,
      licenses: input.coachProfile.licenses,
      open_to_new_role: input.coachProfile.open_to_new_role,
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
      certifications: input.staffProfile.certifications,
      experience_summary: input.staffProfile.experience_summary,
      open_to_work: input.staffProfile.open_to_work,
      preferred_regions: input.staffProfile.preferred_regions,
      profile_id: input.profileId,
      specialization: input.staffProfile.specialization,
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
          description: input.club.description,
          gallery_urls: input.club.gallery_urls,
          league: input.club.league,
          logo_url: input.club.logo_url,
          name: input.club.name,
          region: input.club.region,
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
        description: input.club.description,
        gallery_urls: input.club.gallery_urls,
        league: input.club.league,
        logo_url: input.club.logo_url,
        name: input.club.name,
        owner_profile_id: input.profileId,
        region: input.club.region,
        slug: slugify(input.club.name),
      });

      if (error) {
        throw error;
      }
    }
  }
}

export async function searchTeams(query: string, limit = 5) {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length < 2) {
    return [] as TeamAutocompleteOption[];
  }

  const { data, error } = await supabase
    .from("clubs")
    .select("id, name, city, logo_url")
    .ilike("name", `${trimmedQuery}%`)
    .order("name", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return ((data ?? []) as {
    city: string | null;
    id: string;
    logo_url: string | null;
    name: string;
  }[]).map((club) => ({
    city: club.city,
    id: club.id,
    logoUrl: club.logo_url,
    name: club.name,
  }));
}
