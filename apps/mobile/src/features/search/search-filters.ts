import type { ProfileSearchFilters } from "./search-types";

/**
 * True when a filters object carries no actual constraints (every shared
 * key and every role group is empty/undefined). Used to collapse the
 * payload to `null` before it reaches the RPC, and to keep the React Query
 * key stable when the user opens the filters modal without changing
 * anything.
 */
export function isProfileFiltersEmpty(
  filters: ProfileSearchFilters | null | undefined,
): boolean {
  if (!filters) {
    return true;
  }

  const { region, is_available, player, coach, staff, agent } = filters;

  if (region !== undefined || is_available !== undefined) {
    return false;
  }

  return [player, coach, staff, agent].every(
    (group) => group === undefined || Object.keys(group).length === 0,
  );
}

/**
 * Converts an age range (inclusive) into the equivalent classe (birth year)
 * range: classe_min = year - ageMax, classe_max = year - ageMin. Either
 * bound may be omitted (e.g. "Under 21" only sets ageMax; "Over 23" only
 * sets ageMin).
 */
export function ageRangeToClasse(
  ageMin: number | null | undefined,
  ageMax: number | null | undefined,
  currentYear: number = new Date().getFullYear(),
): { classeMin?: number; classeMax?: number } {
  const result: { classeMin?: number; classeMax?: number } = {};

  if (ageMax != null) {
    result.classeMin = currentYear - ageMax;
  }

  if (ageMin != null) {
    result.classeMax = currentYear - ageMin;
  }

  return result;
}
