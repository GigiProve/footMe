/**
 * Row and filter types for Cerca > Media e contenuti (CER-05).
 *
 * Row shapes mirror the RPC return columns 1:1 in snake_case — there are no
 * generated Supabase types in this project, so these declarations *are* the
 * contract with `search_media_content_page` / `search_media_sources_page` /
 * `search_media_suggestions` / `fetch_media_for_you` /
 * `fetch_media_sources_discover` (20260726110000_media_search_rpcs.sql).
 *
 * `MediaSearchFilters` mirrors the jsonb keys the RPCs read, again 1:1, with
 * no mapping layer. The UI-facing state lives in `media-filter-types.ts` and
 * `buildMediaFilterPayload` is the only bridge between the two shapes.
 */

/** The five content surfaces the search indexes. */
export type MediaContentType =
  | "club_media"
  | "media_profile"
  | "media_tribuna"
  | "fan_tribuna"
  | "fan_media";

/** Tipologia mostrata all'utente (CER-05 §4), derivata in SQL. */
export type MediaContentFormat = "articolo" | "video" | "foto" | "post";

/**
 * Provenienza del contenuto / tipologia della fonte (CER-05 §12/§16).
 * `tifoso` esiste solo sui contenuti: non è una fonte selezionabile.
 */
export type MediaSourceKind =
  | "ufficiale"
  | "testata"
  | "giornalista"
  | "creator"
  | "pagina"
  | "tifoso";

/** Tipologie selezionabili dal filtro Fonte. */
export type MediaSourceFilterKind = Exclude<MediaSourceKind, "tifoso">;

export type MediaSourceType = "media_profile" | "club";

/** Filtro "Tipo di risultato" (CER-05 §18). */
export type MediaResultKind = "all" | "contents" | "sources";

/** Sort modes accepted by `search_media_content_page` (p_sort). */
export type MediaSearchSort = "pertinenza" | "recenti" | "evidenza" | "discussi";

export type MediaPublishedWithinPayload = "today" | "last7" | "last30";

export type MediaContentRow = {
  content_type: MediaContentType;
  post_id: string;
  content_format: MediaContentFormat;
  kind: string | null;
  kind_label: string | null;
  title: string;
  thumbnail_url: string | null;
  media_type: "image" | "video" | null;
  duration_seconds: number | null;
  publisher_type: "club" | "profile";
  publisher_id: string;
  publisher_name: string;
  publisher_avatar_url: string | null;
  source_kind: MediaSourceKind;
  published_at: string | null;
  is_saved: boolean;
  total_count: number;
};

/** `fetch_media_for_you` returns no total_count and adds the affinity flag. */
export type MediaForYouRow = Omit<MediaContentRow, "total_count"> & {
  is_personalized: boolean;
};

export type MediaSourceRowData = {
  source_type: MediaSourceType;
  source_kind: MediaSourceKind;
  entity_id: string;
  name: string;
  avatar_url: string | null;
  description: string | null;
  regions: string[];
  categories: string[];
  topics: string[];
  is_verified: boolean;
  content_count: number;
  last_published_at: string | null;
  is_following: boolean;
  total_count: number;
};

export type MediaSourceDiscoverRow = Omit<MediaSourceRowData, "total_count">;

/**
 * jsonb payload for `p_filters`. Keys mirror the RPC header table exactly;
 * an absent key means "no constraint".
 */
export type MediaSearchFilters = {
  formats?: MediaContentFormat[];
  sources?: MediaSourceFilterKind[];
  categories?: string[];
  regions?: string[];
  provinces?: string[];
  published_within?: MediaPublishedWithinPayload;
  saved?: boolean;
  followed_sources?: boolean;
  followed_clubs?: boolean;
  followed_profiles?: boolean;
};

export type MediaSuggestionGroupKey =
  | "societa"
  | "fonte"
  | "profilo"
  | "argomento"
  | "territorio";

/**
 * `target_id` is null for `argomento` / `territorio`: those rows re-run the
 * search with `search_term` instead of navigating to an entity (CER-05 §21).
 */
export type MediaSuggestionRow = {
  group_key: MediaSuggestionGroupKey;
  group_order: number;
  target_type: "club" | "club_team" | "media_profile" | "profile" | null;
  target_id: string | null;
  label: string;
  subtitle: string | null;
  image_url: string | null;
  search_term: string | null;
};

export type MediaContentPage = {
  rows: MediaContentRow[];
  totalCount: number;
};

export type MediaSourcePage = {
  rows: MediaSourceRowData[];
  totalCount: number;
};
