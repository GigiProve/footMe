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
    >
      {options.map((option) => (
        <Button
          key={option.label}
          label={option.label}
          onPress={() => onChange(option.value)}
          selected={value === option.value}
          size="sm"
          style={styles.chip}
          variant="chipAction"
        />
      ))}
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
  chip: {
    marginRight: spacing[8],
  },
  row: {
    paddingVertical: spacing[4],
  },
});
