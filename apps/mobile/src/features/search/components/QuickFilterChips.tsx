import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { Button } from "../../../ui";
import {
  QUICK_CHIPS,
  type FilterSectionId,
} from "../profile-filters/profile-filter-configs";
import { resetSection } from "../profile-filters/profile-filter-helpers";
import type { ProfileFiltersState } from "../profile-filters/profile-filter-types";
import type { SearchProfileRole } from "../search-types";

type QuickFilterChipsProps = {
  activeFiltersCount: number;
  filters: ProfileFiltersState;
  onChange: (next: ProfileFiltersState) => void;
  onOpenFilters: () => void;
  onOpenSection: (id: FilterSectionId) => void;
  role: SearchProfileRole;
};

export function QuickFilterChips({
  activeFiltersCount,
  filters,
  onChange,
  onOpenFilters,
  onOpenSection,
  role,
}: QuickFilterChipsProps) {
  const chips = QUICK_CHIPS[role];

  return (
    <ScrollView
      contentContainerStyle={styles.row}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
    >
      {chips.map((chip) => {
        const active = chip.isActive(filters);
        const label = chip.getLabel(filters);

        function handlePress() {
          if (chip.action.kind === "toggle") {
            onChange(active ? chip.action.remove(filters) : chip.action.apply(filters));
            return;
          }
          onOpenSection(chip.action.sectionId);
        }

        function handleRemove() {
          if (chip.action.kind === "toggle") {
            onChange(chip.action.remove(filters));
            return;
          }
          onChange(resetSection(role, chip.action.sectionId, filters));
        }

        return (
          <View key={chip.id} style={styles.chipWrap}>
            <Button
              label={label}
              onPress={handlePress}
              selected={active}
              size="sm"
              style={styles.compact}
              variant="chipAction"
            />
            {active ? (
              <Pressable
                accessibilityLabel={`Rimuovi filtro ${label}`}
                accessibilityRole="button"
                hitSlop={8}
                onPress={handleRemove}
                style={styles.removeBadge}
              >
                <Ionicons color={colors.accent} name="close" size={11} />
              </Pressable>
            ) : null}
          </View>
        );
      })}

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
  // Compact pills per the Banani spec (34px, 12px sides).
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
    // Bleed to the screen edge (Screen pads by spacing[20]); the vertical
    // padding leaves room for the remove badge that overflows the chip top.
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[8],
  },
  // Keep the horizontal ScrollView from absorbing leftover vertical space
  // (it would stretch the pills on sparse screens).
  scroll: {
    flexGrow: 0,
    marginHorizontal: -spacing[20],
  },
});
