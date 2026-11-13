/**
 * HOM-03 §18–21, §105: il controller video dentro React.
 *
 * Pausa su background e blur (§77–79): `useFeedVideoLifecycle` in
 * use-feed-video-lifecycle.ts, separato perché è l'unico pezzo che dipende da
 * expo-router — le thumbnail importano solo lo slot.
 *
 * `useFeedVideoSlot` legge lo store con `useSyncExternalStore` e un selettore
 * per chiave che restituisce un numero: un cambio che riguarda un altro video
 * non ri-renderizza questo slot, e il progresso del player non passa mai di qui
 * (§105, resta locale al componente del player).
 *
 * Fuori da un `FeedVideoProvider` ogni chiamante riceve un controller locale:
 * le regole sono le stesse, lo stato no — il dettaglio non deve mettere in
 * pausa il Feed né esserne pausato. Attenzione: il controller locale è PER
 * CHIAMANTE. Una schermata con più video (dettaglio di una gallery, §29) prende
 * il suo con `useFeedVideoController()` e lo passa a un `FeedVideoProvider`,
 * altrimenti ogni slot avrebbe il proprio e due video potrebbero suonare
 * insieme.
 */

import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";

import {
  createFeedVideoController,
  type FeedVideoController,
} from "./feed-video-controller";

const FeedVideoContext = createContext<FeedVideoController | null>(null);

export function FeedVideoProvider({
  controller,
  children,
}: {
  controller: FeedVideoController;
  children: ReactNode;
}) {
  return <FeedVideoContext.Provider value={controller}>{children}</FeedVideoContext.Provider>;
}

/** Fuori da un provider crea un controller locale (dettagli). */
export function useFeedVideoController(): FeedVideoController {
  const fromContext = useContext(FeedVideoContext);
  // Inizializzazione pigra e incondizionata: gli hook non possono dipendere dal
  // provider, e un controller inutilizzato costa una closure.
  const [local] = useState(createFeedVideoController);
  return fromContext ?? local;
}

const CURRENT = 1;
const PLAYING = 2;
const MUTED = 4;

export type FeedVideoSlot = {
  isCurrent: boolean;
  isPlaying: boolean;
  muted: boolean;
  play(): void;
  pause(): void;
  setMuted(muted: boolean): void;
  startPosition: number;
  savePosition(seconds: number): void;
  release(): void;
};

/** useSyncExternalStore con selettore per chiave: un cambio di un altro video non ri-renderizza. */
export function useFeedVideoSlot(key: string, itemId: string): FeedVideoSlot {
  const controller = useFeedVideoController();

  // Un numero, non un oggetto: lo store confronta per identità. Il mute conta
  // solo per lo slot corrente, così attivare l'audio non ri-renderizza le
  // thumbnail del resto del Feed.
  const bits = useSyncExternalStore(controller.subscribe, () => {
    const snapshot = controller.getSnapshot();
    if (snapshot.currentKey !== key) {
      return 0;
    }
    return CURRENT | (snapshot.isPlaying ? PLAYING : 0) | (snapshot.muted ? MUTED : 0);
  });

  return {
    isCurrent: (bits & CURRENT) !== 0,
    isPlaying: (bits & PLAYING) !== 0,
    muted: (bits & MUTED) !== 0,
    play: () => controller.play(key, itemId),
    pause: () => controller.pause("user"),
    setMuted: (muted) => controller.setMuted(muted),
    startPosition: controller.getPosition(key),
    savePosition: (seconds) => controller.savePosition(key, seconds),
    release: () => controller.release(key),
  };
}
