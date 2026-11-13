/**
 * HOM-03 §18–21, §77–81: chi può riprodurre, e quando smettere.
 *
 * Un controller per superficie (il Feed, o un dettaglio), puro TypeScript: le
 * regole stanno qui una volta sola invece che dentro ogni componente (§19 "la
 * soglia deve essere gestita centralmente").
 *
 *  • §18 un solo video corrente: `play` su un'altra chiave lo sostituisce, e il
 *    player precedente si smonta (la sua posizione è già salvata);
 *  • §19 fuori viewport → pausa; la soglia è `FEED_VIDEO_VISIBLE_PERCENT`;
 *  • §20, §78 dopo una pausa non si riprende MAI da soli: nessun metodo rimette
 *    `isPlaying` a true se non `play`, che arriva solo da un tap;
 *  • §21 la posizione vive in memoria per la sessione, non su disco;
 *  • §81 il mute è di sessione: un video nuovo eredita la scelta precedente.
 *
 * Lo snapshot è immutabile e cambia identità solo quando cambia davvero, come
 * richiede `useSyncExternalStore` (vedi use-feed-video.tsx).
 */

/** §19: percentuale minima dell'elemento a schermo perché il video resti attivo. */
export const FEED_VIDEO_VISIBLE_PERCENT = 50;

export type FeedVideoPauseReason =
  | "user"
  | "viewport"
  | "tab"
  | "blur"
  | "background"
  | "replaced";

export type FeedVideoSnapshot = {
  currentKey: string | null;
  isPlaying: boolean;
  muted: boolean;
};

export type FeedVideoController = {
  getSnapshot(): FeedVideoSnapshot;
  subscribe(listener: () => void): () => void;
  /** key = videoKey(itemId, mediaId). Diventa l'unico corrente e in riproduzione (§18). */
  play(key: string, itemId: string): void;
  /** isPlaying=false, currentKey invariato: il player resta montato e mostra il fotogramma. */
  pause(reason: FeedVideoPauseReason): void;
  /** Smontaggio del player: se è il corrente, non c'è più un corrente. */
  release(key: string): void;
  /** Il corrente non visibile oltre la soglia → pause("viewport"). */
  reportVisibleItems(itemIds: ReadonlySet<string>): void;
  /** Di sessione (§81). */
  setMuted(muted: boolean): void;
  /** Sessione in memoria (§21). */
  savePosition(key: string, seconds: number): void;
  /** 0 se ignota. */
  getPosition(key: string): number;
};

/** Chiave di un video: lo stesso Post può contenere più video (§29). */
export function videoKey(itemId: string, mediaId: string): string {
  return `${itemId}#${mediaId}`;
}

export function createFeedVideoController(): FeedVideoController {
  let snapshot: FeedVideoSnapshot = { currentKey: null, isPlaying: false, muted: false };
  let currentItemId: string | null = null;
  const listeners = new Set<() => void>();
  const positions = new Map<string, number>();

  const update = (next: Partial<FeedVideoSnapshot>) => {
    const merged = { ...snapshot, ...next };
    if (
      merged.currentKey === snapshot.currentKey &&
      merged.isPlaying === snapshot.isPlaying &&
      merged.muted === snapshot.muted
    ) {
      return;
    }
    snapshot = merged;
    for (const listener of [...listeners]) {
      listener();
    }
  };

  const pause = () => {
    if (snapshot.isPlaying) {
      update({ isPlaying: false });
    }
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    play(key, itemId) {
      // Un'altra chiave corrente viene sostituita ("replaced"): il suo slot
      // non è più corrente, smonta il player e ha già salvato la posizione.
      currentItemId = itemId;
      update({ currentKey: key, isPlaying: true });
    },
    // Il motivo non cambia l'esito (sempre pausa, mai ripresa automatica): esiste
    // per i chiamanti e per chi legge, come documentazione eseguibile.
    pause: () => pause(),
    release(key) {
      if (snapshot.currentKey !== key) {
        return;
      }
      currentItemId = null;
      update({ currentKey: null, isPlaying: false });
    },
    reportVisibleItems(itemIds) {
      if (snapshot.isPlaying && currentItemId !== null && !itemIds.has(currentItemId)) {
        pause();
      }
    },
    setMuted(muted) {
      update({ muted });
    },
    savePosition(key, seconds) {
      if (Number.isFinite(seconds) && seconds >= 0) {
        positions.set(key, seconds);
      }
    },
    getPosition: (key) => positions.get(key) ?? 0,
  };
}
