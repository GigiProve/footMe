import { supabase } from "../../lib/supabase";
import {
  isPlayerPosition,
  type PlayerPosition,
} from "../profiles/player-sports";
import type { ClubTeam } from "./team-service";

export type PublicClubProfile = {
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
  owner_full_name: string | null;
  region: string;
  sports_focus: string | null;
  stadium: string | null;
  top_level_reached: string | null;
  verification_status: string;
  website_url: string | null;
};

export type ClubHeaderStats = {
  activeTeamsCount: number;
  playersCount: number;
  staffCount: number;
};

export type ClubSeasonSummary = {
  category: string;
  seasonsCount: number;
};

export type ClubPositionSummary = {
  category: string | null;
  created_at: string;
  description?: string;
  id: string;
  published_at: string | null;
  region: string | null;
  role_required: string;
  team_category: string | null;
  team_id: string | null;
  team_name: string | null;
  title: string;
};

export type ClubAffiliationSummary = {
  category: string | null;
  city: string;
  id: string;
  logo_url: string | null;
  name: string;
  region: string;
  relationship_label: string | null;
};

export type ClubParentAffiliation = {
  id: string;
  name: string;
  relationship_label: string | null;
};

export type PublicClubMember = {
  avatar_url: string | null;
  birth_date: string | null;
  contract_status: string | null;
  current_condition: string | null;
  full_name: string | null;
  id: string;
  manual_name: string | null;
  member_role: string;
  primary_position: PlayerPosition | null;
  profile_id: string | null;
  staff_title: string | null;
  team_id: string | null;
};

export type ClubTeamProfileRecord = {
  competition_name: string | null;
  group_name: string | null;
  media_urls: string[];
  promoted_players_count: number;
  recent_results: string[];
  team_id: string;
};

export type PublicClubSquadraOverview = {
  affiliations: ClubAffiliationSummary[];
  parentAffiliation: ClubParentAffiliation | null;
  positionPreview: ClubPositionSummary[];
  positionsTotal: number;
  seasonSummaries: ClubSeasonSummary[];
};

export type PublicClubTeamProfile = {
  club: Pick<
    PublicClubProfile,
    "category" | "city" | "id" | "logo_url" | "name" | "region" | "verification_status"
  >;
  members: PublicClubMember[];
  positionPreview: ClubPositionSummary[];
  positionsTotal: number;
  profile: ClubTeamProfileRecord | null;
  team: ClubTeam;
};

export type ClubAffiliationInput = {
  affiliateClubId: string;
  relationshipLabel: string | null;
  sortOrder: number;
};

