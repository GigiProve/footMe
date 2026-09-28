/**
 * Andamento carriera (REV-PROF-01 §21, §22).
 *
 * Grafico a barre verticali su fondo bianco, con il selettore della metrica
 * sopra. Sostituisce il line chart precedente. Il grafico non è mai l'unico
 * modo di leggere i valori: ogni barra porta la propria etichetta accessibile
 * e il tap mostra stagione e valore in chiaro.
 */
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";

import { colors, spacing, typography } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { ProfileFilterChips } from "../master/ProfileFilterChips";
import {
  buildCareerChartSeries,
  CAREER_METRIC_LABELS,
  formatCareerStat,
  type CareerMetric,
  type PlayerCareerView,
} from "./player-career-model";

const METRIC_OPTIONS: readonly { label: string; value: CareerMetric }[] = [
  { label: "Gol", value: "goals" },
  { label: "Presenze", value: "appearances" },
  { label: "Assist", value: "assists" },
];

const CHART_HEIGHT = 156;
const AXIS_WIDTH = 24;
const BAR_MAX_WIDTH = 26;
const BAR_MIN_WIDTH = 8;
const BAR_GAP = 10;
/** Sotto questa larghezza il valore sopra la barra non è più leggibile. */
const VALUE_LABEL_MIN_BAR_WIDTH = 18;

type CareerPerformanceChartProps = {
  onMetricChange?: (metric: CareerMetric) => void;
  view: PlayerCareerView;
};

