import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../styles";
import { AppText } from "../AppText/AppText";
import { NotificationBadge } from "../NotificationBadge/NotificationBadge";

type TopBarProps = {
  notificationCount?: number;
  onNotificationsPress?: () => void;
  onSearchPress?: () => void;
  searchPlaceholder?: string;
};

export function TopBar({
  notificationCount = 0,
  onNotificationsPress,
  onSearchPress,
  searchPlaceholder = "Cerca",
}: TopBarProps) {
  return (
    <View style={styles.bar}>
      <View style={styles.brand}>
        <View style={styles.brandIcon}>
          <AppText variant="titleSm" color="inverse">
            F
          </AppText>
        </View>
        <AppText variant="headingSm" color="accent">
          FootMe
        </AppText>
      </View>
      <Pressable
        accessibilityLabel="Cerca"
        accessibilityRole="button"
        onPress={onSearchPress}
        style={styles.searchBox}
      >
        <Ionicons color={colors.textMuted} name="search-outline" size={16} />
        <AppText variant="bodySm" color="muted">
          {searchPlaceholder}
        </AppText>
      </Pressable>
      <Pressable
        accessibilityLabel="Notifiche"
        accessibilityRole="button"
        onPress={onNotificationsPress}
        style={styles.bellWrapper}
      >
        <Ionicons
          color={colors.textMuted}
          name="notifications-outline"
          size={22}
        />
        {notificationCount > 0 ? (
          <View style={styles.badgePosition}>
            <NotificationBadge count={notificationCount} />
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[6],
  },
  brandIcon: {
    width: 32,
    height: 32,
    borderRadius: radius[8],
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[8],
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
    backgroundColor: colors.inputBackground,
    borderRadius: radius[8],
  },
  bellWrapper: {
    padding: spacing[4],
  },
  badgePosition: {
    position: "absolute",
    top: -2,
    right: -2,
  },
});