export async function fetchPublicClubProfile(clubId: string): Promise<PublicClubProfile | null> {
  const { data, error } = await supabase
    .from("clubs")
    .select(
      "id, name, city, region, country, category, league, stadium, club_colors, club_email, club_phone, description, field_address, founding_year, gallery_urls, headquarters_address, key_results, logo_url, sports_focus, top_level_reached, verification_status, website_url, owner_profile_id",
    )
    .eq("id", clubId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const { data: owner } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", data.owner_profile_id)
    .maybeSingle();

  return {
    category: data.category ?? null,
    city: data.city ?? "",
    club_colors: data.club_colors ?? null,
    club_email: data.club_email ?? null,
    club_phone: data.club_phone ?? null,
    country: data.country ?? "IT",
    description: data.description ?? null,
    field_address: data.field_address ?? null,
    founding_year: data.founding_year ?? null,
    gallery_urls: normalizeStringArray(data.gallery_urls),
    headquarters_address: data.headquarters_address ?? null,
    id: data.id,
    key_results: normalizeStringArray(data.key_results),
    league: data.league ?? null,
    logo_url: data.logo_url ?? null,
    name: data.name ?? "",
    owner_full_name: owner?.full_name ?? null,
    region: data.region ?? "",
    sports_focus: data.sports_focus ?? null,
    stadium: data.stadium ?? null,
    top_level_reached: data.top_level_reached ?? null,
    verification_status: data.verification_status ?? "unverified",
    website_url: data.website_url ?? null,
  };
}

export async function fetchPublicClubHeaderStats(
  clubId: string,
): Promise<ClubHeaderStats> {
  const [teamsResult, playersResult, staffResult] = await Promise.all([
    supabase
      .from("club_teams")
      .select("id", { count: "exact", head: true })
      .eq("club_id", clubId),
    supabase
      .from("club_members")
      .select("id", { count: "exact", head: true })
      .eq("club_id", clubId)
      .eq("status", "active")
      .eq("member_role", "player"),
    supabase
      .from("club_members")
      .select("id", { count: "exact", head: true })
      .eq("club_id", clubId)
      .eq("status", "active")
      .in("member_role", ["staff", "coach", "director"]),
  ]);

  if (teamsResult.error) {
    throw teamsResult.error;
  }

  if (playersResult.error) {
    throw playersResult.error;
  }

  if (staffResult.error) {
    throw staffResult.error;
  }

  return {
    activeTeamsCount: teamsResult.count ?? 0,
    playersCount: playersResult.count ?? 0,
    staffCount: staffResult.count ?? 0,
  };
}

export async function fetchClubFollowState(
  profileId: string,
  clubId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("club_follows")
    .select("profile_id")
    .eq("profile_id", profileId)
    .eq("club_id", clubId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

export async function followClub(profileId: string, clubId: string) {
  const { error } = await supabase.from("club_follows").upsert(
    {
      club_id: clubId,
      profile_id: profileId,
    },
    { ignoreDuplicates: true, onConflict: "profile_id,club_id" },
  );

  if (error) {
    throw error;
  }
}

export async function unfollowClub(profileId: string, clubId: string) {
  const { error } = await supabase
    .from("club_follows")
    .delete()
    .eq("profile_id", profileId)
    .eq("club_id", clubId);

  if (error) {
    throw error;
  }
}

export async function submitClubClaim(input: {
  clubId: string;
  claimantEmail: string;
  claimantProfileId: string;
  claimantRoleAtClub: string;
  message: string;
}) {
  const { error } = await supabase.from("club_claims").insert({
    claimant_email: input.claimantEmail || null,
    claimant_profile_id: input.claimantProfileId,
    claimant_role_at_club: input.claimantRoleAtClub || null,
    club_id: input.clubId,
    message: input.message || null,
  });

  if (error) {
    throw error;
  }
}

export async function submitClubReport(input: {
  clubId: string;
  reason: string;
  reporterProfileId: string;
}) {
  const { error } = await supabase.from("club_reports").insert({
    club_id: input.clubId,
    reason: input.reason || null,
    reporter_profile_id: input.reporterProfileId,
  });

  if (error) {
    throw error;
  }
}

export async function fetchPublicClubSquadraOverview(
  clubId: string,
): Promise<PublicClubSquadraOverview> {
  const [
    positionsResult,
    seasonsResult,
    affiliations,
    parentAffiliation,
  ] = await Promise.all([
    fetchClubPositionPreview(clubId),
    fetchClubSeasonSummaries(clubId),
    fetchClubAffiliations(clubId),
    fetchClubParentAffiliation(clubId),
  ]);

  return {
    affiliations,
    parentAffiliation,
    positionPreview: positionsResult.positions,
    positionsTotal: positionsResult.total,
    seasonSummaries: seasonsResult,
  };
}

export async function fetchClubPositions(
  clubId: string,
): Promise<ClubPositionSummary[]> {
  const { data, error } = await supabase
    .from("recruiting_ads")
    .select(
      "id, title, role_required, category, region, description, team_id, published_at, created_at",
    )
    .eq("club_id", clubId)
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return attachTeamLabels((data ?? []) as RecruitingAdRow[]);
}

export async function fetchClubPositionPreview(
  clubId: string,
  teamId?: string,
): Promise<{ positions: ClubPositionSummary[]; total: number }> {
  let query = supabase
    .from("recruiting_ads")
    .select(
      "id, title, role_required, category, region, description, team_id, published_at, created_at",
      { count: "exact" },
    )
    .eq("club_id", clubId)
    .eq("status", "published");

  if (teamId) {
    query = query.eq("team_id", teamId);
  }

  const { data, error, count } = await query
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(0, 2);

  if (error) {
    throw error;
  }

  return {
    positions: await attachTeamLabels((data ?? []) as RecruitingAdRow[]),
    total: count ?? data?.length ?? 0,
  };
}

export async function fetchClubAffiliations(
  clubId: string,
): Promise<ClubAffiliationSummary[]> {
  const { data, error } = await supabase
    .from("club_affiliations")
    .select("affiliate_club_id, relationship_label, sort_order")
    .eq("club_id", clubId)
    .order("sort_order", { ascending: true });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as {
    affiliate_club_id: string;
    relationship_label: string | null;
    sort_order: number;
  }[];
  const clubIds = rows.map((row) => row.affiliate_club_id);
  const clubsById = await loadPublicClubSummaries(clubIds);

  return rows
    .map((row) => {
      const club = clubsById.get(row.affiliate_club_id);

      if (!club) {
        return null;
      }

      return {
        ...club,
        relationship_label: row.relationship_label ?? null,
      } satisfies ClubAffiliationSummary;
    })
    .filter((club): club is ClubAffiliationSummary => club !== null);
}

export async function fetchClubParentAffiliation(
  clubId: string,
): Promise<ClubParentAffiliation | null> {
  const { data, error } = await supabase
    .from("club_affiliations")
    .select("club_id, relationship_label, sort_order")
    .eq("affiliate_club_id", clubId)
    .order("sort_order", { ascending: true })
    .limit(1);

  if (error) {
    throw error;
  }

  const row = ((data ?? []) as {
    club_id: string;
    relationship_label: string | null;
  }[])[0];

  if (!row) {
    return null;
  }

  const clubsById = await loadPublicClubSummaries([row.club_id]);
  const parentClub = clubsById.get(row.club_id);

  if (!parentClub) {
    return null;
  }

  return {
    id: parentClub.id,
    name: parentClub.name,
    relationship_label: row.relationship_label ?? null,
  };
}

export async function fetchPublicClubRoster(
  clubId: string,
  teamId?: string,
): Promise<PublicClubMember[]> {
  let query = supabase
    .from("club_members")
    .select(
      "id, club_id, profile_id, manual_name, member_role, staff_title, status, team_id, created_at",
    )
    .eq("club_id", clubId)
    .eq("status", "active");

  if (teamId) {
    query = query.eq("team_id", teamId);
  }

  const { data, error } = await query.order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as PublicClubMemberRow[];
  const profileIds = rows
    .map((row) => row.profile_id)
    .filter((id): id is string => Boolean(id));
  const playerProfileIds = rows
    .filter((row) => row.member_role === "player")
    .map((row) => row.profile_id)
    .filter((id): id is string => Boolean(id));
  const [profilesById, playerProfilesById] = await Promise.all([
    loadProfilesById(profileIds),
    loadPlayerProfilesById(playerProfileIds),
  ]);

  return rows.map((row) => {
    const profile = row.profile_id ? profilesById.get(row.profile_id) : null;
    const playerProfile = row.profile_id
      ? playerProfilesById.get(row.profile_id)
      : null;

    return {
      avatar_url: profile?.avatar_url ?? null,
      birth_date: profile?.birth_date ?? null,
      contract_status: playerProfile?.contract_status ?? null,
      current_condition: playerProfile?.current_condition ?? null,
      full_name: profile?.full_name ?? null,
      id: row.id,
      manual_name: row.manual_name ?? null,
      member_role: row.member_role,
      primary_position: playerProfile?.primary_position ?? null,
      profile_id: row.profile_id ?? null,
      staff_title: row.staff_title ?? null,
      team_id: row.team_id ?? null,
    };
  });
}

export async function fetchPublicClubTeamProfile(
  teamId: string,
): Promise<PublicClubTeamProfile | null> {
  const { data: team, error: teamError } = await supabase
    .from("club_teams")
    .select(
      "id, club_id, name, category, team_type, parent_team_id, inherited, logo_url, city, region, sort_order",
    )
    .eq("id", teamId)
    .maybeSingle();

  if (teamError) {
    throw teamError;
  }

  if (!team) {
    return null;
  }

  const typedTeam = team as ClubTeam;
  const [club, profileResult, members, positionsResult] = await Promise.all([
    fetchPublicClubProfile(typedTeam.club_id),
    supabase
      .from("club_team_profiles")
      .select(
        "team_id, competition_name, group_name, promoted_players_count, recent_results, media_urls",
      )
      .eq("team_id", teamId)
      .maybeSingle(),
    fetchPublicClubRoster(typedTeam.club_id, teamId),
    fetchClubPositionPreview(typedTeam.club_id, teamId),
  ]);

  if (profileResult.error) {
    throw profileResult.error;
  }

  if (!club) {
    return null;
  }

  return {
    club: {
      category: club.category,
      city: club.city,
      id: club.id,
      logo_url: club.logo_url,
      name: club.name,
      region: club.region,
      verification_status: club.verification_status,
    },
    members,
    positionPreview: positionsResult.positions,
    positionsTotal: positionsResult.total,
    profile: profileResult.data
      ? normalizeClubTeamProfile(profileResult.data as Partial<ClubTeamProfileRecord>)
      : null,
    team: typedTeam,
  };
}

export async function updateClubSportProfile(input: {
  clubId: string;
  keyResults: string[];
  ownerProfileId: string;
  sportsFocus: string | null;
  topLevelReached: string | null;
}) {
  const { error } = await supabase
    .from("clubs")
    .update({
      key_results: input.keyResults,
      sports_focus: input.sportsFocus,
      top_level_reached: input.topLevelReached,
    })
    .eq("id", input.clubId)
    .eq("owner_profile_id", input.ownerProfileId);

  if (error) {
    throw error;
  }
}

export async function saveClubAffiliations(
  clubId: string,
  affiliations: ClubAffiliationInput[],
) {
  const { error: deleteError } = await supabase
    .from("club_affiliations")
    .delete()
    .eq("club_id", clubId);

  if (deleteError) {
    throw deleteError;
  }

  if (affiliations.length === 0) {
    return;
  }

  const { error: insertError } = await supabase.from("club_affiliations").insert(
    affiliations.map((affiliation, index) => ({
      affiliate_club_id: affiliation.affiliateClubId,
      club_id: clubId,
      relationship_label: affiliation.relationshipLabel,
      sort_order: affiliation.sortOrder ?? index,
    })),
  );

  if (insertError) {
    throw insertError;
  }
}

export async function searchClubsForAffiliation(
  query: string,
  excludedClubId: string,
  limit = 8,
): Promise<ClubAffiliationSummary[]> {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length < 2) {
    return [];
  }

  const { data, error } = await supabase
    .from("clubs")
    .select("id, name, city, region, category, logo_url")
    .ilike("name", `%${trimmedQuery}%`)
    .neq("id", excludedClubId)
    .limit(limit);

  if (error) {
    throw error;
  }

  return ((data ?? []) as PublicClubSummaryRow[]).map((club) => ({
    category: club.category ?? null,
    city: club.city ?? "",
    id: club.id,
    logo_url: club.logo_url ?? null,
    name: club.name ?? "",
    region: club.region ?? "",
    relationship_label: null,
  }));
}

type RecruitingAdRow = {
  category: string | null;
  created_at: string;
  description?: string | null;
  id: string;
  published_at: string | null;
  region: string | null;
  role_required: string;
  team_id: string | null;
  title: string;
};

type PublicClubSummaryRow = {
  category: string | null;
  city: string | null;
  id: string;
  logo_url: string | null;
  name: string | null;
  region: string | null;
};

type PublicClubMemberRow = {
  id: string;
  manual_name: string | null;
  member_role: string;
  profile_id: string | null;
  staff_title: string | null;
  team_id: string | null;
};

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function normalizeClubTeamProfile(
  row: Partial<ClubTeamProfileRecord>,
): ClubTeamProfileRecord {
  return {
    competition_name: row.competition_name ?? null,
    group_name: row.group_name ?? null,
    media_urls: normalizeStringArray(row.media_urls),
    promoted_players_count:
      typeof row.promoted_players_count === "number"
        ? row.promoted_players_count
        : 0,
    recent_results: normalizeStringArray(row.recent_results),
    team_id: row.team_id ?? "",
  };
}

async function attachTeamLabels(
  rows: RecruitingAdRow[],
): Promise<ClubPositionSummary[]> {
  const teamIds = rows
    .map((row) => row.team_id)
    .filter((id): id is string => Boolean(id));
  const teamsById = await loadTeamsById(teamIds);

  return rows.map((row) => {
    const team = row.team_id ? teamsById.get(row.team_id) : null;

    return {
      category: row.category ?? null,
      created_at: row.created_at,
      description: row.description ?? undefined,
      id: row.id,
      published_at: row.published_at ?? null,
      region: row.region ?? null,
      role_required: row.role_required,
      team_category: team?.category ?? null,
      team_id: row.team_id ?? null,
      team_name: team?.name ?? null,
      title: row.title,
    };
  });
}

async function fetchClubSeasonSummaries(
  clubId: string,
): Promise<ClubSeasonSummary[]> {
  const { data, error } = await supabase
    .from("club_season_entries")
    .select("category, start_year, end_year")
    .eq("club_id", clubId)
    .order("start_year", { ascending: false });

  if (error) {
    throw error;
  }

  const countsByCategory = new Map<string, number>();
  const currentYear = new Date().getFullYear();

  for (const row of (data ?? []) as {
    category: string | null;
    end_year: number | null;
    start_year: number | null;
  }[]) {
    const category = row.category?.trim();

    if (!category || !row.start_year) {
      continue;
    }

    const endYear = row.end_year ?? currentYear;
    const seasonsCount = Math.max(1, endYear - row.start_year + 1);
    countsByCategory.set(
      category,
      (countsByCategory.get(category) ?? 0) + seasonsCount,
    );
  }

  return Array.from(countsByCategory.entries())
    .map(([category, seasonsCount]) => ({ category, seasonsCount }))
    .sort((left, right) => right.seasonsCount - left.seasonsCount);
}

async function loadTeamsById(teamIds: string[]) {
  const uniqueTeamIds = Array.from(new Set(teamIds));
  const teamsById = new Map<string, Pick<ClubTeam, "category" | "id" | "name">>();

  if (uniqueTeamIds.length === 0) {
    return teamsById;
  }

  const { data, error } = await supabase
    .from("club_teams")
    .select("id, name, category")
    .in("id", uniqueTeamIds);

  if (error) {
    throw error;
  }

  for (const team of (data ?? []) as Pick<ClubTeam, "category" | "id" | "name">[]) {
    teamsById.set(team.id, team);
  }

  return teamsById;
}

async function loadPublicClubSummaries(clubIds: string[]) {
  const uniqueClubIds = Array.from(new Set(clubIds));
  const clubsById = new Map<string, Omit<ClubAffiliationSummary, "relationship_label">>();

  if (uniqueClubIds.length === 0) {
    return clubsById;
  }

  const { data, error } = await supabase
    .from("clubs")
    .select("id, name, city, region, category, logo_url")
    .in("id", uniqueClubIds);

  if (error) {
    throw error;
  }

  for (const club of (data ?? []) as PublicClubSummaryRow[]) {
    clubsById.set(club.id, {
      category: club.category ?? null,
      city: club.city ?? "",
      id: club.id,
      logo_url: club.logo_url ?? null,
      name: club.name ?? "",
      region: club.region ?? "",
    });
  }

  return clubsById;
}

async function loadProfilesById(profileIds: string[]) {
  const uniqueProfileIds = Array.from(new Set(profileIds));
  const profilesById = new Map<
    string,
    {
      avatar_url: string | null;
      birth_date: string | null;
      full_name: string | null;
    }
  >();

  if (uniqueProfileIds.length === 0) {
    return profilesById;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, birth_date")
    .in("id", uniqueProfileIds);

  if (error) {
    throw error;
  }

  for (const profile of (data ?? []) as {
    avatar_url: string | null;
    birth_date: string | null;
    full_name: string | null;
    id: string;
  }[]) {
    profilesById.set(profile.id, {
      avatar_url: profile.avatar_url ?? null,
      birth_date: profile.birth_date ?? null,
      full_name: profile.full_name ?? null,
    });
  }

  return profilesById;
}

async function loadPlayerProfilesById(profileIds: string[]) {
  const uniqueProfileIds = Array.from(new Set(profileIds));
  const profilesById = new Map<
    string,
    {
      contract_status: string | null;
      current_condition: string | null;
      primary_position: PlayerPosition | null;
    }
  >();

  if (uniqueProfileIds.length === 0) {
    return profilesById;
  }

  const { data, error } = await supabase
    .from("player_profiles")
    .select("profile_id, primary_position, contract_status, current_condition")
    .in("profile_id", uniqueProfileIds);

  if (error) {
    throw error;
  }

  for (const profile of (data ?? []) as {
    contract_status: string | null;
    current_condition: string | null;
    primary_position: string | null;
    profile_id: string;
  }[]) {
    profilesById.set(profile.profile_id, {
      contract_status: profile.contract_status ?? null,
      current_condition: profile.current_condition ?? null,
      primary_position: isPlayerPosition(profile.primary_position)
        ? profile.primary_position
        : null,
    });
  }

  return profilesById;
}
