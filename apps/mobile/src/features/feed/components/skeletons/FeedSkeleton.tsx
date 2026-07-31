/**
 * Skeleton del caricamento iniziale (§16).
 *
 * Composti SOLO da `Skeleton.Row` e `Skeleton.Circle` già esistenti, che non
 * sono animati: "non lampeggiare" e "nessuna animazione eccessiva" vengono
 * quindi gratis, senza un solo `Animated`. Nessun testo fittizio: solo barre.
 *
 * Le altezze rispecchiano quelle dei componenti reali, così quando i dati
 * arrivano la lista non fa un salto. La sequenza è fissa e non casuale:
 * posizione, post, modulo profili, contenuto editoriale, post — la stessa
 * alternanza che il Feed vero produce.
 *
 * Header, tab e bottom navigation restano visibili perché vivono fuori dalla
 * lista: questi skeleton sono solo il contenuto.
 */

import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { Skeleton } from "../../../../ui";

export function PositionSkeleton() {
  return (
    <View style={styles.row} testID="feed-skeleton-position">
      <View style={styles.square} />
      <View style={styles.rowBody}>
        <Skeleton.Row style={styles.w60} />
        <Skeleton.Row style={styles.w40} />
        <Skeleton.Row style={styles.w30} />
      </View>
    </View>
  );
}

export function PostSkeleton() {
  return (
    <View style={styles.card} testID="feed-skeleton-post">
      <View style={styles.header}>
        <Skeleton.Circle style={styles.avatar} />
        <View style={styles.headerText}>
          <Skeleton.Row style={styles.w50} />
          <Skeleton.Row style={styles.w30} />
        </View>
      </View>
      <Skeleton.Row />
      <Skeleton.Row style={styles.w70} />
      <View style={styles.media} />
      <View style={styles.actions}>
        <View style={styles.pill} />
        <View style={styles.pill} />
        <View style={styles.pill} />
      </View>
    </View>
  );
}

export function SuggestedProfilesSkeleton() {
  return (
    <View style={styles.card} testID="feed-skeleton-profiles">
      <Skeleton.Row style={styles.w40} />
      {[0, 1, 2].map((index) => (
        <View key={index} style={styles.suggestionRow}>
          <Skeleton.Circle style={styles.avatarSm} />
          <View style={styles.rowBody}>
            <Skeleton.Row style={styles.w50} />
            <Skeleton.Row style={styles.w40} />
          </View>
          <View style={styles.followPill} />
        </View>
      ))}
    </View>
  );
}

export function EditorialSkeleton() {
  return (
    <View style={styles.row} testID="feed-skeleton-editorial">
      <View style={styles.thumb} />
      <View style={styles.rowBody}>
        <Skeleton.Row style={styles.w30} />
        <Skeleton.Row />
        <Skeleton.Row style={styles.w60} />
      </View>
    </View>
  );
}

export function FeedSkeleton() {
  return (
    <View style={styles.container} testID="feed-skeleton">
      <PositionSkeleton />
      <PostSkeleton />
      <SuggestedProfilesSkeleton />
      <EditorialSkeleton />
      <PostSkeleton />
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    gap: spacing[12],
    marginTop: spacing[4],
  },
  avatar: {
    height: 40,
    width: 40,
  },
  avatarSm: {
    height: 36,
    width: 36,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    gap: spacing[4],
    padding: spacing[14],
  },
  container: {
    gap: spacing[12],
    paddingTop: spacing[12],
  },
  followPill: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 28,
    width: 64,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[10],
    marginBottom: spacing[8],
  },
  headerText: {
    flex: 1,
  },
  media: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    height: 160,
    marginTop: spacing[4],
  },
  pill: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 20,
    width: 72,
  },
  row: {
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    padding: spacing[14],
  },
  rowBody: {
    flex: 1,
  },
  square: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    height: 48,
    width: 48,
  },
  suggestionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[10],
    paddingVertical: spacing[8],
  },
  thumb: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    height: 56,
    width: 84,
  },
  w30: { width: "30%" },
  w40: { width: "40%" },
  w50: { width: "50%" },
  w60: { width: "60%" },
  w70: { width: "70%" },
});
