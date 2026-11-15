/**
 * Store di sessione dei contenuti nascosti con «Non mi interessa» (HOM-11 §29–§36,
 * §51, §168–§170, §176).
 *
 * Una cella per target (`<content_type>:<content_id>`): è ciò che fa comparire il
 * placeholder compatto «Contenuto nascosto · Annulla» NELLA STESSA POSIZIONE del
 * Post (§29–§33), senza toccare le pagine della lista: l'elemento resta nei dati,
 * quindi Annulla lo rimette dov'era senza un salto di scroll (§34–§35). Lo stato
 * finale resta del server (§176): al refetch il server esclude il contenuto da Per
 * te (§170) e il placeholder sparisce con la lista (§36).
 *
 *  • `begin` → l'hide è OTTIMISTICO (§29): la cella nasce `pending`, senza id;
 *  • `settle` → il server ha risposto: `hidden` con il `feedback_id` (serve a Annulla
 *    e al motivo). Se nel frattempo l'utente ha annullato (cella tolta o di un altro
 *    tentativo) risponde `stale`, e chi chiama cancella la riga lato server;
 *  • `fail` → rollback (§51): la cella sparisce e il contenuto torna;
 *  • `restore` → Annulla (§34): la cella sparisce subito, anche con l'hide in volo.
 *
 * Privacy: logout e cambio account svuotano lo store in modo sincrono
 * (`resetUserInteractions`); `epoch` cambia a ogni svuotamento e una risposta partita
 * per l'utente di prima non tocca lo store del successivo.
 *
 * Singleton di modulo (come `likeStore`): è stato di runtime, non un contesto React.
 * `createHiddenContentStore` esiste per i test.
 */

import { useSyncExternalStore } from "react";

import type { HiddenEntry } from "./feed-feedback-types";

type Listener = () => void;

export type HiddenContentStore = ReturnType<typeof createHiddenContentStore>;

export function createHiddenContentStore() {
  const entries = new Map<string, HiddenEntry>();
  const keyListeners = new Map<string, Set<Listener>>();
  let attempts = 0;
  let epoch = 0;

  function emit(key: string): void {
    for (const listener of keyListeners.get(key) ?? []) {
      listener();
    }
  }

  return {
    /** Generazione dello store: cambia a ogni svuotamento (logout, cambio utente). */
    epoch(): number {
      return epoch;
    },

    get(key: string): HiddenEntry | undefined {
      return entries.get(key);
    },

    has(key: string): boolean {
      return entries.has(key);
    },

    /** §29: nasconde subito. Ritorna il numero del tentativo, o `null` se già nascosto. */
    begin(key: string): number | null {
      if (entries.has(key)) {
        return null;
      }
      attempts += 1;
      entries.set(key, { attempt: attempts, feedbackId: null, phase: "pending", reasonId: null });
      emit(key);
      return attempts;
    },

    /**
     * Conferma dal server. `stale` = la cella non c'è più o è di un altro tentativo:
     * l'utente ha annullato mentre la richiesta era in volo.
     */
    settle(key: string, attempt: number, feedbackId: string | null): "settled" | "stale" {
      const entry = entries.get(key);
      if (!entry || entry.attempt !== attempt) {
        return "stale";
      }
      entries.set(key, { ...entry, feedbackId, phase: "hidden" });
      emit(key);
      return "settled";
    },

    /** §51: rollback. Solo se la cella è ancora di questo tentativo. */
    fail(key: string, attempt: number): boolean {
      const entry = entries.get(key);
      if (!entry || entry.attempt !== attempt) {
        return false;
      }
      entries.delete(key);
      emit(key);
      return true;
    },

    /** §34: Annulla. Ritorna la cella com'era, per chi deve cancellare il feedback sul server. */
    restore(key: string): HiddenEntry | undefined {
      const entry = entries.get(key);
      if (entry) {
        entries.delete(key);
        emit(key);
      }
      return entry;
    },

    /** §50: il motivo scelto (o `null` per un rollback). Solo a hide confermato. */
    setReason(key: string, reasonId: string | null): boolean {
      const entry = entries.get(key);
      if (!entry || entry.phase !== "hidden") {
        return false;
      }
      entries.set(key, { ...entry, reasonId });
      emit(key);
      return true;
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

    /** Logout, cambio account e test. */
    clear(): void {
      entries.clear();
      epoch += 1;
      for (const set of keyListeners.values()) {
        for (const listener of set) {
          listener();
        }
      }
    },
  };
}

export const hiddenContentStore = createHiddenContentStore();

/** La cella di un target, aggiornata per cella: un hide non rirenderizza la lista. */
export function useHiddenContent(key: string | null): HiddenEntry | undefined {
  return useSyncExternalStore(
    (listener) => (key ? hiddenContentStore.subscribe(key, listener) : () => undefined),
    () => (key ? hiddenContentStore.get(key) : undefined),
    () => undefined,
  );
}

export function resetHiddenContentStore(): void {
  hiddenContentStore.clear();
}
