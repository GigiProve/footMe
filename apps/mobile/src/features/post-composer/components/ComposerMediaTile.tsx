/**
 * Cella media del composer (HOM-06.1 §45–48, §57–59, §63–64, §70, §151–153,
 * §196, §198–199).
 *
 * Una cella disegna un solo media di `media[]` e non conosce il layout: il
 * riempimento è del contenitore (`ComposerMediaGrid`), la cella fa `flex: 1`.
 *  • immagine o miniatura; video senza miniatura locale → tile scuro neutro;
 *  • video: Play e durata sempre (§46, §48), senza autoplay;
 *  • X di rimozione (§59) solo se non `readOnly`; mai sui media pubblicati
 *    (§152) e mai su un media fallito, dove «Rimuovi» è già un'azione scritta;
 *  • upload in corso: pillola discreta con spinner e, se misurabile, la
 *    percentuale; non copre l'immagine;
 *  • upload fallito: velo con «Caricamento non riuscito» e azioni scritte
 *    «Riprova» / «Rimuovi» — l'errore non è comunicato dal solo colore (§199);
 *  • accessibilità: etichetta parlata (§198) e azioni «Sposta prima» /
 *    «Sposta dopo» / «Rimuovi» come alternativa al drag (§58), assenti in
 *    `readOnly`;
 *  • feedback di drag leggero (§57): la cella segue il dito con una scala del
 *    4%; la cella sotto il dito riceve un anello accent.
 *
 * La trasformazione del drag è l'unico stile non statico, perché legge un
 * `Animated.ValueXY`.
 */

import { useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import { formatPostVideoDuration } from "../../feed/feed-post-presentation";
import type { ComposerMediaItem } from "../composer-types";

export const COMPOSER_UPLOAD_FAILED_LABEL = "Caricamento non riuscito";

const DRAG_SCALE = 1.04;
const LONG_PRESS_DELAY_MS = 350;

/** Etichetta parlata di riserva, usata se il chiamante non ne fornisce una (§198). */
export function defaultMediaAccessibilityLabel(
  item: ComposerMediaItem,
  index: number,
  total: number,
): string {
  const parts: string[] = [`${item.type === "video" ? "Video" : "Foto"} ${index + 1} di ${total}`];
  const duration = item.durationSeconds;

  if (item.type === "video" && duration != null && duration > 0) {
    parts.push(`durata ${Math.floor(duration)} secondi`);
  }

  // I media già pubblicati non hanno uno stato di upload da raccontare.
  if (item.remoteMediaPosition === null) {
    if (item.uploadStatus === "uploaded") {
      parts.push("caricamento completato");
    } else if (item.uploadStatus === "failed") {
      parts.push("caricamento non riuscito");
    } else if (item.uploadStatus === "uploading") {
      parts.push(
        item.uploadProgress != null
          ? `caricamento in corso, ${Math.round(item.uploadProgress * 100)} per cento`
          : "caricamento in corso",
      );
    } else {
      parts.push("in attesa di caricamento");
    }
  }

  return parts.join(", ");
}

function tileImageUri(item: ComposerMediaItem): string | null {
  if (item.thumbnailUri) {
    return item.thumbnailUri;
  }

  // Un video non è mai usato come sorgente di Image: senza miniatura resta il tile scuro.
  return item.type === "image" ? (item.localUri ?? item.remoteUrl) : null;
}

type ComposerMediaTileProps = {
  item: ComposerMediaItem;
  index: number;
  total: number;
  /** Cella piccola (griglia a 3 colonne): azioni di errore impilate, overlay ridotti. */
  compact: boolean;
  readOnly: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  /** true se la cella o un suo contenitore deve stare sopra le altre durante il drag. */
  raised: boolean;
  dragTranslate: Animated.ValueXY;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
  registerRef: (localId: string, node: View | null) => void;
  onOpen: (localId: string) => void;
  onRemove: (localId: string) => void;
  onRetry: (localId: string) => void;
  onMove: (localId: string, toIndex: number) => void;
  onDragStart: (localId: string) => void;
  onTouchEnd: () => void;
};

export function ComposerMediaTile({
  item,
  index,
  total,
  compact,
  readOnly,
  isDragging,
  isDropTarget,
  raised,
  dragTranslate,
  accessibilityLabel,
  style,
  registerRef,
  onOpen,
  onRemove,
  onRetry,
  onMove,
  onDragStart,
  onTouchEnd,
}: ComposerMediaTileProps) {
  const [imageFailed, setImageFailed] = useState(false);

  // Le due azioni affiancate stanno solo nella cella a tutta larghezza (media singolo):
  // già da due celle a 360pt «Riprova» e «Rimuovi» in riga uscirebbero dalla cella.
  const stackActions = compact || total > 1;
  const isVideo = item.type === "video";
  const isFailed = item.uploadStatus === "failed";
  const isInFlight = item.uploadStatus === "pending" || item.uploadStatus === "uploading";
  const uri = tileImageUri(item);
  const showImage = uri !== null && !imageFailed;
  const duration = isVideo ? formatPostVideoDuration(item.durationSeconds) : null;
  const percent = item.uploadProgress != null ? Math.round(item.uploadProgress * 100) : null;

  const accessibilityActions: { name: string; label: string }[] = [];

  if (!readOnly) {
    if (index > 0) {
      accessibilityActions.push({ name: "moveEarlier", label: "Sposta prima" });
    }
    if (index < total - 1) {
      accessibilityActions.push({ name: "moveLater", label: "Sposta dopo" });
    }
    if (isFailed) {
      accessibilityActions.push({ name: "retry", label: "Riprova" });
    }
    accessibilityActions.push({ name: "remove", label: "Rimuovi" });
  }

  function handleAccessibilityAction(event: AccessibilityActionEvent) {
    switch (event.nativeEvent.actionName) {
      case "moveEarlier":
        onMove(item.localId, index - 1);
        break;
      case "moveLater":
        onMove(item.localId, index + 1);
        break;
      case "retry":
        onRetry(item.localId);
        break;
      case "remove":
        onRemove(item.localId);
        break;
      default:
        break;
    }
  }

  return (
    <View
      collapsable={false}
      ref={(node) => registerRef(item.localId, node)}
      style={[styles.cell, style, raised ? styles.raised : null]}
    >
      <Animated.View
        style={[
          styles.fill,
          isDragging
            ? {
                transform: [
                  { translateX: dragTranslate.x },
                  { translateY: dragTranslate.y },
                  { scale: DRAG_SCALE },
                ],
              }
            : null,
        ]}
      >
        <Pressable
          accessibilityActions={accessibilityActions.length > 0 ? accessibilityActions : undefined}
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="imagebutton"
          delayLongPress={LONG_PRESS_DELAY_MS}
          onAccessibilityAction={handleAccessibilityAction}
          onLongPress={readOnly ? undefined : () => onDragStart(item.localId)}
          onPress={isFailed ? undefined : () => onOpen(item.localId)}
          onPressOut={readOnly ? undefined : onTouchEnd}
          style={[styles.fill, styles.media, isVideo ? styles.videoBackdrop : null]}
          testID={`composer-media-tile-${index}`}
        >
          {showImage ? (
            <Image
              accessibilityIgnoresInvertColors
              onError={() => setImageFailed(true)}
              resizeMode="cover"
              source={{ uri: uri ?? undefined }}
              style={styles.fill}
            />
          ) : null}

          {!showImage && !isVideo ? (
            <View pointerEvents="none" style={styles.centered}>
              <Ionicons color={colors.textMuted} name="image-outline" size={24} />
            </View>
          ) : null}

          {isVideo && !isFailed ? (
            <View pointerEvents="none" style={styles.centered}>
              {/* Su un fondo scuro senza miniatura il cerchio traslucido scompare: lì è pieno e chiaro. */}
              <View
                style={[
                  styles.play,
                  compact ? styles.playSmall : styles.playRegular,
                  showImage ? null : styles.playSolid,
                ]}
              >
                <Ionicons
                  color={showImage ? colors.inkInvert : colors.surfaceInverse}
                  name="play"
                  size={compact ? 14 : 18}
                />
              </View>
            </View>
          ) : null}
        </Pressable>

        {duration && !isFailed ? (
          <View pointerEvents="none" style={styles.duration}>
            <AppText color="inverse" variant={compact ? "caption" : "feedMeta"}>
              {duration}
            </AppText>
          </View>
        ) : null}

        {isInFlight ? (
          <View pointerEvents="none" style={styles.progressPill}>
            <ActivityIndicator color={colors.inkInvert} size="small" />
            {percent !== null ? (
              <AppText color="inverse" variant="caption">
                {`${percent}%`}
              </AppText>
            ) : null}
          </View>
        ) : null}

        {!readOnly && !isFailed ? (
          <Pressable
            accessibilityLabel="Rimuovi media"
            accessibilityRole="button"
            hitSlop={9}
            onPress={() => onRemove(item.localId)}
            style={styles.remove}
            testID={`composer-media-remove-${index}`}
          >
            <Ionicons color={colors.inkInvert} name="close" size={16} />
          </Pressable>
        ) : null}

        {isFailed ? (
          <View pointerEvents="box-none" style={[styles.failed, compact ? styles.failedCompact : null]}>
            {!compact ? <Ionicons color={colors.inkInvert} name="alert-circle-outline" size={22} /> : null}
            <AppText align="center" color="inverse" variant={compact ? "caption" : "feedMeta"}>
              {COMPOSER_UPLOAD_FAILED_LABEL}
            </AppText>
            <View style={stackActions ? styles.failedActionsColumn : styles.failedActionsRow}>
              <Button label="Riprova" onPress={() => onRetry(item.localId)} size="sm" variant="secondary" />
              <Button label="Rimuovi" onPress={() => onRemove(item.localId)} size="sm" variant="outline" />
            </View>
          </View>
        ) : null}

        {isDropTarget ? <View pointerEvents="none" style={styles.dropRing} /> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    minHeight: 44,
    minWidth: 44,
  },
  centered: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  dropRing: {
    ...StyleSheet.absoluteFill,
    borderColor: colors.accent,
    borderRadius: radius[8],
    borderWidth: 2,
  },
  duration: {
    backgroundColor: colors.mediaBadgeSurface,
    borderRadius: radius[4],
    bottom: spacing[6],
    paddingHorizontal: spacing[6],
    position: "absolute",
    right: spacing[6],
  },
  failed: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    backgroundColor: colors.mediaBadgeSurface,
    borderRadius: radius[8],
    gap: spacing[6],
    justifyContent: "center",
    padding: spacing[10],
  },
  failedActionsColumn: {
    alignItems: "center",
    gap: spacing[4],
  },
  failedActionsRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
  },
  failedCompact: {
    padding: spacing[6],
  },
  fill: {
    flex: 1,
  },
  media: {
    backgroundColor: colors.surfacePlaceholder,
    borderRadius: radius[8],
    overflow: "hidden",
  },
  play: {
    alignItems: "center",
    backgroundColor: colors.mediaControlSurface,
    borderRadius: radius.full,
    justifyContent: "center",
  },
  playRegular: {
    height: 44,
    width: 44,
  },
  playSmall: {
    height: 32,
    width: 32,
  },
  playSolid: {
    backgroundColor: colors.inkInvert,
  },
  progressPill: {
    alignItems: "center",
    backgroundColor: colors.mediaBadgeSurface,
    borderRadius: radius.full,
    bottom: spacing[6],
    flexDirection: "row",
    gap: spacing[4],
    left: spacing[6],
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[4],
    position: "absolute",
  },
  raised: {
    zIndex: 20,
  },
  remove: {
    alignItems: "center",
    backgroundColor: colors.mediaBadgeSurface,
    borderRadius: radius.full,
    height: 26,
    justifyContent: "center",
    position: "absolute",
    right: spacing[6],
    top: spacing[6],
    width: 26,
  },
  videoBackdrop: {
    backgroundColor: colors.surfaceInverse,
  },
});
