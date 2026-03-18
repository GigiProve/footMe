import { useEffect, useMemo, useRef } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, radius, sizes, spacing, typography } from "../../theme/tokens";

const ITEM_HEIGHT = 52;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const EDGE_PADDING = ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2);

type WheelPickerProps = {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step?: number;
  unit: "cm" | "kg";
  value: number | null | undefined;
};

function clampValue(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function WheelPicker({
  label,
  max,
  min,
  onChange,
  step = 1,
  unit,
  value,
}: WheelPickerProps) {
  const scrollViewRef = useRef<ScrollView>(null);
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

    scrollViewRef.current?.scrollTo({
      animated: false,
      y: selectedIndex * ITEM_HEIGHT,
    });
  }, [selectedValue, values]);

  function commitOffset(offsetY: number) {
    const rawIndex = Math.round(offsetY / ITEM_HEIGHT);
    const safeIndex = clampValue(rawIndex, 0, values.length - 1);
    const nextValue = values[safeIndex];

    if (nextValue !== value) {
      onChange(nextValue);
    }
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.surface}>
        <View pointerEvents="none" style={styles.selectionWindow} />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          decelerationRate="fast"
          onMomentumScrollEnd={(event) => commitOffset(event.nativeEvent.contentOffset.y)}
          onScrollEndDrag={(event) => commitOffset(event.nativeEvent.contentOffset.y)}
          ref={scrollViewRef}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          testID={`wheel-picker-${unit}`}
        >
          {values.map((entry) => {
            const isSelected = entry === selectedValue;

            return (
              <View key={entry} style={styles.valueRow}>
                <Text style={[styles.valueText, isSelected ? styles.valueTextSelected : null]}>
                  {entry}
                </Text>
              </View>
            );
          })}
        </ScrollView>
        <View style={styles.unitBadge}>
          <Text style={styles.unitBadgeText}>{unit}</Text>
        </View>
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
  surface: {
    height: PICKER_HEIGHT,
    overflow: "hidden",
    borderRadius: radius[20],
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selectionWindow: {
    position: "absolute",
    left: spacing[12],
    right: spacing[12],
    top: EDGE_PADDING,
    height: ITEM_HEIGHT,
    borderRadius: radius[16],
    borderWidth: 1,
    borderColor: colors.accentStrong,
    backgroundColor: colors.accentSoft,
  },
  scrollContent: {
    paddingVertical: EDGE_PADDING,
  },
  valueRow: {
    height: ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
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
  unitBadge: {
    position: "absolute",
    top: EDGE_PADDING + spacing[8],
    right: spacing[16],
    minWidth: sizes.touchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
    backgroundColor: colors.hero,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
  },
  unitBadgeText: {
    color: colors.inkInvert,
    fontWeight: typography.fontWeight.bold,
  },
  helperText: {
    color: colors.textSecondary,
    lineHeight: typography.lineHeight[22],
  },
});
