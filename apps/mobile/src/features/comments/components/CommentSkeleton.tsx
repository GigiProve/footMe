/**
 * Righe skeleton della sezione Commenti (HOM-08 §184–§185, §307).
 *
 * Solo righe dentro la sezione: il contenuto del dettaglio è già a schermo e non si
 * scheletrizza di nuovo. Stessa forma di una riga (avatar + due righe + testo), con i
 * primitivi del design system.
 */

import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../theme/tokens";
import { Skeleton } from "../../../ui";
import { COMMENTS_LOADING } from "../comment-labels";

const ROWS = [0, 1, 2];

export function CommentSkeleton({ rows = ROWS.length }: { rows?: number }) {
  return (
    <View accessibilityLabel={COMMENTS_LOADING} accessible testID="comments-skeleton">
      {ROWS.slice(0, rows).map((row) => (
        <View key={row} style={styles.row}>
          <Skeleton.Circle style={styles.avatar} />
          <View style={styles.text}>
            <Skeleton.Row style={[styles.block, styles.name]} />
            <Skeleton.Row style={styles.block} />
            <Skeleton.Row style={[styles.block, styles.last]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // `surfaceMuted` è il fondo della schermata: i blocchi sarebbero invisibili. Come in HOM-07 (SavedRows).
  avatar: {
    backgroundColor: colors.border,
    borderRadius: radius.full,
    height: 32,
    width: 32,
  },
  block: {
    backgroundColor: colors.border,
  },
  last: {
    width: "55%",
  },
  name: {
    width: "40%",
  },
  row: {
    flexDirection: "row",
    gap: spacing[10],
    paddingVertical: spacing[12],
  },
  text: {
    flex: 1,
  },
});
