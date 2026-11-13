/**
 * Controlli del player inline (HOM-03 §14–15, §83, §128).
 *
 * Una barra sola in basso, come nel visual master 2: Play/Pausa, barra di
 * avanzamento, «0:18 / 0:48», audio e schermo intero. Ogni controllo tappabile è
 * 44×44 (§128) e ha un'etichetta parlata; la barra di avanzamento è un controllo
 * «adjustable» con valore parlato e azioni avanti/indietro di 10 s.
 *
 * Quando si ritirano (§15) i controlli restano montati ma trasparenti e senza
 * tocchi: sparire dall'albero toglierebbe a VoiceOver l'unico modo di mettere in
 * pausa. Chi li ritira li ripresenta con un tap sul video (`PlayerSurface` in
 * `InlineVideoPlayer`). Lo stato di avanzamento è del player e non sale: nessun
 * re-render della lista a ogni tick (§105).
 */

import { useState } from "react";
import { Pressable, StyleSheet, View, type GestureResponderEvent } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import {
  PLAYER_SEEK_STEP_SECONDS,
  VIDEO_A11Y,
  playbackRatio,
  playerClockLabel,
  progressAccessibilityValue,
} from "../../feed-video-presentation";

type VideoPlayerControlsProps = {
  isPlaying: boolean;
  muted: boolean;
  currentTime: number;
  duration: number;
  visible: boolean;
  onTogglePlay: () => void;
  onToggleMuted: () => void;
  onEnterFullscreen: () => void;
  /** Rapporto 0–1 sulla barra. */
  onSeekRatio: (ratio: number) => void;
  /** Salto relativo in secondi (azioni di accessibilità). */
  onSeekBy: (deltaSeconds: number) => void;
};

type IconControlProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  testID: string;
};

function IconControl({ icon, label, onPress, testID }: IconControlProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.control}
      testID={testID}
    >
      <Ionicons color={colors.inkInvert} name={icon} size={20} />
    </Pressable>
  );
}

export function VideoPlayerControls({
  isPlaying,
  muted,
  currentTime,
  duration,
  visible,
  onTogglePlay,
  onToggleMuted,
  onEnterFullscreen,
  onSeekRatio,
  onSeekBy,
}: VideoPlayerControlsProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const percent = `${Math.round(playbackRatio(currentTime, duration) * 100)}%` as const;

  function handleSeek(event: GestureResponderEvent) {
    if (trackWidth > 0) {
      onSeekRatio(event.nativeEvent.locationX / trackWidth);
    }
  }

  return (
    <View
      pointerEvents={visible ? "box-none" : "none"}
      style={[styles.bar, visible ? null : styles.hidden]}
      testID="feed-video-controls"
    >
      <IconControl
        icon={isPlaying ? "pause" : "play"}
        label={isPlaying ? VIDEO_A11Y.pause : VIDEO_A11Y.resume}
        onPress={onTogglePlay}
        testID="feed-video-toggle"
      />

      <Pressable
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        accessibilityLabel={VIDEO_A11Y.progress}
        accessibilityRole="adjustable"
        accessibilityValue={{ text: progressAccessibilityValue(currentTime, duration) }}
        onAccessibilityAction={(event) =>
          onSeekBy(
            event.nativeEvent.actionName === "increment"
              ? PLAYER_SEEK_STEP_SECONDS
              : -PLAYER_SEEK_STEP_SECONDS,
          )
        }
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        onPress={handleSeek}
        style={styles.track}
        testID="feed-video-progress"
      >
        {/* Senza tocchi: così `locationX` è relativo alla barra e non al figlio. */}
        <View pointerEvents="none" style={styles.rail}>
          <View style={[styles.fill, { width: percent }]} />
        </View>
        <View pointerEvents="none" style={[styles.knob, { left: percent }]} />
      </Pressable>

      <AppText color="inverse" numberOfLines={1} style={styles.time} variant="caption">
        {playerClockLabel(currentTime, duration)}
      </AppText>

      <IconControl
        icon={muted ? "volume-mute" : "volume-high"}
        label={muted ? VIDEO_A11Y.unmute : VIDEO_A11Y.mute}
        onPress={onToggleMuted}
        testID="feed-video-mute"
      />
      <IconControl
        icon="expand"
        label={VIDEO_A11Y.enterFullscreen}
        onPress={onEnterFullscreen}
        testID="feed-video-fullscreen"
      />
    </View>
  );
}

const KNOB = 12;

const styles = StyleSheet.create({
  // Velo scuro leggero per il contrasto del bianco sul fotogramma.
  bar: {
    alignItems: "center",
    backgroundColor: colors.mediaControlSurface,
    bottom: 0,
    flexDirection: "row",
    left: 0,
    paddingRight: spacing[4],
    position: "absolute",
    right: 0,
  },
  control: {
    alignItems: "center",
    height: sizes.touchTarget,
    justifyContent: "center",
    width: sizes.touchTarget,
  },
  fill: {
    backgroundColor: colors.inkInvert,
    borderRadius: radius.full,
    height: "100%",
  },
  hidden: {
    opacity: 0,
  },
  knob: {
    backgroundColor: colors.inkInvert,
    borderRadius: radius.full,
    height: KNOB,
    marginLeft: -KNOB / 2,
    position: "absolute",
    width: KNOB,
  },
  rail: {
    backgroundColor: colors.textInverseSoft,
    borderRadius: radius.full,
    height: 3,
    overflow: "hidden",
    width: "100%",
  },
  time: {
    marginHorizontal: spacing[8],
  },
  track: {
    flex: 1,
    height: sizes.touchTarget,
    justifyContent: "center",
  },
});
