import { StyleSheet, View } from "react-native";

import { AppText } from "../AppText/AppText";
import { colors, radius, spacing } from "../../styles";

type NotificationBadgeProps = {
  count: number;
};

export function NotificationBadge({ count }: NotificationBadgeProps) {
  if (count <= 0) return null;

  const display = count > 99 ? "99+" : String(count);

  return (
    <View style={styles.badge}>
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
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[6],
  },
  text: {
    fontSize: 11,
    lineHeight: 14,
  },
});
