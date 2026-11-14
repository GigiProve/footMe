/**
 * Store normalizzato dei Mi piace (HOM-07 §135–§137, §141–§142).
 *
 * Una cella per contenuto, chiave `<content_type>:<post_id>` → `{likesCount,
 * likedAs}`. Feed (due tab), dettaglio Post, dettaglio contenuto e Articolo/Video
 * leggono e scrivono la stessa cella: niente copie indipendenti dello stesso
 * conteggio per schermata (§135).
 *
 * Perché non una query cache: il toggle deve aggiornare SOLO la cella
 * abbonata (§136, §256). Patchare le pagine della infinite query del Feed
 * rigenerava l'array `items` e con lui la lista; qui si aggiorna una cella e
 * rirenderizza una sola action row.
 *
 * Seed e server source of truth: vince il dato server più RECENTE (§19,
 * §141–§142). Ogni cella porta `at`, l'istante della conoscenza server più
 * nuova che riflette; ogni seed porta l'istante in cui la richiesta del suo
 * payload è partita (`fetchedAt` della pagina, `dataUpdatedAt` della query).
 *  • un seed con istante ≤ `at` è un no-op: la pagina del Feed in cache, o la
 *    pagina 1 rimasta com'era quando si carica la 2, non cancella un Mi piace
 *    messo dopo;
 *  • un seed più nuovo (refetch, altro device) prevale;
 *  • durante un toggle in volo (`hold`) il seed non tocca lo stato mostrato:
 *    resta in attesa e, se è più nuovo della risposta (o se la richiesta
 *    fallisce), è lui lo stato finale;
 *  • la risposta del server a un toggle vale come dato dell'istante in cui è
 *    ARRIVATA (`write` con `at`): un fetch partito prima — anche dopo il tap,
 *    mentre la richiesta era in volo — non la sovrascrive;
 *  • un seed senza istante (`at` = 0) riempie solo una cella che non esiste.
 * La cella dice se il viewer ha messo Mi piace, non «chi»: `likedAs` contiene
 * solo identità del viewer (mai altrui).
 *
 * Privacy (§11 di DAS-REV, §141): logout e cambio account svuotano lo store in
 * modo SINCRONO dal SessionProvider (`resetUserInteractions`), prima che la
 * nuova sessione renderizzi; `bindOwner` resta come rete di sicurezza. Ogni
 * svuotamento incrementa `epoch`: una risposta partita per l'utente di prima
 * non scrive nello store del successivo.
 *
 * Singleton di modulo (come la coda del toggle): è uno stato di runtime, non
 * un contesto React. `createLikeStore` esiste per i test.
 */

import { useSyncExternalStore } from "react";

import {
  isLikedForDisplay,
  sameLikeSnapshot,
} from "./interaction-identity";
import type { InteractionIdentity, LikeSnapshot } from "./interaction-types";

type Entry = {
  state: LikeSnapshot;
  /** Istante (ms) della conoscenza server più recente riflessa da `state`; 0 = nessuno. */
  at: number;
  /** Seed arrivato durante un toggle in volo, più nuovo di `at`. */
  pendingSeed: { snapshot: LikeSnapshot; at: number } | null;
  /** Toggle in volo su questa cella. */
  holds: number;
};

type Listener = () => void;

export function likeItemKey(contentType: string, postId: string): string {
  return `${contentType}:${postId}`;
}

