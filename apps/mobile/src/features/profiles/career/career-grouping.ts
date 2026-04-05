import type { PlayerExperienceForm } from "../player-sports";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GroupedExperience = {
  clubId: string | null;
  clubName: string;
  teamLogoUrl: string;
  startYear: number;
  endYear: number;
  durationLabel: string;
  seasons: PlayerExperienceForm[];
};

export type CareerGroups = {
  senior: GroupedExperience[];
  youth: GroupedExperience[];
};

// ---------------------------------------------------------------------------
// Youth classification
// ---------------------------------------------------------------------------

const YOUTH_CATEGORIES = new Set([
  "Primavera",
  "Under 19",
  "Under 17",
  "Under 15",
  "Under 14",
  "Esordienti",
  "Pulcini",
  "Juniores",
  "Allievi",
  "Giovanissimi",
]);

export function isYouthCategory(category: string): boolean {
  return YOUTH_CATEGORIES.has(category);
}

// ---------------------------------------------------------------------------
// Season helpers
// ---------------------------------------------------------------------------

export function getSeasonStartYear(seasonLabel: string): number {
  const parts = seasonLabel.split("/");
  const raw = parts[0]?.trim() ?? "";
  const year = parseInt(raw, 10);
  return isNaN(year) ? 0 : year;
}

export function shortSeasonLabel(seasonLabel: string): string {
  // "2020/2021" → "20/21", "2020/21" → "20/21"
  const parts = seasonLabel.split("/");
  if (parts.length !== 2) return seasonLabel;
  const start = parts[0]?.trim().slice(-2) ?? "";
  const end = parts[1]?.trim().slice(-2) ?? "";
  return `${start}/${end}`;
}

// ---------------------------------------------------------------------------
// Duration label
// ---------------------------------------------------------------------------

export function computeDurationLabel(startYear: number, endYear: number): string {
  const span = endYear - startYear;
  const anni = span <= 1 ? "1 anno" : `${span} anni`;
  return `${startYear} – ${endYear} · ${anni}`;
}

// ---------------------------------------------------------------------------
// Team initials
// ---------------------------------------------------------------------------

export function getTeamInitials(clubName: string): string {
  const words = clubName
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  if (words.length === 0) return "?";
  if (words.length === 1) return (words[0]?.charAt(0) ?? "?").toUpperCase();
  return ((words[0]?.charAt(0) ?? "") + (words[1]?.charAt(0) ?? "")).toUpperCase();
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

export function groupExperiencesByTeam(entries: PlayerExperienceForm[]): CareerGroups {
  // Key: "clubId|clubName|type" where type is "senior"|"youth"
  const buckets = new Map<string, PlayerExperienceForm[]>();

  for (const entry of entries) {
    const clubKey = entry.clubId ?? entry.clubName;
    const type = isYouthCategory(entry.category) ? "youth" : "senior";
    const key = `${clubKey}||${type}`;

    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(entry);
    } else {
      buckets.set(key, [entry]);
    }
  }

  const senior: GroupedExperience[] = [];
  const youth: GroupedExperience[] = [];

  for (const [key, seasons] of buckets) {
    const type = key.endsWith("||youth") ? "youth" : "senior";

    // Sort seasons newest-first
    const sorted = [...seasons].sort(
      (a, b) => getSeasonStartYear(b.seasonLabel) - getSeasonStartYear(a.seasonLabel),
    );

    const startYears = sorted.map((s) => getSeasonStartYear(s.seasonLabel));
    const minYear = Math.min(...startYears);
    const maxYear = Math.max(...startYears);

    const first = sorted[0];
    const group: GroupedExperience = {
      clubId: first?.clubId ?? null,
      clubName: first?.clubName ?? "",
      teamLogoUrl: first?.teamLogoUrl ?? "",
      startYear: minYear,
      endYear: maxYear + 1, // a season "2024/2025" ends in year 2025
      durationLabel: computeDurationLabel(minYear, maxYear + 1),
      seasons: sorted,
    };

    if (type === "youth") {
      youth.push(group);
    } else {
      senior.push(group);
    }
  }

  // Sort each group by most recent season descending
  const byMostRecent = (a: GroupedExperience, b: GroupedExperience) =>
    b.endYear - a.endYear;

  senior.sort(byMostRecent);
  youth.sort(byMostRecent);

  return { senior, youth };
}
