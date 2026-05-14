import { supabase } from "../../lib/supabase";

export type TeamType = "senior" | "youth";

export type ClubTeam = {
  category: string;
  city: string | null;
  club_id: string;
  id: string;
  inherited: boolean;
  logo_url: string | null;
  name: string;
  parent_team_id: string | null;
  region: string | null;
  sort_order: number;
  team_type: TeamType;
};

export type ClubTeamProfileDetails = {
  competition_name: string | null;
  group_name: string | null;
  media_urls: string[];
  promoted_players_count: number;
  recent_results: string[];
  team_id: string;
};

const TEAM_COLUMNS =
  "id, club_id, name, category, team_type, parent_team_id, inherited, logo_url, city, region, sort_order";
const TEAM_PROFILE_COLUMNS =
  "team_id, competition_name, group_name, promoted_players_count, recent_results, media_urls";

export async function fetchClubTeams(clubId: string): Promise<ClubTeam[]> {
  const { data, error } = await supabase
    .from("club_teams")
    .select(TEAM_COLUMNS)
    .eq("club_id", clubId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function upsertClubTeam(
  team: Omit<ClubTeam, "id"> & { id?: string },
): Promise<ClubTeam> {
  const { data, error } = await supabase
    .from("club_teams")
    .upsert(team)
    .select(TEAM_COLUMNS)
    .single();

  if (error) throw error;
  return data;
}

export async function insertClubTeams(
  teams: Omit<ClubTeam, "id">[],
): Promise<ClubTeam[]> {
  if (teams.length === 0) return [];

  const { data, error } = await supabase
    .from("club_teams")
    .insert(teams)
    .select(TEAM_COLUMNS);
  if (error) throw error;
  return data ?? [];
}

export async function deleteClubTeam(teamId: string): Promise<void> {
  const { error } = await supabase
    .from("club_teams")
    .delete()
    .eq("id", teamId);

  if (error) throw error;
}

export async function fetchClubTeamProfiles(
  teamIds: string[],
): Promise<Record<string, ClubTeamProfileDetails>> {
  const uniqueTeamIds = Array.from(new Set(teamIds));

  if (uniqueTeamIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from("club_team_profiles")
    .select(TEAM_PROFILE_COLUMNS)
    .in("team_id", uniqueTeamIds);

  if (error) throw error;

  return Object.fromEntries(
    (data ?? []).map((row) => {
      const profile = normalizeTeamProfile(row as Partial<ClubTeamProfileDetails>);
      return [profile.team_id, profile];
    }),
  );
}

export async function upsertClubTeamProfile(
  profile: ClubTeamProfileDetails,
): Promise<void> {
  const { error } = await supabase.from("club_team_profiles").upsert({
    competition_name: profile.competition_name,
    group_name: profile.group_name,
    media_urls: profile.media_urls,
    promoted_players_count: profile.promoted_players_count,
    recent_results: profile.recent_results,
    team_id: profile.team_id,
  });

  if (error) throw error;
}

function normalizeTeamProfile(
  row: Partial<ClubTeamProfileDetails>,
): ClubTeamProfileDetails {
  return {
    competition_name: row.competition_name ?? null,
    group_name: row.group_name ?? null,
    media_urls: Array.isArray(row.media_urls)
      ? row.media_urls.filter((entry): entry is string => typeof entry === "string")
      : [],
    promoted_players_count:
      typeof row.promoted_players_count === "number"
        ? row.promoted_players_count
        : 0,
    recent_results: Array.isArray(row.recent_results)
      ? row.recent_results.filter((entry): entry is string => typeof entry === "string")
      : [],
    team_id: row.team_id ?? "",
  };
}
