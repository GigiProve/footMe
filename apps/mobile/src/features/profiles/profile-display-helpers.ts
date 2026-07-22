import { getPlayerPositionLabel } from "./player-sports";
import type {
  CoachCareerEntryRecord,
  CoachPlayerCareerEntryRecord,
  StaffPlayerCareerEntryRecord,
} from "./profile-service";

const roleLabels: Record<string, string> = {
  agent: "Procuratore",
  club_admin: "Societa'",
  coach: "Allenatore",
  director: "Dirigente",
  player: "Calciatore",
  staff: "Staff",
};

export function formatRole(value: string | null): string {
  if (!value) {
    return "Ruolo non definito";
  }

  return roleLabels[value] ?? value;
}

export function formatPosition(value: string | null): string {
  return getPlayerPositionLabel(value, "Posizione non definita");
}

export function formatLocation(
  city: string | null,
  region: string | null,
): string {
  return [city, region].filter(Boolean).join(" · ") || "Localita' non definita";
}

const CATEGORY_LEVEL_ORDER = [
  "Serie A", "Serie B", "Serie C", "Serie D",
  "Eccellenza", "Promozione", "Prima Categoria",
  "Seconda Categoria", "Terza Categoria",
  "Juniores", "Allievi", "Giovanissimi",
];

export type PlayerBackground = {
  primaryPosition: string | null;
  careerYears: number;
  topCategory: string | null;
  totalAppearances: number;
  totalGoals: number;
  totalAssists: number;
};

export function computePlayerBackground(
  entries: (CoachPlayerCareerEntryRecord | StaffPlayerCareerEntryRecord)[],
): PlayerBackground {
  if (!entries.length) {
    return { primaryPosition: null, careerYears: 0, topCategory: null, totalAppearances: 0, totalGoals: 0, totalAssists: 0 };
  }
  const posCount: Record<string, number> = {};
  entries.forEach((e) => {
    if (e.position) posCount[e.position] = (posCount[e.position] ?? 0) + 1;
  });
  const primaryPosition = Object.entries(posCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const seasons = new Set(entries.map((e) => e.season).filter(Boolean));
  const careerYears = seasons.size;
  let topCategory: string | null = null;
  let topIndex = Infinity;
  entries.forEach((e) => {
    if (!e.category) return;
    const idx = CATEGORY_LEVEL_ORDER.indexOf(e.category);
    if (idx !== -1 && idx < topIndex) {
      topIndex = idx;
      topCategory = e.category;
    } else if (idx === -1 && topCategory === null) {
      topCategory = e.category;
    }
  });
  const totalAppearances = entries.reduce((s, e) => s + (e.appearances ?? 0), 0);
  const totalGoals = entries.reduce((s, e) => s + (e.goals ?? 0), 0);
  const totalAssists = entries.reduce((s, e) => s + (e.assists ?? 0), 0);
  return { primaryPosition, careerYears, topCategory, totalAppearances, totalGoals, totalAssists };
}

// ────────────────────────────────
// Coach experience years (merged, non-overlapping intervals)
// ────────────────────────────────

type MonthInterval = [number, number];

function monthIndex(year: number, month: number): number {
  return year * 12 + (month - 1);
}

function parseMonthValue(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 12 ? parsed : null;
}

function parseSeasonStartYear(seasonLabel: string): number | null {
  const parsed = Number.parseInt(seasonLabel.split("/")[0] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildCoachExperienceIntervals(
  entry: CoachCareerEntryRecord,
  now: Date,
): MonthInterval[] {
  if (entry.period_start_year) {
    const startMonth = parseMonthValue(entry.period_start_month) ?? 1;
    const start = monthIndex(entry.period_start_year, startMonth);

    const end = entry.period_end_year
      ? monthIndex(entry.period_end_year, parseMonthValue(entry.period_end_month) ?? 12)
      : monthIndex(now.getFullYear(), now.getMonth() + 1);

    return end >= start ? [[start, end]] : [];
  }

  // One interval per season so non-consecutive seasons at the same club are
  // not bridged into a single span; a season conventionally runs July -> June.
  return (entry.seasons ?? [])
    .map(parseSeasonStartYear)
    .filter((year): year is number => year !== null)
    .map((year): MonthInterval => [monthIndex(year, 7), monthIndex(year + 1, 6)]);
}

function mergeMonthIntervals(intervals: MonthInterval[]): MonthInterval[] {
  const sorted = [...intervals].sort((left, right) => left[0] - right[0]);
  const merged: MonthInterval[] = [];

  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];

    if (last && start <= last[1] + 1) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }

  return merged;
}

/**
 * Computes total years of coaching experience from career entries, merging
 * overlapping or contiguous periods so time is never double-counted.
 * Entries with neither a reliable period nor parseable seasons are ignored.
 * Returns null when no reliable interval can be built or the total rounds to 0 years.
 */
export function computeCoachExperienceYears(
  entries: CoachCareerEntryRecord[],
  now: Date = new Date(),
): number | null {
  const intervals = entries.flatMap((entry) =>
    buildCoachExperienceIntervals(entry, now),
  );

  if (intervals.length === 0) {
    return null;
  }

  const mergedIntervals = mergeMonthIntervals(intervals);
  const totalMonths = mergedIntervals.reduce(
    (sum, [start, end]) => sum + (end - start + 1),
    0,
  );
  const years = Math.floor(totalMonths / 12);

  return years > 0 ? years : null;
}

export function formatCoachExperienceLabel(years: number): string {
  return years === 1 ? "1 anno di esperienza" : `${years} anni di esperienza`;
}