export function CareerPerformanceChart({
  onMetricChange,
  view,
}: CareerPerformanceChartProps) {
  const [metric, setMetric] = useState<CareerMetric>("goals");
  const [selectedSeasonKey, setSelectedSeasonKey] = useState<string | null>(null);
  const [chartWidth, setChartWidth] = useState(0);

  const points = useMemo(
    () => buildCareerChartSeries(view, metric),
    [metric, view],
  );

  const maxValue = useMemo(
    () =>
      points.reduce((max, point) => Math.max(max, point.value ?? 0), 0),
    [points],
  );

  if (points.length === 0) {
    return null;
  }

  const plotWidth = Math.max(chartWidth - AXIS_WIDTH, 0);
  // Più stagioni ⇒ barre più strette, mai stagioni tolte e mai scroll
  // orizzontale obbligatorio (§22).
  const slotWidth = plotWidth > 0 ? plotWidth / points.length : 0;
  const barWidth = Math.max(
    BAR_MIN_WIDTH,
    Math.min(BAR_MAX_WIDTH, slotWidth - BAR_GAP),
  );
  const showsEveryLabel = slotWidth >= 34;
  // Con molte stagioni si diradano le etichette dell'asse X, non i dati.
  const labelStride = showsEveryLabel
    ? 1
    : Math.ceil(34 / Math.max(slotWidth, 1));
  const showsValueLabels = barWidth >= VALUE_LABEL_MIN_BAR_WIDTH;
  const scaleMax = maxValue > 0 ? maxValue : 1;
  const selectedPoint =
    points.find((point) => point.seasonKey === selectedSeasonKey) ?? null;

  function handleMetricChange(next: CareerMetric) {
    setMetric(next);
    setSelectedSeasonKey(null);
    onMetricChange?.(next);
  }

  return (
    <View style={styles.container} testID="career-performance-chart">
      <AppText accessibilityRole="header" variant="titleMd">
        Andamento carriera
      </AppText>

      <ProfileFilterChips
        accessibilityLabel="Metrica del grafico"
        onChange={handleMetricChange}
        options={METRIC_OPTIONS}
        testID="career-metric"
        value={metric}
      />

      <View
        onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}
        style={styles.plot}
      >
        {chartWidth > 0 ? (
          <>
            <Svg height={CHART_HEIGHT} width={chartWidth}>
              {/* Asse Y estremamente discreto: tre riferimenti e nulla più. */}
              {[0, 0.5, 1].map((ratio) => {
                const y = CHART_HEIGHT - 18 - ratio * (CHART_HEIGHT - 30);

                return (
                  <SvgText
                    fill={colors.textMuted}
                    fontSize={9}
                    key={ratio}
                    x={0}
                    y={y + 3}
                  >
                    {String(Math.round(scaleMax * ratio))}
                  </SvgText>
                );
              })}

              <Line
                stroke={colors.border}
                strokeWidth={1}
                x1={AXIS_WIDTH}
                x2={chartWidth}
                y1={CHART_HEIGHT - 18}
                y2={CHART_HEIGHT - 18}
              />

              {points.map((point, index) => {
                if (point.value === null) {
                  return null;
                }

                const height =
                  ((CHART_HEIGHT - 30) * point.value) / scaleMax;
                const x =
                  AXIS_WIDTH + index * slotWidth + (slotWidth - barWidth) / 2;
                const y = CHART_HEIGHT - 18 - height;
                const isSelected = point.seasonKey === selectedSeasonKey;

                return (
                  <Rect
                    fill={isSelected ? colors.accentStrong : colors.accent}
                    height={Math.max(height, 2)}
                    key={point.seasonKey}
                    width={barWidth}
                    x={x}
                    y={y}
                  />
                );
              })}

              {showsValueLabels
                ? points.map((point, index) => {
                    if (point.value === null) {
                      return null;
                    }

                    const height =
                      ((CHART_HEIGHT - 30) * point.value) / scaleMax;

                    return (
                      <SvgText
                        fill={colors.textPrimary}
                        fontSize={10}
                        fontWeight="700"
                        key={`${point.seasonKey}-value`}
                        textAnchor="middle"
                        x={AXIS_WIDTH + index * slotWidth + slotWidth / 2}
                        y={CHART_HEIGHT - 24 - height}
                      >
                        {String(point.value)}
                      </SvgText>
                    );
                  })
                : null}

              {points.map((point, index) =>
                index % labelStride === 0 ? (
                  <SvgText
                    fill={colors.textMuted}
                    fontSize={9}
                    key={`${point.seasonKey}-label`}
                    textAnchor="middle"
                    x={AXIS_WIDTH + index * slotWidth + slotWidth / 2}
                    y={CHART_HEIGHT - 4}
                  >
                    {point.label}
                  </SvgText>
                ) : null,
              )}
            </Svg>

            {/*
              Una zona tappabile per barra sopra il disegno: l'SVG non è
              accessibile di suo, queste lo sono (§39).
            */}
            <View style={styles.hitArea}>
              {points.map((point) => (
                <Pressable
                  accessibilityLabel={`Stagione ${point.label}, ${
                    CAREER_METRIC_LABELS[metric]
                  } ${
                    point.value === null
                      ? "dato non disponibile"
                      : String(point.value)
                  }`}
                  accessibilityRole="button"
                  key={point.seasonKey}
                  onPress={() =>
                    setSelectedSeasonKey(
                      point.seasonKey === selectedSeasonKey
                        ? null
                        : point.seasonKey,
                    )
                  }
                  style={styles.hitSlot}
                />
              ))}
            </View>
          </>
        ) : null}
      </View>

      <AppText color="secondary" style={styles.readout} variant="meta">
        {selectedPoint
          ? `${selectedPoint.label} · ${formatCareerStat(selectedPoint.value)} ${
              CAREER_METRIC_LABELS[metric]
            }`
          : "Tocca una barra per leggere stagione e valore."}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[18],
  },
  hitArea: {
    bottom: 18,
    flexDirection: "row",
    left: AXIS_WIDTH,
    position: "absolute",
    right: 0,
    top: 0,
  },
  hitSlot: {
    flex: 1,
  },
  plot: {
    height: CHART_HEIGHT,
    justifyContent: "flex-end",
  },
  readout: {
    lineHeight: typography.lineHeight[18],
    minHeight: typography.lineHeight[18],
  },
});
