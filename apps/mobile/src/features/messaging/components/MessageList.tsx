import { FlatList, StyleSheet } from "react-native";

import { colors, spacing } from "../../../theme/tokens";
import type { ChatListItem } from "../chat-helpers";
import { DateSeparator } from "./DateSeparator";
import { MessageBubble } from "./MessageBubble";

type MessageListProps = {
  items: ChatListItem[];
  myProfileId: string;
  onCopyContactPhone: (phone: string) => void;
};

export function MessageList({ items, myProfileId, onCopyContactPhone }: MessageListProps) {
  return (
    <FlatList
      contentContainerStyle={styles.content}
      data={items}
      inverted
      keyExtractor={(item) => item.id}
      renderItem={({ item }) =>
        item.type === "separator" ? (
          <DateSeparator label={item.label} />
        ) : (
          <MessageBubble
            isOwnMessage={item.message.sender_profile_id === myProfileId}
            message={item.message}
            onCopyContactPhone={onCopyContactPhone}
          />
        )
      }
      style={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing[16],
  },
  list: {
    backgroundColor: colors.chatBackground,
    flex: 1,
  },
});
