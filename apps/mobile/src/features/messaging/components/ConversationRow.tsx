import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing, typography } from "../../../theme/tokens";
import { AppText, Avatar } from "../../../ui";

type ConversationRowProps = {
  avatarUrl?: string | null;
  isGroup?: boolean;
  lastMessage: string;
  name: string;
  onPress: () => void;
  timestamp: string;
  typeLabel: string;
  unreadCount: number;
};

export function ConversationRow({
  avatarUrl,
  isGroup = false,
  lastMessage,
  name,
  onPress,
  timestamp,
  typeLabel,
  unreadCount,
}: ConversationRowProps) {
  const hasUnread = unreadCount > 0;

  return (
    <Pressable
      accessibilityLabel={`Conversazione con ${name}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        hasUnread ? styles.rowUnread : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.avatarWrapper}>
        <Avatar name={name} size="lg" square={isGroup} uri={avatarUrl} />
        {isGroup ? (
          <View style={styles.overlayBadge}>
            <Ionicons color={colors.inkInvert} name="people" size={10} />
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <View style={styles.topLine}>
          <AppText numberOfLines={1} style={styles.nameText} variant="titleSm">
            {name}
          </AppText>
          <AppText variant="caption" color="muted" style={styles.timestamp}>
            {timestamp}
          </AppText>
        </View>
        <View style={styles.bottomLine}>
          <AppText
            color={hasUnread ? "primary" : "muted"}
            numberOfLines={1}
            style={[styles.preview, hasUnread ? styles.previewUnread : null]}
            variant="bodySm"
          >
            {lastMessage}
          </AppText>
          {hasUnread ? (
            <View style={styles.unreadBadge}>
              <AppText variant="caption" color="inverse" style={styles.unreadText}>
                {unreadCount > 99 ? "99+" : String(unreadCount)}
              </AppText>
            </View>
          ) : (
            <View style={styles.typeTag}>
              <AppText color="secondary" style={styles.typeTagText} variant="overline">
                {typeLabel}
              </AppText>
            </View>
          )}
        </View>
      </View>
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
  rowUnread: {
    backgroundColor: colors.surfaceMuted,
  },
  pressed: {
    opacity: 0.7,
  },
  avatarWrapper: {
    position: "relative",
  },
  overlayBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface,
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
  bottomLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[8],
  },
  preview: {
    flex: 1,
  },
  previewUnread: {
    fontWeight: "600",
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[6],
  },
  unreadText: {
    fontSize: typography.fontSize[11],
    lineHeight: 14,
  },
  typeTag: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 4,
    paddingHorizontal: spacing[6],
    paddingVertical: 2,
  },
  typeTagText: {
    fontSize: typography.fontSize[10],
    lineHeight: 12,
  },
});
