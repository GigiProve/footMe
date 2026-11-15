/**
 * Preview compatta del contenuto condiviso (HOM-09 §13–§21, §92, §105–§108).
 *
 * Una sola resa per tre superfici: il pannello (§12), il passo «Condividi»
 * (§92) e la card nella chat (§104). Serve a far riconoscere il contenuto, non
 * a riprodurlo (§13): thumbnail se c'è, autore con il check standard (§249),
 * titolo o excerpt breve, label discreta «Post» / «Articolo» / «Video».
 *
 * Niente placeholder per ciò che manca (§16, §18, §106): un Post di solo testo
 * non ha riquadro immagine, un Articolo senza cover parte dal titolo. L'unico
 * riquadro senza immagine è quello del Video, perché senza il Play il formato
 * non si legge (§19). Nessun autoplay (§20, §109): la thumbnail è un'immagine.
 *
 * `size="chat"` allarga la thumbnail e mostra la riga meta dell'autore; la
 * superficie è leggera (§243): bordo hairline `colors.border`, mai ombra.
 */

import { Image, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing, typography } from "../../../theme/tokens";
import { AppText, VerifiedCheck } from "../../../ui";
import {
  shareKindLabel,
  sharePreviewAccessibilityLabel,
  sharePreviewDuration,
} from "../share-presentation";
import type { SharePreview } from "../share-types";

type SharePreviewCardProps = {
  preview: SharePreview;
  size?: "compact" | "chat";
  /** Cornice hairline attorno alla preview (passo «Condividi» e chat). */
  bordered?: boolean;
  /** Righe massime del titolo o dell'excerpt. */
  maxLines?: number;
  /** Seconda riga dell'autore («Attaccante · AC Como»). */
  showAuthorMeta?: boolean;
  testID?: string;
};

export function SharePreviewCard({
  preview,
  size = "compact",
  bordered = false,
  maxLines = 2,
  showAuthorMeta = false,
  testID,
}: SharePreviewCardProps) {
  const isChat = size === "chat";
  const hasThumbnail = Boolean(preview.thumbnailUrl);
  const hasTile = hasThumbnail || preview.showsPlay;
  const duration = sharePreviewDuration(preview);
  const isEditorial = preview.kind !== "post";
  const headline = isEditorial ? preview.title : null;
  const body = isEditorial ? null : preview.excerpt;

  const author = preview.authorName ? (
    <View style={styles.authorRow}>
      <AppText numberOfLines={2} style={styles.authorName} variant="titleSm">
        {preview.authorName}
      </AppText>
      {preview.isVerified ? <VerifiedCheck size={14} /> : null}
    </View>
  ) : null;

  return (
    <View
      accessible
      accessibilityLabel={sharePreviewAccessibilityLabel(preview)}
      style={[styles.container, bordered ? styles.bordered : null]}
      testID={testID}
    >
      {hasTile ? (
        <View style={[styles.tile, isChat ? styles.tileChat : styles.tileCompact]}>
          {hasThumbnail ? (
            <Image
              accessibilityIgnoresInvertColors
              resizeMode="cover"
              source={{ uri: preview.thumbnailUrl as string }}
              style={styles.thumbnail}
              testID="share-preview-thumbnail"
            />
          ) : (
            <View style={styles.videoFallback} testID="share-preview-video-tile" />
          )}
          {preview.showsPlay ? (
            // Nella tile piccola il Play sale sopra il centro, così non tocca il
            // badge della durata in basso a destra.
            <View style={[styles.playLayer, isChat ? null : styles.playLayerCompact]}>
              <View style={[styles.play, isChat ? null : styles.playCompact]}>
                <Ionicons
                  color={colors.surfaceInverse}
                  name="play"
                  size={isChat ? 16 : 11}
                  style={styles.playIcon}
                />
              </View>
              {duration ? (
                <View style={styles.durationBadge}>
                  <AppText color="inverse" style={styles.durationText} variant="caption">
                    {duration}
                  </AppText>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.text}>
        {headline ? (
          <AppText numberOfLines={maxLines + 1} variant="titleMd">
            {headline}
          </AppText>
        ) : null}
        {author}
        {showAuthorMeta && preview.authorMeta ? (
          <AppText color="secondary" numberOfLines={1} variant="bodySm">
            {preview.authorMeta}
          </AppText>
        ) : null}
        {body ? (
          <AppText color="secondary" numberOfLines={maxLines} variant="bodySm">
            {body}
          </AppText>
        ) : null}
        <AppText color="muted" variant="caption">
          {shareKindLabel(preview.kind)}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  authorName: {
    flexShrink: 1,
  },
  authorRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
  },
  bordered: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    padding: spacing[12],
  },
  container: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[12],
  },
  durationBadge: {
    backgroundColor: colors.mediaBadgeSurface,
    borderRadius: radius.full,
    bottom: spacing[4],
    paddingHorizontal: spacing[6],
    position: "absolute",
    right: spacing[4],
  },
  durationText: {
    fontSize: typography.fontSize[10],
    lineHeight: typography.lineHeight[14],
  },
  // Cerchio bianco con triangolo scuro: si legge sia sopra una thumbnail sia sul
  // riquadro ink del Video senza immagine, dove una velatura scura sparirebbe.
  play: {
    alignItems: "center",
    backgroundColor: colors.inkInvert,
    borderRadius: radius.full,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  playCompact: {
    height: 22,
    width: 22,
  },
  // Il triangolo è asimmetrico: un punto a destra lo centra otticamente.
  playIcon: {
    marginLeft: 1,
  },
  playLayerCompact: {
    paddingBottom: spacing[12],
  },
  playLayer: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  text: {
    flex: 1,
    gap: spacing[4],
  },
  thumbnail: {
    height: "100%",
    width: "100%",
  },
  tile: {
    backgroundColor: colors.surfacePlaceholder,
    borderRadius: radius[10],
    overflow: "hidden",
  },
  tileChat: {
    height: 88,
    width: 88,
  },
  tileCompact: {
    height: 56,
    width: 56,
  },
  videoFallback: {
    backgroundColor: colors.surfaceInverse,
    height: "100%",
    width: "100%",
  },
});
