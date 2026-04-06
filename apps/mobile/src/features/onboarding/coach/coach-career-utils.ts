import type { SelectOption } from "../../profiles/profile-form-utils";
import type { CoachCareerEntry, SimplePlayerCareerEntry } from "./coach-career-types";

const CURRENT_YEAR = new Date().getFullYear();
const CHIP_FIRST_YEAR = 2010;
const OLDEST_YEAR = 2000;

export const MONTH_OPTIONS: { label: string; value: string }[] = [
  { label: "Gennaio", value: "Gennaio" },
  { label: "Febbraio", value: "Febbraio" },
  { label: "Marzo", value: "Marzo" },
  { label: "Aprile", value: "Aprile" },
  { label: "Maggio", value: "Maggio" },
  { label: "Giugno", value: "Giugno" },
  { label: "Luglio", value: "Luglio" },
  { label: "Agosto", value: "Agosto" },
  { label: "Settembre", value: "Settembre" },
  { label: "Ottobre", value: "Ottobre" },
  { label: "Novembre", value: "Novembre" },
  { label: "Dicembre", value: "Dicembre" },
];

/** Seasons from current year back to 2010 as chips. */
export function getCoachSeasonOptions(): string[] {
  const seasons: string[] = [];
  for (let year = CURRENT_YEAR; year >= CHIP_FIRST_YEAR; year--) {
    seasons.push(`${year}/${year + 1}`);
  }
  return seasons;
}

/** Seasons before 2010 back to 2000 for older seasons picker. */
export function getOlderCoachSeasonOptions(): { label: string; value: string }[] {
  const options: { label: string; value: string }[] = [];
  for (let year = CHIP_FIRST_YEAR - 1; year >= OLDEST_YEAR; year--) {
    const season = `${year}/${year + 1}`;
    options.push({ label: formatSeasonShort(season), value: season });
  }
  return options;
}

/** Last 20 seasons for player career dropdown. */
export function getPlayerSeasonOptions(): { label: string; value: string }[] {
  return Array.from({ length: 20 }, (_, i) => {
    const year = CURRENT_YEAR - i;
    const season = `${year}/${year + 1}`;
    const label = `${year}/${String(year + 1).slice(2)}`;
    return { label, value: season };
  });
}

/** Last 30 years + current for period pickers. */
export function getCoachYearOptions(): { label: string; value: string }[] {
  return Array.from({ length: 31 }, (_, i) => {
    const year = CURRENT_YEAR - i;
    return { label: String(year), value: String(year) };
  });
}

export function getEntrySeasonLabels(entry: CoachCareerEntry): string[] {
  if (entry.type === "CUSTOM_PERIOD" && entry.period) {
    return computeCoachSeasonsFromPeriod(entry.period);
  }

  return entry.seasons;
}

function getSeasonStartYear(season: string): number {
  const startYear = Number.parseInt(season.split("/")[0] ?? "", 10);
  return Number.isNaN(startYear) ? 0 : startYear;
}

function getEntrySortYears(entry: CoachCareerEntry): {
  latestSeasonStartYear: number;
  earliestSeasonStartYear: number;
} {
  const seasonStartYears = getEntrySeasonLabels(entry)
    .map(getSeasonStartYear)
    .filter((year) => year > 0);

  if (seasonStartYears.length > 0) {
    return {
      latestSeasonStartYear: Math.max(...seasonStartYears),
      earliestSeasonStartYear: Math.min(...seasonStartYears),
    };
  }

  if (entry.period) {
    const startYear = Number.parseInt(entry.period.startYear, 10);
    const endYear = Number.parseInt(entry.period.endYear, 10);

    return {
      latestSeasonStartYear: Number.isNaN(endYear) ? 0 : endYear,
      earliestSeasonStartYear: Number.isNaN(startYear) ? 0 : startYear,
    };
  }

  return {
    latestSeasonStartYear: 0,
    earliestSeasonStartYear: 0,
  };
}

