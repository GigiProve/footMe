import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Line,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";

import { colors, spacing, typography } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import type { ChartDataPoint } from "./chart-data";

type CareerChartSvgProps = {
  data: ChartDataPoint[];
  metricLabel: string;
};

const CHART_HEIGHT = 148;
const PADDING_X = 14;
const PADDING_TOP = 16;
const BASELINE_Y = CHART_HEIGHT - 8;

export function CareerChartSvg({ data, metricLabel }: CareerChartSvgProps) {
  const [containerWidth, setContainerWidth] = useState(0);

  if (data.length === 0) {
    return (
      <View style={styles.empty}>
        <AppText color="muted" variant="bodySm">
          Nessun dato disponibile
        </AppText>
      </View>
    );
  }

  const width = containerWidth > 0 ? containerWidth : 320;
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const yScale = (BASELINE_Y - PADDING_TOP) / maxValue;

  function xPos(index: number): number {
    if (data.length === 1) return width / 2;
    return PADDING_X + (index * (width - PADDING_X * 2)) / (data.length - 1);
  }

  function yPos(value: number): number {
    return BASELINE_Y - value * yScale;
  }

  const points = data.map((d, i) => ({ x: xPos(i), y: yPos(d.value), d }));

  // Line path
  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  // Area path (close back to baseline)
  const lastX = points[points.length - 1]?.x ?? 0;
  const firstX = points[0]?.x ?? 0;
  const areaPath = `${linePath} L ${lastX} ${BASELINE_Y} L ${firstX} ${BASELINE_Y} Z`;

  // Best value index
  const bestIndex = data.reduce(
    (best, d, i) => (d.value > (data[best]?.value ?? 0) ? i : best),
    0,
  );

  // Grid lines at 25%, 50%, 75% of maxValue
  const gridValues = [maxValue * 0.75, maxValue * 0.5, maxValue * 0.25];

  return (
    <View
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      style={styles.container}
    >
      {containerWidth > 0 ? (
        <Svg height={CHART_HEIGHT} style={styles.svg} width={width}>
          <Defs>
            <LinearGradient id="careerGrad" x1="0" x2="0" y1="0" y2="1">
              <Stop offset="0%" stopColor={colors.accent} stopOpacity={0.18} />
              <Stop offset="100%" stopColor={colors.accent} stopOpacity={0} />
            </LinearGradient>
          </Defs>

          {/* Baseline */}
          <Line
            stroke={colors.border}
            strokeWidth={1}
            x1={PADDING_X}
            x2={width - PADDING_X}
            y1={BASELINE_Y}
            y2={BASELINE_Y}
          />

          {/* Dashed grid lines */}
          {gridValues.map((gv, i) => (
            <Line
              key={i}
              stroke={colors.border}
              strokeDasharray="4 5"
              strokeWidth={1}
              x1={PADDING_X}
              x2={width - PADDING_X}
              y1={yPos(gv)}
              y2={yPos(gv)}
            />
          ))}

          {/* Gradient fill area */}
          <Path d={areaPath} fill="url(#careerGrad)" />

          {/* Line */}
          <Path
            d={linePath}
            fill="none"
            stroke={colors.accent}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
          />

          {/* Data points */}
          {points.map((p, i) => {
            const isBest = i === bestIndex;
            return (
              <G key={i}>
                <Circle
                  cx={p.x}
                  cy={p.y}
                  fill={isBest ? colors.accent : colors.surface}
                  r={9}
                  stroke={isBest ? colors.surface : colors.accent}
                  strokeWidth={2.5}
                />
                <SvgText
                  fill={isBest ? colors.inkInvert : colors.accent}
                  fontSize={7}
                  fontWeight="700"
                  textAnchor="middle"
                  x={p.x}
                  y={p.y + 3}
                >
                  {p.d.teamInitials}
                </SvgText>
              </G>
            );
          })}

          {/* Tooltip on best value */}
          {points[bestIndex] ? (
            <TooltipEl
              label={`${data[bestIndex]?.value ?? 0} ${metricLabel}`}
              x={points[bestIndex]!.x}
              y={points[bestIndex]!.y}
              chartWidth={width}
            />
          ) : null}
        </Svg>
      ) : (
        <View style={{ height: CHART_HEIGHT }} />
      )}

      {/* X-axis labels */}
      <View style={styles.xLabels}>
        {data.map((d, i) => (
          <AppText
            color="muted"
            key={i}
            style={[styles.xLabel, data.length === 1 ? styles.xLabelCenter : null]}
            variant="caption"
          >
            {d.seasonLabel}
          </AppText>
        ))}
      </View>
    </View>
  );
}

function TooltipEl({
  chartWidth,
  label,
  x,
  y,
}: {
  chartWidth: number;
  label: string;
  x: number;
  y: number;
}) {
  const tooltipWidth = label.length * 7 + 16;
  const tooltipHeight = 24;
  const tooltipY = y - tooltipHeight - 8;
  let tooltipX = x - tooltipWidth / 2;

  // Clamp within chart
  tooltipX = Math.max(PADDING_X, Math.min(tooltipX, chartWidth - PADDING_X - tooltipWidth));

  return (
    <>
      <Rect
        fill={colors.textPrimary}
        height={tooltipHeight}
        rx={8}
        width={tooltipWidth}
        x={tooltipX}
        y={tooltipY}
      />
      <SvgText
        fill={colors.inkInvert}
        fontSize={11}
        fontWeight="600"
        textAnchor="middle"
        x={tooltipX + tooltipWidth / 2}
        y={tooltipY + 16}
      >
        {label}
      </SvgText>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[6],
  },
  empty: {
    alignItems: "center",
    height: 80,
    justifyContent: "center",
  },
  svg: {
    overflow: "visible",
  },
  xLabel: {
    flex: 1,
    fontSize: typography.fontSize[11],
    textAlign: "center",
  },
  xLabelCenter: {
    textAlign: "center",
  },
  xLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing[4],
  },
});
