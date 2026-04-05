import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

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
  const chartWidth = Math.max(320, data.length * 74);
  const isScrollable = data.length > 4;

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
        <ScrollView
          contentContainerStyle={[
            styles.chartScrollContent,
            !isScrollable ? styles.chartScrollContentCentered : null,
          ]}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          <View style={[styles.chartCanvas, { width: chartWidth }]}>
            <CareerChartSvg data={data} metricLabel={METRIC_LABELS[metric]} />
          </View>
        </ScrollView>
        {isScrollable ? (
          <AppText color="muted" style={styles.chartHint} variant="caption">
            Scorri orizzontalmente e trascina sul grafico per vedere i valori stagione per stagione.
          </AppText>
        ) : null}
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
  chartCanvas: {
    minWidth: "100%",
  },
  chartHint: {
    lineHeight: typography.lineHeight[22],
  },
  chartScrollContent: {
    flexGrow: 1,
  },
  chartScrollContentCentered: {
    justifyContent: "center",
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
