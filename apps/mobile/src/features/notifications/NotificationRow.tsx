import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../styles";
import { AppText } from "../../ui";
import { formatRelativeTime } from "../../lib/relative-time";
import type { AppNotification } from "../clubs/membership-types";
import {
  ctaLabelFor,
  iconNameForCategory,
  resolveNotificationCategory,
} from "./notifications-helpers";

type NotificationRowProps = {
  notification: AppNotification;
  onPress: (notification: AppNotification) => void;
};

export function NotificationRow({ notification, onPress }: NotificationRowProps) {
  const category = resolveNotificationCategory(notification);
  const iconName = iconNameForCategory(
    category,
  ) as keyof typeof Ionicons.glyphMap;
  const isUnread = !notification.is_read;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(notification)}
      style={({ pressed }) => [
        styles.container,
        isUnread ? styles.unread : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.iconCircle}>
        <Ionicons color={colors.accent} name={iconName} size={20} />
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <AppText
            numberOfLines={1}
            style={styles.title}
            variant={isUnread ? "titleSm" : "bodyLg"}
          >
            {notification.title}
          </AppText>
          {isUnread ? <View style={styles.dot} /> : null}
        </View>
        {notification.body ? (
          <AppText color="secondary" numberOfLines={2} variant="bodySm">
            {notification.body}
          </AppText>
        ) : null}
        <View style={styles.metaRow}>
          <AppText color="muted" variant="caption">
            {formatRelativeTime(notification.created_at)}
          </AppText>
          <AppText color="accent" variant="caption" style={styles.cta}>
            {ctaLabelFor(notification)}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[14],
    borderRadius: radius[12],
  },
  unread: {
    backgroundColor: colors.heroSoft,
  },
  pressed: {
    opacity: 0.82,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  body: {
    flex: 1,
    gap: spacing[4],
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[8],
  },
  title: {
    flexShrink: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing[4],
  },
  cta: {
    fontWeight: "600",
  },
});
