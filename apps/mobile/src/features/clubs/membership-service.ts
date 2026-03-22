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
      "id, club_id, profile_id, manual_name, member_role, staff_title, status, added_by, created_at",
    )
    .eq("club_id", clubId)
    .in("status", ["active", "rejected"])
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
      manual_name: row.manual_name,
      member_role: row.member_role,
      profile_id: row.profile_id,
      staff_title: row.staff_title,
      status: row.status,
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
  staffTitle?: string;
}) {
  const { error } = await supabase.from("club_members").insert({
    club_id: input.clubId,
    member_role: input.memberRole,
    profile_id: input.profileId,
    staff_title: input.staffTitle?.trim() || null,
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
