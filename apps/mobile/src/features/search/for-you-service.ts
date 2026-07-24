import { supabase } from "../../lib/supabase";

export const FOR_YOU_LIMIT = 3;

export type ForYouPosition = {
  ad_id: string;
  title: string;
  club_name: string | null;
  team_name: string | null;
  category: string | null;
  region: string | null;
  deadline: string | null;
};

export type ForYouClub = {
  club_id: string;
  name: string;
  logo_url: string | null;
  city: string | null;
  region: string | null;
  category: string | null;
};

export type ForYouProfile = {
  profile_id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  city: string | null;
  region: string | null;
};

export type ForYouSuggestions =
  | { kind: "player"; positions: ForYouPosition[]; clubsToFollow: ForYouClub[] }
  | {
      kind: "scout";
      availableNearby: ForYouProfile[];
      recentlyUpdated: ForYouProfile[];
    }
  | { kind: "follow-only"; clubsToFollow: ForYouClub[] }
  | { kind: "hidden" };

type ForYouProfileInput = {
  id: string;
  role: string;
  region: string | null;
};

type AdRow = {
  id: string;
  title: string;
  category: string | null;
  region: string | null;
  deadline: string | null;
  clubs: { name: string | null } | null;
  club_teams: { name: string | null } | null;
};

async function fetchCompatiblePositions(
  profileId: string,
): Promise<ForYouPosition[]> {
  const { data: playerData, error: playerError } = await supabase
    .from("player_profiles")
    .select("primary_position")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (playerError) {
    throw playerError;
  }

  const primaryPosition =
    (playerData?.primary_position as string | null) ?? null;

  if (!primaryPosition) {
    return [];
  }

  const { data, error } = await supabase
    .from("recruiting_ads")
    .select("id, title, category, region, deadline, clubs(name), club_teams(name)")
    .eq("status", "published")
    .eq("role_required", primaryPosition)
    .order("published_at", { ascending: false })
    .limit(FOR_YOU_LIMIT);

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as AdRow[]).map((ad) => ({
    ad_id: ad.id,
    category: ad.category,
    club_name: ad.clubs?.name ?? null,
    deadline: ad.deadline,
    region: ad.region,
    team_name: ad.club_teams?.name ?? null,
    title: ad.title,
  }));
}

async function fetchClubsToFollow(
  profileId: string,
  region: string | null,
): Promise<ForYouClub[]> {
  const { data: follows, error: followsError } = await supabase
    .from("club_follows")
    .select("club_id")
    .eq("profile_id", profileId);

  if (followsError) {
    throw followsError;
  }

  const followedIds = (follows ?? []).map((row) => row.club_id as string);

  let query = supabase
    .from("clubs")
    .select("id, name, logo_url, city, region, category")
    .order("created_at", { ascending: false })
    .limit(FOR_YOU_LIMIT);

  if (region) {
    query = query.eq("region", region);
  }

  if (followedIds.length > 0) {
    query = query.not("id", "in", `(${followedIds.join(",")})`);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map((club) => ({
    category: (club.category as string | null) ?? null,
    city: (club.city as string | null) ?? null,
    club_id: club.id as string,
    logo_url: (club.logo_url as string | null) ?? null,
    name: club.name as string,
    region: (club.region as string | null) ?? null,
  }));
}

const SCOUTABLE_ROLES = ["player", "coach", "staff"];

async function fetchProfilesForScouts(
  profileId: string,
  region: string | null,
  availableOnly: boolean,
): Promise<ForYouProfile[]> {
  let query = supabase
    .from("profiles")
    .select("id, full_name, avatar_url, role, city, region")
    .in("role", SCOUTABLE_ROLES)
    .neq("id", profileId)
    .order("updated_at", { ascending: false })
    .limit(FOR_YOU_LIMIT);

  if (availableOnly) {
    query = query.eq("is_available", true);

    if (region) {
      query = query.eq("region", region);
    }
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map((profile) => ({
    avatar_url: (profile.avatar_url as string | null) ?? null,
    city: (profile.city as string | null) ?? null,
    full_name: (profile.full_name as string | null) ?? "Profilo footMe",
    profile_id: profile.id as string,
    region: (profile.region as string | null) ?? null,
    role: profile.role as string,
  }));
}

export async function getForYouSuggestions(
  profile: ForYouProfileInput,
): Promise<ForYouSuggestions> {
  switch (profile.role) {
    case "player": {
      const [positions, clubsToFollow] = await Promise.all([
        fetchCompatiblePositions(profile.id),
        fetchClubsToFollow(profile.id, profile.region),
      ]);

      return { clubsToFollow, kind: "player", positions };
    }
    case "club_admin":
    case "director":
    case "agent": {
      const [availableNearby, recentlyUpdated] = await Promise.all([
        fetchProfilesForScouts(profile.id, profile.region, true),
        fetchProfilesForScouts(profile.id, profile.region, false),
      ]);

      return { availableNearby, kind: "scout", recentlyUpdated };
    }
    case "coach":
    case "staff": {
      const clubsToFollow = await fetchClubsToFollow(
        profile.id,
        profile.region,
      );

      return { clubsToFollow, kind: "follow-only" };
    }
    default:
      return { kind: "hidden" };
  }
}
