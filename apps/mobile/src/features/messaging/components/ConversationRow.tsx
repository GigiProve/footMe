import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing, typography } from "../../../theme/tokens";
import { AppText, Avatar } from "../../../ui";
import { GroupAvatar } from "../../dashboard/groups/components/GroupAvatar";
import { conversationRowA11yLabel } from "../inbox-helpers";

/*
  DAS-REV-32 §12: nessuna label tecnica «Diretta»/«Gruppo» sulla riga; il tipo
  si legge dall'avatar. I gruppi organizzativi con immagine usano GroupAvatar
  (URL firmato da bucket privato), tutte le altre righe restano invariate.
*/
type ConversationRowProps = {
  avatarUrl?: string | null;
  groupAvatarPath?: string | null;
  isGroup?: boolean;
  /**
   * DAS-REV-34 §10: conversazione silenziata. Una piccola icona accanto al
   * timestamp, compresente col badge dei non letti (mai al posto suo, QA-026).
   */
  isMuted?: boolean;
  lastMessage: string;
  name: string;
  onPress: () => void;
  /** DAS-REV-33 §21: metadata neutro («Archiviato») di un gruppo archiviato; non tocca gli unread. */
  statusLabel?: string | null;
  timestamp: string;
  unreadCount: number;
};

export function ConversationRow({
  avatarUrl,
  groupAvatarPath = null,
  isGroup = false,
  isMuted = false,
  lastMessage,
  name,
  onPress,
  statusLabel = null,
  timestamp,
  unreadCount,
}: ConversationRowProps) {
  const hasUnread = unreadCount > 0;

  return (
    <Pressable
      accessibilityLabel={conversationRowA11yLabel({ isMuted, name, statusLabel, unreadCount })}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        hasUnread ? styles.rowUnread : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.avatarWrapper}>
        {isGroup && groupAvatarPath ? (
          <GroupAvatar name={name} path={groupAvatarPath} size="lg" />
        ) : (
          <Avatar name={name} size="lg" square={isGroup} uri={avatarUrl} />
        )}
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
          <View style={styles.meta}>
            {isMuted ? (
              <Ionicons
                color={colors.textMuted}
                name="notifications-off-outline"
                size={13}
                testID="conversation-row-muted"
              />
            ) : null}
            <AppText variant="caption" color="muted" style={styles.timestamp}>
              {statusLabel ? `${statusLabel} · ${timestamp}` : timestamp}
            </AppText>
          </View>
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
          ) : null}
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
  meta: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
    marginLeft: spacing[8],
  },
  timestamp: {
    fontSize: typography.fontSize[11],
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
    // DAS-REV-34 §6: i badge usano l'accent standard (PNG 03/04), non il rosso.
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
