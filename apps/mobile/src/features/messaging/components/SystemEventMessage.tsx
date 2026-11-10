/**
 * Evento di sistema nella timeline di un gruppo (DAS-REV-33 §24, PNG 22):
 * centrato, metadata grigio chiaro, senza avatar, bolla, autore o action row.
 */
import { StyleSheet, View } from "react-native";

import { spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { formatSystemEvent } from "../group-chat-presentation";
import type { ConversationMessage } from "../messaging-service";

export function SystemEventMessage({ message }: { message: ConversationMessage }) {
  return (
    <View style={styles.wrapper}>
      <AppText color="muted" style={styles.text} variant="caption">
        {formatSystemEvent(message.system_event_type, message.system_payload)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  text: {
    textAlign: "center",
  },
  wrapper: {
    alignItems: "center",
    marginBottom: spacing[12],
    paddingHorizontal: spacing[24],
  },
});
