/**
 * Store del conteggio commenti per contenuto (HOM-08 §87–§91, §209–§214, §312).
 *
 * Una cella per contenuto, chiave `likeItemKey(contentType, contentId)` — la stessa
 * del Mi piace (HOM-07). Feed (due tab), dettaglio Post, dettaglio Articolo/Video
 * e la sezione Commenti leggono e scrivono la STESSA cella: tornando al Feed la
 * cella Commenta mostra il conteggio aggiornato (§214), senza rileggere le pagine
 * della lista (§91, §210).
 *
 * Stessa disciplina di freschezza di `like-store` (HOM-07 §19, §141–§142), copiata
 * perché il problema è identico:
 *  • ogni cella porta `at`, l'istante della conoscenza server più nuova che riflette;
 *    ogni seed porta l'istante in cui la sua richiesta è PARTITA (`fetchedAt`);
 *  • un seed con istante ≤ `at` è un no-op: una pagina del Feed in cache non
 *    cancella un commento pubblicato dopo;
 *  • durante una mutazione in volo (`adjust` → `confirm` | `rollback`) la cella è
 *    TENUTA: un seed più nuovo resta in attesa e non rompe l'ottimistico; a
 *    mutazione chiusa, se è più recente della risposta, è lui lo stato finale;
 *  • la risposta del server a una mutazione vale come dato dell'istante in cui è
 *    ARRIVATA: un fetch partito prima non la sovrascrive;
 *  • un seed senza istante (`at` = 0) riempie solo una cella che non esiste.
 * Più mutazioni in volo sulla stessa cella: il valore mostrato è sempre
 * «conteggio confermato + somma dei delta non ancora confermati» (§100: un invio
 * fallito toglie solo il proprio +1).
 *
 * Privacy: logout e cambio account svuotano lo store in modo SINCRONO
 * (`resetUserInteractions`); ogni svuotamento incrementa `epoch`, così una
 * risposta partita per l'utente di prima non scrive in quello del successivo.
 */

import { useSyncExternalStore } from "react";

type Listener = () => void;

type Entry = {
  /** Conteggio confermato dal server (senza i delta ottimistici). */
  confirmed: number;
  /** Somma dei delta delle mutazioni non ancora chiuse. */
  pendingDelta: number;
  /** Mutazioni in volo su questa cella. */
  holds: number;
  at: number;
  pendingSeed: { count: number; at: number } | null;
};

function shown(entry: Entry): number {
  return Math.max(0, entry.confirmed + entry.pendingDelta);
}

