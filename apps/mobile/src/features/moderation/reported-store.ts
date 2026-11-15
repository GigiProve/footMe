/**
 * I target segnalati dal viewer in questa sessione (HOM-11 §123–§125, §131–§140,
 * §171, §292–§293).
 *
 * Dopo una segnalazione riuscita il target sparisce SUBITO dalla superficie del
 * reporter — il contenuto dal Feed (§125), il commento collassato in «Commento
 * segnalato» (§134–§135) — prima che il refetch porti il dato del server
 * (`viewer_has_reported`, esclusione in Per te e Seguiti). Vale solo per il reporter
 * (§123): non rimuove nulla per gli altri (§124). Vale anche per un «già segnalato»
 * scoperto sul server, che è lo stesso stato visto da un altro device (§295).
 *
 * Il menu legge lo stesso store: «Segnalazione inviata ✓» al posto di «Segnala»
 * (§130) anche se la riga in cache non lo sa ancora.
 *
 * Granularità: ogni target ha i propri listener (un commento segnalato non rirenderizza
 * il thread); le liste che devono filtrare usano `useReportedVersion`. Logout e cambio
 * account lo svuotano in modo sincrono (`resetUserInteractions`).
 *
 * Singleton di modulo; `createReportedStore` esiste per i test.
 */

import { useSyncExternalStore } from "react";

type Listener = () => void;

export type ReportedStore = ReturnType<typeof createReportedStore>;

export function createReportedStore() {
  const keys = new Set<string>();
  const keyListeners = new Map<string, Set<Listener>>();
  const globalListeners = new Set<Listener>();
  let version = 0;

  function emit(key: string): void {
    version += 1;
    for (const listener of keyListeners.get(key) ?? []) {
      listener();
    }
    for (const listener of globalListeners) {
      listener();
    }
  }

  return {
    add(key: string): void {
      if (!keys.has(key)) {
        keys.add(key);
        emit(key);
      }
    },

    has(key: string): boolean {
      return keys.has(key);
    },

    version(): number {
      return version;
    },

    subscribe(key: string, listener: Listener): () => void {
      let set = keyListeners.get(key);
      if (!set) {
        set = new Set();
        keyListeners.set(key, set);
      }
      set.add(listener);

      return () => {
        set.delete(listener);
        if (set.size === 0) {
          keyListeners.delete(key);
        }
      };
    },

    subscribeAll(listener: Listener): () => void {
      globalListeners.add(listener);
      return () => {
        globalListeners.delete(listener);
      };
    },

    /** Logout, cambio account e test. */
    clear(): void {
      keys.clear();
      version += 1;
      for (const listener of globalListeners) {
        listener();
      }
      for (const set of keyListeners.values()) {
        for (const listener of set) {
          listener();
        }
      }
    },
  };
}

export const reportedStore = createReportedStore();

/** Il target è stato segnalato dal viewer? Aggiornato per cella. */
export function useIsReported(key: string | null): boolean {
  return useSyncExternalStore(
    (listener) => (key ? reportedStore.subscribe(key, listener) : () => undefined),
    () => (key ? reportedStore.has(key) : false),
    () => false,
  );
}

/** Abbonamento all'intero insieme: per le liste che filtrano i contenuti segnalati. */
export function useReportedVersion(): number {
  return useSyncExternalStore(
    reportedStore.subscribeAll,
    reportedStore.version,
    reportedStore.version,
  );
}

export function resetReportedStore(): void {
  reportedStore.clear();
}
