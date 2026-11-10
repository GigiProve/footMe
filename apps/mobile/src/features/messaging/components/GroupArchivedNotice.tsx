/**
 * Riga discreta che prende il posto del composer in una chat di gruppo
 * archiviata (DAS-REV-33 §21, PNG 17): nessun input, plus, microfono o invio,
 * neppure disabilitati.
 */
import { StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { GROUP_CHAT_COPY } from "../group-chat-presentation";

export function GroupArchivedNotice() {
  return (
    <View style={styles.bar}>
      <AppText color="muted" style={styles.text} variant="bodySm">
        {GROUP_CHAT_COPY.archivedNotice}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[16],
  },
  text: {
    textAlign: "center",
  },
});
