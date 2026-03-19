import { supabase } from "../../lib/supabase";

export type PublicClubProfile = {
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
  logo_url: string | null;
  name: string;
  owner_full_name: string | null;
  region: string;
  verification_status: string;
  website_url: string | null;
};

export async function fetchPublicClubProfile(clubId: string): Promise<PublicClubProfile | null> {
  const { data, error } = await supabase
    .from("clubs")
    .select(
      "id, name, city, region, country, club_colors, club_email, club_phone, description, field_address, founding_year, headquarters_address, logo_url, verification_status, website_url, owner_profile_id",
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
    logo_url: data.logo_url ?? null,
    name: data.name ?? "",
    owner_full_name: owner?.full_name ?? null,
    region: data.region ?? "",
    verification_status: data.verification_status ?? "unverified",
    website_url: data.website_url ?? null,
  };
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
