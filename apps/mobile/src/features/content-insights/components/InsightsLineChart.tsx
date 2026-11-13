/**
 * Il grafico Andamento: UNA linea, una metrica per volta (HOM-05 §65–66, §166, §169).
 *
 * Solo una polilinea in un'unica tonalità PROLINK: niente area, gradiente,
 * doppio asse, più serie o 3D (§65). Griglia orizzontale leggera, etichette
 * degli assi in `textSecondary` (leggibili, §166, §170). La serie è già
 * cumulativa dal backend: qui si disegna soltanto, senza ricalcolare nulla.
 * L'SVG non è accessibile di suo: il contenitore porta la frase del §169 con
 * metrica, periodo, valore iniziale e finale.
 *
 * Geometria e scala sono funzioni pure di `insights-presentation`.
 */

import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, G, Line, Polyline, Text as SvgText } from "react-native-svg";

import { colors } from "../../../theme/tokens";
import {
  formatMetricNumber,
  toPolylinePoints,
  trendAccessibilitySummary,
  trendAxisLabels,
  trendAxisWidth,
  trendGeometry,
  trendMaxValue,
  trendScale,
  type ChartBox,
} from "../insights-presentation";
import type { ContentInsightsTrend } from "../insights-types";

export const CHART_HEIGHT = 176;
const TOP = 12;
const BOTTOM = 24;
const RIGHT = 12;
const LABEL_SIZE = 10;

export function InsightsLineChart({ trend }: { trend: ContentInsightsTrend }) {
  const [width, setWidth] = useState(0);

  const scale = trendScale(trendMaxValue(trend.points));
  const tickLabels = scale.ticks.map(formatMetricNumber);
  const box: ChartBox = {
    bottom: BOTTOM,
    height: CHART_HEIGHT,
    left: trendAxisWidth(tickLabels),
    right: RIGHT,
    top: TOP,
    width,
  };
  const coordinates = trendGeometry(trend.points, scale.max, box);
  const xLabels = trendAxisLabels(trend.points, trend.interval, width < 300 ? 3 : 4);
  const plotHeight = CHART_HEIGHT - TOP - BOTTOM;
  const lastPoint = coordinates[coordinates.length - 1];

  return (
    <View
      accessible
      accessibilityLabel={trendAccessibilitySummary(trend)}
      accessibilityRole="image"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={styles.container}
      testID="insights-chart"
    >
      {width > 0 ? (
        <Svg height={CHART_HEIGHT} width={width}>
          {scale.ticks.map((tick, index) => {
            const y = TOP + plotHeight * (1 - tick / scale.max);

            return (
              <G key={tick}>
                <Line
                  stroke={colors.border}
                  strokeWidth={1}
                  x1={box.left}
                  x2={width - RIGHT}
                  y1={y}
                  y2={y}
                />
                <SvgText
                  fill={colors.textSecondary}
                  fontSize={LABEL_SIZE}
                  textAnchor="end"
                  x={box.left - 6}
                  y={y + 3}
                >
                  {tickLabels[index]}
                </SvgText>
              </G>
            );
          })}

          <Polyline
            fill="none"
            points={toPolylinePoints(coordinates)}
            stroke={colors.accent}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
          />
          {lastPoint ? <Circle cx={lastPoint.x} cy={lastPoint.y} fill={colors.accent} r={3.5} /> : null}

          {xLabels.map(({ index, label }) => (
            <SvgText
              fill={colors.textSecondary}
              fontSize={LABEL_SIZE}
              key={index}
              textAnchor={
                index === 0 ? "start" : index === trend.points.length - 1 ? "end" : "middle"
              }
              x={coordinates[index].x}
              y={CHART_HEIGHT - 6}
            >
              {label}
            </SvgText>
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: CHART_HEIGHT,
    width: "100%",
  },
});
