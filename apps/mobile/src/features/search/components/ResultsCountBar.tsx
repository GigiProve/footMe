import { StyleSheet, View } from "react-native";

import { spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";

type ResultsCountBarProps = {
  filtersActiveCount: number;
  label: string | null;
  onFiltersPress: () => void;
  onSortPress: () => void;
  showFilters: boolean;
  sortActive: boolean;
};

export function ResultsCountBar({
  filtersActiveCount,
  label,
  onFiltersPress,
  onSortPress,
  showFilters,
  sortActive,
}: ResultsCountBarProps) {
  return (
    <View style={styles.row}>
      <AppText color="secondary" numberOfLines={1} style={styles.label} variant="bodySm">
        {label ?? ""}
      </AppText>

      <View style={styles.actions}>
        {showFilters ? (
          <Button
            label={filtersActiveCount > 0 ? `Filtri (${filtersActiveCount})` : "Filtri"}
            onPress={onFiltersPress}
            selected={filtersActiveCount > 0}
            size="sm"
            variant="link"
          />
        ) : null}
        <Button
          label="Ordina"
          onPress={onSortPress}
          selected={sortActive}
          size="sm"
          variant="link"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
  },
  label: {
    flex: 1,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[8],
  },
});