export function sortCoachCareerEntriesBySeason<T extends CoachCareerEntry>(entries: T[]): T[] {
  return [...entries].sort((left, right) => {
    const leftYears = getEntrySortYears(left);
    const rightYears = getEntrySortYears(right);

    if (leftYears.latestSeasonStartYear !== rightYears.latestSeasonStartYear) {
      return rightYears.latestSeasonStartYear - leftYears.latestSeasonStartYear;
    }

    if (leftYears.earliestSeasonStartYear !== rightYears.earliestSeasonStartYear) {
      return rightYears.earliestSeasonStartYear - leftYears.earliestSeasonStartYear;
    }

    return left.teamName.localeCompare(right.teamName, "it", { sensitivity: "base" });
  });
}

export function getOccupiedCoachSeasonLabels(
  entries: CoachCareerEntry[],
  currentEntryId?: string,
): Set<string> {
  const occupied = new Set<string>();

  for (const entry of entries) {
    if (currentEntryId && entry.id === currentEntryId) {
      continue;
    }

    for (const season of getEntrySeasonLabels(entry)) {
      if (season.trim()) {
        occupied.add(season);
      }
    }
  }

  return occupied;
}

export function getCoachSeasonSelectOptions(
  occupiedSeasons: Set<string>,
): SelectOption[] {
  return getCoachSeasonOptions().map((season) => ({
    label: formatSeasonShort(season),
    value: season,
    disabled: occupiedSeasons.has(season),
  }));
}

export function getOlderCoachSeasonSelectOptions(
  occupiedSeasons: Set<string>,
): SelectOption[] {
  return getOlderCoachSeasonOptions().map((option) => ({
    ...option,
    disabled: occupiedSeasons.has(option.value),
  }));
}

function computeSeasonsFromYearRange(
  startYear: number,
  startMonth: number | null,
  endYear: number,
  endMonth: number | null,
): string[] {
  const firstSeasonStart =
    startMonth !== null && startMonth >= 1 && startMonth <= 6
      ? startYear - 1
      : startYear;

  let lastSeasonStart =
    endMonth !== null && endMonth >= 7 ? endYear : endYear - 1;

  if (lastSeasonStart < firstSeasonStart) {
    lastSeasonStart = firstSeasonStart;
  }

  const seasons: string[] = [];
  for (let year = firstSeasonStart; year <= lastSeasonStart; year += 1) {
    seasons.push(`${year}/${year + 1}`);
  }

  return seasons;
}

export function getCoachEndYearOptions(
  startYear: string,
  startMonth: string,
  occupiedSeasons: Set<string>,
): SelectOption[] {
  const yearOptions = getCoachYearOptions();
  if (!startYear) {
    return yearOptions;
  }

  const parsedStartYear = Number.parseInt(startYear, 10);
  if (Number.isNaN(parsedStartYear)) {
    return yearOptions;
  }

  const parsedStartMonth = startMonth
    ? (MONTH_LABEL_TO_NUM[startMonth] ?? null)
    : null;

  return yearOptions.map((option) => {
    const parsedEndYear = Number.parseInt(option.value, 10);
    if (parsedEndYear < parsedStartYear) {
      return { ...option, disabled: true };
    }

    const seasons = computeSeasonsFromYearRange(
      parsedStartYear,
      parsedStartMonth,
      parsedEndYear,
      null,
    );

    return seasons.some((season) => occupiedSeasons.has(season))
      ? { ...option, disabled: true }
      : option;
  });
}

