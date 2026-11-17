/**
 * Caricamento di un dettaglio contenuto (HOM-15 §202, §206).
 *
 * §202: skeleton coerente con il renderer, non uno spinner a schermo intero
 * (§206). Ricalca l'ordine del dettaglio — header autore (avatar + nome + meta),
 * area media, righe di testo — dentro la stessa `ContentDetailFrame`, così
 * l'arrivo dei dati non sposta barra e padding. Vale per Post, Articolo/Video e
 * per la sonda che li smista: un solo aspetto di attesa.
 *
 * Solo `Skeleton.Row` / `Skeleton.Circle` del kit, senza animazione. Il fondo
 * del dettaglio è `colors.background`, uguale a `surfaceMuted` dei primitivi:
 * i blocchi usano `colors.border`, come `CommentSkeleton` (HOM-08).
 */

import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { Skeleton } from "../../../../ui";

export const CONTENT_DETAIL_LOADING_LABEL = "Caricamento contenuto";

export function ContentDetailSkeleton() {
  return (
    <View
      accessibilityLabel={CONTENT_DETAIL_LOADING_LABEL}
      accessible
      style={styles.root}
      testID="content-detail-skeleton"
    >
      <View style={styles.header}>
        <Skeleton.Circle style={[styles.block, styles.avatar]} />
        <View style={styles.grow}>
          <Skeleton.Row style={[styles.block, styles.w50]} />
          <Skeleton.Row style={[styles.block, styles.w30]} />
        </View>
      </View>
      <View style={[styles.block, styles.media]} />
      <Skeleton.Row style={[styles.block, styles.w70]} />
      <Skeleton.Row style={styles.block} />
      <Skeleton.Row style={styles.block} />
      <Skeleton.Row style={[styles.block, styles.w50]} />
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: radius.full,
    height: 32,
    width: 32,
  },
  block: {
    backgroundColor: colors.border,
  },
  grow: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[10],
    marginBottom: spacing[12],
  },
  media: {
    aspectRatio: 16 / 9,
    borderRadius: radius[8],
    marginBottom: spacing[12],
    width: "100%",
  },
  // `Skeleton.Row` porta già il proprio margine inferiore: nessun gap in più.
  root: {
    paddingTop: spacing[8],
  },
  w30: { width: "30%" },
  w50: { width: "50%" },
  w70: { width: "70%" },
});
