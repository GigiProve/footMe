/**
 * Header compatto e fisso della Home (HOM-01.1 §4, §5).
 *
 * A sinistra il solo wordmark testuale PROLINK: nessun logo provvisorio,
 * simbolo, badge o payoff. A destra campanella e "+", icone semplici senza
 * cerchi né bottoni pieni, ognuna con un'area di tocco di 44pt.
 *
 * Niente più icona menu: §4 e il visual master vogliono a sinistra solo
 * PROLINK. La sidebar resta raggiungibile dal pulsante flottante delle altre
 * tab, che sulla Home non compare perché coprirebbe il wordmark (decisione
 * confermata da Luigi il 2026-11-11).
 *
 * HOM-14 §5 sostituisce il punto di HOM-01.1 §5: la campanella mostra un badge
 * numerico con le notifiche NUOVE dall'ultima apertura del Centro (non quelle
 * mai aperte), lo stesso `NotificationBadge` delle altre superfici.
 */

import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../theme/tokens";
import { AppText, NotificationBadge } from "../../../ui";
import { FEED_BRAND } from "../feed-labels";

type FeedHeaderProps = {
  /** Notifiche nuove dall'ultima apertura del Centro (HOM-14 §5–§7). */
  notificationCount: number;
  onOpenNotifications: () => void;
  onOpenComposer: () => void;
};

export function FeedHeader({
  notificationCount,
  onOpenNotifications,
  onOpenComposer,
}: FeedHeaderProps) {
  return (
    <View style={styles.bar} testID="feed-header">
      <AppText
        accessibilityRole="header"
        numberOfLines={1}
        style={styles.brand}
        variant="heroName"
      >
        {FEED_BRAND}
      </AppText>

      <Pressable
        accessibilityLabel={
          notificationCount > 0
            ? `Notifiche, ${notificationCount} ${notificationCount === 1 ? "nuova" : "nuove"}`
            : "Notifiche"
        }
        accessibilityRole="button"
        onPress={onOpenNotifications}
        style={styles.iconButton}
      >
        <Ionicons color={colors.textPrimary} name="notifications-outline" size={23} />
        {notificationCount > 0 ? (
          <View style={styles.badge} testID="feed-header-badge">
            <NotificationBadge count={notificationCount} tone="accent" />
          </View>
        ) : null}
      </Pressable>

      <Pressable
        accessibilityLabel="Crea contenuto"
        accessibilityRole="button"
        onPress={onOpenComposer}
        style={styles.iconButton}
      >
        <Ionicons color={colors.textPrimary} name="add" size={27} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: "center",
    backgroundColor: colors.surface,
    flexDirection: "row",
    paddingLeft: spacing[16],
    paddingRight: spacing[6],
    paddingVertical: spacing[4],
  },
  brand: {
    flex: 1,
    fontSize: 19,
  },
  badge: {
    position: "absolute",
    right: 4,
    top: 5,
  },
  iconButton: {
    alignItems: "center",
    height: sizes.touchTarget,
    justifyContent: "center",
    width: sizes.touchTarget,
  },
});
