/**
 * Chat lato bloccato (HOM-12 §105–§109, §246, Screen Master 6): avviso neutro sopra il
 * composer disabilitato. Nessun rosso (§109), nessun motivo (§107), nessun «Sblocca»
 * (§108): il bloccato non può rimuovere un Block creato dall'altra identità.
 * Semanticamente esplicito per lo screen reader (§246).
 */

import { StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { BLOCK_COPY } from "../blocking-presentation";

export function ChatBlockedNotice() {
  return (
    <View
      accessibilityLabel={BLOCK_COPY.blockedChatNotice}
      accessibilityRole="alert"
      accessible
      style={styles.row}
      testID="chat-blocked-notice"
    >
      <AppText align="center" color="muted" variant="bodySm">
        {BLOCK_COPY.blockedChatNotice}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[10],
  },
});
