import type { PlayerExperienceForm } from "../../profiles/player-sports";
import type { PlayerCareerEntry, PlayerSeasonDetail } from "./player-career-types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

let idCounter = 0;

export function generatePlayerEntryId(): string {
  idCounter += 1;
  return `player-${Date.now()}-${idCounter}`;
}

// ---------------------------------------------------------------------------
// Season/year option builders
// ---------------------------------------------------------------------------

/** Seasons from current year back to 2010 as chips. */
export function getPlayerSeasonOptions(): string[] {
  const seasons: string[] = [];
  for (let year = CURRENT_YEAR; year >= CHIP_FIRST_YEAR; year--) {
    seasons.push(`${year}/${year + 1}`);
  }
  return seasons;
}

/** Seasons before 2010 back to 2000 for older seasons picker. */
export function getOlderPlayerSeasonOptions(): { label: string; value: string }[] {
  const options: { label: string; value: string }[] = [];
  for (let year = CHIP_FIRST_YEAR - 1; year >= OLDEST_YEAR; year--) {
    const season = `${year}/${year + 1}`;
    options.push({ label: formatSeasonShort(season), value: season });
  }
  return options;
}

/** Last 31 years for period pickers. */
export function getPlayerYearOptions(): { label: string; value: string }[] {
  return Array.from({ length: 31 }, (_, i) => {
    const year = CURRENT_YEAR - i;
    return { label: String(year), value: String(year) };
  });
}

export function formatSeasonShort(season: string): string {
  const parts = season.split("/");
  if (parts.length !== 2) return season;
  const endYear = parts[1];
  return `${parts[0]}/${endYear.length === 4 ? endYear.slice(2) : endYear}`;
}

// ---------------------------------------------------------------------------
// Period → seasons computation
// ---------------------------------------------------------------------------

/**
 * Compute football seasons (e.g. "2023/2024") from a custom period.
 * Season Jul(Y) → Jun(Y+1) = "Y/(Y+1)".
 * Returns [] when start or end year is missing.
 */
