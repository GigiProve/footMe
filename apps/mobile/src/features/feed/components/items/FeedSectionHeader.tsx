/**
 * Intestazione di un modulo del Feed (HOM-01.1 §19, §37): titolo a sinistra,
 * eventuale azione testuale a destra ("Vedi tutte").
 *
 * È testo, non un bottone: §60 riduce i riempimenti blu e §12 vuole la section
 * heading a 16–18px. L'azione ha un'area di tocco piena (§67) pur restando una
 * parola sola.
 */

import { Pressable, StyleSheet, View } from "react-native";

import { sizes, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";

type FeedSectionHeaderProps = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function FeedSectionHeader({ title, actionLabel, onAction }: FeedSectionHeaderProps) {
  return (
    <View style={styles.row}>
      <AppText accessibilityRole="header" numberOfLines={2} style={styles.title} variant="titleMd">
        {title}
      </AppText>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityLabel={`${actionLabel}: ${title}`}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onAction}
          style={styles.action}
        >
          <AppText color="accent" variant="feedMeta">
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    justifyContent: "center",
    minHeight: sizes.touchTarget,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    justifyContent: "space-between",
    minHeight: sizes.touchTarget,
  },
  title: {
    flex: 1,
  },
});
