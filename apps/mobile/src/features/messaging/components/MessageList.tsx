import type { ReactNode } from "react";
import { FlatList, StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../theme/tokens";
import type { ChatListItem } from "../chat-helpers";
import { DateSeparator } from "./DateSeparator";
import { MessageBubble } from "./MessageBubble";
import { SystemEventMessage } from "./SystemEventMessage";

type MessageListProps = {
  /** Mostrato al posto della lista quando non c'è alcun messaggio (non è un messaggio). */
  emptyState?: ReactNode;
  items: ChatListItem[];
  myProfileId: string;
  onCopyContactPhone: (phone: string) => void;
  /** Nei GROUP il nome del mittente compare sopra le bolle altrui (PNG 14). */
  showSenderNames?: boolean;
};

export function MessageList({
  emptyState,
  items,
  myProfileId,
  onCopyContactPhone,
  showSenderNames = false,
}: MessageListProps) {
  // Una FlatList inverted capovolge anche ListEmptyComponent: lo stato vuoto
  // sta fuori dalla lista.
  if (emptyState && items.length === 0) {
    return <View style={styles.empty}>{emptyState}</View>;
  }

  return (
    <FlatList
      contentContainerStyle={styles.content}
      data={items}
      inverted
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => {
        if (item.type === "separator") {
          return <DateSeparator label={item.label} />;
        }

        // DAS-REV-33 §24: l'evento di sistema non è una bolla.
        if (item.message.message_kind === "system_event") {
          return <SystemEventMessage message={item.message} />;
        }

        return (
          <MessageBubble
            isOwnMessage={item.message.sender_profile_id === myProfileId}
            message={item.message}
            onCopyContactPhone={onCopyContactPhone}
            senderName={showSenderNames ? (item.message.sender_full_name ?? undefined) : undefined}
          />
        );
      }}
      style={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  empty: {
    backgroundColor: colors.chatBackground,
    flex: 1,
  },
  content: {
    padding: spacing[16],
  },
  list: {
    backgroundColor: colors.chatBackground,
    flex: 1,
  },
});
