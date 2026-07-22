import { StyleSheet, View } from "react-native";

import { AppText } from "../AppText/AppText";
import { colors, radius, spacing } from "../../styles";

type NotificationBadgeProps = {
  count: number;
  tone?: "danger" | "accent";
};

export function NotificationBadge({ count, tone = "danger" }: NotificationBadgeProps) {
  if (count <= 0) return null;

  const display = count > 99 ? "99+" : String(count);

  return (
    <View
      style={[styles.badge, tone === "accent" ? styles.badgeAccent : styles.badgeDanger]}
    >
      <AppText variant="caption" color="inverse" style={styles.text}>
        {display}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[6],
  },
  badgeDanger: {
    backgroundColor: colors.danger,
  },
  badgeAccent: {
    backgroundColor: colors.accent,
  },
  text: {
    fontSize: 11,
    lineHeight: 14,
  },
});
