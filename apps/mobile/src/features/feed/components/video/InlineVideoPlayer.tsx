/**
 * Player inline (HOM-03 §12–15, §17–23, §35, §72–75, §105–107, §115).
 *
 * Esiste solo per il video «corrente» del controller (§18): `VideoMedia` lo monta
 * al posto della miniatura dopo un tap esplicito su Play (§12, §16) e lo smonta
 * quando un altro video diventa corrente. Il player nativo nasce qui e non
 * prima (§73: niente stream per i video solo visibili); smontarlo lo libera
 * (§107) e salva la posizione di sessione (§21).
 *
 * Il controller decide COSA deve accadere (play, pausa per viewport/tab/blur/
 * background); questo componente lo esegue sul player e riporta ciò che il
 * player fa da sé (fine video, interruzione di sistema, errore). Dopo una pausa
 * non riprende mai da solo (§20, §78, §80): lo stato raggiunto resta a schermo.
 *
 * Progresso, controlli e stato di caricamento sono locali (§105): il tick del
 * player non risale alla lista. Errore del player ≠ video non disponibile
 * (§115): messaggio e «Riprova», che ricarica la sorgente nello stesso player.
 * Schermo intero con lo STESSO player (`enterFullscreen`): tempo e audio si
 * mantengono, e alla chiusura si torna allo stesso Post (§22).
 *
 * Fuori da questo file: analytics di avvio/quartili/completamento nella sessione
 * del controller B (`createVideoAnalyticsSession`), mute e fullscreen via
 * `trackFeed`. Sottotitoli: il modello li porta (`captions`, §84) ma
 * expo-video 57 non espone ancora l'aggancio di tracce esterne, quindi il
 * player non li usa — nessuna pipeline da simulare.
 */

import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useVideoPlayer, VideoView, type VideoPlayer, type VideoPlayerStatus } from "expo-video";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import { trackFeed } from "../../feed-analytics";
import { createVideoAnalyticsSession } from "../../feed-video-analytics";
import { VIDEO_PLAY_ERROR, VIDEO_RETRY } from "../../feed-labels";
import {
  PLAYER_CONTROLS_AUTO_HIDE_MS,
  PLAYER_TIME_UPDATE_INTERVAL_S,
  hasPlayedToEnd,
  resolveDuration,
  seekBy,
  seekTarget,
  type PlaybackSource,
} from "../../feed-video-presentation";
import type { FeedMediaItem } from "../../feed-types";
import type { FeedVideoSlot } from "../../use-feed-video";
import { VideoPlayerControls } from "./VideoPlayerControls";

type VideoSlot = FeedVideoSlot;

// Schermo intero consentito, orientamento nativo (§82): il Feed resta portrait.
const FULLSCREEN_OPTIONS = { enable: true } as const;
type LoadState = "loading" | "ready" | "error";

type InlineVideoPlayerProps = {
  itemId: string;
  media: FeedMediaItem;
  source: PlaybackSource;
  slot: VideoSlot;
  surface: "feed" | "detail";
  /** Miniatura già in cache: copre il primo fotogramma, senza un secondo download. */
  posterUri: string | null;
};

// Il player di `useVideoPlayer` è un oggetto nativo imperativo: le sue proprietà
// si scrivono qui, fuori dal render, così il componente non le muta direttamente.
function seekPlayer(player: VideoPlayer, seconds: number) {
  player.currentTime = seconds;
}

function setPlayerMuted(player: VideoPlayer, muted: boolean) {
  player.muted = muted;
}

function loadStateOf(status: VideoPlayerStatus): LoadState {
  if (status === "error") {
    return "error";
  }

  return status === "readyToPlay" ? "ready" : "loading";
}

