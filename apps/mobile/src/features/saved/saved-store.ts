/**
 * Store normalizzato dei Salvati (HOM-07 §130–§137, B2).
 *
 * Un solo booleano per target — `<target_type>:<content_type|->:<id>` — letto e
 * scritto da ogni superficie (Feed •••, bookmark Articolo/Video, dettaglio,
 * Cerca profili/società/media/posizioni, profilo pubblico, Dashboard, Saved
 * Center). Nessuna schermata tiene una copia indipendente (§134): le sorgenti
 * (payload del Feed, flag di Cerca, `list_saved`) *seminano* lo store, non lo
 * sostituiscono.
 *
 * Regola di sincronizzazione: vince il dato server più RECENTE (§19, §141–§143).
 * Ogni cella porta `at`, l'istante della conoscenza server più nuova che
 * riflette; ogni seme porta l'istante in cui la sua richiesta è partita
 * (`fetchedAt` della pagina o `dataUpdatedAt` della query).
 *  • un seme più vecchio o uguale a `at` non cambia nulla: è una pagina in
 *    cache (Feed, Cerca, pagina 1 di una lista che ha appena caricato la 2)
 *    rimasta com'era prima del tap o di un dato più fresco;
 *  • un seme più nuovo prevale (refetch, altro device: §142–§143);
 *  • durante una mutazione il valore mostrato resta quello del tap; un seme
 *    più nuovo aggiorna solo il valore a cui un eventuale rollback torna;
 *  • una mutazione riuscita vale come dato server dell'istante della risposta:
 *    un fetch partito prima — anche dopo il tap, mentre la scrittura era in
 *    volo — non può più sovrascriverla.
 * Un seme senza istante (`at` = 0) riempie solo una cella che non esiste.
 *
 * Privacy (§70, §103): logout e cambio account svuotano lo store in modo
 * sincrono dal SessionProvider (`resetUserInteractions`); `epoch` cambia a
 * ogni svuotamento e una scrittura partita per l'utente di prima non tocca lo
 * store del successivo.
 *
 * Granularità (§136–§137): ogni cella ha i propri listener, quindi un toggle
 * rirenderizza solo la riga abbonata e non la Home. Le liste che devono
 * ricalcolare un insieme (Cerca) usano l'abbonamento globale a `version`.
 */

import { useEffect, useSyncExternalStore } from "react";

import type { SavedContentType, SavedTarget } from "./saved-types";

export type SavedEntry = {
  /** Valore mostrato. */
  readonly value: boolean;
  /** Ultimo valore confermato dal server (seme o mutazione riuscita); null = ignoto. */
  readonly settled: boolean | null;
  /** Istante (ms) della conoscenza server più recente riflessa dalla cella; 0 = nessuno. */
  readonly at: number;
  /** Mutazioni in volo per questo target. */
  readonly pending: number;
  /** Numero d'ordine dell'ultima mutazione: solo la più recente fa rollback. */
  readonly seq: number;
};

type Listener = () => void;

const entries = new Map<string, SavedEntry>();
const keyListeners = new Map<string, Set<Listener>>();
const globalListeners = new Set<Listener>();
let version = 0;
let sequence = 0;
let epoch = 0;

/** Generazione dello store: cambia a ogni svuotamento (logout, cambio utente). */
export function getSavedEpoch(): number {
  return epoch;
}

/** Il target di un contenuto del Feed/dettaglio: `<content_type>` + `post_id`. */
export function contentSavedTarget(contentType: SavedContentType, postId: string): SavedTarget {
  return { contentType, id: postId, type: "content" };
}

export function savedKey(target: SavedTarget): string {
  return target.type === "content"
    ? `content:${target.contentType}:${target.id}`
    : `${target.type}:-:${target.id}`;
}

// ── Lettura pura ────────────────────────────────────────────────

/**
 * Il valore da mostrare data la cella e l'eventuale seme della superficie con
 * il suo istante. Funzione pura: è ciò che i test verificano.
 */
export function resolveSaved(entry: SavedEntry | undefined, seed?: boolean, seedAt = 0): boolean {
  if (!entry) {
    return seed ?? false;
  }
  if (seed === undefined || entry.pending > 0) {
    return entry.value;
  }
  return seedAt > entry.at ? seed : entry.value;
}

export function getSavedEntry(key: string): SavedEntry | undefined {
  return entries.get(key);
}

/** Il valore corrente senza abbonarsi: per i gestori di tap. */
export function getSavedValue(target: SavedTarget, seed?: boolean, seedAt = 0): boolean {
  return resolveSaved(entries.get(savedKey(target)), seed, seedAt);
}

