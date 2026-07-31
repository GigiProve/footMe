export type GlobalSearchGroupKey =
  | "societa"
  | "profilo"
  | "posizione"
  | "contenuto";

export type GlobalSearchTargetType =
  | "profile"
  | "club"
  | "club_team"
  | "recruiting_ad"
  | "club_media"
  | "fan_tribuna";

export type GlobalSearchRow = {
  group_key: GlobalSearchGroupKey;
  target_type: GlobalSearchTargetType;
  target_id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
};

/** Roles surfaced by the Cerca > Profili chips. */
export type SearchProfileRole = "player" | "coach" | "staff" | "agent";

/** Sort modes accepted by `search_profiles_page` (p_sort). */
export type ProfileSearchSort =
  | "relevance"
  | "recent"
  | "vicini"
  | "classe_asc"
  | "classe_desc";

export type ProfileSearchRow = {
  profile_id: string;
  full_name: string;
  avatar_url: string | null;
  role: SearchProfileRole;
  region: string | null;
  city: string | null;
  primary_position: string | null;
  current_club_name: string | null;
  current_team_name: string | null;
  age: number | null;
  is_available: boolean | null;
  birth_year: number | null;
  is_open_to_transfer: boolean | null;
  current_category: string | null;
  coach_primary_role: string | null;
  coach_top_license: string | null;
  coach_context: string | null;
  open_to_new_role: boolean | null;
  staff_primary_role: string | null;
  experience_summary: string | null;
  open_to_work: boolean | null;
  agency_name: string | null;
  managed_players_count: string | null;
  agent_operating_areas: string[] | null;
  open_to_players: boolean | null;
  years_experience: number | null;
  total_count: number;
};

/**
 * Advanced filters payload for `search_profiles_page` (p_filters).
 * Keys mirror the jsonb schema 1:1 (snake_case) — no client-side mapping
 * layer. Only the keys relevant to the active role chip should be sent;
 * `search-service.ts` drops the whole payload to `null` when empty.
 */
export type PlayerSearchFilters = {
  positions?: string[];
  classe_min?: number;
  classe_max?: number;
  situation?: "svincolato" | "tesserato" | "disponibile" | "in_scadenza";
  categories?: string[];
  provinces?: string[];
  transfer_areas?: string[];
  is_open_to_transfer?: boolean;
  preferred_foot?: "right" | "left" | "both";
  height_min?: number;
  height_max?: number;
  has_video?: boolean;
};

export type CoachSearchFilters = {
  coach_role?: string;
  licenses?: string[];
  context?: "prima_squadra" | "settore_giovanile" | "entrambi";
  min_seasons?: number;
  coached_categories?: string[];
  provinces?: string[];
  open_to_new_role?: boolean;
  backgrounds?: (
    | "ex_calciatore"
    | "preparatore_atletico"
    | "collaboratore_tecnico"
    | "osservatore"
  )[];
};

export type StaffSearchFilters = {
  staff_roles?: string[];
  has_certifications?: boolean;
  certifications?: string[];
  categories?: string[];
  scope?: "prima_squadra" | "settore_giovanile" | "entrambi";
  provinces?: string[];
  open_to_work?: boolean;
};

export type AgentSearchFilters = {
  operating_areas?: string[];
  player_types?: string[];
  managed_bands?: string[];
  min_years?: number;
  is_federation_licensed?: boolean;
  open_to_players?: boolean;
};

export type ProfileSearchFilters = {
  region?: string;
  is_available?: boolean;
  player?: PlayerSearchFilters;
  coach?: CoachSearchFilters;
  staff?: StaffSearchFilters;
  agent?: AgentSearchFilters;
};

/** Chip filter on Cerca > Società ("affiliate" filters clubs flagged as affiliated). */
export type SearchClubKind = "club" | "team" | "affiliate";

/** Sort modes accepted by `search_clubs_page` (p_sort). */
export type ClubSearchSort = "relevance" | "vicini" | "recent" | "positions" | "name";

/**
 * Advanced filters payload for `search_clubs_page` (p_filters). Keys mirror
 * the jsonb schema 1:1 (snake_case) — no client-side mapping layer. Only
 * present keys constrain the result; `search-service.ts` drops the whole
 * payload to `null` when empty (see `isClubFiltersEmpty`).
 */
export type ClubSearchFilters = {
  categories?: string[];
  region?: string;
  city?: string;
  has_senior?: boolean;
  has_youth?: boolean;
  has_teams?: boolean;
  has_affiliates?: boolean;
  open_positions?: boolean;
  target_roles?: ("player" | "coach" | "staff")[];
  followed?: boolean;
  saved?: boolean;
};

export type ClubSearchRow = {
  kind: "club" | "team";
  entity_id: string;
  name: string;
  logo_url: string | null;
  city: string | null;
  region: string | null;
  category: string | null;
  parent_club_id: string | null;
  parent_club_name: string | null;
  is_affiliate: boolean;
  has_senior: boolean | null;
  has_youth: boolean | null;
  affiliate_count: number | null;
  open_positions_count: number | null;
  total_count: number;
};

/** Chip filter on Cerca > Posizioni aperte. */
export type SearchPositionTarget = "player" | "coach" | "staff";

/** Sort modes accepted by `search_positions_page` (p_sort). */
export type PositionSort =
  | "pertinenza"
  | "recenti"
  | "vicinanza"
  | "categoria"
  | "localita";

export type PositionSearchRow = {
  ad_id: string;
  title: string;
  club_name: string;
  club_logo_url: string | null;
  team_name: string | null;
  team_type: "senior" | "youth" | null;
  /** recruiting_ads.role_required (player positions); null for coach/staff. */
  role_required: string | null;
  category: string | null;
  city: string | null;
  province: string | null;
  region: string | null;
  target_role: SearchPositionTarget;
  deadline: string | null;
  published_at: string | null;
  /** Populated only in "Vicino a me" mode (haversine km); otherwise null. */
  distance_km: number | null;
  /** True when the ad matched via a compatible (non-primary) role. */
  is_secondary_match: boolean;
  is_saved: boolean;
  total_count: number;
};

/**
 * Parameters forwarded to `search_positions_page`. Empty arrays collapse to
 * null in `searchPositionsPage` so the RPC treats them as "no constraint".
 */
export type PositionSearchParams = {
  query?: string | null;
  target?: SearchPositionTarget | null;
  savedOnly?: boolean;
  /** Player positions to match against role_required. */
  positions?: string[] | null;
  /** Subset of `positions` considered primary (drives is_secondary_match). */
  primaryPositions?: string[] | null;
  regions?: string[] | null;
  provinces?: string[] | null;
  categories?: string[] | null;
  teamType?: "senior" | "youth" | null;
  clubId?: string | null;
  lat?: number | null;
  lng?: number | null;
  radiusKm?: number | null;
  sort?: PositionSort | null;
  page: number;
  pageSize?: number;
};
