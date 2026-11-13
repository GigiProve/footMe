/**
 * Skeleton del caricamento iniziale (HOM-01.1 §52–§55).
 *
 * Ricalcano i componenti aperti: niente più card, ogni blocco sta nella stessa
 * `FeedItemFrame` dei contenuti veri, così l'arrivo dei dati non sposta nulla.
 *  • post: avatar, riga nome, righe di testo, media 16:9, tre aree azioni
 *    bilanciate (§53; HOM-02 §77);
 *  • video: autore, una riga di caption, area media 16:9, azioni (HOM-03 §123–124);
 *  • articolo: autore, righe di titolo, miniatura piccola a destra come la
 *    preview vera (96pt, 4:5), azioni (HOM-03 §125);
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
import { ARTICLE_THUMBNAIL_RATIO, ARTICLE_THUMBNAIL_WIDTH } from "../../feed-video-presentation";
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

function SkeletonHeader() {
  return (
    <View style={styles.header}>
      <Skeleton.Circle style={styles.avatar} />
      <View style={styles.grow}>
        <Skeleton.Row style={styles.w50} />
        <Skeleton.Row style={styles.w30} />
      </View>
    </View>
  );
}

/** HOM-02 §77: tre aree uguali come la riga azioni vera, niente quarto segnalibro. */
function SkeletonActions() {
  return (
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
  );
}

export function PostSkeleton() {
  return (
    <FeedItemFrame testID="feed-skeleton-post">
      <SkeletonHeader />
      <Skeleton.Row />
      <Skeleton.Row style={styles.w70} />
      <View style={styles.media} />
      <SkeletonActions />
    </FeedItemFrame>
  );
}

/** HOM-03 §124: autore, una riga di caption, area media, azioni. */
export function VideoPostSkeleton() {
  return (
    <FeedItemFrame testID="feed-skeleton-video">
      <SkeletonHeader />
      <Skeleton.Row style={styles.w70} />
      <View style={styles.media} />
      <SkeletonActions />
    </FeedItemFrame>
  );
}

/** HOM-03 §125: autore, righe di titolo, miniatura piccola, azioni. */
export function ArticleSkeleton() {
  return (
    <FeedItemFrame testID="feed-skeleton-article">
      <SkeletonHeader />
      <View style={styles.articleBody}>
        <View style={styles.grow}>
          <Skeleton.Row />
          <Skeleton.Row style={styles.w70} />
          <Skeleton.Row style={styles.w50} />
        </View>
        <View style={styles.thumbnail} />
      </View>
      <SkeletonActions />
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

/**
 * Stessa alternanza che il Feed vero produce: posizione, post, video, persone,
 * articolo (HOM-03 §123: video e articolo fanno parte della sequenza).
 */
export function FeedSkeleton() {
  return (
    <View testID="feed-skeleton">
      <PositionSkeleton />
      <PostSkeleton />
      <VideoPostSkeleton />
      <SuggestedProfilesSkeleton />
      <ArticleSkeleton />
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
  articleBody: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[12],
    marginTop: spacing[8],
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
  thumbnail: {
    aspectRatio: ARTICLE_THUMBNAIL_RATIO,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    width: ARTICLE_THUMBNAIL_WIDTH,
  },
  w30: { width: "30%" },
  w40: { width: "40%" },
  w50: { width: "50%" },
  w60: { width: "60%" },
  w70: { width: "70%" },
});
