import AsyncStorage from "@react-native-async-storage/async-storage";

export type RecentSearchScope =
  | "global"
  | "profiles"
  | "clubs"
  | "positions"
  | "media";

export type RecentSearch = {
  query: string;
  scope: RecentSearchScope;
  searchedAt: string;
};

const PREFIX = "@footme/recent-searches/";

export const MAX_RECENT_SEARCHES = 10;
const MIN_QUERY_LENGTH = 2;

function isRecentSearch(value: unknown): value is RecentSearch {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const entry = value as Record<string, unknown>;

  return (
    typeof entry.query === "string" &&
    typeof entry.searchedAt === "string" &&
    (entry.scope === "global" ||
      entry.scope === "profiles" ||
      entry.scope === "clubs" ||
      entry.scope === "positions" ||
      entry.scope === "media")
  );
}

export async function loadRecentSearches(
  profileId: string,
): Promise<RecentSearch[]> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + profileId);
    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRecentSearch) : [];
  } catch {
    return [];
  }
}

export async function addRecentSearch(
  profileId: string,
  query: string,
  scope: RecentSearchScope,
): Promise<RecentSearch[]> {
  const normalized = query.trim();
  const current = await loadRecentSearches(profileId);

  if (normalized.length < MIN_QUERY_LENGTH) {
    return current;
  }

  const next: RecentSearch[] = [
    { query: normalized, scope, searchedAt: new Date().toISOString() },
    ...current.filter(
      (entry) => entry.query.toLowerCase() !== normalized.toLowerCase(),
    ),
  ].slice(0, MAX_RECENT_SEARCHES);

  try {
    await AsyncStorage.setItem(PREFIX + profileId, JSON.stringify(next));
  } catch {
    // Best-effort: recording history must never block the search flow.
  }

  return next;
}

export async function clearRecentSearches(profileId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(PREFIX + profileId);
  } catch {
    // Best-effort.
  }
}

/** "oggi" / "ieri" / "N giorni fa", by calendar day. */
export function formatRecentSearchAge(
  searchedAt: string,
  now: Date = new Date(),
): string {
  const then = new Date(searchedAt);

  if (Number.isNaN(then.getTime())) {
    return "oggi";
  }

  const startOfDay = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.round((startOfDay(now) - startOfDay(then)) / dayMs);

  if (days <= 0) {
    return "oggi";
  }

  if (days === 1) {
    return "ieri";
  }

  return `${days} giorni fa`;
}
