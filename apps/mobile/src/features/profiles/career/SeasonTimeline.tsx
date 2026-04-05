import { StyleSheet, View } from "react-native";

import { colors, radius, spacing, typography } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import type { PlayerExperienceForm } from "../player-sports";
import { shortSeasonLabel } from "./career-grouping";

type SeasonTimelineProps = {
  seasons: PlayerExperienceForm[];
};

export function SeasonTimeline({ seasons }: SeasonTimelineProps) {
  return (
    <View style={styles.container}>
      <View style={styles.line} />
      {seasons.map((season, index) => (
        <SeasonItem key={`${season.seasonLabel}-${season.clubName}`} season={season} isLast={index === seasons.length - 1} />
      ))}
    </View>
  );
}

type SeasonItemProps = {
  isLast: boolean;
  season: PlayerExperienceForm;
};

function SeasonItem({ season }: SeasonItemProps) {
  const statsText = buildStatsText(season);
  const awards = parseAwards(season.awards);

  return (
    <View style={styles.seasonItem}>
      <View style={styles.dot} />
      <View style={styles.seasonContent}>
        <AppText style={styles.seasonLabel} variant="titleSm">
          {shortSeasonLabel(season.seasonLabel)}
        </AppText>
        {season.category ? (
          <AppText color="accent" style={styles.category} variant="bodySm">
            {season.category}
          </AppText>
        ) : null}
        {statsText ? (
          <AppText color="primary" style={styles.stats} variant="bodySm">
            {statsText}
          </AppText>
        ) : null}
        {awards.length > 0 ? (
          <View style={styles.awardsRow}>
            {awards.map((award) => (
              <View key={award} style={styles.awardBadge}>
                <AppText style={styles.awardText}>{award}</AppText>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function buildStatsText(season: PlayerExperienceForm): string {
  const parts: string[] = [];
  const appearances = parseInt(season.appearances, 10);
  const goals = parseInt(season.goals, 10);
  const assists = parseInt(season.assists, 10);

  if (!isNaN(appearances) && appearances > 0) parts.push(`${appearances} presenze`);
  if (!isNaN(goals) && goals > 0) parts.push(`${goals} gol`);
  if (!isNaN(assists) && assists > 0) parts.push(`${assists} assist`);

  return parts.join(" · ");
}

function parseAwards(awards: string): string[] {
  if (!awards || !awards.trim()) return [];
  return awards
    .split(",")
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}

const styles = StyleSheet.create({
  awardBadge: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[4] + 1,
  },
  awardText: {
    color: colors.success,
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.semibold,
    lineHeight: 16,
  },
  awardsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
    marginTop: spacing[4],
  },
  category: {
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.bold,
  },
  container: {
    marginLeft: spacing[4],
    paddingLeft: spacing[18],
    position: "relative",
  },
  dot: {
    backgroundColor: colors.accent,
    borderColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: 3,
    height: 8,
    left: -13,
    position: "absolute",
    top: 5,
    width: 8,
  },
  line: {
    backgroundColor: colors.border,
    bottom: spacing[6],
    left: 3,
    position: "absolute",
    top: spacing[6],
    width: 1,
  },
  seasonContent: {
    gap: spacing[4],
    paddingBottom: spacing[18],
  },
  seasonItem: {
    position: "relative",
  },
  seasonLabel: {
    fontSize: typography.fontSize[15],
    fontWeight: typography.fontWeight.bold,
  },
  stats: {
    fontSize: typography.fontSize[14],
  },
});
