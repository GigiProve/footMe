import { StyleSheet, View } from "react-native";

import { spacing } from "../../../theme/tokens";
import { Button } from "../../../ui";

type InlineSafetyRowProps = {
  onArchive: () => void;
  onBlock: () => void;
  onReport: () => void;
};

export function InlineSafetyRow({ onArchive, onBlock, onReport }: InlineSafetyRowProps) {
  return (
    <View style={styles.row}>
      <Button label="Archivia chat" onPress={onArchive} size="sm" variant="chipAction" />
      <Button destructive label="Blocca utente" onPress={onBlock} size="sm" variant="chipAction" />
      <Button destructive label="Segnala" onPress={onReport} size="sm" variant="chipAction" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
    paddingHorizontal: spacing[16],
    paddingTop: spacing[8],
  },
});
