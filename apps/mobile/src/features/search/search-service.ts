import { supabase } from "../../lib/supabase";
import { isProfileFiltersEmpty } from "./search-filters";
import type {
  ClubSearchFilters,
  ClubSearchRow,
  ClubSearchSort,
  GlobalSearchRow,
  PositionSearchParams,
  PositionSearchRow,
  ProfileSearchFilters,
  ProfileSearchRow,
  ProfileSearchSort,
  SearchClubKind,
  SearchPositionTarget,
  SearchProfileRole,
} from "./search-types";

export const SEARCH_PAGE_SIZE = 20;
export const MIN_SEARCH_QUERY_LENGTH = 2;

/** Empty/blank queries become null so the paged RPCs switch to browse mode. */
function normalizeQuery(query: string | null | undefined): string | null {
  const trimmed = query?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export type ProfileSearchPage = {
  rows: ProfileSearchRow[];
  totalCount: number;
};

export type ClubSearchPage = {
  rows: ClubSearchRow[];
  totalCount: number;
};

export { ageRangeToClasse, isProfileFiltersEmpty } from "./search-filters";

/**
 * True when a filters object carries no actual constraints (every key
 * absent/empty). Mirrors `isProfileFiltersEmpty` — used to collapse the
 * payload to `null` before it reaches `search_clubs_page`.
 */
export function isClubFiltersEmpty(
  filters: ClubSearchFilters | null | undefined,
): boolean {
  if (!filters) {
    return true;
  }

  return Object.values(filters).every((value) => {
    // Boolean filters here are toggles that only constrain when `true`
    // (see search_clubs_page); an explicit `false` behaves exactly like
    // absent, so treat it as empty too.
    if (value === undefined || value === false) {
      return true;
    }

    if (Array.isArray(value)) {
      return value.length === 0;
    }

    return false;
  });
}

export async function searchGlobal(
  query: string,
  perCategory = 3,
  contentLimit = 2,
): Promise<GlobalSearchRow[]> {
  const { data, error } = await supabase.rpc("search_global", {
    p_content_limit: contentLimit,
    p_per_category: perCategory,
    p_query: query.trim(),
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as GlobalSearchRow[];
}

export async function searchProfilesPage({
  query,
  role,
  filters,
  sort,
  page,
  pageSize = SEARCH_PAGE_SIZE,
}: {
  query: string | null;
  role: SearchProfileRole | null;
  filters?: ProfileSearchFilters | null;
  sort?: ProfileSearchSort;
  page: number;
  pageSize?: number;
}): Promise<ProfileSearchPage> {
  const { data, error } = await supabase.rpc("search_profiles_page", {
    p_filters: isProfileFiltersEmpty(filters) ? null : filters,
    p_limit: pageSize,
    p_offset: page * pageSize,
    p_query: normalizeQuery(query),
    p_role: role,
    p_sort: sort ?? "relevance",
  });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as ProfileSearchRow[];

  return {
    rows,
    totalCount: Number(rows[0]?.total_count ?? 0),
  };
}

export async function searchClubsPage({
  query,
  kind,
  filters,
  sort,
  page,
  pageSize = SEARCH_PAGE_SIZE,
}: {
  query: string | null;
  kind: SearchClubKind | null;
  filters?: ClubSearchFilters | null;
  sort?: ClubSearchSort;
  page: number;
  pageSize?: number;
}): Promise<ClubSearchPage> {
  const { data, error } = await supabase.rpc("search_clubs_page", {
    p_filters: isClubFiltersEmpty(filters) ? null : filters,
    p_kind: kind,
    p_limit: pageSize,
    p_offset: page * pageSize,
    p_query: normalizeQuery(query),
    p_sort: sort ?? "relevance",
  });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as ClubSearchRow[];

  return {
    rows,
    totalCount: Number(rows[0]?.total_count ?? 0),
  };
}

export type PositionSearchPage = {
  rows: PositionSearchRow[];
  totalCount: number;
};

/** Arrays are only constraining when non-empty; collapse empties to null. */
function arrayParam(values: string[] | null | undefined): string[] | null {
  return values && values.length > 0 ? values : null;
}

export async function searchPositionsPage({
  query = null,
  target = null,
  savedOnly = false,
  positions = null,
  primaryPositions = null,
  regions = null,
  provinces = null,
  categories = null,
  teamType = null,
  clubId = null,
  lat = null,
  lng = null,
  radiusKm = null,
  sort = null,
  page,
  pageSize = SEARCH_PAGE_SIZE,
}: PositionSearchParams): Promise<PositionSearchPage> {
  const { data, error } = await supabase.rpc("search_positions_page", {
    p_categories: arrayParam(categories),
    p_club_id: clubId,
    p_lat: lat,
    p_limit: pageSize,
    p_lng: lng,
    p_offset: page * pageSize,
    p_positions: arrayParam(positions),
    p_primary_positions: arrayParam(primaryPositions),
    p_provinces: arrayParam(provinces),
    p_query: normalizeQuery(query),
    p_radius_km: radiusKm,
    p_regions: arrayParam(regions),
    p_saved_only: savedOnly,
    p_sort: sort,
    p_target: target,
    p_team_type: teamType,
  });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as PositionSearchRow[];

  return {
    rows,
    totalCount: Number(rows[0]?.total_count ?? 0),
  };
}

export type ForYouPositions = {
  /** In-area, role-matched positions (primary role first). */
  primary: PositionSearchRow[];
  /** Same roles, out of the preferred area ("Potrebbero interessarti anche"). */
  suggestions: PositionSearchRow[];
};

/**
 * Profile-seeded "Per te" positions. Runs two queries in parallel: the main
 * in-area list (region-filtered, primary role ranked first) and a lighter
 * out-of-area list, deduped against the main one.
 */
export async function searchPositionsForYou({
  target,
  primaryPositions,
  compatiblePositions,
  regions,
  pageSize = 10,
}: {
  target: SearchPositionTarget;
  primaryPositions: string[];
  compatiblePositions: string[];
  regions: string[];
  pageSize?: number;
}): Promise<ForYouPositions> {
  const allPositions =
    target === "player"
      ? [...primaryPositions, ...compatiblePositions]
      : [];

  const [inArea, anyArea] = await Promise.all([
    searchPositionsPage({
      target,
      positions: allPositions,
      primaryPositions,
      regions,
      sort: "pertinenza",
      page: 0,
      pageSize,
    }),
    regions.length > 0
      ? searchPositionsPage({
          target,
          positions: allPositions,
          primaryPositions,
          sort: "recenti",
          page: 0,
          pageSize,
        })
      : Promise.resolve<PositionSearchPage>({ rows: [], totalCount: 0 }),
  ]);

  const primaryIds = new Set(inArea.rows.map((row) => row.ad_id));
  const suggestions = anyArea.rows.filter((row) => !primaryIds.has(row.ad_id));

  return { primary: inArea.rows, suggestions };
}

export function resolveGlobalSearchHref(row: GlobalSearchRow): string {
  switch (row.target_type) {
    case "profile":
      return `/profile/${row.target_id}`;
    case "club":
      return `/club/${row.target_id}`;
    case "club_team":
      return `/club/team/${row.target_id}`;
    case "recruiting_ad":
      return `/position/${row.target_id}`;
    case "club_media":
    case "fan_tribuna":
      return `/content/${row.target_type}/${row.target_id}`;
    default: {
      const _exhaustive: never = row.target_type;
      throw new Error(`Unknown target_type: ${String(_exhaustive)}`);
    }
  }
}
