import { Pressable, StyleSheet, View } from "react-native";

import { colors, spacing, typography } from "../../../theme/tokens";
import { AppText, Avatar } from "../../../ui";

type ConversationRowProps = {
  avatarUrl?: string | null;
  lastMessage: string;
  name: string;
  onPress: () => void;
  timestamp: string;
  unreadCount: number;
};

export function ConversationRow({
  avatarUrl,
  lastMessage,
  name,
  onPress,
  timestamp,
  unreadCount,
}: ConversationRowProps) {
  const hasUnread = unreadCount > 0;

  return (
    <Pressable
      accessibilityLabel={`Conversazione con ${name}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <Avatar name={name} size="lg" uri={avatarUrl} />
      <View style={styles.body}>
        <View style={styles.topLine}>
          <AppText numberOfLines={1} style={styles.nameText} variant="titleSm">
            {name}
          </AppText>
          <AppText variant="caption" color="muted" style={styles.timestamp}>
            {timestamp}
          </AppText>
        </View>
        <AppText
          color={hasUnread ? "primary" : "muted"}
          numberOfLines={1}
          variant="bodySm"
        >
          {lastMessage}
        </AppText>
      </View>
      {hasUnread ? (
        <View style={styles.unreadBadge}>
          <AppText variant="caption" color="inverse" style={styles.unreadText}>
            {unreadCount > 99 ? "99+" : String(unreadCount)}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pressed: {
    opacity: 0.7,
  },
  body: {
    flex: 1,
    gap: spacing[4],
  },
  topLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  nameText: {
    flex: 1,
  },
  timestamp: {
    fontSize: typography.fontSize[11],
    marginLeft: spacing[8],
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[6],
  },
  unreadText: {
    fontSize: typography.fontSize[11],
    lineHeight: 14,
  },
});
