/**
 * Andamento: periodo, metrica e grafico (HOM-05 §64–75, §133–134, §171).
 *
 * Periodi come chip leggere (§71) — solo quelli disponibili, mai disabilitati
 * finti (§70, §188) — e metrica con un selettore leggero «Visualizzazioni ▾»,
 * non tre bottoni grandi (§67). Cambiare periodo o metrica cambia solo lo stato
 * di questa sezione: la pagina non si riscrive e lo scroll resta (§72).
 *
 * Il grafico ha quattro esiti: skeleton di altezza fissa (nessun salto di
 * layout), errore SOLO di sezione con «Riprova» (§133–134), stato compatto se i
 * dati non bastano (§75) e la linea. Target dei controlli ≥ 44px (§171): le chip
 * da 30px hanno un'area di tocco estesa.
 */

import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../theme/tokens";
import { ActionSheet, AppText, Button, Skeleton } from "../../../ui";
import {
  INSIGHTS_RETRY,
  INSIGHTS_SECTION_ERROR,
  INSIGHTS_SECTION_TITLES,
  INSIGHTS_TREND_INSUFFICIENT,
  METRIC_LABELS,
  METRIC_ORDER,
  type PeriodOption,
  type TrendViewState,
} from "../insights-presentation";
import type { InsightsMetric, InsightsPeriod } from "../insights-types";
import { CHART_HEIGHT, InsightsLineChart } from "./InsightsLineChart";
import { InsightsPanel, InsightsSection } from "./InsightsSection";

export function InsightsTrend({
  metric,
  onChangeMetric,
  onChangePeriod,
  onRetry,
  period,
  periods,
  state,
}: {
  metric: InsightsMetric;
  onChangeMetric: (metric: InsightsMetric) => void;
  onChangePeriod: (period: InsightsPeriod) => void;
  onRetry: () => void;
  period: InsightsPeriod;
  periods: PeriodOption[];
  state: TrendViewState;
}) {
  const [isMetricSheetOpen, setMetricSheetOpen] = useState(false);

  return (
    <InsightsSection testID="insights-trend" title={INSIGHTS_SECTION_TITLES.trend}>
      <View accessibilityLabel="Periodo del grafico" accessibilityRole="radiogroup" style={styles.chips}>
        {periods.map((option) => {
          const isSelected = option.value === period;

          return (
            <Button
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected, selected: isSelected }}
              hitSlop={7}
              key={option.value}
              label={option.label}
              onPress={() => onChangePeriod(option.value)}
              selected={isSelected}
              size="sm"
              testID={`insights-period-${option.value}`}
              variant="chipAction"
            />
          );
        })}
      </View>

      <Pressable
        accessibilityHint="Cambia la metrica del grafico"
        accessibilityLabel={`Metrica del grafico: ${METRIC_LABELS[metric]}`}
        accessibilityRole="button"
        onPress={() => setMetricSheetOpen(true)}
        style={({ pressed }) => [styles.selector, pressed ? styles.pressed : null]}
        testID="insights-metric-selector"
      >
        <AppText variant="titleSm">{METRIC_LABELS[metric]}</AppText>
        <Ionicons color={colors.textSecondary} name="chevron-down" size={16} />
      </Pressable>

      <InsightsPanel>
        <View style={styles.chartArea} testID="insights-chart-area">
          {state.kind === "loading" ? (
            <View accessibilityState={{ busy: true }} style={styles.skeleton} testID="insights-chart-skeleton">
              <Skeleton.Row style={styles.skeletonBlock} />
            </View>
          ) : state.kind === "error" ? (
            <View style={styles.message} testID="insights-trend-error">
              <AppText align="center" color="secondary" variant="bodyLg">
                {INSIGHTS_SECTION_ERROR}
              </AppText>
              <Button hitSlop={6} label={INSIGHTS_RETRY} onPress={onRetry} size="sm" variant="secondary" />
            </View>
          ) : state.kind === "insufficient" ? (
            <View style={styles.message} testID="insights-trend-insufficient">
              <AppText align="center" color="secondary" variant="bodyLg">
                {INSIGHTS_TREND_INSUFFICIENT}
              </AppText>
            </View>
          ) : (
            <InsightsLineChart trend={state.trend} />
          )}
        </View>
      </InsightsPanel>

      <ActionSheet
        actions={METRIC_ORDER.map((option) => ({
          icon: option === metric ? "checkmark" : undefined,
          id: `metric-${option}`,
          label: METRIC_LABELS[option],
          onPress: () => onChangeMetric(option),
        }))}
        onClose={() => setMetricSheetOpen(false)}
        title="Metrica del grafico"
        visible={isMetricSheetOpen}
      />
    </InsightsSection>
  );
}

const styles = StyleSheet.create({
  chartArea: {
    justifyContent: "center",
    minHeight: CHART_HEIGHT,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[12],
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  message: {
    alignItems: "center",
    gap: spacing[12],
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.7,
  },
  selector: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[8],
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[16],
  },
  skeleton: {
    height: CHART_HEIGHT - spacing[24],
  },
  skeletonBlock: {
    height: "100%",
    marginBottom: 0,
  },
});
