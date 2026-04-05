import { Pressable, StyleSheet, View } from "react-native";

import { colors, radius, shadows, spacing, typography } from "../../../theme/tokens";
import { AppText } from "../../../ui";

type SegmentedControlOption<T extends string> = {
  label: string;
  value: T;
};

type SegmentedControlProps<T extends string> = {
  onChange: (value: T) => void;
  options: readonly SegmentedControlOption<T>[];
  value: T;
};

export function SegmentedControl<T extends string>({
  onChange,
  options,
  value,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.container}>
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <Pressable
            accessibilityLabel={opt.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.tab, isActive ? styles.tabActive : styles.tabInactive]}
          >
            <AppText
              color={isActive ? "primary" : "muted"}
              style={isActive ? styles.labelActive : styles.label}
              variant="bodySm"
            >
              {opt.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[6],
    flexDirection: "row",
    gap: spacing[4],
    padding: spacing[4],
  },
  label: {
    fontWeight: typography.fontWeight.semibold,
  },
  labelActive: {
    fontWeight: typography.fontWeight.semibold,
  },
  tab: {
    alignItems: "center",
    borderRadius: radius[4],
    flex: 1,
    height: 40,
    justifyContent: "center",
  },
  tabActive: {
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  tabInactive: {
    backgroundColor: "transparent",
  },
});
