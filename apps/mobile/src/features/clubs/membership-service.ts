import { supabase } from "../../lib/supabase";
import type {
  ClubMember,
  MemberRole,
  ProfileSuggestion,
} from "./membership-types";

export async function fetchClubMembers(clubId: string): Promise<ClubMember[]> {
  const { data, error } = await supabase
    .from("club_members")
    .select(
      "id, club_id, profile_id, manual_name, member_role, staff_title, status, added_by, team_id, season, is_current, created_at",
    )
    .eq("club_id", clubId)
    .in("status", ["pending", "active", "rejected"])
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    return [];
  }

  const profileIds = data
    .map((m) => m.profile_id)
    .filter((id): id is string => id !== null);

  let profileMap: Record<string, { avatar_url: string | null; full_name: string | null }> = {};

  if (profileIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", profileIds);

    if (profileError) {
      throw profileError;
    }

    for (const p of profiles ?? []) {
      profileMap[p.id] = { avatar_url: p.avatar_url, full_name: p.full_name };
    }
  }

  return data.map((row) => {
    const profile = row.profile_id ? profileMap[row.profile_id] : null;

    return {
      added_by: row.added_by,
      avatar_url: profile?.avatar_url ?? null,
      club_id: row.club_id,
      created_at: row.created_at,
      full_name: profile?.full_name ?? null,
      id: row.id,
      is_current: row.is_current,
      manual_name: row.manual_name,
      member_role: row.member_role,
      profile_id: row.profile_id,
      season: row.season,
      staff_title: row.staff_title,
      status: row.status,
      team_id: row.team_id,
    } as ClubMember;
  });
}

export async function addManualMember(input: {
  clubId: string;
  manualName: string;
  memberRole: MemberRole;
  staffTitle?: string;
}) {
  const { error } = await supabase.from("club_members").insert({
    club_id: input.clubId,
    manual_name: input.manualName.trim(),
    member_role: input.memberRole,
    staff_title: input.staffTitle?.trim() || null,
  });

  if (error) {
    throw error;
  }
}

export async function addLinkedMember(input: {
  clubId: string;
  memberRole: MemberRole;
  profileId: string;
  season?: string;
  staffTitle?: string;
  teamId?: string;
}) {
  // Linked members require confirmation from the assigned profile: insert as
  // pending and notify them. Manual (name-only) members stay active elsewhere.
  const { error } = await supabase.from("club_members").insert({
    club_id: input.clubId,
    member_role: input.memberRole,
    profile_id: input.profileId,
    season: input.season?.trim() || null,
    staff_title: input.staffTitle?.trim() || null,
    status: "pending",
    team_id: input.teamId ?? null,
  });

  if (error) {
    throw error;
  }

  const { data: club } = await supabase
    .from("clubs")
    .select("name")
    .eq("id", input.clubId)
    .maybeSingle();

  await supabase.from("notifications").insert({
    body: `${club?.name ?? "Una societa'"} ti ha aggiunto alla rosa`,
    data: {
      club_id: input.clubId,
      team_id: input.teamId ?? "",
    },
    recipient_profile_id: input.profileId,
    title: "La societa' ti ha aggiunto alla rosa",
    type: "roster_assignment_pending",
  });
}

export type PendingMembership = {
  club_id: string;
  club_name: string | null;
  created_at: string;
  id: string;
  member_role: MemberRole;
  team_id: string | null;
  team_name: string | null;
};

export async function fetchPendingMemberships(
  profileId: string,
): Promise<PendingMembership[]> {
  const { data, error } = await supabase
    .from("club_members")
    .select(
      "id, club_id, member_role, team_id, created_at, clubs(name), club_teams(name)",
    )
    .eq("profile_id", profileId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
    // Supabase types to-one embeds loosely; normalize array-or-object to object.
    const club = (Array.isArray(row.clubs) ? row.clubs[0] : row.clubs) as
      | { name: string | null }
      | null;
    const team = (
      Array.isArray(row.club_teams) ? row.club_teams[0] : row.club_teams
    ) as { name: string | null } | null;

    return {
      club_id: row.club_id,
      club_name: club?.name ?? null,
      created_at: row.created_at,
      id: row.id,
      member_role: row.member_role,
      team_id: row.team_id,
      team_name: team?.name ?? null,
    };
  });
}

export async function respondToMembership(memberId: string, accept: boolean) {
  const { error } = await supabase.rpc("respond_to_club_membership", {
    p_accept: accept,
    p_member_id: memberId,
  });

  if (error) {
    throw error;
  }
}

export async function removeMember(memberId: string) {
  const { error } = await supabase
    .from("club_members")
    .update({ status: "removed", updated_at: new Date().toISOString() })
    .eq("id", memberId);

  if (error) {
    throw error;
  }
}

export async function rejectMember(memberId: string) {
  const { error } = await supabase
    .from("club_members")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("id", memberId);

  if (error) {
    throw error;
  }
}

export async function suggestProfiles(
  searchName: string,
  targetRole?: string,
): Promise<ProfileSuggestion[]> {
  const { data, error } = await supabase.rpc("suggest_profiles_for_club", {
    result_limit: 5,
    search_name: searchName.trim(),
    target_role: targetRole ?? null,
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as ProfileSuggestion[];
}

export async function requestClubMembership(input: {
  clubId: string;
  memberRole: MemberRole;
  profileId: string;
}) {
  const { error } = await supabase.from("club_members").insert({
    added_by: "self_request",
    club_id: input.clubId,
    member_role: input.memberRole,
    profile_id: input.profileId,
    status: "active",
  });

  if (error) {
    throw error;
  }

  // Get club owner and user name for the notification
  const [
    { data: club },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from("clubs")
      .select("owner_profile_id, name")
      .eq("id", input.clubId)
      .single(),
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", input.profileId)
      .single(),
  ]);

  if (club) {
    const memberName = profile?.full_name ?? "Un utente";
    const roleLabelMap: Record<string, string> = {
      coach: "allenatore",
      director: "dirigente",
      player: "giocatore",
      staff: "staff",
    };
    const roleLabel = roleLabelMap[input.memberRole] ?? input.memberRole;

    await supabase.from("notifications").insert({
      body: `${memberName} si e' collegato a ${club.name} come ${roleLabel}`,
      data: {
        club_id: input.clubId,
        profile_id: input.profileId,
      },
      recipient_profile_id: club.owner_profile_id,
      title: "Nuovo membro nella rosa",
      type: "member_joined",
    });
  }
}
