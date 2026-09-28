/**
 * Una stagione dentro un'esperienza (REV-PROF-01 §16, §19).
 *
 * Stagione, categoria e le tre statistiche su una riga sola, allineate e senza
 * card individuali. Una statistica mai inserita mostra un trattino: non viene
 * trasformata in zero.
 */
import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import {
  CAREER_METRIC_LABELS,
  formatCareerStat,
  getCareerStatAccessibilityLabel,
  type CareerMetric,
  type CareerSeason,
  type CareerStat,
} from "./player-career-model";

const METRICS: readonly CareerMetric[] = ["appearances", "goals", "assists"];

type CareerSeasonRowProps = {
  isFirst: boolean;
  isLast: boolean;
  season: CareerSeason;
};

export function CareerSeasonRow({
  isFirst,
  isLast,
  season,
}: CareerSeasonRowProps) {
  const statsLabel = METRICS.map((metric) =>
    getCareerStatAccessibilityLabel(metric, season[metric]),
  ).join(", ");

  return (
    <View
      accessible
      accessibilityLabel={[
        `Stagione ${season.seasonKey.replace("/", "-")}`,
        season.category,
        statsLabel,
      ]
        .filter(Boolean)
        .join(", ")}
      style={styles.row}
      testID={`career-season-${season.seasonKey}`}
    >
      <View style={styles.timeline}>
        <View
          style={[
            styles.timelineLine,
            isFirst ? styles.timelineLineFirst : null,
            isLast ? styles.timelineLineLast : null,
          ]}
        />
        <View style={styles.timelineDot} />
      </View>

      <View style={styles.label}>
        <AppText numberOfLines={1} variant="metaStrong">
          {season.label}
        </AppText>
        {season.category ? (
          <AppText color="muted" numberOfLines={1} variant="meta">
            {season.category}
          </AppText>
        ) : null}
      </View>

      <View style={styles.stats}>
        {METRICS.map((metric) => (
          <SeasonStat
            key={metric}
            label={CAREER_METRIC_LABELS[metric]}
            value={season[metric]}
          />
        ))}
      </View>
    </View>
  );
}

function SeasonStat({ label, value }: { label: string; value: CareerStat }) {
  return (
    <View style={styles.stat}>
      <AppText
        color={value === null ? "muted" : "primary"}
        numberOfLines={1}
        style={styles.statValue}
        variant="numeric"
      >
        {formatCareerStat(value)}
      </AppText>
      <AppText color="muted" numberOfLines={1} style={styles.statLabel} variant="caption">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
    paddingRight: spacing[8],
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 44,
    paddingVertical: spacing[6],
  },
  stat: {
    alignItems: "center",
    gap: spacing[4],
    minWidth: 46,
  },
  statLabel: {
    textAlign: "center",
  },
  statValue: {
    textAlign: "center",
  },
  stats: {
    flexDirection: "row",
    gap: spacing[6],
  },
  timeline: {
    alignItems: "center",
    alignSelf: "stretch",
    justifyContent: "center",
    marginRight: spacing[12],
    width: 10,
  },
  timelineDot: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    height: 7,
    width: 7,
  },
  timelineLine: {
    backgroundColor: colors.border,
    bottom: 0,
    position: "absolute",
    top: 0,
    width: 1,
  },
  timelineLineFirst: {
    top: "50%",
  },
  timelineLineLast: {
    bottom: "50%",
  },
});
