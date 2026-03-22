import type { PlayerExperienceForm, SeasonPeriod } from "./player-sports";
import type { SelectOption } from "./profile-form-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SeasonDetail = {
  seasonLabel: string;
  category: string;
  appearances: string;
  goals: string;
  assists: string;
  minutesPlayed: string;
  awards: string;
};

export type ExperienceBlockData = {
  localId: string;
  teamId: string | null;
  teamName: string;
  teamCity: string;
  teamLogoUrl: string;
  startYear: string;
  startMonth: string;
  endYear: string;
  endMonth: string;
  isOngoing: boolean;
  isTeamLocked: boolean;
  seasonDetails: SeasonDetail[];
};

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

let localIdCounter = 0;

function generateLocalId(): string {
  localIdCounter += 1;
  return `block-${Date.now()}-${localIdCounter}`;
}

export function createEmptySeasonDetail(seasonLabel: string): SeasonDetail {
  return {
    seasonLabel,
    category: "",
    appearances: "",
    goals: "",
    assists: "",
    minutesPlayed: "",
    awards: "",
  };
}

export function createEmptyBlock(): ExperienceBlockData {
  return {
    localId: generateLocalId(),
    teamId: null,
    teamName: "",
    teamCity: "",
    teamLogoUrl: "",
    startYear: "",
    startMonth: "",
    endYear: "",
    endMonth: "",
    isOngoing: false,
    isTeamLocked: false,
    seasonDetails: [],
  };
}

export function createBlockFromTeam(
  source: ExperienceBlockData,
): ExperienceBlockData {
  return {
    ...createEmptyBlock(),
    teamId: source.teamId,
    teamName: source.teamName,
    teamCity: source.teamCity,
    teamLogoUrl: source.teamLogoUrl,
    isTeamLocked: true,
  };
}

// ---------------------------------------------------------------------------
// Year / month options for pickers
// ---------------------------------------------------------------------------

const CURRENT_YEAR = new Date().getFullYear();

export const YEAR_OPTIONS = Array.from(
  { length: CURRENT_YEAR - 2004 },
  (_, i) => {
    const year = CURRENT_YEAR + 1 - i;
    return { label: String(year), value: String(year) };
  },
);

// ---------------------------------------------------------------------------
// Season calculation from date range
// ---------------------------------------------------------------------------

/**
 * Computes football season labels from a date range.
 *
 * A football season "Y/(Y+1)" runs roughly Jul Y to Jun (Y+1).
 *
 * Examples (years only):
 *   2021 → 2022  =  ["2021/2022"]
 *   2020 → 2023  =  ["2020/2021", "2021/2022", "2022/2023"]
 *
 * With months:
 *   Jan 2022 → Jun 2022  =  ["2021/2022"]  (Jan–Jun = second half)
 *   Aug 2020 → May 2023  =  ["2020/2021", "2021/2022", "2022/2023"]
 */
export function computeSeasonsFromDates(
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
  for (let y = firstSeasonStart; y <= lastSeasonStart; y++) {
    seasons.push(`${y}/${y + 1}`);
  }
  return seasons;
}

export function getComputedSeasons(block: ExperienceBlockData): string[] {
  const startYear = parseInt(block.startYear, 10);
  const endYear = block.isOngoing
    ? CURRENT_YEAR
    : parseInt(block.endYear, 10);

  if (isNaN(startYear) || isNaN(endYear)) return [];
  if (endYear < startYear) return [];

  const startMonth = block.startMonth ? parseInt(block.startMonth, 10) : null;
  const endMonth = block.endMonth ? parseInt(block.endMonth, 10) : null;

  return computeSeasonsFromDates(startYear, startMonth, endYear, endMonth);
}

// ---------------------------------------------------------------------------
// Season details sync
// ---------------------------------------------------------------------------

/**
 * Keeps seasonDetails in sync with the computed season labels.
 * Preserves existing data for seasons that still exist, adds empty
 * details for new ones, and drops seasons that are no longer valid.
 */
export function syncSeasonDetails(
  currentDetails: SeasonDetail[],
  seasonLabels: string[],
): SeasonDetail[] {
  const existingByLabel = new Map(
    currentDetails.map((d) => [d.seasonLabel, d]),
  );

  const synced = seasonLabels.map(
    (label) => existingByLabel.get(label) ?? createEmptySeasonDetail(label),
  );

  // Avoid unnecessary state updates if nothing changed
  if (
    synced.length === currentDetails.length &&
    synced.every((d, i) => d === currentDetails[i])
  ) {
    return currentDetails;
  }

  return synced;
}

