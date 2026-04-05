import type { PlayerExperienceForm } from "../player-sports";
import { getTeamInitials, shortSeasonLabel } from "./career-grouping";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChartMetric = "goals" | "appearances" | "assists";

export type ChartDataPoint = {
  seasonLabel: string;   // short format: "20/21"
  value: number;
  teamInitials: string;
};

// ---------------------------------------------------------------------------
// Build chart data
// ---------------------------------------------------------------------------

export function buildChartData(
  entries: PlayerExperienceForm[],
  metric: ChartMetric,
): ChartDataPoint[] {
  type SeasonBucket = { valueByClub: Map<string, number>; totalValue: number };
  const buckets = new Map<string, SeasonBucket>();

  for (const entry of entries) {
    const rawValue =
      metric === "goals"
        ? parseInt(entry.goals, 10)
        : metric === "appearances"
          ? parseInt(entry.appearances, 10)
          : parseInt(entry.assists, 10);

    const value = isNaN(rawValue) ? 0 : rawValue;
    const clubKey = entry.clubId ?? entry.clubName;

    let bucket = buckets.get(entry.seasonLabel);
    if (!bucket) {
      bucket = { valueByClub: new Map(), totalValue: 0 };
      buckets.set(entry.seasonLabel, bucket);
    }

    const existing = bucket.valueByClub.get(clubKey) ?? 0;
    bucket.valueByClub.set(clubKey, existing + value);
    bucket.totalValue += value;
  }

  const points: ChartDataPoint[] = [];

  for (const [seasonLabel, bucket] of buckets) {
    // Find club with highest value for initials
    let bestClubKey = "";
    let bestClubValue = -1;
    for (const [clubKey, v] of bucket.valueByClub) {
      if (v > bestClubValue) {
        bestClubValue = v;
        bestClubKey = clubKey;
      }
    }

    // Find the actual club name for initials (could be id, fall back to the key)
    const clubEntry = entries.find(
      (e) =>
        e.seasonLabel === seasonLabel &&
        (e.clubId ?? e.clubName) === bestClubKey,
    );
    const teamInitials = getTeamInitials(clubEntry?.clubName ?? bestClubKey);

    points.push({
      seasonLabel: shortSeasonLabel(seasonLabel),
      value: bucket.totalValue,
      teamInitials,
    });
  }

  // Sort chronologically (oldest first = left on chart)
  points.sort((a, b) => {
    const aYear = parseInt(a.seasonLabel.split("/")[0] ?? "0", 10);
    const bYear = parseInt(b.seasonLabel.split("/")[0] ?? "0", 10);
    return aYear - bYear;
  });

  return points;
}
