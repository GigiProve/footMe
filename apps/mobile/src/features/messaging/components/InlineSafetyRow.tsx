import { StyleSheet, View } from "react-native";

import { spacing } from "../../../theme/tokens";
import { Button } from "../../../ui";

type InlineSafetyRowProps = {
  /** HOM-12 §15, §241: «Blocca {nome}», come nel menu del profilo e della chat. */
  blockLabel: string;
  onArchive: () => void;
  onBlock: () => void;
  onReport: () => void;
};

export function InlineSafetyRow({ blockLabel, onArchive, onBlock, onReport }: InlineSafetyRowProps) {
  return (
    <View style={styles.row}>
      <Button label="Archivia chat" onPress={onArchive} size="sm" variant="chipAction" />
      <Button destructive label={blockLabel} onPress={onBlock} size="sm" variant="chipAction" />
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
