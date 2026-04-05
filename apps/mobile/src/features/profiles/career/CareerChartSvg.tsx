import { useEffect, useState } from "react";
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

import { colors } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import type { ChartDataPoint } from "./chart-data";

type CareerChartSvgProps = {
  data: ChartDataPoint[];
  metricLabel: string;
};

const CHART_HEIGHT = 220;
const Y_AXIS_WIDTH = 40;
const RIGHT_PADDING = 18;
const TOP_PADDING = 28;
const BOTTOM_PADDING = 34;
const POINT_RADIUS = 9;

export function CareerChartSvg({ data, metricLabel }: CareerChartSvgProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const bestIndex = data.reduce(
    (best, point, index) => (point.value > (data[best]?.value ?? 0) ? index : best),
    0,
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(bestIndex);

  useEffect(() => {
    setSelectedIndex(bestIndex);
  }, [bestIndex, metricLabel, data]);

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
  const chartLeft = Y_AXIS_WIDTH;
  const chartRight = width - RIGHT_PADDING;
  const chartTop = TOP_PADDING;
  const baselineY = CHART_HEIGHT - BOTTOM_PADDING;
  const plotHeight = baselineY - chartTop;
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const yScale = plotHeight / maxValue;

  function xPos(index: number): number {
    if (data.length === 1) return width / 2;
    return chartLeft + (index * (chartRight - chartLeft)) / (data.length - 1);
  }

  function yPos(value: number): number {
    return baselineY - value * yScale;
  }

  const points = data.map((d, i) => ({ x: xPos(i), y: yPos(d.value), d }));

  // Line path
  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  // Area path (close back to baseline)
  const lastX = points[points.length - 1]?.x ?? 0;
  const firstX = points[0]?.x ?? 0;
  const areaPath = `${linePath} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;

  const yAxisTicks = Array.from(
    new Set([
      maxValue,
      Math.round(maxValue * 0.66),
      Math.round(maxValue * 0.33),
      0,
    ]),
  )
    .filter((value) => value >= 0 && value <= maxValue)
    .sort((a, b) => b - a);

  function getNearestPointIndex(locationX: number): number {
    return points.reduce((nearestIndex, point, index) => {
      const nearestDistance = Math.abs(points[nearestIndex]!.x - locationX);
      const currentDistance = Math.abs(point.x - locationX);
      return currentDistance < nearestDistance ? index : nearestIndex;
    }, 0);
  }

  function handlePointer(locationX: number) {
    if (points.length === 0) return;
    setSelectedIndex(getNearestPointIndex(locationX));
  }

  const activeIndex = selectedIndex ?? bestIndex;
  const activePoint = points[activeIndex];

  return (
    <View
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      onTouchMove={(e) => handlePointer(e.nativeEvent.locationX)}
      onTouchStart={(e) => handlePointer(e.nativeEvent.locationX)}
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

          {yAxisTicks.map((tick) => (
            <G key={`tick-${tick}`}>
              <Line
                stroke={tick === 0 ? colors.border : colors.border}
                strokeDasharray={tick === 0 ? undefined : "4 5"}
                strokeWidth={1}
                x1={chartLeft}
                x2={chartRight}
                y1={yPos(tick)}
                y2={yPos(tick)}
              />
              <SvgText
                fill={colors.textSecondary}
                fontSize={11}
                fontWeight="600"
                textAnchor="end"
                x={chartLeft - 8}
                y={yPos(tick) + 4}
              >
                {tick}
              </SvgText>
            </G>
          ))}

          {/* Baseline */}
          <Line
            stroke={colors.border}
            strokeWidth={1}
            x1={chartLeft}
            x2={chartRight}
            y1={baselineY}
            y2={baselineY}
          />

          {/* Gradient fill area */}
          <Path d={areaPath} fill="url(#careerGrad)" />

          {activePoint ? (
            <Line
              stroke={colors.accent}
              strokeDasharray="3 4"
              strokeWidth={1.5}
              x1={activePoint.x}
              x2={activePoint.x}
              y1={chartTop}
              y2={baselineY}
            />
          ) : null}

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
            const isActive = i === activeIndex;
            return (
              <G key={i}>
                <PointValueLabel
                  chartTop={chartTop}
                  isActive={isActive}
                  value={p.d.value}
                  x={p.x}
                  y={p.y}
                />
                <Circle
                  cx={p.x}
                  cy={p.y}
                  fill={isActive || isBest ? colors.accent : colors.surface}
                  r={isActive ? POINT_RADIUS + 1 : POINT_RADIUS}
                  stroke={isActive || isBest ? colors.surface : colors.accent}
                  strokeWidth={isActive ? 3 : 2.5}
                />
                <SvgText
                  fill={isActive || isBest ? colors.inkInvert : colors.accent}
                  fontSize={7}
                  fontWeight="700"
                  textAnchor="middle"
                  x={p.x}
                  y={p.y + 3}
                >
                  {p.d.teamInitials}
                </SvgText>
                <SvgText
                  fill={colors.textSecondary}
                  fontSize={10}
                  fontWeight={isActive ? "700" : "600"}
                  textAnchor="middle"
                  x={p.x}
                  y={baselineY + 18}
                >
                  {p.d.seasonLabel}
                </SvgText>
              </G>
            );
          })}

          {/* Tooltip on best value */}
          {activePoint ? (
            <TooltipEl
              label={`${data[activeIndex]?.value ?? 0} ${metricLabel} • ${data[activeIndex]?.seasonLabel ?? ""}`}
              x={activePoint.x}
              y={activePoint.y}
              chartWidth={width}
              chartTop={chartTop}
            />
          ) : null}

          <SvgText
            fill={colors.textSecondary}
            fontSize={11}
            fontWeight="700"
            textAnchor="start"
            x={chartLeft}
            y={14}
          >
            {metricLabel}
          </SvgText>
        </Svg>
      ) : (
        <View style={{ height: CHART_HEIGHT }} />
      )}
    </View>
  );
}

function PointValueLabel({
  chartTop,
  isActive,
  value,
  x,
  y,
}: {
  chartTop: number;
  isActive: boolean;
  value: number;
  x: number;
  y: number;
}) {
  const label = String(value);
  const labelWidth = Math.max(24, label.length * 7 + 10);
  const labelHeight = 20;
  const topY = y - POINT_RADIUS - labelHeight - 6;
  const labelY = topY < chartTop ? y + POINT_RADIUS + 6 : topY;
  const textY = labelY + 13;

  return (
    <>
      <Rect
        fill={isActive ? colors.accentSoft : colors.surface}
        height={labelHeight}
        rx={10}
        stroke={isActive ? colors.accent : colors.border}
        strokeWidth={1}
        width={labelWidth}
        x={x - labelWidth / 2}
        y={labelY}
      />
      <SvgText
        fill={isActive ? colors.accentStrong : colors.textPrimary}
        fontSize={11}
        fontWeight="700"
        textAnchor="middle"
        x={x}
        y={textY}
      >
        {label}
      </SvgText>
    </>
  );
}

function TooltipEl({
  chartWidth,
  chartTop,
  label,
  x,
  y,
}: {
  chartWidth: number;
  chartTop: number;
  label: string;
  x: number;
  y: number;
}) {
  const tooltipWidth = label.length * 7 + 16;
  const tooltipHeight = 24;
  const topCandidate = y - tooltipHeight - 10;
  const tooltipY = topCandidate < chartTop ? y + 18 : topCandidate;
  let tooltipX = x - tooltipWidth / 2;

  // Clamp within chart
  tooltipX = Math.max(8, Math.min(tooltipX, chartWidth - 8 - tooltipWidth));

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
    minHeight: CHART_HEIGHT,
  },
  empty: {
    alignItems: "center",
    height: 80,
    justifyContent: "center",
  },
  svg: {
    overflow: "visible",
  },
});
