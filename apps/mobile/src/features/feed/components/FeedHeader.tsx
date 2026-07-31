/**
 * Header compatto e fisso della Home (§2).
 *
 * A sinistra il solo nome testuale PROLINK: il §2 vieta esplicitamente di
 * generare o introdurre un logo provvisorio, perché quello definitivo non è
 * ancora approvato. Non si riusa `TopBar`, che ha un riquadro con la lettera "F"
 * e una finta casella di ricerca — entrambi fuori specifica qui.
 *
 * A destra campanella e "+". La campanella mostra un indicatore piccolo quando
 * ci sono notifiche non lette: il §2 vieta numeri grandi e badge invasivi,
 * quindi un punto e non un contatore.
 *
 * L'icona menu a sinistra è l'accesso alla sidebar: il pulsante flottante del
 * layout tabs viene nascosto sulla Home perché si sovrapporrebbe a PROLINK.
 */

import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { FEED_BRAND } from "../feed-labels";

type FeedHeaderProps = {
  hasUnreadNotifications: boolean;
  onOpenMenu: () => void;
  onOpenNotifications: () => void;
  onOpenComposer: () => void;
};

export function FeedHeader({
  hasUnreadNotifications,
  onOpenMenu,
  onOpenNotifications,
  onOpenComposer,
}: FeedHeaderProps) {
  return (
    <View style={styles.bar} testID="feed-header">
      <Pressable
        accessibilityLabel="Apri menu laterale"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onOpenMenu}
        style={styles.iconButton}
      >
        <Ionicons color={colors.textPrimary} name="menu-outline" size={22} />
      </Pressable>

      <AppText color="accent" style={styles.brand} variant="headingSm">
        {FEED_BRAND}
      </AppText>

      <Pressable
        accessibilityLabel="Notifiche"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onOpenNotifications}
        style={styles.iconButton}
      >
        <Ionicons color={colors.textPrimary} name="notifications-outline" size={22} />
        {hasUnreadNotifications ? (
          <View style={styles.dot} testID="feed-header-unread-dot" />
        ) : null}
      </Pressable>

      <Pressable
        accessibilityLabel="Crea contenuto"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onOpenComposer}
        style={styles.iconButton}
      >
        <Ionicons color={colors.textPrimary} name="add" size={24} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing[4],
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
  },
  brand: {
    flex: 1,
    letterSpacing: 0.5,
    paddingLeft: spacing[4],
  },
  dot: {
    backgroundColor: colors.accent,
    borderRadius: 4,
    height: 8,
    position: "absolute",
    right: spacing[6],
    top: spacing[6],
    width: 8,
  },
  iconButton: {
    alignItems: "center",
    height: sizes.touchTarget,
    justifyContent: "center",
    width: sizes.touchTarget,
  },
});
