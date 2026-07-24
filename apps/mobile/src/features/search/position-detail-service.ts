import { supabase } from "../../lib/supabase";

export type PositionDetail = {
  ad_id: string;
  title: string;
  description: string;
  club_id: string | null;
  club_name: string | null;
  club_logo_url: string | null;
  team_name: string | null;
  category: string | null;
  region: string | null;
  compensation_summary: string | null;
  deadline: string | null;
  published_at: string | null;
  is_saved: boolean;
};

type AdDetailRow = {
  id: string;
  title: string;
  description: string;
  category: string | null;
  region: string | null;
  compensation_summary: string | null;
  deadline: string | null;
  published_at: string | null;
  club_id: string | null;
  clubs: { id: string; logo_url: string | null; name: string | null } | null;
  club_teams: { name: string | null } | null;
};

export async function fetchPositionDetail(
  profileId: string,
  adId: string,
): Promise<PositionDetail | null> {
  const [{ data: adData, error: adError }, { data: savedData, error: savedError }] =
    await Promise.all([
      supabase
        .from("recruiting_ads")
        .select(
          "id, title, description, category, region, compensation_summary, deadline, published_at, club_id, clubs(id, name, logo_url), club_teams(name)",
        )
        .eq("id", adId)
        .eq("status", "published")
        .maybeSingle(),
      supabase
        .from("saved_ads")
        .select("ad_id")
        .eq("ad_id", adId)
        .eq("profile_id", profileId)
        .maybeSingle(),
    ]);

  if (adError) {
    throw adError;
  }

  if (savedError) {
    throw savedError;
  }

  if (!adData) {
    return null;
  }

  const ad = adData as unknown as AdDetailRow;

  return {
    ad_id: ad.id,
    category: ad.category,
    club_id: ad.clubs?.id ?? ad.club_id,
    club_logo_url: ad.clubs?.logo_url ?? null,
    club_name: ad.clubs?.name ?? null,
    compensation_summary: ad.compensation_summary,
    deadline: ad.deadline,
    description: ad.description,
    is_saved: savedData !== null,
    published_at: ad.published_at,
    region: ad.region,
    team_name: ad.club_teams?.name ?? null,
    title: ad.title,
  };
}
