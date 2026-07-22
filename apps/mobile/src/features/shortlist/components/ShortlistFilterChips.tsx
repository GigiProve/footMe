import { ScrollView, StyleSheet } from "react-native";

import { Button } from "../../../ui";
import { spacing } from "../../../theme/tokens";

export type ShortlistEntryFilter =
  | "all"
  | "alta_priorita"
  | "da_valutare"
  | "da_contattare"
  | "contattato"
  | "scartato";

const FILTERS: { label: string; value: ShortlistEntryFilter }[] = [
  { label: "Tutti", value: "all" },
  { label: "Alta priorità", value: "alta_priorita" },
  { label: "Da valutare", value: "da_valutare" },
  { label: "Da contattare", value: "da_contattare" },
  { label: "Contattati", value: "contattato" },
  { label: "Scartati", value: "scartato" },
];

type ShortlistFilterChipsProps = {
  onChange: (value: ShortlistEntryFilter) => void;
  value: ShortlistEntryFilter;
};

export function ShortlistFilterChips({
  onChange,
  value,
}: ShortlistFilterChipsProps) {
  return (
    <ScrollView
      contentContainerStyle={styles.row}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {FILTERS.map((filter) => (
        <Button
          key={filter.value}
          label={filter.label}
          onPress={() => onChange(filter.value)}
          selected={value === filter.value}
          size="sm"
          style={styles.chip}
          variant="chipAction"
        />
      ))}
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