export function getCoachStartYearOptions(
  endYear: string,
  endMonth: string,
  occupiedSeasons: Set<string>,
): SelectOption[] {
  const yearOptions = getCoachYearOptions();
  if (!endYear) {
    return yearOptions;
  }

  const parsedEndYear = Number.parseInt(endYear, 10);
  if (Number.isNaN(parsedEndYear)) {
    return yearOptions;
  }

  const parsedEndMonth = endMonth ? (MONTH_LABEL_TO_NUM[endMonth] ?? null) : null;

  return yearOptions.map((option) => {
    const parsedStartYear = Number.parseInt(option.value, 10);
    if (parsedStartYear > parsedEndYear) {
      return { ...option, disabled: true };
    }

    const seasons = computeSeasonsFromYearRange(
      parsedStartYear,
      null,
      parsedEndYear,
      parsedEndMonth,
    );

    return seasons.some((season) => occupiedSeasons.has(season))
      ? { ...option, disabled: true }
      : option;
  });
}

export function sanitizeCoachPeriodSelection(
  period: NonNullable<CoachCareerEntry["period"]>,
  occupiedSeasons: Set<string>,
): NonNullable<CoachCareerEntry["period"]> {
  let nextPeriod = { ...period };

  if (nextPeriod.startYear && nextPeriod.endYear) {
    const endYearOptions = getCoachEndYearOptions(
      nextPeriod.startYear,
      nextPeriod.startMonth,
      occupiedSeasons,
    );
    const selectedEndYear = endYearOptions.find(
      (option) => option.value === nextPeriod.endYear,
    );

    if (selectedEndYear?.disabled) {
      nextPeriod = {
        ...nextPeriod,
        endMonth: "",
        endYear: "",
      };
    }
  }

  if (nextPeriod.startYear && nextPeriod.endYear) {
    const startYearOptions = getCoachStartYearOptions(
      nextPeriod.endYear,
      nextPeriod.endMonth,
      occupiedSeasons,
    );
    const selectedStartYear = startYearOptions.find(
      (option) => option.value === nextPeriod.startYear,
    );

    if (selectedStartYear?.disabled) {
      nextPeriod = {
        ...nextPeriod,
        startMonth: "",
        startYear: "",
      };
    }
  }

  return nextPeriod;
}

export function getSimplePlayerSeasonSelectOptions(
  entries: SimplePlayerCareerEntry[],
  currentEntryId?: string,
): SelectOption[] {
  const occupied = new Set(
    entries
      .filter((entry) => entry.id !== currentEntryId)
      .map((entry) => entry.season)
      .filter((season) => season.trim() !== ""),
  );

  return getPlayerSeasonOptions().map((option) => ({
    ...option,
    disabled: occupied.has(option.value),
  }));
}

export function formatSeasonShort(season: string): string {
  const parts = season.split("/");
  if (parts.length !== 2) return season;
  const endYear = parts[1];
  return `${parts[0]}/${endYear.length === 4 ? endYear.slice(2) : endYear}`;
}

let idCounter = 0;

export function generateCoachEntryId(): string {
  idCounter += 1;
  return `coach-${Date.now()}-${idCounter}`;
}

export const COACH_ROLE_OPTIONS: { label: string; value: string }[] = [
  { label: "Allenatore", value: "Allenatore" },
  { label: "Vice allenatore", value: "Vice allenatore" },
  { label: "Collaboratore tecnico", value: "Collaboratore tecnico" },
  { label: "Allenatore portieri", value: "Allenatore portieri" },
  { label: "Preparatore atletico", value: "Preparatore atletico" },
];

export const MONTH_LABEL_TO_NUM: Record<string, number> = {
  Gennaio: 1,
  Febbraio: 2,
  Marzo: 3,
  Aprile: 4,
  Maggio: 5,
  Giugno: 6,
  Luglio: 7,
  Agosto: 8,
  Settembre: 9,
  Ottobre: 10,
  Novembre: 11,
  Dicembre: 12,
};

/**
 * Compute football seasons (e.g. "2023/2024") from a custom period.
 * Season Jul(Y) → Jun(Y+1) = "Y/(Y+1)".
 * Returns [] when start or end year is missing.
 */
