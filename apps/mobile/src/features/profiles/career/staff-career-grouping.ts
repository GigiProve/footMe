import type {
  StaffCareerEntryRecord,
  StaffCoachCareerEntryRecord,
  StaffPlayerCareerEntryRecord,
} from "../profile-service";
import type { PlayerExperienceForm } from "../player-sports";
import type { CoachSeasonItem } from "./coach-career-grouping";
import {
  formatCoachDurationLabel,
} from "./coach-career-grouping";

export type StaffSeasonItem = CoachSeasonItem;

export type StaffGroupedExperience = {
  entryId: string;
  teamName: string;
  teamLogoUrl: string | null;
  roleLabel: string;
  durationLabel: string;
  seasons: StaffSeasonItem[];
  headCoachName: string | null;
};

function getSeasonStartYear(seasonLabel: string): number {
  const year = Number.parseInt(seasonLabel.split("/")[0] ?? "", 10);
  return Number.isNaN(year) ? 0 : year;
}

type ResultBadge = {
  label: string;
  variant: "success" | "accent" | "warning" | "default";
};

function normalizeResultBadge(input: unknown): ResultBadge | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const value = input as { label?: unknown; variant?: unknown };
  if (typeof value.label !== "string" || !value.label.trim()) {
    return null;
  }

  return {
    label: value.label.trim(),
    variant:
      value.variant === "success" ||
      value.variant === "accent" ||
      value.variant === "warning"
        ? value.variant
        : "default",
  };
}

function groupEntries(
  entries: StaffCareerEntryRecord[],
): StaffGroupedExperience[] {
  return [...entries]
    .sort((left, right) => {
      if (left.sort_order !== right.sort_order) {
        return left.sort_order - right.sort_order;
      }

      const leftYear = Math.max(
        ...left.seasons.map(getSeasonStartYear),
        left.period_end_year ?? 0,
      );
      const rightYear = Math.max(
        ...right.seasons.map(getSeasonStartYear),
        right.period_end_year ?? 0,
      );
      return rightYear - leftYear;
    })
    .map((entry) => {
      const seasonSource =
        entry.seasons.length > 0
          ? entry.seasons
          : entry.period_start_year && entry.period_end_year
            ? [`${entry.period_start_year}/${entry.period_end_year}`]
            : [];

      const seasonItems = [...seasonSource]
        .sort(
          (left, right) =>
            getSeasonStartYear(right) - getSeasonStartYear(left),
        )
        .map((seasonLabel) => {
          const seasonDetail = entry.season_details?.[seasonLabel];
          const assignments = [
            {
              category:
                seasonDetail?.category?.trim() || entry.category || "",
              role: seasonDetail?.role?.trim() || entry.role,
            },
          ];
          const results = (entry.results ?? [])
            .filter((result) => {
              if (!result || typeof result !== "object") {
                return false;
              }

              const seasonValue = (result as { seasonLabel?: unknown })
                .seasonLabel;
              return (
                typeof seasonValue !== "string" || seasonValue === seasonLabel
              );
            })
            .map(normalizeResultBadge)
            .filter((result): result is ResultBadge => Boolean(result));

          return {
            seasonLabel,
            assignments,
            description: entry.description ?? undefined,
            results,
          } satisfies StaffSeasonItem;
        });

      return {
        durationLabel: formatCoachDurationLabel(entry),
        entryId: entry.id,
        headCoachName: entry.head_coach_name,
        roleLabel: entry.role,
        seasons: seasonItems,
        teamLogoUrl: entry.team_logo_url,
        teamName: entry.team_name,
      } satisfies StaffGroupedExperience;
    });
}

export function groupStaffCareerEntries(
  entries: StaffCareerEntryRecord[],
): StaffGroupedExperience[] {
  return groupEntries(entries);
}

export function groupStaffCoachCareerEntries(
  entries: StaffCoachCareerEntryRecord[],
): StaffGroupedExperience[] {
  return groupEntries(entries);
}

export function mapStaffPlayerEntriesToPlayerExperiences(
  entries: StaffPlayerCareerEntryRecord[],
): PlayerExperienceForm[] {
  return entries.map((entry) => ({
    id: entry.id,
    appearances: entry.appearances > 0 ? String(entry.appearances) : "",
    assists: entry.assists > 0 ? String(entry.assists) : "",
    awards: "",
    category: entry.category ?? "",
    clubId: null,
    clubName: entry.team_name,
    goals: entry.goals > 0 ? String(entry.goals) : "",
    minutesPlayed: "",
    periodEndMonth: "",
    periodStartMonth: "",
    seasonLabel: entry.season,
    seasonPeriod: "full",
    teamCity: "",
    teamLogoUrl: entry.team_logo_url ?? "",
  }));
}
