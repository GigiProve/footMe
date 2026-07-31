import { supabase } from "../../lib/supabase";
import { toggleSavedAd } from "../recruiting/recruiting-service";
import { toggleSavedMediaTribuna } from "../profiles/media-tribuna-service";
import { toggleSavedClubMedia } from "../clubs/club-media-service";
import { toggleSavedFanMedia } from "../profiles/fan-media-service";
import { toggleSavedFanTribuna } from "../profiles/fan-tribuna-service";
import { toggleSavedMediaProfilePost } from "../profiles/media-profile-post-service";

export type SavedKind = "profile" | "club" | "team" | "position" | "content";

export type SavedSourceTable =
  | "saved_profiles"
  | "saved_clubs"
  | "saved_teams"
  | "saved_ads"
  | "saved_media_tribuna"
  | "saved_club_media"
  | "saved_fan_tribuna"
  | "saved_media_profile_posts"
  | "saved_fan_media";

/**
 * `content_type` copre tutte e cinque le superfici contenuto indicizzate da
 * Cerca > Media e contenuti: i bookmark fatti da lì confluiscono qui, senza
 * un secondo sistema di salvataggio (CER-05 §14).
 */
export type SavedContentType =
  | "media_tribuna"
  | "club_media"
  | "fan_tribuna"
  | "media_profile"
  | "fan_media";

export type SavedItem = {
  kind: SavedKind;
  source_table: SavedSourceTable;
  entity_id: string;
  content_type: SavedContentType | null;
  title: string;
  subtitle: string | null;
  thumbnail_url: string | null;
  saved_at: string;
};

export type SavedFilter = "all" | "profile" | "club" | "position" | "content";

export type SavedCounts = {
  profiles_count: number;
  clubs_count: number;
  positions_count: number;
  contents_count: number;
};

