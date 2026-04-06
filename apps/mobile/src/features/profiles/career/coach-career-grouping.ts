import type {
  CoachCareerEntryRecord,
  CoachDirectorCareerEntryRecord,
  CoachPlayerCareerEntryRecord,
} from "../profile-service";

export type CoachSeasonAssignment = {
  category: string;
  role: string;
};

export type CoachResultBadge = {
  label: string;
  variant: "success" | "accent" | "warning" | "default";
};

export type CoachSeasonItem = {
  seasonLabel: string;
  assignments: CoachSeasonAssignment[];
  results: CoachResultBadge[];
  description?: string;
};

export type CoachGroupedExperience = {
  entryId: string;
  teamName: string;
  teamLogoUrl: string;
  roleLabel: string;
  durationLabel: string;
  seasons: CoachSeasonItem[];
};

export type CoachGroupedPlayerExperience = {
  entryId: string;
  teamName: string;
  teamLogoUrl: string;
  seasonLabel: string;
  description: string;
};

export type CoachGroupedDirectorExperience = {
  entryId: string;
  teamName: string;
  teamLogoUrl: string;
  roleLabel: string;
  durationLabel: string;
  description?: string;
};

function getSeasonStartYear(seasonLabel: string): number {
  const year = Number.parseInt(seasonLabel.split("/")[0] ?? "", 10);
  return Number.isNaN(year) ? 0 : year;
}

export function shortSeasonLabel(seasonLabel: string): string {
  const parts = seasonLabel.split("/");
  if (parts.length !== 2) {
    return seasonLabel;
  }

  return `${parts[0]}/${parts[1]?.slice(-2) ?? ""}`;
}

function monthYearLabel(month: string | null, year: number | null) {
  if (!year) {
    return "";
  }

  return month ? `${month} ${year}` : String(year);
}

export function formatCoachDurationLabel(
  entry:
    | CoachCareerEntryRecord
    | CoachDirectorCareerEntryRecord
    | { seasons: string[]; period_start_month?: string | null; period_start_year?: number | null; period_end_month?: string | null; period_end_year?: number | null },
) {
  if (
    "period_start_year" in entry &&
    entry.period_start_year &&
    entry.period_end_year
  ) {
    const start = monthYearLabel(entry.period_start_month ?? null, entry.period_start_year);
    const end = monthYearLabel(entry.period_end_month ?? null, entry.period_end_year);
    return `${start} - ${end}`;
  }

  const seasons = [...(entry.seasons ?? [])].sort(
    (left, right) => getSeasonStartYear(right) - getSeasonStartYear(left),
  );

  if (seasons.length === 0) {
    return "Periodo da definire";
  }

  if (seasons.length === 1) {
    return shortSeasonLabel(seasons[0]);
  }

  const oldest = seasons[seasons.length - 1];
  const newest = seasons[0];
  return `${shortSeasonLabel(oldest)} - ${shortSeasonLabel(newest)}`;
}

function normalizeResultBadge(input: unknown): CoachResultBadge | null {
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

export function groupCoachCareerEntries(
  entries: CoachCareerEntryRecord[],
): CoachGroupedExperience[] {
  return [...entries]
    .sort((left, right) => {
      if (left.sort_order !== right.sort_order) {
        return left.sort_order - right.sort_order;
      }

      const leftYear = Math.max(...left.seasons.map(getSeasonStartYear), left.period_end_year ?? 0);
      const rightYear = Math.max(...right.seasons.map(getSeasonStartYear), right.period_end_year ?? 0);
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
        .sort((left, right) => getSeasonStartYear(right) - getSeasonStartYear(left))
        .map((seasonLabel) => {
          const seasonDetail = entry.season_details?.[seasonLabel];
          const assignments: CoachSeasonAssignment[] = [
            {
              category: seasonDetail?.category?.trim() || entry.category || "",
              role: seasonDetail?.role?.trim() || entry.role,
            },
          ];
          const results = (entry.results ?? [])
            .filter((result) => {
              if (!result || typeof result !== "object") {
                return false;
              }

              const seasonValue = (result as { seasonLabel?: unknown }).seasonLabel;
              return typeof seasonValue !== "string" || seasonValue === seasonLabel;
            })
            .map(normalizeResultBadge)
            .filter((result): result is CoachResultBadge => Boolean(result));

          return {
            seasonLabel,
            assignments,
            description: entry.description ?? undefined,
            results,
          } satisfies CoachSeasonItem;
        });

      return {
        durationLabel: formatCoachDurationLabel(entry),
        entryId: entry.id,
        roleLabel: entry.role,
        seasons: seasonItems,
        teamLogoUrl: entry.team_logo_url ?? "",
        teamName: entry.team_name,
      } satisfies CoachGroupedExperience;
    });
}

function buildPlayerCareerDescription(entry: CoachPlayerCareerEntryRecord) {
  const parts = [entry.position, entry.category].filter(Boolean) as string[];

  if (entry.appearances > 0) {
    parts.push(`${entry.appearances} presenze`);
  }

  if (entry.goals > 0) {
    parts.push(`${entry.goals} gol`);
  }

  if (entry.assists > 0) {
    parts.push(`${entry.assists} assist`);
  }

  return parts.join(" · ");
}

export function groupCoachPlayerCareerEntries(
  entries: CoachPlayerCareerEntryRecord[],
): CoachGroupedPlayerExperience[] {
  return [...entries]
    .sort((left, right) => {
      const seasonDelta = getSeasonStartYear(right.season) - getSeasonStartYear(left.season);
      return seasonDelta !== 0 ? seasonDelta : left.sort_order - right.sort_order;
    })
    .map((entry) => ({
      description: buildPlayerCareerDescription(entry),
      entryId: entry.id,
      seasonLabel: shortSeasonLabel(entry.season),
      teamLogoUrl: entry.team_logo_url ?? "",
      teamName: entry.team_name,
    }));
}

export function groupCoachDirectorCareerEntries(
  entries: CoachDirectorCareerEntryRecord[],
): CoachGroupedDirectorExperience[] {
  return [...entries]
    .sort((left, right) => {
      const leftYear = Math.max(...left.seasons.map(getSeasonStartYear), 0);
      const rightYear = Math.max(...right.seasons.map(getSeasonStartYear), 0);
      return rightYear - leftYear;
    })
    .map((entry) => ({
      description: entry.description ?? undefined,
      durationLabel: formatCoachDurationLabel(entry),
      entryId: entry.id,
      roleLabel: [entry.role, entry.category].filter(Boolean).join(" · "),
      teamLogoUrl: entry.team_logo_url ?? "",
      teamName: entry.team_name,
    }));
}
