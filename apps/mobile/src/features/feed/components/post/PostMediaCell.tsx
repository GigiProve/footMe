/**
 * Cella della media collection del Post (HOM-02 §26–34, §41, §87–88).
 *
 * Una cella disegna un solo media. Il riempimento è del contenitore
 * (`PostMediaCollection`), che riserva lo spazio dal rapporto prima del
 * download (§40): la cella fa solo `flex: 1`.
 *  • video: Play e durata ovunque, anche nelle celle piccole (§33), con lo
 *    stesso colore delle foto — la tipologia la dice il segno, non una tinta;
 *  • cella +N: velo semitrasparente (§32) e numero leggibile; su un video si
 *    semplifica (§34): +N e un piccolo Play, senza durata;
 *  • immagine rotta, video in elaborazione o non disponibile: placeholder con
 *    la sua scritta (§41). Il guasto resta nella cella e non rompe il Post;
 *  • ogni cella tappabile misura almeno 44pt per costruzione e ha un'etichetta
 *    parlata (§73, §76). Una cella non riproducibile non è tappabile, salvo che
 *    sia la +N, che apre sempre la galleria.
 */

import { useState } from "react";
import { Image, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import {
  formatPostVideoDuration,
  mediaCellAccessibilityLabel,
  mediaCellState,
  mediaCellStateLabel,
  mediaImageUri,
  type MediaCellPlan,
  type MediaCellState,
} from "../../feed-post-presentation";

type PostMediaCellProps = {
  cell: MediaCellPlan;
  total: number;
  /** Cella piccola (coppia, griglia, colonna destra del 1+2): overlay ridotti. */
  compact: boolean;
  /** Il media singolo carica l'immagine intera, le celle multiple la miniatura. */
  preferFull: boolean;
  style?: StyleProp<ViewStyle>;
  onPress: (cell: MediaCellPlan) => void;
};

function stateIconName(isVideo: boolean, state: MediaCellState): keyof typeof Ionicons.glyphMap {
  if (!isVideo) {
    return "image-outline";
  }

  return state === "processing" ? "time-outline" : "videocam-outline";
}

export function PostMediaCell({
  cell,
  total,
  compact,
  preferFull,
  style,
  onPress,
}: PostMediaCellProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const { item, overflowCount } = cell;
  const state = mediaCellState(item, imageFailed);
  const uri = mediaImageUri(item, preferFull);
  const isVideo = item.type === "video";
  const isOverflow = overflowCount !== null;
  const stateLabel = mediaCellStateLabel(item, state);
  const label = mediaCellAccessibilityLabel(cell, total, state);
  const isInteractive = state === "ready" || isOverflow;
  const showImage = Boolean(uri) && !imageFailed && (state === "ready" || isOverflow);

  const content = (
    <>
      {showImage ? (
        <Image
          accessibilityIgnoresInvertColors
          onError={() => setImageFailed(true)}
          resizeMode="cover"
          source={{ uri: uri ?? undefined }}
          style={styles.fill}
        />
      ) : null}

      {!isOverflow && stateLabel ? (
        <View style={styles.stateWrap}>
          <Ionicons
            color={colors.textSecondary}
            name={stateIconName(isVideo, state)}
            size={compact ? 20 : 24}
          />
          <AppText align="center" color="secondary" numberOfLines={3} variant="caption">
            {stateLabel}
          </AppText>
        </View>
      ) : null}

      {isOverflow ? (
        <View style={styles.scrim}>
          <AppText color="inverse" variant="statValue">
            {`+${overflowCount}`}
          </AppText>
        </View>
      ) : null}

      {isVideo && state === "ready" ? (
        <VideoMarks
          compact={compact}
          duration={isOverflow ? null : formatPostVideoDuration(item.durationSeconds)}
          tiny={isOverflow}
        />
      ) : null}
    </>
  );

  if (!isInteractive) {
    return (
      <View
        accessibilityLabel={label}
        accessible
        style={[styles.cell, style]}
        testID={`feed-post-media-cell-${cell.index}`}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={() => onPress(cell)}
      style={[styles.cell, style]}
      testID={`feed-post-media-cell-${cell.index}`}
    >
      {content}
    </Pressable>
  );
}

type VideoMarksProps = {
  compact: boolean;
  duration: string | null;
  /** Sulla cella +N di un video: solo un piccolo Play, senza durata (§34). */
  tiny: boolean;
};

function VideoMarks({ compact, duration, tiny }: VideoMarksProps) {
  let playStyle = styles.playRegular;
  let iconSize = 18;

  if (tiny) {
    playStyle = styles.playTiny;
    iconSize = 11;
  } else if (compact) {
    playStyle = styles.playSmall;
    iconSize = 14;
  }

  return (
    <>
      <View pointerEvents="none" style={tiny ? styles.playCorner : styles.playCenter}>
        <View style={[styles.playBase, playStyle]}>
          <Ionicons color={colors.inkInvert} name="play" size={iconSize} />
        </View>
      </View>

      {duration ? (
        <View pointerEvents="none" style={styles.duration} testID="feed-post-media-duration">
          <AppText color="inverse" variant={compact ? "caption" : "feedMeta"}>
            {duration}
          </AppText>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  // Il rapporto lo dà il contenitore; la cella riempie lo spazio riservato.
  cell: {
    backgroundColor: colors.surfacePlaceholder,
    flex: 1,
    minHeight: 44,
    minWidth: 44,
    overflow: "hidden",
  },
  duration: {
    backgroundColor: colors.mediaBadgeSurface,
    borderRadius: radius[4],
    bottom: spacing[6],
    paddingHorizontal: spacing[6],
    position: "absolute",
    right: spacing[6],
  },
  fill: {
    ...StyleSheet.absoluteFill,
  },
  playBase: {
    alignItems: "center",
    backgroundColor: colors.mediaControlSurface,
    justifyContent: "center",
  },
  playCenter: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  playCorner: {
    bottom: spacing[6],
    left: spacing[6],
    position: "absolute",
  },
  playRegular: {
    borderRadius: radius.full,
    height: 44,
    width: 44,
  },
  playSmall: {
    borderRadius: radius.full,
    height: 32,
    width: 32,
  },
  playTiny: {
    borderRadius: radius.full,
    height: 22,
    width: 22,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    backgroundColor: colors.mediaControlSurface,
    justifyContent: "center",
  },
  stateWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    gap: spacing[4],
    justifyContent: "center",
    paddingHorizontal: spacing[8],
  },
});
