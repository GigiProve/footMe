import { supabase } from "../../lib/supabase";

export type SearchMode = "profiles" | "ads";

export type SearchRoleFilter =
  | "all"
  | "player"
  | "coach"
  | "staff"
  | "club_admin";

export type SearchPositionFilter =
  | "all"
  | "goalkeeper"
  | "defender"
  | "midfielder"
  | "forward";

export type ProfileSearchResult = {
  bio: string | null;
  city: string | null;
  full_name: string;
  is_available: boolean;
  primary_position: string | null;
  profile_id: string;
  region: string | null;
  role: string;
};

export type RecruitingAdSearchResult = {
  ad_id: string;
  category: string | null;
  club_name: string;
  compensation_summary: string | null;
  created_at: string;
  region: string | null;
  role_required: string;
  status: string;
  title: string;
};

export async function searchProfiles(input: {
  position: SearchPositionFilter;
  query: string;
  region: string;
  role: SearchRoleFilter;
}) {
  const { data, error } = await supabase.rpc("search_profiles", {
    position_filter: input.position === "all" ? null : input.position,
    region_filter: input.region.trim() || null,
    role_filter: input.role === "all" ? null : input.role,
    search_text: input.query.trim() || null,
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as ProfileSearchResult[];
}

export async function searchRecruitingAds(input: {
  position: SearchPositionFilter;
  query: string;
  region: string;
}) {
  const { data, error } = await supabase.rpc("search_recruiting_ads", {
    region_filter: input.region.trim() || null,
    role_filter: input.position === "all" ? null : input.position,
    search_text: input.query.trim() || null,
    status_filter: "published",
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as RecruitingAdSearchResult[];
}
