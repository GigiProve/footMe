import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { Button } from "../../../ui";
import { buildClubActiveChips } from "../club-filters/club-filter-helpers";
import type { ClubFiltersState } from "../club-filters/club-filter-types";

type ClubQuickFilterChipsProps = {
  activeFiltersCount: number;
  filters: ClubFiltersState;
  onChange: (next: ClubFiltersState) => void;
  onOpenFilters: () => void;
};

export function ClubQuickFilterChips({
  activeFiltersCount,
  filters,
  onChange,
  onOpenFilters,
}: ClubQuickFilterChipsProps) {
  const chips = buildClubActiveChips(filters);

  return (
    <ScrollView
      contentContainerStyle={styles.row}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
    >
      {chips.map((chip) => (
        <View key={chip.id} style={styles.chipWrap}>
          <Button
            label={chip.label}
            onPress={() => onChange(chip.remove(filters))}
            selected
            size="sm"
            style={styles.compact}
            variant="chipAction"
          />
          <Pressable
            accessibilityLabel={`Rimuovi filtro ${chip.label}`}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => onChange(chip.remove(filters))}
            style={styles.removeBadge}
          >
            <Ionicons color={colors.accent} name="close" size={11} />
          </Pressable>
        </View>
      ))}

      <Button
        label={activeFiltersCount > 0 ? `Filtri (${activeFiltersCount})` : "Filtri"}
        leftIcon={
          <Ionicons color={colors.textSecondary} name="options-outline" size={14} />
        }
        onPress={onOpenFilters}
        selected={activeFiltersCount > 0}
        size="sm"
        style={[styles.chip, styles.compact]}
        variant="chipAction"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: {
    marginRight: spacing[8],
  },
  chipWrap: {
    marginRight: spacing[8],
    position: "relative",
  },
  compact: {
    minHeight: 34,
    paddingHorizontal: spacing[12],
  },
  removeBadge: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.accent,
    borderRadius: radius.full,
    borderWidth: 1,
    height: 16,
    justifyContent: "center",
    position: "absolute",
    right: -6,
    top: -6,
    width: 16,
  },
  row: {
    alignItems: "center",
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[8],
  },
  scroll: {
    flexGrow: 0,
    marginHorizontal: -spacing[20],
  },
});
