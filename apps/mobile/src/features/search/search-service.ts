import { supabase } from "../../lib/supabase";
import { isProfileFiltersEmpty } from "./search-filters";
import type {
  ClubSearchRow,
  GlobalSearchRow,
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

export { ageRangeToClasse, isProfileFiltersEmpty } from "./search-filters";

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

export async function searchClubsPage(
  query: string | null,
  kind: SearchClubKind | null,
  page: number,
  pageSize = SEARCH_PAGE_SIZE,
): Promise<ClubSearchRow[]> {
  const { data, error } = await supabase.rpc("search_clubs_page", {
    p_kind: kind,
    p_limit: pageSize,
    p_offset: page * pageSize,
    p_query: normalizeQuery(query),
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as ClubSearchRow[];
}

export async function searchPositionsPage(
  query: string | null,
  target: SearchPositionTarget | null,
  savedOnly: boolean,
  page: number,
  pageSize = SEARCH_PAGE_SIZE,
): Promise<PositionSearchRow[]> {
  const { data, error } = await supabase.rpc("search_positions_page", {
    p_limit: pageSize,
    p_offset: page * pageSize,
    p_query: normalizeQuery(query),
    p_saved_only: savedOnly,
    p_target: target,
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as PositionSearchRow[];
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