export function computeCoachSeasonsFromPeriod(
  period: NonNullable<CoachCareerEntry["period"]>,
): string[] {
  const startYear = parseInt(period.startYear, 10);
  const endYear = parseInt(period.endYear, 10);

  if (isNaN(startYear) || isNaN(endYear)) return [];

  const startMonthNum = period.startMonth
    ? (MONTH_LABEL_TO_NUM[period.startMonth] ?? null)
    : null;
  const endMonthNum = period.endMonth
    ? (MONTH_LABEL_TO_NUM[period.endMonth] ?? null)
    : null;

  const firstSeasonStart =
    startMonthNum !== null && startMonthNum <= 6 ? startYear - 1 : startYear;

  let lastSeasonStart =
    endMonthNum !== null && endMonthNum >= 7 ? endYear : endYear - 1;

  if (lastSeasonStart < firstSeasonStart) {
    lastSeasonStart = firstSeasonStart;
  }

  const seasons: string[] = [];
  for (let y = firstSeasonStart; y <= lastSeasonStart; y++) {
    seasons.push(`${y}/${y + 1}`);
  }

  return seasons;
}

/**
 * Split a CoachCareerEntry whose seasonDetails has multiple role/category combos
 * into separate entries — one per unique (role, category) group.
 *
 * If all seasons share the same role+category (or there are no season details),
 * returns a single normalised entry with seasonDetails cleared.
 */
export function splitCoachEntryBySeasonDetails(
  entry: CoachCareerEntry,
): CoachCareerEntry[] {
  // Resolve the effective list of seasons
  let seasons: string[];
  if (entry.type === "CUSTOM_PERIOD" && entry.period) {
    seasons = computeCoachSeasonsFromPeriod(entry.period);
  } else {
    seasons = entry.seasons;
  }

  const details = entry.seasonDetails ?? {};

  // Nothing to split: single season or no per-season details
  if (seasons.length <= 1 || Object.keys(details).length === 0) {
    return [entry];
  }

  // Group seasons by (category, role)
  const groups = new Map<
    string,
    { category: string; role: string; seasons: string[] }
  >();

  for (const season of seasons) {
    const detail = details[season] ?? { category: entry.category, role: entry.role };
    const key = `${detail.category}|||${detail.role}`;

    if (!groups.has(key)) {
      groups.set(key, { category: detail.category, role: detail.role, seasons: [] });
    }
    groups.get(key)!.seasons.push(season);
  }

  // All seasons share the same role+category — just normalise the entry
  if (groups.size === 1) {
    const [group] = groups.values();
    return [
      {
        ...entry,
        type: entry.type === "CUSTOM_PERIOD" ? "MULTI_SEASON" : entry.type,
        category: group.category,
        role: group.role,
        seasons: group.seasons,
        period: null,
        seasonDetails: {},
      },
    ];
  }

  // Multiple groups — emit one entry per group
  const result: CoachCareerEntry[] = [];
  let isFirst = true;

  for (const group of groups.values()) {
    result.push({
      ...entry,
      id: isFirst ? entry.id : generateCoachEntryId(),
      type: "MULTI_SEASON",
      category: group.category,
      role: group.role,
      seasons: group.seasons,
      period: null,
      seasonDetails: {},
    });
    isFirst = false;
  }

  return result;
}

export const PLAYER_POSITION_OPTIONS: { label: string; value: string }[] = [
  { label: "Portiere", value: "Portiere" },
  { label: "Difensore centrale", value: "Difensore centrale" },
  { label: "Terzino destro", value: "Terzino destro" },
  { label: "Terzino sinistro", value: "Terzino sinistro" },
  { label: "Mediano", value: "Mediano" },
  { label: "Mezzala", value: "Mezzala" },
  { label: "Trequartista", value: "Trequartista" },
  { label: "Ala destra", value: "Ala destra" },
  { label: "Ala sinistra", value: "Ala sinistra" },
  { label: "Centravanti", value: "Centravanti" },
  { label: "Attaccante esterno", value: "Attaccante esterno" },
];
