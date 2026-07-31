import type { PositionSearchParams } from "../search-types";
import type { PositionsSearchCriteria } from "./positions-search-types";

export const POSITIONS_QK = "positions";

/** Build the RPC params for the Esplora results list from the full criteria. */
export function criteriaToParams(
  criteria: PositionsSearchCriteria,
  page: number,
): PositionSearchParams {
  const params: PositionSearchParams = {
    target: criteria.target,
    page,
    sort: criteria.sort,
    categories: criteria.categories,
    teamType: criteria.teamType,
    clubId: criteria.clubId,
  };

  if (criteria.target === "player") {
    params.positions = criteria.useCompatible
      ? [...criteria.primaryPositions, ...criteria.compatiblePositions]
      : criteria.primaryPositions;
    params.primaryPositions = criteria.primaryPositions;
  }

  switch (criteria.geoMode) {
    case "regions":
      params.regions = criteria.regions;
      break;
    case "provinces":
      params.provinces = criteria.provinces;
      break;
    case "profile":
      // Exactly one of these is populated at seed time (see fetchPositionsSeed),
      // so they never AND together into an over-constrained query.
      params.regions = criteria.profileRegions;
      params.provinces = criteria.profileProvinces;
      break;
    case "near_me":
      if (criteria.nearMe) {
        params.lat = criteria.nearMe.lat;
        params.lng = criteria.nearMe.lng;
        params.radiusKm = criteria.nearMe.radiusKm;
      }
      break;
    case "italy":
    default:
      break;
  }

  return params;
}

/** Number of active "Altri filtri" constraints (drives the "Filtri (n)" chip). */
export function activeFilterCount(criteria: PositionsSearchCriteria): number {
  let count = 0;
  if (criteria.categories.length > 0) count += 1;
  if (criteria.teamType) count += 1;
  if (criteria.clubId) count += 1;
  return count;
}

function criteriaKey(criteria: PositionsSearchCriteria): string {
  const { page: _page, ...rest } = criteriaToParams(criteria, 0);
  return JSON.stringify(rest);
}

export function resultsQueryKey(criteria: PositionsSearchCriteria) {
  return [POSITIONS_QK, "results", criteriaKey(criteria)] as const;
}

export function savedQueryKey(profileId: string | null) {
  return [POSITIONS_QK, "saved", profileId] as const;
}

export function forYouQueryKey(
  profileId: string | null,
  criteria: PositionsSearchCriteria,
) {
  return [
    POSITIONS_QK,
    "for-you",
    profileId,
    criteria.target,
    criteria.primaryPositions.join(","),
    criteria.compatiblePositions.join(","),
    criteria.profileRegions.join(","),
  ] as const;
}
