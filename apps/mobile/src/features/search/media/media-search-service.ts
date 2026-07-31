import { supabase } from "../../../lib/supabase";
import { followClub, unfollowClub } from "../../clubs/club-service";
import { toggleSavedClubMedia } from "../../clubs/club-media-service";
import {
  followProfile,
  toggleSavedFanMedia,
  unfollowProfile,
} from "../../profiles/fan-media-service";
import { toggleSavedFanTribuna } from "../../profiles/fan-tribuna-service";
import { toggleSavedMediaProfilePost } from "../../profiles/media-profile-post-service";
import { toggleSavedMediaTribuna } from "../../profiles/media-tribuna-service";
import {
  isMediaFiltersEmpty,
} from "./media-filter-helpers";
import type {
  MediaContentPage,
  MediaContentRow,
  MediaContentType,
  MediaForYouRow,
  MediaSearchFilters,
  MediaSearchSort,
  MediaSourceDiscoverRow,
  MediaSourcePage,
  MediaSourceRowData,
  MediaSourceType,
  MediaSuggestionRow,
} from "./media-search-types";

export const MEDIA_PAGE_SIZE = 20;
export const MIN_MEDIA_QUERY_LENGTH = 2;

/** Quante fonti si mostrano dentro la pagina risultati mista (CER-05 §8). */
export const MEDIA_SOURCES_INLINE_LIMIT = 4;

/** Quante anteprime contenuto precedono il blocco fonti (CER-05 §8). */
export const MEDIA_TOP_CONTENT_COUNT = 3;

/** Empty/blank queries become null so the paged RPCs switch to browse mode. */
function normalizeQuery(query: string | null | undefined): string | null {
  const trimmed = query?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function filtersParam(
  filters: MediaSearchFilters | null | undefined,
): MediaSearchFilters | null {
  return isMediaFiltersEmpty(filters) ? null : (filters as MediaSearchFilters);
}

export async function searchMediaContentPage({
  filters,
  page,
  pageSize = MEDIA_PAGE_SIZE,
  query,
  sort,
}: {
  filters?: MediaSearchFilters | null;
  page: number;
  pageSize?: number;
  query: string | null;
  sort?: MediaSearchSort;
}): Promise<MediaContentPage> {
  const { data, error } = await supabase.rpc("search_media_content_page", {
    p_filters: filtersParam(filters),
    p_limit: pageSize,
    p_offset: page * pageSize,
    p_query: normalizeQuery(query),
    p_sort: sort ?? "pertinenza",
  });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as MediaContentRow[];

  // supabase-js returns bigint as a string, hence the explicit Number().
  return { rows, totalCount: Number(rows[0]?.total_count ?? 0) };
}

export async function searchMediaSourcesPage({
  filters,
  page,
  pageSize = MEDIA_PAGE_SIZE,
  query,
}: {
  filters?: MediaSearchFilters | null;
  page: number;
  pageSize?: number;
  query: string | null;
}): Promise<MediaSourcePage> {
  const { data, error } = await supabase.rpc("search_media_sources_page", {
    p_filters: filtersParam(filters),
    p_limit: pageSize,
    p_offset: page * pageSize,
    p_query: normalizeQuery(query),
  });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as MediaSourceRowData[];

  return { rows, totalCount: Number(rows[0]?.total_count ?? 0) };
}

export async function searchMediaSuggestions(
  query: string,
  perGroup = 3,
): Promise<MediaSuggestionRow[]> {
  const { data, error } = await supabase.rpc("search_media_suggestions", {
    p_per_group: perGroup,
    p_query: query,
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as MediaSuggestionRow[];
}

export async function fetchMediaForYou(limit = 6): Promise<MediaForYouRow[]> {
  const { data, error } = await supabase.rpc("fetch_media_for_you", {
    p_limit: limit,
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as MediaForYouRow[];
}

export async function fetchMediaSourcesDiscover(
  limit = 5,
): Promise<MediaSourceDiscoverRow[]> {
  const { data, error } = await supabase.rpc("fetch_media_sources_discover", {
    p_limit: limit,
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as MediaSourceDiscoverRow[];
}

/**
 * Bookmark di un singolo contenuto. Ogni superficie ha la sua tabella
 * `saved_*`: si riusano i toggle già esistenti invece di duplicare la
 * scrittura, esattamente come fa `removeSavedItem` in saved-service.ts.
 */
export async function toggleSavedContent(
  profileId: string,
  contentType: MediaContentType,
  postId: string,
  shouldSave: boolean,
): Promise<void> {
  switch (contentType) {
    case "club_media":
      await toggleSavedClubMedia(profileId, postId, shouldSave);
      return;
    case "media_profile":
      await toggleSavedMediaProfilePost(profileId, postId, shouldSave);
      return;
    case "media_tribuna":
      await toggleSavedMediaTribuna(profileId, postId, shouldSave);
      return;
    case "fan_tribuna":
      await toggleSavedFanTribuna(profileId, postId, shouldSave);
      return;
    case "fan_media":
      await toggleSavedFanMedia(profileId, postId, shouldSave);
      return;
    default: {
      const exhaustive: never = contentType;
      throw new Error(`Tipo di contenuto non gestito: ${String(exhaustive)}`);
    }
  }
}

/**
 * Follow di una fonte. I profili Media usano `profile_follows`, le società
 * `club_follows`: non esiste una tabella follow polimorfa.
 */
export async function toggleFollowSource(
  profileId: string,
  sourceType: MediaSourceType,
  entityId: string,
  shouldFollow: boolean,
): Promise<void> {
  if (sourceType === "club") {
    await (shouldFollow ? followClub(profileId, entityId) : unfollowClub(profileId, entityId));
    return;
  }

  await (shouldFollow
    ? followProfile(profileId, entityId)
    : unfollowProfile(profileId, entityId));
}

export function resolveMediaContentHref(row: {
  content_type: MediaContentType;
  post_id: string;
}): string {
  return `/content/${row.content_type}/${row.post_id}`;
}

export function resolveMediaPublisherHref(row: {
  publisher_id: string;
  publisher_type: "club" | "profile";
}): string {
  return row.publisher_type === "club"
    ? `/club/${row.publisher_id}`
    : `/profile/${row.publisher_id}`;
}

export function resolveMediaSourceHref(row: {
  entity_id: string;
  source_type: MediaSourceType;
}): string {
  return row.source_type === "club"
    ? `/club/${row.entity_id}`
    : `/profile/${row.entity_id}`;
}

/**
 * Suggerimenti: entità -> profilo pubblico, argomento/territorio -> null,
 * perché quelle righe rilanciano la ricerca invece di navigare (CER-05 §21).
 */
export function resolveMediaSuggestionHref(row: MediaSuggestionRow): string | null {
  if (!row.target_id || !row.target_type) {
    return null;
  }

  switch (row.target_type) {
    case "club":
      return `/club/${row.target_id}`;
    case "club_team":
      return `/club/team/${row.target_id}`;
    case "media_profile":
    case "profile":
      return `/profile/${row.target_id}`;
    default:
      return null;
  }
}
