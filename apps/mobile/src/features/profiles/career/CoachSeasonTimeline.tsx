import { StyleSheet, View } from "react-native";

import { colors, radius, spacing, typography } from "../../../theme/tokens";
import { AppText, Badge } from "../../../ui";
import type { CoachSeasonItem } from "./coach-career-grouping";
import { shortSeasonLabel } from "./coach-career-grouping";

type CoachSeasonTimelineProps = {
  seasons: CoachSeasonItem[];
};

export function CoachSeasonTimeline({ seasons }: CoachSeasonTimelineProps) {
  return (
    <View style={styles.container}>
      <View style={styles.line} />
      {seasons.map((season) => (
        <View key={season.seasonLabel} style={styles.seasonItem}>
          <View style={styles.dot} />
          <View style={styles.seasonContent}>
            <AppText style={styles.seasonLabel} variant="titleSm">
              {shortSeasonLabel(season.seasonLabel)}
            </AppText>
            <View style={styles.assignmentList}>
              {season.assignments.map((assignment, index) => (
                <AppText
                  color="accent"
                  key={`${season.seasonLabel}-${assignment.role}-${assignment.category}-${index}`}
                  style={styles.assignmentText}
                  variant="bodySm"
                >
                  {"• "}
                  {[assignment.role, assignment.category].filter(Boolean).join(" - ")}
                </AppText>
              ))}
            </View>
            {season.results.length > 0 ? (
              <View style={styles.badgesRow}>
                {season.results.map((result, index) => (
                  <Badge
                    key={`${season.seasonLabel}-${result.label}-${index}`}
                    label={result.label}
                    variant={result.variant}
                  />
                ))}
              </View>
            ) : null}
            {season.description ? (
              <AppText color="secondary" variant="caption">
                {season.description}
              </AppText>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  assignmentList: {
    gap: spacing[4],
  },
  assignmentText: {
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.medium,
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
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
    gap: spacing[6],
    paddingBottom: spacing[18],
  },
  seasonItem: {
    position: "relative",
  },
  seasonLabel: {
    fontSize: typography.fontSize[15],
    fontWeight: typography.fontWeight.bold,
  },
});