export async function fetchSavedItems(
  filter: SavedFilter,
  page: number,
  pageSize = 20,
): Promise<SavedItem[]> {
  const offset = page * pageSize;
  const { data, error } = await supabase.rpc("fetch_saved_items", {
    p_filter: filter,
    p_limit: pageSize,
    p_offset: offset,
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as SavedItem[];
}

export async function fetchSavedCounts(): Promise<SavedCounts> {
  const { data, error } = await supabase.rpc("fetch_saved_counts");

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;

  return {
    clubs_count: Number(row?.clubs_count ?? 0),
    contents_count: Number(row?.contents_count ?? 0),
    positions_count: Number(row?.positions_count ?? 0),
    profiles_count: Number(row?.profiles_count ?? 0),
  };
}

export async function saveProfile(
  ownerId: string,
  targetId: string,
): Promise<void> {
  if (ownerId === targetId) {
    throw new Error("Non puoi salvare il tuo profilo.");
  }

  const { error } = await supabase.from("saved_profiles").upsert(
    {
      owner_profile_id: ownerId,
      target_profile_id: targetId,
    },
    {
      ignoreDuplicates: true,
      onConflict: "owner_profile_id,target_profile_id",
    },
  );

  if (error) {
    throw error;
  }
}

export async function unsaveProfile(
  ownerId: string,
  targetId: string,
): Promise<void> {
  const { error } = await supabase
    .from("saved_profiles")
    .delete()
    .eq("owner_profile_id", ownerId)
    .eq("target_profile_id", targetId);

  if (error) {
    throw error;
  }
}

export async function saveClub(ownerId: string, clubId: string): Promise<void> {
  const { error } = await supabase.from("saved_clubs").upsert(
    {
      club_id: clubId,
      owner_profile_id: ownerId,
    },
    {
      ignoreDuplicates: true,
      onConflict: "owner_profile_id,club_id",
    },
  );

  if (error) {
    throw error;
  }
}

export async function unsaveClub(
  ownerId: string,
  clubId: string,
): Promise<void> {
  const { error } = await supabase
    .from("saved_clubs")
    .delete()
    .eq("owner_profile_id", ownerId)
    .eq("club_id", clubId);

  if (error) {
    throw error;
  }
}

export async function fetchProfileSaveState(
  ownerId: string,
  targetId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("saved_profiles")
    .select("owner_profile_id")
    .eq("owner_profile_id", ownerId)
    .eq("target_profile_id", targetId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data !== null;
}

export async function fetchClubSaveState(
  ownerId: string,
  clubId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("saved_clubs")
    .select("owner_profile_id")
    .eq("owner_profile_id", ownerId)
    .eq("club_id", clubId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data !== null;
}

export async function saveTeam(ownerId: string, teamId: string): Promise<void> {
  const { error } = await supabase.from("saved_teams").upsert(
    {
      owner_profile_id: ownerId,
      team_id: teamId,
    },
    {
      ignoreDuplicates: true,
      onConflict: "owner_profile_id,team_id",
    },
  );

  if (error) {
    throw error;
  }
}

export async function unsaveTeam(
  ownerId: string,
  teamId: string,
): Promise<void> {
  const { error } = await supabase
    .from("saved_teams")
    .delete()
    .eq("owner_profile_id", ownerId)
    .eq("team_id", teamId);

  if (error) {
    throw error;
  }
}

export async function fetchTeamSaveState(
  ownerId: string,
  teamId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("saved_teams")
    .select("owner_profile_id")
    .eq("owner_profile_id", ownerId)
    .eq("team_id", teamId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data !== null;
}

/**
 * Batch save-state lookup for a page of profile rows (e.g. Cerca > Profili
 * results). Returns the subset of `targetIds` the owner has saved.
 */
export async function fetchSavedProfileIds(
  ownerId: string,
  targetIds: string[],
): Promise<Set<string>> {
  if (targetIds.length === 0) {
    return new Set();
  }

  const { data, error } = await supabase
    .from("saved_profiles")
    .select("target_profile_id")
    .eq("owner_profile_id", ownerId)
    .in("target_profile_id", targetIds);

  if (error) {
    throw error;
  }

  return new Set((data ?? []).map((row) => row.target_profile_id as string));
}

/**
 * Batch save-state lookup for a page of club rows (e.g. Cerca > Società
 * results). Returns the subset of `clubIds` the owner has saved.
 */
export async function fetchSavedClubIds(
  ownerId: string,
  clubIds: string[],
): Promise<Set<string>> {
  if (clubIds.length === 0) {
    return new Set();
  }

  const { data, error } = await supabase
    .from("saved_clubs")
    .select("club_id")
    .eq("owner_profile_id", ownerId)
    .in("club_id", clubIds);

  if (error) {
    throw error;
  }

  return new Set((data ?? []).map((row) => row.club_id as string));
}

/**
 * Batch save-state lookup for a page of team rows (e.g. Cerca > Società
 * results filtered to squadre interne). Returns the subset of `teamIds` the
 * owner has saved.
 */
export async function fetchSavedTeamIds(
  ownerId: string,
  teamIds: string[],
): Promise<Set<string>> {
  if (teamIds.length === 0) {
    return new Set();
  }

  const { data, error } = await supabase
    .from("saved_teams")
    .select("team_id")
    .eq("owner_profile_id", ownerId)
    .in("team_id", teamIds);

  if (error) {
    throw error;
  }

  return new Set((data ?? []).map((row) => row.team_id as string));
}

// Content route `/content/[type]/[id]` supports all five content surfaces
// since CER-05 extended it. Saved positions (`saved_ads`) still have no per-ad
// route and resolve to null, rendering as non-navigating rows.
const ROUTABLE_CONTENT_TYPES = new Set<SavedContentType>([
  "club_media",
  "fan_media",
  "fan_tribuna",
  "media_profile",
  "media_tribuna",
]);

export function resolveSavedItemHref(item: SavedItem): string | null {
  switch (item.kind) {
    case "profile":
      return `/profile/${item.entity_id}`;
    case "club":
      return `/club/${item.entity_id}`;
    case "team":
      return `/club/team/${item.entity_id}`;
    case "content":
      return item.content_type && ROUTABLE_CONTENT_TYPES.has(item.content_type)
        ? `/content/${item.content_type}/${item.entity_id}`
        : null;
    case "position":
    default:
      return null;
  }
}

export async function removeSavedItem(
  ownerId: string,
  item: SavedItem,
): Promise<void> {
  switch (item.source_table) {
    case "saved_profiles":
      await unsaveProfile(ownerId, item.entity_id);
      break;
    case "saved_clubs":
      await unsaveClub(ownerId, item.entity_id);
      break;
    case "saved_teams":
      await unsaveTeam(ownerId, item.entity_id);
      break;
    case "saved_ads":
      await toggleSavedAd(ownerId, item.entity_id, false);
      break;
    case "saved_media_tribuna":
      await toggleSavedMediaTribuna(ownerId, item.entity_id, false);
      break;
    case "saved_club_media":
      await toggleSavedClubMedia(ownerId, item.entity_id, false);
      break;
    case "saved_fan_tribuna":
      await toggleSavedFanTribuna(ownerId, item.entity_id, false);
      break;
    case "saved_media_profile_posts":
      await toggleSavedMediaProfilePost(ownerId, item.entity_id, false);
      break;
    case "saved_fan_media":
      await toggleSavedFanMedia(ownerId, item.entity_id, false);
      break;
    default: {
      const _exhaustive: never = item.source_table;
      throw new Error(`Unknown source_table: ${String(_exhaustive)}`);
    }
  }
}
