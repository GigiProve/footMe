/**
 * Area media di UN video (HOM-03 §6–12, §24–25, §60–70, §108–110).
 *
 * È l'unico punto che sa disegnare un video, per Post social, gallery a media
 * singolo, Video editoriale e dettaglio (§3, §35: nessun «VideoPost» né player
 * separato). Tre stati, decisi da `videoMediaState`:
 *  • pronto: miniatura a proporzione nota dai metadata (nessun salto di layout,
 *    §108–109), Play centrale discreto come nelle celle della gallery (§25) e
 *    durata. Il tap su Play monta `InlineVideoPlayer` nella STESSA area (§12);
 *    non parte da solo (§16–17) e non apre schermate;
 *  • in elaborazione / non disponibile: riga compatta senza Play (§62, §67),
 *    il resto del Post resta (§63, §68). Quando il poll centrale (B) porta il
 *    media a «pronto» l'item si aggiorna in cache e questo componente passa
 *    da riga a miniatura senza ricostruire il Feed (§65).
 *
 * Il controller (B) tiene un solo video corrente: avviarne un secondo smonta il
 * primo, che torna alla miniatura con la sua posizione ricordata (§18, §21).
 * `autoStart` serve al dettaglio per il video toccato nel Feed (`?media=N`): è
 * un tap già avvenuto, parte una volta sola.
 */

import { useEffect, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import { formatPostVideoDuration, singleMediaAspectRatio } from "../../feed-post-presentation";
import {
  pickPlaybackSource,
  videoMediaState,
  videoPlayAccessibilityLabel,
} from "../../feed-video-presentation";
import type { FeedMediaItem } from "../../feed-types";
import { useFeedVideoSlot } from "../../use-feed-video";
import { videoKey } from "../../feed-video-controller";
import { InlineVideoPlayer } from "./InlineVideoPlayer";
import { VideoStateRow } from "./VideoStateRow";

type VideoMediaProps = {
  /** Chiave dell'elemento (`<tipo>:<uuid>`): lega il video al controller e alla viewport. */
  itemId: string;
  media: FeedMediaItem;
  surface?: "feed" | "detail";
  /** Il video parte subito, una volta sola (tap già avvenuto altrove). */
  autoStart?: boolean;
  /** Margine esterno e simili, dal contenitore. */
  style?: StyleProp<ViewStyle>;
};

export function VideoMedia({
  itemId,
  media,
  surface = "feed",
  autoStart = false,
  style,
}: VideoMediaProps) {
  const state = videoMediaState(media);

  if (state !== "ready") {
    return <VideoStateRow state={state} style={style} />;
  }

  return (
    <PlayableVideo autoStart={autoStart} itemId={itemId} media={media} style={style} surface={surface} />
  );
}

type PlayableVideoProps = Omit<VideoMediaProps, "surface" | "autoStart"> &
  Required<Pick<VideoMediaProps, "surface" | "autoStart">>;

function PlayableVideo({ itemId, media, surface, autoStart, style }: PlayableVideoProps) {
  const slot = useFeedVideoSlot(videoKey(itemId, media.id), itemId);
  const source = pickPlaybackSource(media);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);

  const autoStartedRef = useRef(false);
  const { play } = slot;
  useEffect(() => {
    if (autoStart && !autoStartedRef.current) {
      autoStartedRef.current = true;
      play();
    }
  }, [autoStart, play]);

  const duration = formatPostVideoDuration(media.durationSeconds);
  const posterUri = thumbnailFailed ? null : media.thumbnailUrl;

  return (
    <View
      style={[styles.frame, { aspectRatio: singleMediaAspectRatio(media) }, style]}
      testID="feed-video-media"
    >
      {posterUri ? (
        <Image
          accessibilityIgnoresInvertColors
          onError={() => setThumbnailFailed(true)}
          resizeMode="cover"
          source={{ uri: posterUri }}
          style={styles.fill}
        />
      ) : null}

      {slot.isCurrent && source ? (
        <InlineVideoPlayer
          itemId={itemId}
          media={media}
          posterUri={posterUri}
          slot={slot}
          source={source}
          surface={surface}
        />
      ) : (
        <Pressable
          accessibilityLabel={videoPlayAccessibilityLabel(media)}
          accessibilityRole="button"
          onPress={slot.play}
          style={styles.fill}
          testID="feed-video-play"
        >
          <View pointerEvents="none" style={styles.playCenter}>
            <View style={styles.play}>
              <Ionicons color={colors.inkInvert} name="play" size={20} />
            </View>
          </View>

          {duration ? (
            <View pointerEvents="none" style={styles.duration} testID="feed-post-media-duration">
              <AppText color="inverse" variant="feedMeta">
                {duration}
              </AppText>
            </View>
          ) : null}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  duration: {
    backgroundColor: colors.mediaBadgeSurface,
    borderRadius: radius[4],
    bottom: spacing[8],
    paddingHorizontal: spacing[6],
    position: "absolute",
    right: spacing[8],
  },
  fill: {
    ...StyleSheet.absoluteFill,
  },
  // Il rapporto lo dà la riga sopra (metadata del backend): spazio riservato prima del download.
  frame: {
    backgroundColor: colors.surfacePlaceholder,
    borderRadius: radius[8],
    overflow: "hidden",
    width: "100%",
  },
  // Stesso segno della gallery (§25): cerchio traslucido, non saturo (§10).
  play: {
    alignItems: "center",
    backgroundColor: colors.mediaControlSurface,
    borderRadius: radius.full,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  playCenter: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
});