// ── Scrittura ───────────────────────────────────────────────────

function emit(key: string): void {
  version += 1;
  for (const listener of keyListeners.get(key) ?? []) {
    listener();
  }
  for (const listener of globalListeners) {
    listener();
  }
}

function write(key: string, next: SavedEntry): void {
  const previous = entries.get(key);
  if (
    previous &&
    previous.value === next.value &&
    previous.settled === next.settled &&
    previous.at === next.at &&
    previous.pending === next.pending &&
    previous.seq === next.seq
  ) {
    return;
  }
  entries.set(key, next);
  emit(key);
}

/**
 * Semina da una sorgente server. `at` è l'istante in cui la richiesta della
 * sorgente è partita; 0 = sconosciuto (riempie solo una cella mancante).
 */
export function seedSaved(key: string, serverValue: boolean, at = 0): void {
  const entry = entries.get(key);

  if (!entry) {
    write(key, { at, pending: 0, seq: 0, settled: serverValue, value: serverValue });
    return;
  }
  if (at <= entry.at) {
    return;
  }
  if (entry.pending > 0) {
    // Il tap resta visibile; il rollback, se serve, torna a questo dato.
    write(key, { ...entry, at, settled: serverValue });
    return;
  }

  write(key, { ...entry, at, settled: serverValue, value: serverValue });
}

/** Scrittura ottimistica (§94): ritorna il numero d'ordine della mutazione. */
export function beginSavedMutation(key: string, nextValue: boolean): number {
  const entry = entries.get(key);
  sequence += 1;
  write(key, {
    at: entry?.at ?? 0,
    pending: (entry?.pending ?? 0) + 1,
    seq: sequence,
    settled: entry?.settled ?? null,
    value: nextValue,
  });
  return sequence;
}

/**
 * Chiude una mutazione. In caso di errore la più recente torna all'ultimo
 * valore confermato dal server (o, se ignoto, a `rollbackTo`, cioè lo stato
 * prima del tap): con due tap ravvicinati l'esito del secondo non viene
 * cancellato dal fallimento del primo, e viceversa. Un successo vale come dato
 * server dell'istante del tap: i fetch partiti prima non lo sovrascrivono.
 */
export function endSavedMutation(
  key: string,
  seq: number,
  outcome: { ok: true; value: boolean } | { ok: false; rollbackTo: boolean },
): void {
  const entry = entries.get(key);
  if (!entry) {
    return;
  }

  const pending = Math.max(0, entry.pending - 1);
  const isLatest = entry.seq === seq;

  write(key, {
    // Dato server dell'istante della risposta (§19, §141).
    at: outcome.ok ? Math.max(entry.at, Date.now()) : entry.at,
    pending,
    seq: entry.seq,
    settled: outcome.ok ? outcome.value : entry.settled,
    value: outcome.ok
      ? entry.value
      : isLatest
        ? (entry.settled ?? outcome.rollbackTo)
        : entry.value,
  });
}

/** Logout, cambio account e test. */
export function resetSavedStore(): void {
  entries.clear();
  version += 1;
  sequence = 0;
  epoch += 1;
  for (const listener of globalListeners) {
    listener();
  }
  for (const set of keyListeners.values()) {
    for (const listener of set) {
      listener();
    }
  }
}

// ── Abbonamento ─────────────────────────────────────────────────

function subscribeKey(key: string, listener: Listener): () => void {
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
}

function subscribeAll(listener: Listener): () => void {
  globalListeners.add(listener);
  return () => {
    globalListeners.delete(listener);
  };
}

/**
 * Lo stato di un target, aggiornato per cella. `seed` è il valore che la
 * superficie ha dal proprio payload (Feed, dettaglio, riga di Cerca) e
 * `seedAt` l'istante in cui quel payload è stato richiesto: semina lo store e
 * prevale solo se è più recente di ciò che lo store sa già (§141).
 */
export function useIsSaved(target: SavedTarget | null, seed?: boolean, seedAt = 0): boolean {
  const key = target ? savedKey(target) : null;

  const entry = useSyncExternalStore(
    (listener) => (key ? subscribeKey(key, listener) : () => undefined),
    () => (key ? entries.get(key) : undefined),
    () => undefined,
  );

  useEffect(() => {
    if (key && seed !== undefined) {
      seedSaved(key, seed, seedAt);
    }
  }, [key, seed, seedAt]);

  return resolveSaved(entry, seed, seedAt);
}

/** Abbonamento all'intero store: per le liste che ricalcolano un insieme di id. */
export function useSavedStoreVersion(): number {
  return useSyncExternalStore(subscribeAll, () => version, () => version);
}