export function createCommentCountStore() {
  const entries = new Map<string, Entry>();
  const listeners = new Map<string, Set<Listener>>();
  let epoch = 0;

  function notify(key: string) {
    listeners.get(key)?.forEach((listener) => listener());
  }

  /** Imposta il confermato e notifica solo se il valore mostrato cambia. */
  function setConfirmed(key: string, entry: Entry, count: number, at: number) {
    const before = shown(entry);
    entry.confirmed = Math.max(0, count);
    entry.at = Math.max(entry.at, at);
    if (shown(entry) !== before) {
      notify(key);
    }
  }

  /** Una mutazione si è chiusa: applica il seed in attesa se è più nuovo di ciò che la cella sa. */
  function flushPendingSeed(key: string, entry: Entry) {
    const waiting = entry.pendingSeed;
    if (entry.holds > 0 || !waiting) {
      return;
    }
    entry.pendingSeed = null;
    if (waiting.at > entry.at) {
      setConfirmed(key, entry, waiting.count, waiting.at);
    }
  }

  return {
    get(key: string): number | undefined {
      const entry = entries.get(key);
      return entry ? shown(entry) : undefined;
    },

    subscribe(key: string, listener: Listener): () => void {
      const set = listeners.get(key) ?? new Set<Listener>();
      set.add(listener);
      listeners.set(key, set);

      return () => {
        set.delete(listener);
        if (set.size === 0) {
          listeners.delete(key);
        }
      };
    },

    /** Dal payload di un contenuto; `fetchedAt` è l'istante in cui la sua richiesta è partita. */
    seed(key: string, count: number, fetchedAt = 0) {
      const entry = entries.get(key);

      if (!entry) {
        entries.set(key, {
          at: fetchedAt,
          confirmed: Math.max(0, count),
          holds: 0,
          pendingDelta: 0,
          pendingSeed: null,
        });
        notify(key);
        return;
      }

      if (entry.holds > 0) {
        if (fetchedAt > Math.max(entry.at, entry.pendingSeed?.at ?? 0)) {
          entry.pendingSeed = { at: fetchedAt, count };
        }
        return;
      }

      if (fetchedAt <= entry.at) {
        return;
      }

      setConfirmed(key, entry, count, fetchedAt);
    },

    /**
     * Dato del server di un istante preciso (contesto dei commenti, risposta di
     * una cancellazione, polling). Senza `at` vale «adesso». Durante una mutazione
     * in volo il valore mostrato resta confermato + delta.
     */
    apply(key: string, count: number, at: number = Date.now()) {
      const entry = entries.get(key);

      if (!entry) {
        entries.set(key, {
          at,
          confirmed: Math.max(0, count),
          holds: 0,
          pendingDelta: 0,
          pendingSeed: null,
        });
        notify(key);
        return;
      }

      if (at < entry.at) {
        return;
      }

      setConfirmed(key, entry, count, at);
    },

    /**
     * Mutazione ottimistica (§211–§212: +1 a ogni commento o risposta). `base` crea
     * la cella se la superficie mostrava ancora il fallback del payload.
     */
    adjust(key: string, delta: number, base?: number) {
      let entry = entries.get(key);

      if (!entry) {
        entry = {
          at: 0,
          confirmed: Math.max(0, base ?? 0),
          holds: 0,
          pendingDelta: 0,
          pendingSeed: null,
        };
        entries.set(key, entry);
      }

      entry.holds += 1;
      entry.pendingDelta += delta;
      notify(key);
    },

    /** La mutazione è riuscita: il conteggio del server, dell'istante della risposta. */
    confirm(key: string, delta: number, serverCount: number, at: number = Date.now()) {
      const entry = entries.get(key);
      if (!entry) {
        return;
      }

      const before = shown(entry);
      entry.holds = Math.max(0, entry.holds - 1);
      entry.pendingDelta -= delta;
      // Una risposta più vecchia di ciò che la cella già sa (arrivata fuori ordine) chiude la
      // mutazione ma non riscrive il conteggio confermato.
      if (at >= entry.at) {
        entry.confirmed = Math.max(0, serverCount);
        entry.at = at;
      }
      flushPendingSeed(key, entry);
      if (shown(entry) !== before) {
        notify(key);
      }
    },

    /** La mutazione è fallita (§100): si toglie solo il suo delta; un seed più nuovo è lo stato finale. */
    rollback(key: string, delta: number) {
      const entry = entries.get(key);
      if (!entry) {
        return;
      }

      const before = shown(entry);
      entry.holds = Math.max(0, entry.holds - 1);
      entry.pendingDelta -= delta;
      flushPendingSeed(key, entry);
      if (shown(entry) !== before) {
        notify(key);
      }
    },

    /** Numero di generazione: cambia a ogni svuotamento (logout, cambio utente). */
    epoch(): number {
      return epoch;
    },

    /** Logout, cambio account e test: store vuoto. */
    clear() {
      const keys = [...entries.keys()];
      entries.clear();
      epoch += 1;
      keys.forEach(notify);
    },
  };
}

export type CommentCountStore = ReturnType<typeof createCommentCountStore>;

export const commentCountStore: CommentCountStore = createCommentCountStore();

/**
 * Il conteggio di UN contenuto per la cella che lo mostra. Fino al primo seed vale
 * il payload ricevuto (`fallback`), poi la cella dello store.
 */
export function useCommentsCount(key: string, fallback: number): number {
  const stored = useSyncExternalStore(
    (listener) => commentCountStore.subscribe(key, listener),
    () => commentCountStore.get(key),
    () => commentCountStore.get(key),
  );

  return stored ?? fallback;
}
