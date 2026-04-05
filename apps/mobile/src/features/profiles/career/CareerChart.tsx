import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { colors, radius, shadows, spacing, typography } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import type { PlayerExperienceForm } from "../player-sports";
import { buildChartData, type ChartMetric } from "./chart-data";
import { CareerChartSvg } from "./CareerChartSvg";
import { SegmentedControl } from "./SegmentedControl";

type CareerChartProps = {
  entries: PlayerExperienceForm[];
};

const CHART_OPTIONS: readonly { label: string; value: ChartMetric }[] = [
  { label: "Gol", value: "goals" },
  { label: "Presenze", value: "appearances" },
  { label: "Assist", value: "assists" },
] as const;

const METRIC_LABELS: Record<ChartMetric, string> = {
  goals: "Gol",
  appearances: "Presenze",
  assists: "Assist",
};

export function CareerChart({ entries }: CareerChartProps) {
  const [metric, setMetric] = useState<ChartMetric>("goals");
  const data = buildChartData(entries, metric);

  return (
    <View style={styles.section}>
      <AppText style={styles.sectionTitle} variant="headingSm">
        Andamento carriera
      </AppText>
      <View style={styles.card}>
        <SegmentedControl
          onChange={setMetric}
          options={CHART_OPTIONS}
          value={metric}
        />
        <CareerChartSvg data={data} metricLabel={METRIC_LABELS[metric]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing[16],
    padding: spacing[16],
    ...shadows.card,
  },
  section: {
    backgroundColor: colors.surface,
    gap: spacing[14],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[18],
  },
  sectionTitle: {
    fontSize: typography.fontSize[18],
    fontWeight: typography.fontWeight.bold,
  },
});
