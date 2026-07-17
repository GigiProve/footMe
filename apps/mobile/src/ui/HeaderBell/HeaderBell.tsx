import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../styles";
import { NotificationBadge } from "../NotificationBadge/NotificationBadge";

type HeaderBellProps = {
  count: number;
  onPress: () => void;
};

export function HeaderBell({ count, onPress }: HeaderBellProps) {
  return (
    <Pressable
      accessibilityLabel="Notifiche"
      accessibilityRole="button"
      onPress={onPress}
      style={styles.bellWrapper}
    >
      <Ionicons color={colors.textMuted} name="notifications-outline" size={22} />
      {count > 0 ? (
        <View style={styles.badgePosition}>
          <NotificationBadge count={count} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bellWrapper: {
    padding: spacing[4],
  },
  badgePosition: {
    position: "absolute",
    top: -2,
    right: -2,
  },
});
