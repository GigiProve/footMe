/**
 * Il comando di salvataggio, senza React (HOM-07 §94, §99, §130–§133, §189).
 *
 * Due tempi, perché l'aggiornamento ottimistico deve avvenire nello stesso tick
 * del tap e non dopo i microtask di una mutation (§94):
 *  • `beginSetSaved` scrive lo store subito e ritorna un «biglietto»;
 *  • `commitSetSaved` accoda la scrittura per target (due tap ravvicinati
 *    arrivano al server nell'ordine in cui sono stati dati: la RPC è
 *    idempotente, ma l'ultimo stato deve essere quello voluto) e, se fallisce,
 *    riporta lo store all'ultimo stato confermato prima di rilanciare l'errore.
 *
 * `runSetSaved` li fa di seguito; `setSavedTracked` ci aggiunge gli eventi di
 * prodotto (tentativo, successo, fallimento: §189) ed è ciò che usano le
 * mutation e le schermate con un proprio feedback, come il profilo pubblico.
 *
 * Sta fuori dagli hook perché lo usano anche i flussi che hanno già la propria
 * mutation con le proprie patch di cache (Dashboard, tab Salvate di Posizioni).
 */

import { targetProps, trackSaved, type SavedSurface } from "./saved-analytics";
import { setSavedRemote } from "./saved-service";
import { beginSavedMutation, endSavedMutation, getSavedEpoch, savedKey } from "./saved-store";
import type { SavedTarget } from "./saved-types";

/** `epoch`: generazione dello store al tap; se cambia (logout) l'esito non lo tocca. */
export type SavedTicket = { key: string; saved: boolean; seq: number; epoch: number };

const chains = new Map<string, Promise<unknown>>();

/** Logout o cambio account: nessuna coda dell'utente di prima. */
export function resetSavedCommands(): void {
  chains.clear();
}

/** Esegue `task` dopo che le scritture precedenti dello stesso target sono finite, riuscite o no. */
function serialize<T>(key: string, task: () => Promise<T>): Promise<T> {
  const prior = chains.get(key);
  // Senza scritture in volo la RPC parte subito, nello stesso tick del tap.
  const run = prior ? prior.then(task, task) : task();
  const tail = run.then(
    () => undefined,
    () => undefined,
  );

  chains.set(key, tail);
  void tail.then(() => {
    if (chains.get(key) === tail) {
      chains.delete(key);
    }
  });

  return run;
}

/** Scrive lo store in modo ottimistico, in modo sincrono. */
export function beginSetSaved(target: SavedTarget, saved: boolean): SavedTicket {
  const key = savedKey(target);
  return { epoch: getSavedEpoch(), key, saved, seq: beginSavedMutation(key, saved) };
}

/** Scrive sul server; su errore riporta lo store all'ultimo stato confermato e rilancia. */
export async function commitSetSaved(target: SavedTarget, ticket: SavedTicket): Promise<void> {
  try {
    await serialize(ticket.key, () => setSavedRemote(target, ticket.saved));
    if (ticket.epoch === getSavedEpoch()) {
      endSavedMutation(ticket.key, ticket.seq, { ok: true, value: ticket.saved });
    }
  } catch (error) {
    if (ticket.epoch === getSavedEpoch()) {
      endSavedMutation(ticket.key, ticket.seq, { ok: false, rollbackTo: !ticket.saved });
    }
    throw error;
  }
}

export function runSetSaved(target: SavedTarget, saved: boolean): Promise<void> {
  return commitSetSaved(target, beginSetSaved(target, saved));
}

/**
 * `runSetSaved` + gli eventi del §189. Se il chiamante ha già aperto il
 * biglietto (aggiornamento ottimistico al tap) lo si passa, altrimenti si apre
 * qui. Gli eventi non portano mai id o testo del contenuto (§190).
 */
export async function setSavedTracked(
  target: SavedTarget,
  saved: boolean,
  surface: SavedSurface,
  ticket?: SavedTicket,
): Promise<void> {
  const opened = ticket ?? beginSetSaved(target, saved);
  const props = targetProps(target, surface);

  trackSaved(
    saved ? { name: "save_attempt", ...props } : { name: "unsave_attempt", ...props },
  );

  try {
    await commitSetSaved(target, opened);
  } catch (error) {
    trackSaved({ action: saved ? "save" : "unsave", name: "save_failure", ...props });
    throw error;
  }

  trackSaved(
    saved ? { name: "save_success", ...props } : { name: "unsave_success", ...props },
  );
}
