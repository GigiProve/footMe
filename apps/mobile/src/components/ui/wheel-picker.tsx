import { memo, useEffect, useMemo, useRef } from "react";
import { Animated, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, typography } from "../../theme/tokens";

const ITEM_HEIGHT_DEFAULT = 52;
const ITEM_HEIGHT_COMPACT = 40;
const VISIBLE_ITEMS_DEFAULT = 5;
const VISIBLE_ITEMS_COMPACT = 3;

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

type WheelPickerItemProps = {
  compact: boolean;
  entry: number;
  index: number;
  itemHeight: number;
  scrollY: Animated.Value;
  unit?: string;
};

const WheelPickerItem = memo(function WheelPickerItem({
  compact,
  entry,
  index,
  itemHeight,
  scrollY,
  unit,
}: WheelPickerItemProps) {
  const center = index * itemHeight;
  const inputRange = [
    center - 2 * itemHeight,
    center - itemHeight,
    center,
    center + itemHeight,
    center + 2 * itemHeight,
  ];

  const opacity = scrollY.interpolate({
    inputRange,
    outputRange: [0.25, 0.6, 1, 0.6, 0.25],
    extrapolate: "clamp",
  });

  const scale = scrollY.interpolate({
    inputRange,
    outputRange: [0.78, 0.9, 1.06, 0.9, 0.78],
    extrapolate: "clamp",
  });

  return (
    <Animated.View
      style={{
        height: itemHeight,
        alignItems: "center",
        justifyContent: "center",
        opacity,
        transform: [{ scale }],
      }}
    >
      <Text
        style={compact ? styles.valueTextSelectedCompact : styles.valueTextSelected}
        testID={unit ? `wheel-picker-value-${unit}-${entry}` : undefined}
      >
        {entry}
      </Text>
    </Animated.View>
  );
});

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
  const scrollY = useRef(new Animated.Value(0)).current;

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
    if (selectedIndex < 0) return;

    const nextOffset = selectedIndex * itemHeight;
    scrollY.setValue(nextOffset);
    scrollViewRef.current?.scrollTo({ animated: false, y: nextOffset });
  }, [itemHeight, scrollY, selectedValue, values]);

  function commitOffset(offsetY: number) {
    const rawIndex = Math.round(offsetY / itemHeight);
    const safeIndex = clampValue(rawIndex, 0, values.length - 1);
    const nextValue = values[safeIndex];
    if (nextValue !== value) {
      onChange(nextValue);
    }
  }

  return (
    <View style={styles.wrapper}>
      {label ? (
        <Text style={compact ? styles.labelCompact : styles.label}>{label}</Text>
      ) : null}
      <View style={[styles.surface, { height: pickerHeight }, compact ? styles.surfaceCompact : null]}>
        <View
          pointerEvents="none"
          style={[
            styles.selectionWindow,
            { top: edgePadding, height: itemHeight },
            compact ? styles.selectionWindowCompact : null,
          ]}
        />
        <Animated.ScrollView
          contentContainerStyle={{ paddingVertical: edgePadding }}
          decelerationRate="fast"
          onMomentumScrollEnd={(event) =>
            commitOffset(event.nativeEvent.contentOffset.y)
          }
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true },
          )}
          onScrollEndDrag={(event) =>
            commitOffset(event.nativeEvent.contentOffset.y)
          }
          ref={scrollViewRef}
          scrollEventThrottle={8}
          showsVerticalScrollIndicator={false}
          snapToAlignment="start"
          snapToInterval={itemHeight}
          testID={unit ? `wheel-picker-${unit}` : undefined}
        >
          {values.map((entry, index) => (
            <WheelPickerItem
              compact={compact}
              entry={entry}
              index={index}
              itemHeight={itemHeight}
              key={entry}
              scrollY={scrollY}
              unit={unit}
            />
          ))}
        </Animated.ScrollView>
        {unit ? (
          <View
            style={[styles.unitBadge, { top: edgePadding + spacing[14] }]}
            testID={`wheel-picker-unit-${unit}`}
          >
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
    borderRadius: radius[12],
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  surfaceCompact: {
    borderRadius: radius[12],
  },
  selectionWindow: {
    position: "absolute",
    left: spacing[12],
    right: spacing[12],
    borderRadius: radius[12],
    borderWidth: 1,
    borderColor: colors.accentStrong,
    backgroundColor: colors.accentSoft,
  },
  selectionWindowCompact: {
    left: spacing[8],
    right: spacing[8],
    borderRadius: radius[12],
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
