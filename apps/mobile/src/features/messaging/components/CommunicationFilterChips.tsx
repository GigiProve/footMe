import { ScrollView, StyleSheet } from "react-native";

import { Button } from "../../../ui";
import { spacing } from "../../../theme/tokens";
import { COMMUNICATION_FILTERS, type CommunicationFilter } from "../inbox-helpers";

type CommunicationFilterChipsProps = {
  onChange: (value: CommunicationFilter) => void;
  value: CommunicationFilter;
};

export function CommunicationFilterChips({
  onChange,
  value,
}: CommunicationFilterChipsProps) {
  return (
    <ScrollView
      contentContainerStyle={styles.row}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
    >
      {COMMUNICATION_FILTERS.map((filter) => (
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
    alignItems: "center",
    paddingVertical: spacing[4],
  },
  // In un contenitore flex la ScrollView orizzontale altrimenti si espande
  // in verticale e i chip si stirano a tutta altezza.
  scroll: {
    flexGrow: 0,
  },
});
