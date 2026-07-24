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

export type ClubSearchRow = {
  kind: "club" | "team";
  entity_id: string;
  name: string;
  logo_url: string | null;
  city: string | null;
  region: string | null;
  category: string | null;
  parent_club_name: string | null;
  is_affiliate: boolean;
};

/** Chip filter on Cerca > Posizioni aperte. */
export type SearchPositionTarget = "player" | "coach" | "staff";

export type PositionSearchRow = {
  ad_id: string;
  title: string;
  club_name: string;
  club_logo_url: string | null;
  team_name: string | null;
  category: string | null;
  region: string | null;
  target_role: SearchPositionTarget;
  deadline: string | null;
  published_at: string | null;
  is_saved: boolean;
};
