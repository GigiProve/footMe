import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  fetchClubAffiliations,
  fetchClubParentAffiliation,
} from "../clubs/club-service";
import type { ClubAffiliationSummary, ClubParentAffiliation } from "../clubs/club-service";
import { fetchClubTeams } from "../clubs/team-service";
import type { ClubTeam } from "../clubs/team-service";
import { MIN_SEARCH_QUERY_LENGTH, searchClubsPage } from "./search-service";
import type { ClubSearchFilters, ClubSearchRow, ClubSearchSort, SearchClubKind } from "./search-types";

export type ClubGroupedResultsEmpty = {
  mode: "empty";
  totalCount: 0;
};

export type ClubGroupedResultsClub = {
  mode: "club";
  primary: ClubSearchRow;
  parent: ClubParentAffiliation | null;
  teams: ClubTeam[];
  affiliates: ClubAffiliationSummary[];
  linkedSiblings: ClubAffiliationSummary[];
  others: ClubSearchRow[];
  totalCount: number;
};

export type ClubGroupedResultsTeam = {
  mode: "team";
  primary: ClubSearchRow;
  relatedTeams: ClubSearchRow[];
  others: ClubSearchRow[];
  totalCount: number;
};

export type ClubGroupedResults =
  | ClubGroupedResultsEmpty
  | ClubGroupedResultsClub
  | ClubGroupedResultsTeam;

async function loadGroupedResults(
  query: string,
  kind: SearchClubKind | null,
  filters: ClubSearchFilters | null,
  sort: ClubSearchSort,
): Promise<ClubGroupedResults> {
  const { rows, totalCount } = await searchClubsPage({
    query,
    kind,
    filters,
    sort,
    page: 0,
  });

  if (!rows.length) {
    return { mode: "empty", totalCount: 0 };
  }

  const primary = rows[0];

  if (primary.kind === "club") {
    const [teams, affiliates, parent] = await Promise.all([
      fetchClubTeams(primary.entity_id).catch(() => []),
      fetchClubAffiliations(primary.entity_id).catch(() => []),
      fetchClubParentAffiliation(primary.entity_id).catch(() => null),
    ]);

    const childIds = new Set([
      ...teams.map((t) => t.id),
      ...affiliates.map((a) => a.id),
    ]);
    const others = rows.slice(1).filter((r) => !childIds.has(r.entity_id));

    const linkedSiblings = parent
      ? (await fetchClubAffiliations(parent.id).catch(() => [])).filter(
          (a) => a.id !== primary.entity_id,
        )
      : [];

    return {
      mode: "club",
      primary,
      parent,
      teams,
      affiliates,
      linkedSiblings,
      others,
      totalCount,
    };
  }

  const relatedTeams = rows.slice(1).filter((r) => r.kind === "team");
  const others = rows.slice(1).filter((r) => r.kind === "club");

  return {
    mode: "team",
    primary,
    relatedTeams,
    others,
    totalCount,
  };
}

/**
 * Hierarchical view for Cerca > Società query mode: società principale → sue
 * squadre → società affiliate → altri risultati (see `ClubGroupedResults`
 * component). Bounded to the first page — unlike the browse-mode infinite
 * list, this view assembles a small fixed set of related entities.
 */
export function useClubGroupedResults(
  query: string,
  kind: SearchClubKind | null,
  filters: ClubSearchFilters | null,
  sort: ClubSearchSort,
) {
  const trimmed = query.trim();

  const { data, isLoading } = useQuery({
    queryKey: ["search-clubs-grouped", trimmed, kind, filters, sort],
    queryFn: () => loadGroupedResults(trimmed, kind, filters, sort),
    enabled: trimmed.length >= MIN_SEARCH_QUERY_LENGTH,
    placeholderData: keepPreviousData,
  });

  return { data, isLoading };
}
