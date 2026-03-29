import {
  SENIOR_CATEGORY_OPTIONS,
  YOUTH_CATEGORY_OPTIONS,
  MONTH_OPTIONS,
  type PlayerExperienceForm,
  type SportsSelectOption,
} from "../../profiles/player-sports";
import type {
  CareerExperience,
  CareerExperiencePeriod,
  CareerExperienceType,
  DurationType,
  SeasonStats,
} from "./career-types";

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

let idCounter = 0;

export function generateExperienceId(): string {
  idCounter += 1;
  return `career-${Date.now()}-${idCounter}`;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createEmptyExperience(
  type: CareerExperienceType,
): CareerExperience {
  return {
    id: generateExperienceId(),
    type,
    teamName: "",
    category: "",
    durationType: "SEASON",
    seasons: [],
    period: null,
    statsEnabled: false,
    stats: {},
  };
}

export function createEmptyStats(): SeasonStats {
  return { appearances: "", goals: "", assists: "" };
}

// ---------------------------------------------------------------------------
// Season options
// ---------------------------------------------------------------------------

const CURRENT_YEAR = new Date().getFullYear();
const CHIP_FIRST_YEAR = 2010;
const OLDEST_YEAR = 1970;

/** Seasons shown as chips in the main grid. */
export function getSeasonOptions(): string[] {
  const seasons: string[] = [];

  for (let year = CURRENT_YEAR; year >= CHIP_FIRST_YEAR; year--) {
    seasons.push(`${year}/${year + 1}`);
  }

  return seasons;
}

/** Older seasons available via the "Aggiungi stagione precedente" picker. */
export function getOlderSeasonOptions(): { label: string; value: string }[] {
  const options: { label: string; value: string }[] = [];

  for (let year = CHIP_FIRST_YEAR - 1; year >= OLDEST_YEAR; year--) {
    const season = `${year}/${year + 1}`;
    options.push({ label: formatSeasonShort(season), value: season });
  }

  return options;
}

/**
 * Short display format: "2024/25" instead of "2024/2025".
 */
export function formatSeasonShort(season: string): string {
  const parts = season.split("/");

  if (parts.length !== 2) return season;

  const endYear = parts[1];

  return `${parts[0]}/${endYear.length === 4 ? endYear.slice(2) : endYear}`;
}

// ---------------------------------------------------------------------------
// Category options by type
// ---------------------------------------------------------------------------

const seniorValues = new Set(SENIOR_CATEGORY_OPTIONS.map((o) => o.value));

export function getCategoryOptions(
  type: CareerExperienceType,
): SportsSelectOption[] {
  return type === "FIRST_TEAM"
    ? SENIOR_CATEGORY_OPTIONS
    : YOUTH_CATEGORY_OPTIONS;
}

export function inferExperienceType(category: string): CareerExperienceType {
  return seniorValues.has(category) ? "FIRST_TEAM" : "YOUTH";
}

export { MONTH_OPTIONS };

// ---------------------------------------------------------------------------
// Year options for period pickers
// ---------------------------------------------------------------------------

export function getYearOptions(): SportsSelectOption[] {
  return Array.from({ length: CURRENT_YEAR - 2004 }, (_, i) => {
    const year = CURRENT_YEAR + 1 - i;
    return { label: String(year), value: String(year) };
  });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type CareerExperienceErrors = {
  teamName?: string;
  category?: string;
  duration?: string;
};

export function validateExperience(
  exp: CareerExperience,
): CareerExperienceErrors {
  const errors: CareerExperienceErrors = {};

  if (!exp.teamName.trim()) {
    errors.teamName = "Il nome della squadra è obbligatorio.";
  }

  if (!exp.category) {
    errors.category = "Seleziona una categoria.";
  }

  if (exp.durationType === "SEASON") {
    if (exp.seasons.length === 0) {
      errors.duration = "Seleziona almeno una stagione.";
    }
  } else {
    if (!exp.period?.startYear) {
      errors.duration = "L'anno di inizio è obbligatorio.";
    } else if (!exp.period?.endYear) {
      errors.duration = "L'anno di fine è obbligatorio.";
    } else {
      const startY = parseInt(exp.period.startYear, 10);
      const endY = parseInt(exp.period.endYear, 10);
      const startM = exp.period.startMonth
        ? parseInt(exp.period.startMonth, 10)
        : 0;
      const endM = exp.period.endMonth ? parseInt(exp.period.endMonth, 10) : 13;

      if (endY < startY || (endY === startY && endM < startM)) {
        errors.duration =
          "La data di fine deve essere successiva alla data di inizio.";
      }
    }
  }

  return errors;
}

export function isExperienceValid(exp: CareerExperience): boolean {
  return Object.keys(validateExperience(exp)).length === 0;
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

const monthShortLabels: Record<string, string> = {
  "1": "Gen",
  "2": "Feb",
  "3": "Mar",
  "4": "Apr",
  "5": "Mag",
  "6": "Giu",
  "7": "Lug",
  "8": "Ago",
  "9": "Set",
  "10": "Ott",
  "11": "Nov",
  "12": "Dic",
};

export function formatExperienceDuration(exp: CareerExperience): string {
  if (exp.durationType === "SEASON") {
    return exp.seasons.map(formatSeasonShort).join(", ");
  }

  if (exp.period) {
    const parts: string[] = [];

    if (exp.period.startMonth) {
      parts.push(
        `${monthShortLabels[exp.period.startMonth] ?? exp.period.startMonth} ${exp.period.startYear}`,
      );
    } else {
      parts.push(exp.period.startYear);
    }

    parts.push("→");

    if (exp.period.endMonth) {
      parts.push(
        `${monthShortLabels[exp.period.endMonth] ?? exp.period.endMonth} ${exp.period.endYear}`,
      );
    } else {
      parts.push(exp.period.endYear);
    }

    return parts.join(" ");
  }

  return "";
}

export function getStatsSummary(exp: CareerExperience): string | null {
  if (!exp.statsEnabled) return null;

  let totalApp = 0;
  let totalGoals = 0;
  let totalAssists = 0;

  for (const s of Object.values(exp.stats)) {
    totalApp += parseInt(s.appearances, 10) || 0;
    totalGoals += parseInt(s.goals, 10) || 0;
    totalAssists += parseInt(s.assists, 10) || 0;
  }

  if (totalApp === 0 && totalGoals === 0 && totalAssists === 0) return null;

  const parts: string[] = [];

  if (totalApp > 0) parts.push(`${totalApp} Pres.`);
  if (totalGoals > 0) parts.push(`${totalGoals} Gol`);
  if (totalAssists > 0) parts.push(`${totalAssists} Assist`);

  return parts.join(" · ");
}

export function getExperienceTypeLabel(type: CareerExperienceType): string {
  return type === "FIRST_TEAM" ? "Prima Squadra" : "Settore Giovanile";
}

// ---------------------------------------------------------------------------
// Conversion: CareerExperience[] → PlayerExperienceForm[]
// ---------------------------------------------------------------------------

function computeSeasonsFromPeriod(period: CareerExperiencePeriod): string[] {
  const startYear = parseInt(period.startYear, 10);
  const endYear = parseInt(period.endYear, 10);

  if (isNaN(startYear) || isNaN(endYear)) return [];

  const startMonth = period.startMonth ? parseInt(period.startMonth, 10) : null;
  const endMonth = period.endMonth ? parseInt(period.endMonth, 10) : null;

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

  for (let y = firstSeasonStart; y <= lastSeasonStart; y++) {
    seasons.push(`${y}/${y + 1}`);
  }

  return seasons;
}

export function experiencesToForms(
  experiences: CareerExperience[],
): PlayerExperienceForm[] {
  const forms: PlayerExperienceForm[] = [];

  for (const exp of experiences) {
    if (exp.durationType === "SEASON") {
      for (const season of exp.seasons) {
        const stats = exp.statsEnabled ? exp.stats[season] : undefined;

        forms.push({
          appearances: stats?.appearances || "0",
          assists: stats?.assists || "0",
          awards: "",
          category: exp.category,
          clubId: null,
          clubName: exp.teamName,
          goals: stats?.goals || "0",
          minutesPlayed: "0",
          periodEndMonth: "",
          periodStartMonth: "",
          seasonLabel: season,
          seasonPeriod: "full",
          teamCity: "",
          teamLogoUrl: "",
        });
      }
    } else if (exp.period) {
      const seasons = computeSeasonsFromPeriod(exp.period);
      const effectiveSeasons =
        seasons.length > 0
          ? seasons
          : [`${exp.period.startYear}/${Number(exp.period.startYear) + 1}`];

      for (let i = 0; i < effectiveSeasons.length; i++) {
        const season = effectiveSeasons[i];
        const stats = exp.statsEnabled
          ? exp.stats[season] || exp.stats["period"]
          : undefined;

        const isFirst = i === 0;
        const isLast = i === effectiveSeasons.length - 1;
        const isSingle = effectiveSeasons.length === 1;

        forms.push({
          appearances: stats?.appearances || "0",
          assists: stats?.assists || "0",
          awards: "",
          category: exp.category,
          clubId: null,
          clubName: exp.teamName,
          goals: stats?.goals || "0",
          minutesPlayed: "0",
          periodEndMonth: isLast && exp.period ? exp.period.endMonth || "" : "",
          periodStartMonth:
            isFirst && exp.period ? exp.period.startMonth || "" : "",
          seasonLabel: season,
          seasonPeriod: isSingle
            ? "partial"
            : isFirst || isLast
              ? "partial"
              : "full",
          teamCity: "",
          teamLogoUrl: "",
        });
      }
    }
  }

  return forms;
}

// ---------------------------------------------------------------------------
// Conversion: PlayerExperienceForm[] → CareerExperience[]
// ---------------------------------------------------------------------------

export function formsToExperiences(
  forms: PlayerExperienceForm[],
): CareerExperience[] {
  if (forms.length === 0) return [];

  // Group by clubName + category
  const groups = new Map<string, PlayerExperienceForm[]>();

  for (const form of forms) {
    const key = `${form.clubName}|||${form.category}`;
    const group = groups.get(key) || [];
    group.push(form);
    groups.set(key, group);
  }

  const experiences: CareerExperience[] = [];

  for (const [, group] of groups) {
    const first = group[0];
    const type = inferExperienceType(first.category);
    const hasPeriodInfo = group.some(
      (f) =>
        f.seasonPeriod === "partial" &&
        (f.periodStartMonth || f.periodEndMonth),
    );

    const seasons = group.map((f) => f.seasonLabel).filter(Boolean);

    const stats: Record<string, SeasonStats> = {};
    let hasAnyStats = false;

    for (const f of group) {
      const app = parseInt(f.appearances, 10) || 0;
      const g = parseInt(f.goals, 10) || 0;
      const a = parseInt(f.assists, 10) || 0;

      if (app > 0 || g > 0 || a > 0) hasAnyStats = true;

      stats[f.seasonLabel] = {
        appearances: f.appearances || "",
        goals: f.goals || "",
        assists: f.assists || "",
      };
    }

    let period: CareerExperiencePeriod | null = null;
    let durationType: DurationType = "SEASON";

    if (hasPeriodInfo) {
      durationType = "PERIOD";

      const withStart = group.find((f) => f.periodStartMonth) || group[0];
      const withEnd =
        group.find((f) => f.periodEndMonth) || group[group.length - 1];

      period = {
        startMonth: withStart.periodStartMonth || "",
        startYear: withStart.seasonLabel.split("/")[0] || "",
        endMonth: withEnd.periodEndMonth || "",
        endYear:
          withEnd.seasonLabel.split("/")[1] ||
          String(Number(withEnd.seasonLabel.split("/")[0]) + 1),
      };
    }

    experiences.push({
      id: generateExperienceId(),
      type,
      teamName: first.clubName,
      category: first.category,
      durationType,
      seasons,
      period,
      statsEnabled: hasAnyStats,
      stats,
    });
  }

  return experiences;
}
