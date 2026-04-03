import { Pressable, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

type CommunityChipGroupProps = {
  multiple?: boolean;
  onToggle: (value: string) => void;
  options: readonly ({ label: string; value: string } | string)[];
  selectedValues: string[];
};

export function CommunityChipGroup({
  multiple = true,
  onToggle,
  options,
  selectedValues,
}: CommunityChipGroupProps) {
  return (
    <View style={styles.row}>
      {options.map((option) => {
        const value = typeof option === "string" ? option : option.value;
        const label = typeof option === "string" ? option : option.label;
        const isSelected = selectedValues.includes(value);
        return (
          <Pressable
            accessibilityRole={multiple ? "checkbox" : "radio"}
            accessibilityState={
              multiple ? { checked: isSelected } : { selected: isSelected }
            }
            key={value}
            onPress={() => onToggle(value)}
            style={[styles.chip, isSelected ? styles.chipActive : null]}
          >
            <AppText
              variant="bodySm"
              style={isSelected ? styles.chipTextActive : styles.chipText}
            >
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: "transparent",
    borderRadius: radius.full,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: spacing[14],
  },
  chipActive: {
    backgroundColor: colors.accentSoft,
    borderColor: "rgba(10,102,194,0.18)",
  },
  chipText: {
    color: colors.textPrimary,
    fontWeight: "600",
  },
  chipTextActive: {
    color: colors.accentStrong,
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
});