export function createLikeStore() {
  const entries = new Map<string, Entry>();
  const keyListeners = new Map<string, Set<Listener>>();
  const identityListeners = new Set<Listener>();
  let owner: string | null = null;
  let identity: InteractionIdentity | null = null;
  let epoch = 0;

  function wipe(nextOwner: string | null) {
    const keys = [...entries.keys()];
    entries.clear();
    owner = nextOwner;
    identity = null;
    epoch += 1;
    keys.forEach(notifyKey);
    notifyIdentity();
  }

  function notifyKey(key: string) {
    keyListeners.get(key)?.forEach((listener) => listener());
  }

  function notifyIdentity() {
    identityListeners.forEach((listener) => listener());
  }

  function apply(key: string, entry: Entry, snapshot: LikeSnapshot) {
    if (sameLikeSnapshot(entry.state, snapshot)) {
      return;
    }

    entry.state = snapshot;
    notifyKey(key);
  }

  return {
    get(key: string): LikeSnapshot | undefined {
      return entries.get(key)?.state;
    },

    subscribe(key: string, listener: Listener): () => void {
      const set = keyListeners.get(key) ?? new Set<Listener>();
      set.add(listener);
      keyListeners.set(key, set);

      return () => {
        set.delete(listener);
        if (set.size === 0) {
          keyListeners.delete(key);
        }
      };
    },

    /**
     * Dal payload di un contenuto; `at` è l'istante in cui la sua richiesta è
     * partita. Vedi la testa del file per le regole.
     */
    seed(key: string, snapshot: LikeSnapshot, at = 0) {
      const entry = entries.get(key);

      if (!entry) {
        entries.set(key, { at, holds: 0, pendingSeed: null, state: snapshot });
        notifyKey(key);
        return;
      }

      if (entry.holds > 0) {
        if (at > Math.max(entry.at, entry.pendingSeed?.at ?? 0)) {
          entry.pendingSeed = { at, snapshot };
        }
        return;
      }

      if (at <= entry.at) {
        return;
      }

      entry.at = at;
      apply(key, entry, snapshot);
    },

    /**
     * Stato ottimistico, confermato o ripristinato: lo scrive il motore del
     * toggle. Con `at` è la risposta del server all'istante del tap; senza, è
     * lo stato ottimistico o il ripristino dopo un errore.
     */
    write(key: string, snapshot: LikeSnapshot, at?: number) {
      const entry = entries.get(key);

      if (!entry) {
        entries.set(key, { at: at ?? 0, holds: 0, pendingSeed: null, state: snapshot });
        notifyKey(key);
        return;
      }

      // Toggle chiuso: un seed arrivato nel frattempo e più nuovo della
      // risposta (o di un ripristino, che non ha istante) è lo stato finale.
      const waiting = entry.holds === 0 ? entry.pendingSeed : null;
      if (entry.holds === 0) {
        entry.pendingSeed = null;
      }
      if (waiting && (at === undefined || waiting.at > at)) {
        entry.at = Math.max(entry.at, waiting.at);
        apply(key, entry, waiting.snapshot);
        return;
      }

      if (at !== undefined) {
        entry.at = Math.max(entry.at, at);
      }
      apply(key, entry, snapshot);
    },

    /**
     * Apre un toggle in volo. Se la cella non esiste ancora (la superficie
     * mostra il fallback del payload e il suo seed non è ancora partito) la
     * crea da `initial`, così un seed che arriva durante il volo resta in
     * attesa invece di sovrascrivere lo stato ottimistico.
     */
    hold(key: string, initial?: LikeSnapshot) {
      const entry = entries.get(key);
      if (entry) {
        entry.holds += 1;
        return;
      }
      if (initial) {
        entries.set(key, { at: 0, holds: 1, pendingSeed: null, state: initial });
      }
    },

    release(key: string) {
      const entry = entries.get(key);
      if (entry) {
        entry.holds = Math.max(0, entry.holds - 1);
      }
    },

    /** Un utente nuovo parte da uno store vuoto e senza identità. */
    bindOwner(ownerId: string) {
      if (!ownerId || owner === ownerId) {
        return;
      }

      // Il primo bind adotta ciò che è già stato seminato: i seed della prima
      // schermata possono precedere l'effetto che lega l'utente. Si svuota solo
      // passando da un utente a un altro.
      if (owner === null) {
        owner = ownerId;
        return;
      }

      wipe(ownerId);
    },

    /** Numero di generazione: cambia a ogni svuotamento (logout, cambio utente). */
    epoch(): number {
      return epoch;
    },

    getIdentity(): InteractionIdentity | null {
      return identity;
    },

    setIdentity(next: InteractionIdentity | null) {
      if (identity === next) {
        return;
      }

      identity = next;
      notifyIdentity();
    },

    subscribeIdentity(listener: Listener): () => void {
      identityListeners.add(listener);

      return () => {
        identityListeners.delete(listener);
      };
    },

    /** Logout, cambio account e test: store vuoto, nessun proprietario. */
    clear() {
      wipe(null);
    },
  };
}

export type LikeStore = ReturnType<typeof createLikeStore>;

export const likeStore: LikeStore = createLikeStore();

export type LikeView = {
  likesCount: number;
  isLiked: boolean;
};

/**
 * Lo stato di UN contenuto per la cella che lo mostra. Fino al primo seed vale
 * il payload ricevuto (`fallback`), poi la cella dello store (i seed più nuovi
 * la aggiornano dall'effetto della schermata). Il Mi piace è «messo» se
 * l'identità di interazione corrente compare in `likedAs`; finché l'identità
 * non è risolta vale l'identità personale (`isLikedForDisplay`).
 */
export function useLikeView(key: string, fallback: LikeSnapshot): LikeView {
  const stored = useSyncExternalStore(
    (listener) => likeStore.subscribe(key, listener),
    () => likeStore.get(key),
    () => likeStore.get(key),
  );
  const identity = useSyncExternalStore(
    likeStore.subscribeIdentity,
    likeStore.getIdentity,
    likeStore.getIdentity,
  );
  const snapshot = stored ?? fallback;

  return {
    isLiked: isLikedForDisplay(snapshot.likedAs, identity),
    likesCount: snapshot.likesCount,
  };
}
