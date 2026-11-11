/**
 * Skeleton del caricamento iniziale (HOM-01.1 §52–§55).
 *
 * Ricalcano i componenti aperti: niente più card, ogni blocco sta nella stessa
 * `FeedItemFrame` dei contenuti veri, così l'arrivo dei dati non sposta nulla.
 *  • post: avatar, riga nome, righe di testo, media 16:9, tre aree azioni
 *    bilanciate (§53; HOM-02 §77);
 *  • posizione: kicker, poi logo, titolo, due metadata e CTA testuale (§54);
 *  • discovery: intestazione e righe avatar + testo + azione (§55).
 *
 * Composti SOLO da `Skeleton.Row` e `Skeleton.Circle` già esistenti, che non
 * sono animati: niente lampeggi, nessun `Animated`. Nessun testo fittizio.
 * Header, tab e bottom navigation restano visibili perché vivono fuori dalla
 * lista.
 */

import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { Skeleton } from "../../../../ui";
import { FeedItemFrame } from "../items/FeedItemFrame";

export function PositionSkeleton() {
  return (
    <FeedItemFrame testID="feed-skeleton-position">
      <Skeleton.Row style={styles.w40} />
      <View style={styles.box}>
        <View style={styles.boxRow}>
          <View style={styles.logo} />
          <View style={styles.grow}>
            <Skeleton.Row style={styles.w60} />
            <Skeleton.Row style={styles.w50} />
            <Skeleton.Row style={styles.w70} />
          </View>
        </View>
        <Skeleton.Row style={[styles.w30, styles.end]} />
      </View>
    </FeedItemFrame>
  );
}

export function PostSkeleton() {
  return (
    <FeedItemFrame testID="feed-skeleton-post">
      <View style={styles.header}>
        <Skeleton.Circle style={styles.avatar} />
        <View style={styles.grow}>
          <Skeleton.Row style={styles.w50} />
          <Skeleton.Row style={styles.w30} />
        </View>
      </View>
      <Skeleton.Row />
      <Skeleton.Row style={styles.w70} />
      <View style={styles.media} />
      {/* HOM-02 §77: tre aree uguali come la riga azioni vera, niente quarto segnalibro. */}
      <View style={styles.actions}>
        <View style={styles.actionCell}>
          <View style={styles.icon} />
        </View>
        <View style={styles.actionCell}>
          <View style={styles.icon} />
        </View>
        <View style={styles.actionCell}>
          <View style={styles.icon} />
        </View>
      </View>
    </FeedItemFrame>
  );
}

export function SuggestedProfilesSkeleton() {
  return (
    <FeedItemFrame testID="feed-skeleton-profiles">
      <Skeleton.Row style={[styles.w50, styles.sectionTitle]} />
      {[0, 1, 2].map((index) => (
        <View key={index} style={styles.suggestionRow}>
          <Skeleton.Circle style={styles.avatar} />
          <View style={styles.grow}>
            <Skeleton.Row style={styles.w50} />
            <Skeleton.Row style={styles.w40} />
          </View>
          <View style={styles.followPill} />
        </View>
      ))}
    </FeedItemFrame>
  );
}

/** Stessa alternanza che il Feed vero produce: posizione, post, persone, post. */
export function FeedSkeleton() {
  return (
    <View testID="feed-skeleton">
      <PositionSkeleton />
      <PostSkeleton />
      <SuggestedProfilesSkeleton />
      <PostSkeleton />
    </View>
  );
}

const styles = StyleSheet.create({
  actionCell: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  actions: {
    alignItems: "center",
    flexDirection: "row",
    height: 44,
    marginTop: spacing[4],
  },
  avatar: {
    height: 32,
    width: 32,
  },
  box: {
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    gap: spacing[8],
    marginTop: spacing[10],
    padding: spacing[14],
  },
  boxRow: {
    flexDirection: "row",
    gap: spacing[12],
  },
  end: {
    alignSelf: "flex-end",
  },
  followPill: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 32,
    width: 64,
  },
  grow: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[10],
    marginBottom: spacing[8],
  },
  icon: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 20,
    width: 20,
  },
  logo: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    height: 44,
    width: 44,
  },
  media: {
    aspectRatio: 16 / 9,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    marginTop: spacing[8],
    width: "100%",
  },
  sectionTitle: {
    marginBottom: spacing[8],
  },
  suggestionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    paddingVertical: spacing[10],
  },
  w30: { width: "30%" },
  w40: { width: "40%" },
  w50: { width: "50%" },
  w60: { width: "60%" },
  w70: { width: "70%" },
});
