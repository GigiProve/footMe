/**
 * HOM-03 §99–101: eventi grezzi di UNA sessione di visione, per HOME-05.
 *
 *  • §99 la thumbnail a schermo non è un play: `feed_video_play` parte solo al
 *    primo `onPlaying` (riproduzione reale), una volta per sessione (§100);
 *  • i quartili 25/50/75 partono una volta sola ciascuno, e solo se raggiunti
 *    guardando: un seek che li scavalca li consuma senza emetterli;
 *  • il tempo di visione si accumula dai salti di `currentTime` durante la
 *    riproduzione e si scrive su pausa, fine o smontaggio (il componente chiama
 *    `onPaused` anche quando si smonta). Un salto lungo è un seek, non visione;
 *  • §101 nessuna statistica: niente medie, retention o percentuali aggregate.
 *
 * Una sessione per montaggio del player: rimontarlo (Riprova, ritorno nel
 * viewport dopo uno smontaggio) è una sessione nuova.
 */

import { trackFeed, type FeedVideoSurface } from "./feed-analytics";

/** Oltre questo salto tra due letture di `currentTime` è un seek, non visione. */
const MAX_TICK_SECONDS = 2;

const QUARTILES = [25, 50, 75] as const;

export type VideoAnalyticsSession = {
  onPlaying(): void;
  onPaused(currentTime: number): void;
  /** `durationSeconds` del player, se il server non la conosceva. */
  onTime(currentTime: number, durationSeconds?: number | null): void;
  onEnd(): void;
  onError(): void;
  onRetry(): void;
};

export function createVideoAnalyticsSession(args: {
  itemId: string;
  mediaId: string;
  surface: FeedVideoSurface;
  durationSeconds: number | null;
}): VideoAnalyticsSession {
  const { itemId, mediaId, surface } = args;
  let duration = args.durationSeconds;
  let started = false;
  let playing = false;
  let completed = false;
  let lastTime: number | null = null;
  let watched = 0;
  const sentQuartiles = new Set<number>();

  const advance = (currentTime: number) => {
    if (!Number.isFinite(currentTime)) {
      return;
    }
    if (playing && lastTime !== null) {
      const delta = currentTime - lastTime;
      if (delta > 0 && delta <= MAX_TICK_SECONDS) {
        watched += delta;
      }
    }
    lastTime = currentTime;
  };

  const flushWatch = () => {
    const seconds = Math.round(watched);
    watched = 0;
    if (seconds > 0) {
      trackFeed({ itemId, mediaId, name: "feed_video_watch", seconds });
    }
  };

  return {
    onPlaying() {
      if (!started) {
        started = true;
        trackFeed({ itemId, mediaId, name: "feed_video_play", surface });
      }
      playing = true;
    },
    onPaused(currentTime) {
      advance(currentTime);
      playing = false;
      flushWatch();
    },
    onTime(currentTime, durationSeconds) {
      if (durationSeconds && durationSeconds > 0) {
        duration = durationSeconds;
      }
      if (!playing) {
        lastTime = currentTime;
        return;
      }
      const previous = lastTime;
      advance(currentTime);
      if (!duration || duration <= 0) {
        return;
      }
      const step = previous === null ? Number.NaN : currentTime - previous;
      const watchedThrough = step >= 0 && step <= MAX_TICK_SECONDS;
      const percent = (currentTime / duration) * 100;
      for (const quartile of QUARTILES) {
        if (percent >= quartile && !sentQuartiles.has(quartile)) {
          sentQuartiles.add(quartile);
          if (watchedThrough) {
            trackFeed({ itemId, mediaId, name: "feed_video_progress", percent: quartile });
          }
        }
      }
    },
    onEnd() {
      if (duration && duration > 0) {
        advance(duration);
      }
      playing = false;
      flushWatch();
      if (started && !completed) {
        completed = true;
        trackFeed({ itemId, mediaId, name: "feed_video_complete" });
      }
    },
    onError() {
      playing = false;
      flushWatch();
      trackFeed({ itemId, mediaId, name: "feed_video_error" });
    },
    onRetry() {
      trackFeed({ itemId, mediaId, name: "feed_video_retry" });
    },
  };
}