// ---------------------------------------------------------------------------
// Saved-experience season extraction
// ---------------------------------------------------------------------------

/**
 * Extracts the set of season labels from previously saved experiences.
 * These are always treated as "full" (non-partial) for conflict purposes
 * since partial detection requires block-level date info we don't have.
 */
export function getSavedSeasonLabels(
  savedExperiences: PlayerExperienceForm[],
): Set<string> {
  const set = new Set<string>();
  for (const exp of savedExperiences) {
    if (exp.seasonLabel.trim()) {
      set.add(exp.seasonLabel);
    }
  }
  return set;
}

// ---------------------------------------------------------------------------
// Season conflict detection
// ---------------------------------------------------------------------------

/**
 * A block produces "partial" season entries when it has both startMonth
 * and endMonth and covers exactly one season. Otherwise its seasons are full.
 */
function isBlockPartial(block: ExperienceBlockData): boolean {
  return (
    Boolean(block.startMonth) &&
    Boolean(block.endMonth) &&
    getComputedSeasons(block).length === 1
  );
}

type UsedSeasonEntry = {
  blockId: string;
  isPartial: boolean;
};

/**
 * Builds a map of season labels → usage info from all blocks except the
 * one identified by `excludeBlockId`, plus any previously saved seasons.
 */
export function getUsedSeasonsMap(
  blocks: ExperienceBlockData[],
  excludeBlockId: string,
  savedSeasons?: Set<string>,
): Map<string, UsedSeasonEntry> {
  const map = new Map<string, UsedSeasonEntry>();

  // Saved seasons are always treated as full (non-partial)
  if (savedSeasons) {
    for (const label of savedSeasons) {
      map.set(label, { blockId: "__saved__", isPartial: false });
    }
  }

  for (const block of blocks) {
    if (block.localId === excludeBlockId) continue;

    const partial = isBlockPartial(block);

    for (const detail of block.seasonDetails) {
      const label = detail.seasonLabel;
      const existing = map.get(label);

      // If there's already a full entry, keep it (it's the strictest)
      if (existing && !existing.isPartial) continue;

      map.set(label, { blockId: block.localId, isPartial: partial });
    }
  }

  return map;
}

/**
 * Returns the set of season labels in `block` that conflict with
 * already-used seasons.
 *
 * Rules:
 * - full + anything  → conflict
 * - partial + partial → allowed (different parts of the same season)
 */
export function getBlockConflicts(
  block: ExperienceBlockData,
  usedMap: Map<string, UsedSeasonEntry>,
): Set<string> {
  const conflicts = new Set<string>();
  const currentPartial = isBlockPartial(block);

  for (const detail of block.seasonDetails) {
    const existing = usedMap.get(detail.seasonLabel);
    if (!existing) continue;

    // Both partial → allowed
    if (existing.isPartial && currentPartial) continue;

    conflicts.add(detail.seasonLabel);
  }

  return conflicts;
}

/**
 * Returns a set of season labels that are fully occupied (not partial)
 * across all blocks except `excludeBlockId`, plus any saved seasons.
 */
export function getFullyUsedSeasons(
  blocks: ExperienceBlockData[],
  excludeBlockId: string,
  savedSeasons?: Set<string>,
): Set<string> {
  const set = new Set<string>();

  // Saved seasons are always full
  if (savedSeasons) {
    for (const label of savedSeasons) {
      set.add(label);
    }
  }

  for (const block of blocks) {
    if (block.localId === excludeBlockId) continue;
    if (isBlockPartial(block)) continue;

    for (const detail of block.seasonDetails) {
      set.add(detail.seasonLabel);
    }
  }

  return set;
}

/**
 * Returns YEAR_OPTIONS for the end-year picker with years disabled when
 * any season they would produce (given the current start year/month)
 * is already fully used by another block.
 */
export function computeEndYearOptions(
  startYear: string,
  startMonth: string,
  fullyUsedSeasons: Set<string>,
): SelectOption[] {
  if (!startYear || fullyUsedSeasons.size === 0) return YEAR_OPTIONS;

  const sYear = parseInt(startYear, 10);
  if (isNaN(sYear)) return YEAR_OPTIONS;

  const sMo = startMonth ? parseInt(startMonth, 10) : null;

  return YEAR_OPTIONS.map((opt) => {
    const eYear = parseInt(opt.value, 10);
    if (eYear < sYear) return opt;

    const seasons = computeSeasonsFromDates(sYear, sMo, eYear, null);
    if (seasons.length === 0) return opt;

    const hasConflict = seasons.some((s) => fullyUsedSeasons.has(s));
    return hasConflict ? { ...opt, disabled: true } : opt;
  });
}