export function computePlayerSeasonsFromPeriod(
  period: NonNullable<PlayerCareerEntry["period"]>,
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

// ---------------------------------------------------------------------------
// Effective seasons helper
// ---------------------------------------------------------------------------

/**
 * For MULTI_SEASON returns entry.seasons when length > 1.
 * For CUSTOM_PERIOD computes from period when length > 1.
 * Otherwise returns [].
 */
export function getEffectiveSeasons(entry: PlayerCareerEntry): string[] {
  if (entry.type === "MULTI_SEASON") {
    return entry.seasons.length > 1 ? entry.seasons : [];
  }
  if (entry.type === "CUSTOM_PERIOD" && entry.period) {
    const seasons = computePlayerSeasonsFromPeriod(entry.period);
    return seasons.length > 1 ? seasons : [];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Empty season detail factory
// ---------------------------------------------------------------------------

export function emptyPlayerSeasonDetail(): PlayerSeasonDetail {
  return {
    category: "",
    appearances: "",
    goals: "",
    assists: "",
    minutesPlayed: "",
    awards: "",
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type PlayerEntryErrors = {
  teamName?: string;
  category?: string;
  seasons?: string;
  startYear?: string;
  endYear?: string;
  seasonDetails?: string;
};

export function validatePlayerEntry(
  entry: PlayerCareerEntry,
  isMultiSeason: boolean,
): PlayerEntryErrors {
  const errors: PlayerEntryErrors = {};

  if (!entry.teamName.trim()) {
    errors.teamName = "La squadra è obbligatoria.";
  }

  if (!isMultiSeason && !entry.category.trim()) {
    errors.category = "Seleziona una categoria.";
  }

  if (entry.type === "MULTI_SEASON" && entry.seasons.length === 0) {
    errors.seasons = "Seleziona almeno una stagione.";
  }

  if (entry.type === "SINGLE_SEASON" && entry.seasons.length === 0) {
    errors.seasons = "Seleziona una stagione.";
  }

  if (entry.type === "CUSTOM_PERIOD") {
    if (!entry.period?.startYear) {
      errors.startYear = "L'anno di inizio è obbligatorio.";
    }
    if (!entry.period?.endYear) {
      errors.endYear = "L'anno di fine è obbligatorio.";
    }
  }

  if (isMultiSeason) {
    const effectiveSeasons = getEffectiveSeasons(entry);
    for (const season of effectiveSeasons) {
      const detail = entry.seasonDetails[season];
      if (!detail?.category) {
        errors.seasonDetails = `Seleziona una categoria per la stagione ${formatSeasonShort(season)}.`;
        break;
      }
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Split entry by season details
// ---------------------------------------------------------------------------

/**
 * If multiple effective seasons have different categories, split into separate
 * entries — one per unique category group.
 * Returns [entry] if nothing to split.
 */
export function splitPlayerEntryBySeasonDetails(
  entry: PlayerCareerEntry,
): PlayerCareerEntry[] {
  let seasons: string[];
  if (entry.type === "CUSTOM_PERIOD" && entry.period) {
    seasons = computePlayerSeasonsFromPeriod(entry.period);
  } else {
    seasons = entry.seasons;
  }

  const details = entry.seasonDetails ?? {};

  // Nothing to split: single season or no per-season details
  if (seasons.length <= 1 || Object.keys(details).length === 0) {
    return [entry];
  }

  // Group seasons by category
  const groups = new Map<string, { category: string; seasons: string[] }>();

  for (const season of seasons) {
    const detail = details[season] ?? { ...emptyPlayerSeasonDetail(), category: entry.category };
    const key = detail.category;

    if (!groups.has(key)) {
      groups.set(key, { category: detail.category, seasons: [] });
    }
    groups.get(key)!.seasons.push(season);
  }

  // All seasons share the same category — just normalise the entry
  if (groups.size === 1) {
    const [group] = groups.values();
    return [
      {
        ...entry,
        type: entry.type === "CUSTOM_PERIOD" ? "MULTI_SEASON" : entry.type,
        category: group.category,
        seasons: group.seasons,
        period: null,
        seasonDetails: {},
      },
    ];
  }

  // Multiple groups — emit one entry per group
  const result: PlayerCareerEntry[] = [];
  let isFirst = true;

  for (const group of groups.values()) {
    result.push({
      ...entry,
      id: isFirst ? entry.id : generatePlayerEntryId(),
      type: "MULTI_SEASON",
      category: group.category,
      seasons: group.seasons,
      period: null,
      seasonDetails: {},
    });
    isFirst = false;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Conversion: PlayerCareerEntry[] ↔ PlayerExperienceForm[]
// ---------------------------------------------------------------------------

export function playerEntriesToForms(
  entries: PlayerCareerEntry[],
): PlayerExperienceForm[] {
  const forms: PlayerExperienceForm[] = [];

  for (const entry of entries) {
    if (entry.type === "MULTI_SEASON" || entry.type === "SINGLE_SEASON") {
      for (const season of entry.seasons) {
        const detail = entry.seasonDetails[season];
        forms.push({
          appearances: detail?.appearances || "",
          assists: detail?.assists || "",
          awards: detail?.awards || "",
          category: detail?.category || entry.category,
          clubId: null,
          clubName: entry.teamName,
          goals: detail?.goals || "",
          minutesPlayed: detail?.minutesPlayed || "",
          periodEndMonth: "",
          periodStartMonth: "",
          seasonLabel: season,
          seasonPeriod: "full",
          teamCity: "",
          teamLogoUrl: "",
        });
      }
    } else if (entry.type === "CUSTOM_PERIOD" && entry.period) {
      const seasons = computePlayerSeasonsFromPeriod(entry.period);
      const effectiveSeasons =
        seasons.length > 0
          ? seasons
          : [`${entry.period.startYear}/${Number(entry.period.startYear) + 1}`];

      for (let i = 0; i < effectiveSeasons.length; i++) {
        const season = effectiveSeasons[i];
        const detail = entry.seasonDetails[season];
        const isFirst = i === 0;
        const isLast = i === effectiveSeasons.length - 1;
        const isSingle = effectiveSeasons.length === 1;

        const seasonPeriod: "full" | "partial" =
          isSingle || isFirst || isLast ? "partial" : "full";

        forms.push({
          appearances: detail?.appearances || "",
          assists: detail?.assists || "",
          awards: detail?.awards || "",
          category: detail?.category || entry.category,
          clubId: null,
          clubName: entry.teamName,
          goals: detail?.goals || "",
          minutesPlayed: detail?.minutesPlayed || "",
          periodEndMonth: isLast && entry.period ? entry.period.endMonth || "" : "",
          periodStartMonth: isFirst && entry.period ? entry.period.startMonth || "" : "",
          seasonLabel: season,
          seasonPeriod,
          teamCity: "",
          teamLogoUrl: "",
        });
      }
    }
  }

  return forms;
}

export function formsToPlayerEntries(
  forms: PlayerExperienceForm[],
): PlayerCareerEntry[] {
  if (forms.length === 0) return [];

  // Group by clubName
  const groups = new Map<string, PlayerExperienceForm[]>();

  for (const form of forms) {
    const key = form.clubName;
    const group = groups.get(key) ?? [];
    group.push(form);
    groups.set(key, group);
  }

  const entries: PlayerCareerEntry[] = [];

  for (const [, group] of groups) {
    const first = group[0];
    const hasPartial = group.some((f) => f.seasonPeriod === "partial");

    if (hasPartial) {
      // CUSTOM_PERIOD
      const withStart = group.find((f) => f.periodStartMonth) ?? group[0];
      const withEnd = group.find((f) => f.periodEndMonth) ?? group[group.length - 1];

      const seasonDetails: Record<string, PlayerSeasonDetail> = {};
      for (const f of group) {
        if (f.seasonLabel) {
          seasonDetails[f.seasonLabel] = {
            category: f.category,
            appearances: f.appearances,
            goals: f.goals,
            assists: f.assists,
            minutesPlayed: f.minutesPlayed,
            awards: f.awards,
          };
        }
      }

      entries.push({
        id: generatePlayerEntryId(),
        teamName: first.clubName,
        category: first.category,
        type: "CUSTOM_PERIOD",
        seasons: [],
        period: {
          startMonth: withStart.periodStartMonth || "",
          startYear: withStart.seasonLabel.split("/")[0] || "",
          endMonth: withEnd.periodEndMonth || "",
          endYear:
            withEnd.seasonLabel.split("/")[1] ||
            String(Number(withEnd.seasonLabel.split("/")[0]) + 1),
        },
        seasonDetails,
      });
    } else {
      const seasons = group.map((f) => f.seasonLabel).filter(Boolean);
      const type: PlayerCareerEntry["type"] =
        seasons.length === 1 ? "SINGLE_SEASON" : "MULTI_SEASON";

      const seasonDetails: Record<string, PlayerSeasonDetail> = {};
      for (const f of group) {
        if (f.seasonLabel) {
          seasonDetails[f.seasonLabel] = {
            category: f.category,
            appearances: f.appearances,
            goals: f.goals,
            assists: f.assists,
            minutesPlayed: f.minutesPlayed,
            awards: f.awards,
          };
        }
      }

      entries.push({
        id: generatePlayerEntryId(),
        teamName: first.clubName,
        category: first.category,
        type,
        seasons,
        period: null,
        seasonDetails,
      });
    }
  }

  return entries;
}
