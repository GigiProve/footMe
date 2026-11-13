import { createElement, forwardRef, useEffect, useImperativeHandle, useState } from "react";

/**
 * Doppio di `expo-video` per i test dei componenti video (HOM-03). Il modulo
 * vero cerca il modulo nativo all'import; qui il player è un oggetto in memoria
 * che registra le chiamate (play, pause, replace) e emette gli eventi su
 * richiesta del test (`player.emit("playingChange", { isPlaying: true })`).
 *
 * Si attiva per file con
 *   vi.mock("expo-video", () => import("<percorso>/src/test/expo-video"));
 */

type Listener = (payload?: unknown) => void;

export class FakeVideoPlayer {
  source: unknown;
  muted = false;
  currentTime = 0;
  duration = 0;
  status: "idle" | "loading" | "readyToPlay" | "error" = "loading";
  timeUpdateEventInterval = 0;
  playing = false;
  released = false;
  playCalls = 0;
  pauseCalls = 0;
  replaceCalls: unknown[] = [];
  private listeners = new Map<string, Set<Listener>>();

  constructor(source: unknown) {
    this.source = source;
  }

  play() {
    this.playing = true;
    this.playCalls += 1;
  }

  pause() {
    this.playing = false;
    this.pauseCalls += 1;
  }

  replace(source: unknown) {
    this.source = source;
    this.replaceCalls.push(source);
  }

  replaceAsync(source: unknown): Promise<void> {
    this.replace(source);

    return Promise.resolve();
  }

  addListener(event: string, listener: Listener) {
    const set = this.listeners.get(event) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(event, set);

    return { remove: () => set.delete(listener) };
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  /** Emette un evento come farebbe il player nativo. */
  emit(event: string, payload?: unknown) {
    this.listeners.get(event)?.forEach((listener) => listener(payload));
  }
}

export const videoMock = {
  fullscreenEnters: 0,
  players: [] as FakeVideoPlayer[],
  /** L'ultimo player creato: nei test con un solo video è quello. */
  get last(): FakeVideoPlayer {
    return this.players[this.players.length - 1];
  },
  reset() {
    this.players = [];
    this.fullscreenEnters = 0;
  },
};

export function useVideoPlayer(source: unknown, setup?: (player: FakeVideoPlayer) => void) {
  const [player] = useState(() => {
    const created = new FakeVideoPlayer(source);
    videoMock.players.push(created);
    setup?.(created);
    return created;
  });

  useEffect(
    () => () => {
      player.released = true;
    },
    [player],
  );

  return player;
}

export const VideoView = forwardRef(function VideoView(
  { player: _player, ...props }: Record<string, unknown>,
  ref,
) {
  useImperativeHandle(ref, () => ({
    enterFullscreen: async () => {
      videoMock.fullscreenEnters += 1;
    },
    exitFullscreen: async () => undefined,
  }));

  return createElement("VideoView", props);
});