/**
 * Returns YEAR_OPTIONS for the start-year picker with years disabled when
 * any season they would produce (given the current end year/month)
 * is already fully used by another block.
 */
export function computeStartYearOptions(
  endYear: string,
  endMonth: string,
  isOngoing: boolean,
  fullyUsedSeasons: Set<string>,
): SelectOption[] {
  if (fullyUsedSeasons.size === 0) return YEAR_OPTIONS;

  const eYear = isOngoing
    ? CURRENT_YEAR
    : endYear
      ? parseInt(endYear, 10)
      : NaN;

  return YEAR_OPTIONS.map((opt) => {
    const sYear = parseInt(opt.value, 10);

    // Can't compute seasons without a valid end year (unless ongoing)
    if (isNaN(eYear)) return opt;
    if (sYear > eYear) return opt;

    const eMo = endMonth ? parseInt(endMonth, 10) : null;
    const seasons = computeSeasonsFromDates(sYear, null, eYear, eMo);
    if (seasons.length === 0) return opt;

    const hasConflict = seasons.some((s) => fullyUsedSeasons.has(s));
    return hasConflict ? { ...opt, disabled: true } : opt;
  });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function isBlockValid(
  block: ExperienceBlockData,
  conflicts?: Set<string>,
): boolean {
  if (!block.teamName.trim()) return false;
  if (!block.startYear.trim()) return false;
  if (!block.isOngoing && !block.endYear.trim()) return false;
  if (block.seasonDetails.length === 0) return false;

  // Every season must have a category
  if (!block.seasonDetails.every((d) => d.category.trim() !== "")) return false;

  // No season conflicts
  if (conflicts && conflicts.size > 0) return false;

  return true;
}

export function areAllBlocksValid(
  blocks: ExperienceBlockData[],
  savedSeasons?: Set<string>,
): boolean {
  if (blocks.length === 0) return false;

  for (const block of blocks) {
    const usedMap = getUsedSeasonsMap(blocks, block.localId, savedSeasons);
    const conflicts = getBlockConflicts(block, usedMap);
    if (!isBlockValid(block, conflicts)) return false;
  }

  return true;
}

/**
 * Returns true when the block has enough data filled to show
 * the "add another experience" actions below it.
 */
export function isBlockComplete(
  block: ExperienceBlockData,
  conflicts?: Set<string>,
): boolean {
  return isBlockValid(block, conflicts);
}

// ---------------------------------------------------------------------------
// Conversion: blocks → PlayerExperienceForm[]
// ---------------------------------------------------------------------------

export function blocksToExperienceForms(
  blocks: ExperienceBlockData[],
): PlayerExperienceForm[] {
  const forms: PlayerExperienceForm[] = [];

  for (const block of blocks) {
    const seasonLabels = getComputedSeasons(block);
    if (seasonLabels.length === 0) continue;

    for (let i = 0; i < block.seasonDetails.length; i++) {
      const detail = block.seasonDetails[i];
      const isSingle = seasonLabels.length === 1;

      // Period detection for partial seasons
      let seasonPeriod: SeasonPeriod = "full";
      let periodStartMonth = "";
      let periodEndMonth = "";

      if (isSingle && block.startMonth && block.endMonth) {
        seasonPeriod = "partial";
        periodStartMonth = block.startMonth;
        periodEndMonth = block.endMonth;
      } else if (i === 0 && block.startMonth) {
        const m = parseInt(block.startMonth, 10);
        if (m > 8 || (m >= 1 && m <= 6)) {
          seasonPeriod = "partial";
          periodStartMonth = block.startMonth;
          periodEndMonth = "6";
        }
      } else if (i === seasonLabels.length - 1 && block.endMonth && !isSingle) {
        const m = parseInt(block.endMonth, 10);
        if (m >= 1 && m < 6) {
          seasonPeriod = "partial";
          periodStartMonth = "7";
          periodEndMonth = block.endMonth;
        }
      }

      forms.push({
        appearances: detail.appearances || "0",
        assists: detail.assists || "0",
        awards: detail.awards,
        category: detail.category,
        clubId: block.teamId,
        clubName: block.teamName,
        goals: detail.goals || "0",
        minutesPlayed: detail.minutesPlayed || "0",
        periodEndMonth,
        periodStartMonth,
        seasonLabel: detail.seasonLabel,
        seasonPeriod,
        teamCity: block.teamCity,
        teamLogoUrl: block.teamLogoUrl,
      });
    }
  }

  return forms;
}
