import { supabase } from "../../lib/supabase";
import { toggleSavedAd } from "../recruiting/recruiting-service";
import { toggleSavedMediaTribuna } from "../profiles/media-tribuna-service";
import { toggleSavedClubMedia } from "../clubs/club-media-service";
import { toggleSavedFanTribuna } from "../profiles/fan-tribuna-service";

export type SavedKind = "profile" | "club" | "position" | "content";

export type SavedSourceTable =
  | "saved_profiles"
  | "saved_clubs"
  | "saved_ads"
  | "saved_media_tribuna"
  | "saved_club_media"
  | "saved_fan_tribuna";

export type SavedItem = {
  kind: SavedKind;
  source_table: SavedSourceTable;
  entity_id: string;
  content_type: "media_tribuna" | "club_media" | "fan_tribuna" | null;
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

// Content route `/content/[type]/[id]` only supports these types.
// `saved_media_tribuna` items (content_type "media_tribuna") have no standalone
// detail route, and saved positions (`saved_ads`) have no per-ad route either —
// both resolve to null and render as non-navigating rows.
const ROUTABLE_CONTENT_TYPES = new Set(["club_media", "fan_tribuna"]);

export function resolveSavedItemHref(item: SavedItem): string | null {
  switch (item.kind) {
    case "profile":
      return `/profile/${item.entity_id}`;
    case "club":
      return `/club/${item.entity_id}`;
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
    default: {
      const _exhaustive: never = item.source_table;
      throw new Error(`Unknown source_table: ${String(_exhaustive)}`);
    }
  }
}
