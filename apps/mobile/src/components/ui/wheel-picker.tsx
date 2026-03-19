import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, typography } from "../../theme/tokens";

const ITEM_HEIGHT_DEFAULT = 52;
const ITEM_HEIGHT_COMPACT = 40;
const VISIBLE_ITEMS_DEFAULT = 5;
const VISIBLE_ITEMS_COMPACT = 3;
const MAX_INTERPOLATION_DISTANCE = 2;

type WheelPickerProps = {
  compact?: boolean;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step?: number;
  unit?: string;
  value: number | null | undefined;
};

function clampValue(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function WheelPicker({
  compact = false,
  label,
  max,
  min,
  onChange,
  step = 1,
  unit,
  value,
}: WheelPickerProps) {
  const itemHeight = compact ? ITEM_HEIGHT_COMPACT : ITEM_HEIGHT_DEFAULT;
  const visibleItems = compact ? VISIBLE_ITEMS_COMPACT : VISIBLE_ITEMS_DEFAULT;
  const pickerHeight = itemHeight * visibleItems;
  const edgePadding = itemHeight * Math.floor(visibleItems / 2);

  const scrollViewRef = useRef<ScrollView>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const values = useMemo(() => {
    return Array.from({ length: Math.floor((max - min) / step) + 1 }, (_, index) => {
      return min + index * step;
    });
  }, [max, min, step]);
  const fallbackValue = useMemo(() => {
    const midpoint = min + Math.round((max - min) / (step * 2)) * step;
    return clampValue(midpoint, min, max);
  }, [max, min, step]);
  const selectedValue = useMemo(() => {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return fallbackValue;
    }

    return clampValue(value, min, max);
  }, [fallbackValue, max, min, value]);

  useEffect(() => {
    const selectedIndex = values.indexOf(selectedValue);

    if (selectedIndex < 0) {
      return;
    }

    const nextOffset = selectedIndex * itemHeight;
    setScrollOffset(nextOffset);

    scrollViewRef.current?.scrollTo({
      animated: false,
      y: nextOffset,
    });
  }, [itemHeight, selectedValue, values]);

  function commitOffset(offsetY: number) {
    const rawIndex = Math.round(offsetY / itemHeight);
    const safeIndex = clampValue(rawIndex, 0, values.length - 1);
    const nextValue = values[safeIndex];

    if (nextValue !== value) {
      onChange(nextValue);
    }
  }

  const selectedFontSize = compact ? typography.fontSize[20] : typography.fontSize[24];
  const baseFontSize = compact ? typography.fontSize[14] : typography.fontSize[16];

  return (
    <View style={styles.wrapper}>
      <Text style={compact ? styles.labelCompact : styles.label}>{label}</Text>
      <View style={[styles.surface, { height: pickerHeight }, compact ? styles.surfaceCompact : null]}>
        <View
          pointerEvents="none"
          style={[
            styles.selectionWindow,
            { top: edgePadding, height: itemHeight },
            compact ? styles.selectionWindowCompact : null,
          ]}
        />
        <ScrollView
          contentContainerStyle={{ paddingVertical: edgePadding }}
          decelerationRate="fast"
          onMomentumScrollEnd={(event) => commitOffset(event.nativeEvent.contentOffset.y)}
          onScroll={(event) => setScrollOffset(event.nativeEvent.contentOffset.y)}
          onScrollEndDrag={(event) => commitOffset(event.nativeEvent.contentOffset.y)}
          ref={scrollViewRef}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          snapToInterval={itemHeight}
          testID={unit ? `wheel-picker-${unit}` : undefined}
        >
          {values.map((entry, index) => {
            const distanceFromCenter = Math.abs(scrollOffset - index * itemHeight);
            // Beyond two rows away the peripheral values should feel equally de-emphasized,
            // so we cap the interpolation distance to avoid over-attenuating far items.
            const interpolationStep = Math.min(
              distanceFromCenter / itemHeight,
              MAX_INTERPOLATION_DISTANCE,
            );
            const opacity = Math.max(0.32, 1 - interpolationStep * 0.28);
            const scale = Math.max(0.82, 1.08 - interpolationStep * 0.14);
            const fontSize = Math.max(
              baseFontSize,
              selectedFontSize - interpolationStep * 4,
            );
            const isSelected = distanceFromCenter < itemHeight / 2;

            return (
              <View key={entry} style={{ height: itemHeight, alignItems: "center", justifyContent: "center" }}>
                <Text
                  style={[
                    styles.valueText,
                    isSelected ? (compact ? styles.valueTextSelectedCompact : styles.valueTextSelected) : null,
                    {
                      fontSize,
                      opacity,
                      transform: [{ scale }],
                    },
                  ]}
                  testID={unit ? `wheel-picker-value-${unit}-${entry}` : undefined}
                >
                  {entry}
                </Text>
              </View>
            );
          })}
        </ScrollView>
        {unit ? (
          <View style={[styles.unitBadge, { top: edgePadding + spacing[14] }]} testID={`wheel-picker-unit-${unit}`}>
            <Text style={styles.unitBadgeText}>{unit}</Text>
          </View>
        ) : null}
      </View>
      {value === null || value === undefined ? (
        <Text style={styles.helperText}>Scorri la rotella per impostare il valore.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing[8],
  },
  label: {
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.bold,
  },
  labelCompact: {
    color: colors.textPrimary,
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
    textTransform: "uppercase",
  },
  surface: {
    overflow: "hidden",
    borderRadius: radius[20],
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  surfaceCompact: {
    borderRadius: radius[16],
  },
  selectionWindow: {
    position: "absolute",
    left: spacing[12],
    right: spacing[12],
    borderRadius: radius[16],
    borderWidth: 1,
    borderColor: colors.accentStrong,
    backgroundColor: colors.accentSoft,
  },
  selectionWindowCompact: {
    left: spacing[8],
    right: spacing[8],
    borderRadius: radius[14],
  },
  valueText: {
    color: colors.textMuted,
    fontSize: typography.fontSize[18],
    fontWeight: typography.fontWeight.medium,
  },
  valueTextSelected: {
    color: colors.textPrimary,
    fontSize: typography.fontSize[24],
    fontWeight: typography.fontWeight.heavy,
  },
  valueTextSelectedCompact: {
    color: colors.textPrimary,
    fontSize: typography.fontSize[20],
    fontWeight: typography.fontWeight.heavy,
  },
  unitBadge: {
    position: "absolute",
    right: spacing[12],
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.86)",
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[4],
  },
  unitBadgeText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.medium,
  },
  helperText: {
    color: colors.textSecondary,
    lineHeight: typography.lineHeight[22],
  },
});
