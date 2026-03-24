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

const TEAM_COLUMNS =
  "id, club_id, name, category, team_type, parent_team_id, inherited, logo_url, city, region, sort_order";

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
): Promise<void> {
  if (teams.length === 0) return;

  const { error } = await supabase.from("club_teams").insert(teams);
  if (error) throw error;
}

export async function deleteClubTeam(teamId: string): Promise<void> {
  const { error } = await supabase
    .from("club_teams")
    .delete()
    .eq("id", teamId);

  if (error) throw error;
}
