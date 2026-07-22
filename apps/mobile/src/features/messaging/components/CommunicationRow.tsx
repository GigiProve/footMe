import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing, typography } from "../../../theme/tokens";
import { AppText, Avatar } from "../../../ui";
import { formatRelativeTime } from "../../../lib/relative-time";
import type { CommunicationSummary } from "../communications-service";
import { CommunicationCategoryBadge } from "./CommunicationCategoryBadge";

type CommunicationRowProps = {
  communication: CommunicationSummary;
  onPress: () => void;
};

export function CommunicationRow({
  communication,
  onPress,
}: CommunicationRowProps) {
  const hasUnread = !communication.is_read;

  return (
    <Pressable
      accessibilityLabel={`Comunicazione di ${communication.sender_name}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        hasUnread ? styles.rowUnread : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.avatarWrapper}>
        <Avatar name={communication.sender_name} size="lg" uri={communication.sender_logo_url} />
        <View style={styles.overlayBadge}>
          <Ionicons color={colors.inkInvert} name="megaphone" size={10} />
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.topLine}>
          <AppText numberOfLines={1} style={styles.nameText} variant="titleSm">
            {communication.sender_name}
          </AppText>
          <AppText variant="caption" color="muted" style={styles.timestamp}>
            {formatRelativeTime(communication.published_at)}
          </AppText>
        </View>
        <View style={styles.previewLine}>
          <AppText
            color={hasUnread ? "primary" : "muted"}
            numberOfLines={1}
            style={[styles.preview, hasUnread ? styles.previewUnread : null]}
            variant="bodySm"
          >
            {communication.preview}
          </AppText>
          <CommunicationCategoryBadge category={communication.category} />
        </View>
        {communication.cta_label ? (
          <AppText color="accent" variant="caption" style={styles.ctaText}>
            {communication.cta_label} →
          </AppText>
        ) : (
          <AppText color="muted" variant="overline">
            Senza risposta
          </AppText>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
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
  previewLine: {
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
  ctaText: {
    fontWeight: typography.fontWeight.bold,
  },
});
