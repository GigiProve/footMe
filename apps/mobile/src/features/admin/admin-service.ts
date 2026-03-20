import { supabase } from "../../lib/supabase";

export type ClubVerificationStatus =
  | "unverified"
  | "pending_review"
  | "verified"
  | "flagged"
  | "suspended"
  | "rejected";

export type AdminClubEntry = {
  city: string;
  club_email: string | null;
  created_at: string;
  id: string;
  name: string;
  owner_full_name: string | null;
  owner_profile_id: string;
  region: string;
  verification_status: ClubVerificationStatus;
};

export type ClubClaimEntry = {
  claimant_email: string | null;
  claimant_profile_id: string;
  claimant_role_at_club: string | null;
  club_id: string;
  club_name: string;
  created_at: string;
  id: string;
  message: string | null;
  status: "pending" | "approved" | "rejected";
};

export type ClubReportEntry = {
  club_id: string;
  club_name: string;
  created_at: string;
  id: string;
  reason: string | null;
  reporter_profile_id: string;
};

export type AdminClubDetail = {
  category: string | null;
  city: string;
  club_colors: string | null;
  club_email: string | null;
  club_phone: string | null;
  country: string;
  created_at: string;
  field_address: string | null;
  founding_year: number | null;
  headquarters_address: string | null;
  id: string;
  logo_url: string | null;
  name: string;
  owner_full_name: string | null;
  owner_profile_id: string;
  region: string;
  verification_status: ClubVerificationStatus;
  website_url: string | null;
};

export async function fetchClubDetail(clubId: string): Promise<AdminClubDetail> {
  const { data, error } = await supabase
    .from("clubs")
    .select("id, name, city, region, country, category, club_colors, club_email, club_phone, field_address, founding_year, headquarters_address, logo_url, owner_profile_id, verification_status, website_url, created_at")
    .eq("id", clubId)
    .maybeSingle();

  if (error || !data) {
    throw error ?? new Error("Club not found");
  }

  const { data: owner } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", data.owner_profile_id)
    .maybeSingle();

  return {
    category: data.category ?? null,
    city: data.city,
    club_colors: data.club_colors ?? null,
    club_email: data.club_email ?? null,
    club_phone: data.club_phone ?? null,
    country: data.country ?? "IT",
    created_at: data.created_at,
    field_address: data.field_address ?? null,
    founding_year: data.founding_year ?? null,
    headquarters_address: data.headquarters_address ?? null,
    id: data.id,
    logo_url: data.logo_url ?? null,
    name: data.name,
    owner_full_name: owner?.full_name ?? null,
    owner_profile_id: data.owner_profile_id,
    region: data.region,
    verification_status: data.verification_status as ClubVerificationStatus,
    website_url: data.website_url ?? null,
  };
}

export async function fetchPendingClubs(): Promise<AdminClubEntry[]> {
  const { data, error } = await supabase
    .from("clubs")
    .select("id, name, city, region, club_email, verification_status, owner_profile_id, created_at")
    .in("verification_status", ["unverified", "pending_review"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  const clubs = data ?? [];

  if (clubs.length === 0) {
    return [];
  }

  const ownerIds = [...new Set(clubs.map((c) => c.owner_profile_id))];
  const { data: owners } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", ownerIds);

  const ownerMap = new Map((owners ?? []).map((o) => [o.id, o.full_name]));

  return clubs.map((club) => ({
    ...club,
    owner_full_name: ownerMap.get(club.owner_profile_id) ?? null,
  }));
}

export async function updateClubVerificationStatus(
  clubId: string,
  status: ClubVerificationStatus,
  adminUserId: string,
) {
  const updatePayload: Record<string, unknown> = {
    verification_status: status,
    reviewed_by: adminUserId,
    reviewed_at: new Date().toISOString(),
  };

  if (status === "verified") {
    updatePayload.verified_at = new Date().toISOString();
    updatePayload.verified_by = adminUserId;
  }

  const { error } = await supabase
    .from("clubs")
    .update(updatePayload)
    .eq("id", clubId);

  if (error) {
    throw error;
  }
}

export async function fetchPendingClaims(): Promise<ClubClaimEntry[]> {
  const { data, error } = await supabase
    .from("club_claims")
    .select("id, club_id, claimant_profile_id, claimant_role_at_club, claimant_email, message, status, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  const claims = data ?? [];

  if (claims.length === 0) {
    return [];
  }

  const clubIds = [...new Set(claims.map((c) => c.club_id))];
  const { data: clubs } = await supabase
    .from("clubs")
    .select("id, name")
    .in("id", clubIds);

  const clubMap = new Map((clubs ?? []).map((c) => [c.id, c.name]));

  return claims.map((claim) => ({
    ...claim,
    club_name: clubMap.get(claim.club_id) ?? "Sconosciuto",
  }));
}

export type PendingClubLink = {
  candidate_club_city: string;
  candidate_club_id: string;
  candidate_club_name: string;
  candidate_club_region: string;
  career_club_name: string;
  career_entry_id: string;
  confidence: "high" | "medium";
  entry_created_at: string;
  player_name: string | null;
  player_profile_id: string;
};

export async function fetchPendingClubLinks(): Promise<PendingClubLink[]> {
  const { data, error } = await supabase
    .from("pending_club_links")
    .select("*")
    .limit(50);

  if (error) {
    throw error;
  }

  return (data ?? []) as PendingClubLink[];
}

export async function approveClubLink(careerEntryId: string, clubId: string) {
  const { error } = await supabase
    .from("player_career_entries")
    .update({ club_id: clubId })
    .eq("id", careerEntryId);

  if (error) {
    throw error;
  }
}

export async function fetchPendingReports(): Promise<ClubReportEntry[]> {
  const { data, error } = await supabase
    .from("club_reports")
    .select("id, club_id, reporter_profile_id, reason, created_at")
    .is("resolved_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  const reports = data ?? [];

  if (reports.length === 0) {
    return [];
  }

  const clubIds = [...new Set(reports.map((r) => r.club_id))];
  const { data: clubs } = await supabase
    .from("clubs")
    .select("id, name")
    .in("id", clubIds);

  const clubMap = new Map((clubs ?? []).map((c) => [c.id, c.name]));

  return reports.map((report) => ({
    ...report,
    club_name: clubMap.get(report.club_id) ?? "Sconosciuto",
  }));
}
