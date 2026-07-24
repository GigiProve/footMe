import { ScrollView, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Button } from "../../../ui";
import { colors, spacing } from "../../../theme/tokens";

type SearchFilterChipsOption<T> = {
  label: string;
  value: T | null;
};

type SearchFilterChipsProps<T extends string> = {
  onChange: (value: T | null) => void;
  onFiltersPress?: () => void;
  options: SearchFilterChipsOption<T>[];
  value: T | null;
};

export function SearchFilterChips<T extends string>({
  onChange,
  onFiltersPress,
  options,
  value,
}: SearchFilterChipsProps<T>) {
  return (
    <ScrollView
      contentContainerStyle={styles.row}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
    >
      {options.map((option) => {
        const selected = value === option.value;

        return (
          <Button
            key={option.label}
            label={option.label}
            onPress={() => onChange(option.value)}
            selected={selected}
            size="sm"
            style={[styles.chip, selected ? styles.chipSelected : null]}
            textStyle={selected ? styles.chipSelectedLabel : undefined}
            variant="chipAction"
          />
        );
      })}
      {onFiltersPress ? (
        <Button
          label="Filtri"
          leftIcon={
            <Ionicons color={colors.textSecondary} name="options-outline" size={14} />
          }
          onPress={onFiltersPress}
          size="sm"
          style={styles.chip}
          variant="chipAction"
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Compact pills per the Banani spec (34px, 12px sides) instead of the
  // 44px touch-target default of Button sm.
  chip: {
    marginRight: spacing[8],
    minHeight: 34,
    paddingHorizontal: spacing[12],
  },
  // Primary (category) row: the active tab gets a solid accent fill so it
  // reads stronger than the soft-accent quick-filter chips below it.
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipSelectedLabel: {
    color: colors.inkInvert,
  },
  row: {
    alignItems: "center",
    // Let the row bleed to the screen edge (Screen pads by spacing[20]) so
    // scrolled-out chips are clipped by the display, not mid-content.
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[4],
  },
  // A ScrollView in a flex column grabs the leftover vertical space by
  // default, stretching the pills with it (giant chips on sparse screens).
  scroll: {
    flexGrow: 0,
    marginBottom: spacing[4],
    marginHorizontal: -spacing[20],
  },
});
