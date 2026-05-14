import { supabase } from "../../lib/supabase";

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
  headquarters_address: string | null;
  id: string;
  league: string | null;
  logo_url: string | null;
  name: string;
  owner_full_name: string | null;
  region: string;
  stadium: string | null;
  verification_status: string;
  website_url: string | null;
};

export type ClubHeaderStats = {
  activeTeamsCount: number;
  playersCount: number;
  staffCount: number;
};

export async function fetchPublicClubProfile(clubId: string): Promise<PublicClubProfile | null> {
  const { data, error } = await supabase
    .from("clubs")
    .select(
      "id, name, city, region, country, category, league, stadium, club_colors, club_email, club_phone, description, field_address, founding_year, headquarters_address, logo_url, verification_status, website_url, owner_profile_id",
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
    headquarters_address: data.headquarters_address ?? null,
    id: data.id,
    league: data.league ?? null,
    logo_url: data.logo_url ?? null,
    name: data.name ?? "",
    owner_full_name: owner?.full_name ?? null,
    region: data.region ?? "",
    stadium: data.stadium ?? null,
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