export function InlineVideoPlayer({
  itemId,
  media,
  source,
  slot,
  surface,
  posterUri,
}: InlineVideoPlayerProps) {
  const viewRef = useRef<VideoView>(null);
  // Ultimo slot per i listener del player, aggiornato dopo il render.
  const slotRef = useRef(slot);
  useEffect(() => {
    slotRef.current = slot;
  });

  const player = useVideoPlayer(source, (instance) => {
    instance.timeUpdateEventInterval = PLAYER_TIME_UPDATE_INTERVAL_S;
    instance.muted = slot.muted;
    instance.currentTime = slot.startPosition;
    // Il play lo dà l'effetto sull'intento del controller, una volta sola.
  });

  const [analytics] = useState(() =>
    createVideoAnalyticsSession({
      durationSeconds: media.durationSeconds,
      itemId,
      mediaId: media.id,
      surface,
    }),
  );
  const [currentTime, setCurrentTime] = useState(slot.startPosition);
  const [duration, setDuration] = useState(() =>
    resolveDuration(player.duration, media.durationSeconds),
  );
  const [loadState, setLoadState] = useState<LoadState>(() => loadStateOf(player.status));
  const [hasFrame, setHasFrame] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [touches, setTouches] = useState(0);
  const lastTimeRef = useRef(slot.startPosition);

  // Eventi del player → stato locale, analytics e controller.
  useEffect(() => {
    const subscriptions = [
      player.addListener("statusChange", ({ status }) => {
        setLoadState(loadStateOf(status));

        if (status === "error") {
          analytics.onError();
          slotRef.current.pause();
        }
      }),
      player.addListener("sourceLoad", (payload) => {
        setDuration(resolveDuration(payload.duration, media.durationSeconds));
      }),
      player.addListener("playingChange", ({ isPlaying }) => {
        if (isPlaying) {
          analytics.onPlaying();
          return;
        }

        // Su iOS un rebuffer emette playingChange(false) con lo stato in
        // `loading`: non è una pausa, il player riprende da solo quando ha dati.
        if (player.status === "loading") {
          return;
        }

        analytics.onPaused(lastTimeRef.current);

        // Pausa nata nel player (interruzione di sistema, fine): il controller
        // lo sa, e non si riprende da soli con l'audio (§80).
        if (slotRef.current.isPlaying) {
          slotRef.current.pause();
        }
      }),
      player.addListener("timeUpdate", ({ currentTime: seconds }) => {
        lastTimeRef.current = seconds;
        setCurrentTime(seconds);
        // Senza durata dal server (video legacy) i quartili usano quella del player.
        analytics.onTime(seconds, player.duration > 0 ? player.duration : null);
      }),
      player.addListener("playToEnd", () => {
        analytics.onEnd();
        // Concluso: la prossima riproduzione riparte dall'inizio.
        lastTimeRef.current = 0;
        slotRef.current.savePosition(0);
        setControlsVisible(true);
      }),
    ];

    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [analytics, media.durationSeconds, player]);

  // Intento del controller → player. Una pausa salva la posizione di sessione.
  useEffect(() => {
    if (slot.isPlaying) {
      player.play();
    } else {
      player.pause();
      slotRef.current.savePosition(lastTimeRef.current);
    }
  }, [player, slot.isPlaying]);

  useEffect(() => {
    setPlayerMuted(player, slot.muted);
  }, [player, slot.muted]);

  // §15: i controlli si ritirano dopo l'inattività, ma solo in riproduzione.
  useEffect(() => {
    if (!controlsVisible || !slot.isPlaying) {
      return undefined;
    }

    const timer = setTimeout(() => setControlsVisible(false), PLAYER_CONTROLS_AUTO_HIDE_MS);

    return () => clearTimeout(timer);
  }, [controlsVisible, slot.isPlaying, touches]);

  // Smontaggio (§107): chiude la sessione di visione, salva la posizione e dice
  // al controller che questo video non c'è più. Il player lo libera il suo hook.
  useEffect(
    () => () => {
      analytics.onPaused(lastTimeRef.current);
      slotRef.current.savePosition(lastTimeRef.current);
      slotRef.current.release();
    },
    [analytics],
  );

  const controlsShown = controlsVisible || !slot.isPlaying || loadState === "error";

  function touch() {
    setControlsVisible(true);
    setTouches((count) => count + 1);
  }

  function handleTogglePlay() {
    touch();

    if (slot.isPlaying) {
      slot.pause();
      return;
    }

    if (hasPlayedToEnd(lastTimeRef.current, duration)) {
      seekPlayer(player, 0);
      lastTimeRef.current = 0;
      setCurrentTime(0);
    }

    slot.play();
  }

  function handleToggleMuted() {
    touch();
    trackFeed({ itemId, muted: !slot.muted, name: "feed_video_mute" });
    slot.setMuted(!slot.muted);
  }

  function handleEnterFullscreen() {
    touch();
    trackFeed({ itemId, name: "feed_video_fullscreen" });
    void viewRef.current?.enterFullscreen().catch(() => undefined);
  }

  function seekToSeconds(seconds: number) {
    touch();
    seekPlayer(player, seconds);
    lastTimeRef.current = seconds;
    setCurrentTime(seconds);
  }

  function handleRetry() {
    analytics.onRetry();
    setLoadState("loading");
    setHasFrame(false);
    const resumeAt = lastTimeRef.current;
    // replaceAsync: niente caricamento sincrono sul main thread iOS.
    void player
      .replaceAsync(source)
      .then(() => {
        seekPlayer(player, resumeAt);
        slotRef.current.play();
      })
      .catch(() => setLoadState("error"));
  }

  return (
    <View style={styles.fill} testID="feed-video-player">
      <VideoView
        // Come la miniatura (cover): nessun cambio d'inquadratura al primo fotogramma.
        // Il fullscreen nativo mostra il video intero.
        contentFit="cover"
        fullscreenOptions={FULLSCREEN_OPTIONS}
        nativeControls={false}
        onFirstFrameRender={() => setHasFrame(true)}
        player={player}
        ref={viewRef}
        style={styles.fill}
      />

      {!hasFrame && posterUri ? (
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="cover"
          source={{ uri: posterUri }}
          style={styles.fill}
        />
      ) : null}

      {loadState === "loading" && slot.isPlaying ? (
        <View pointerEvents="none" style={styles.centered}>
          <ActivityIndicator color={colors.inkInvert} />
        </View>
      ) : null}

      {/* Tap sul video: mostra/nasconde i controlli (§15). Non è un controllo
          di accessibilità: i controlli veri restano sempre raggiungibili. */}
      <Pressable
        accessible={false}
        onPress={() => (controlsVisible ? setControlsVisible(false) : touch())}
        style={styles.fill}
        testID="feed-video-surface"
      />

      {loadState === "error" ? (
        <View style={[styles.fill, styles.error]} testID="feed-video-error">
          <Ionicons color={colors.inkInvert} name="alert-circle-outline" size={26} />
          <AppText align="center" color="inverse" variant="bodySm">
            {VIDEO_PLAY_ERROR}
          </AppText>
          <Button
            accessibilityLabel={VIDEO_RETRY}
            label={VIDEO_RETRY}
            onPress={handleRetry}
            size="sm"
            variant="outline"
          />
        </View>
      ) : (
        <VideoPlayerControls
          currentTime={currentTime}
          duration={duration}
          isPlaying={slot.isPlaying}
          muted={slot.muted}
          onEnterFullscreen={handleEnterFullscreen}
          onSeekBy={(delta) => seekToSeconds(seekBy(currentTime, delta, duration))}
          onSeekRatio={(ratio) => seekToSeconds(seekTarget(ratio, duration))}
          onToggleMuted={handleToggleMuted}
          onTogglePlay={handleTogglePlay}
          visible={controlsShown}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  error: {
    alignItems: "center",
    backgroundColor: colors.mediaBadgeSurface,
    gap: spacing[8],
    justifyContent: "center",
    padding: spacing[16],
  },
  fill: {
    ...StyleSheet.absoluteFill,
  },
});
