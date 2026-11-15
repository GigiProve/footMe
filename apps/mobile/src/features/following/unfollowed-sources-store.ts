/**
 * Le fonti non più seguite in questa sessione (HOM-11 §62–§65, §172–§173, §246).
 *
 * «Non seguire» aggiorna il Follow GLOBALE (`profile_follows` / `club_follows`) e,
 * qui, un insieme di sessione che serve a tre cose:
 *  • «Seguiti»: una pagina successiva della stessa sessione non deve reintrodurre i
 *    contenuti della fonte appena lasciata (§65) — la lista li filtra contro questo
 *    insieme mentre le pagine in cache sono già state ripulite (§64);
 *  • il menu: «Non seguire <nome>» non resta offerto per una fonte già lasciata (§54),
 *    anche se la riga in cache o il commento non lo sanno ancora;
 *  • Annulla (§61): `remove` rimette la fonte fra le seguite.
 *
 * Lo stato finale è del server (§173): una voce vale solo finché un dato server PIÙ NUOVO
 * non la smentisce. Come negli store HOM-07, ogni voce porta `at`, l'istante da cui il
 * server conferma la rimozione:
 *  • al tap `at = Infinity` (la scrittura è in volo: nessun dato server può smentirla — una
 *    pagina partita prima che il server cancelli la riga direbbe ancora «segui»);
 *  • `settle` la fissa all'istante della risposta riuscita;
 *  • `reconcile(key, serverAt)` toglie la voce se un payload server partito DOPO (`serverAt`
 *    > `at`) dice che la fonte è seguita: l'utente l'ha ri-seguita da un'altra superficie
 *    (profilo, Cerca, lista Mi piace) e lì nessuno tocca questo store.
 *
 * Logout e cambio account lo svuotano in modo sincrono (`resetUserInteractions`).
 *
 * Singleton di modulo; `createUnfollowedSourcesStore` esiste per i test.
 */

import { useSyncExternalStore } from "react";

type Listener = () => void;

export type UnfollowedSourcesStore = ReturnType<typeof createUnfollowedSourcesStore>;

export function createUnfollowedSourcesStore() {
  const entries = new Map<string, number>();
  const listeners = new Set<Listener>();
  let version = 0;

  function emit(): void {
    version += 1;
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    /** Tap: la voce nasce con la scrittura in volo (`at = Infinity`), nessun dato server la smentisce. */
    add(key: string, at: number = Number.POSITIVE_INFINITY): void {
      if (entries.get(key) !== at) {
        entries.set(key, at);
        emit();
      }
    },

    /** Risposta riuscita: da `at` in poi il server conferma la rimozione. */
    settle(key: string, at: number): void {
      if (entries.has(key)) {
        entries.set(key, at);
      }
    },

    /**
     * Un payload server partito a `serverAt` dice che la fonte è SEGUITA. Se è più nuovo della
     * rimozione confermata, vince il server (§173). Ritorna true se la voce è stata tolta.
     */
    reconcile(key: string, serverAt: number): boolean {
      const at = entries.get(key);
      if (at === undefined || serverAt <= at) {
        return false;
      }
      entries.delete(key);
      emit();
      return true;
    },

    remove(key: string): void {
      if (entries.delete(key)) {
        emit();
      }
    },

    has(key: string): boolean {
      return entries.has(key);
    },

    size(): number {
      return entries.size;
    },

    version(): number {
      return version;
    },

    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    /** Logout, cambio account e test. */
    clear(): void {
      entries.clear();
      emit();
    },
  };
}

export const unfollowedSourcesStore = createUnfollowedSourcesStore();

/** La fonte è stata lasciata in questa sessione? */
export function useIsSourceUnfollowed(key: string | null): boolean {
  return useSyncExternalStore(
    unfollowedSourcesStore.subscribe,
    () => (key ? unfollowedSourcesStore.has(key) : false),
    () => false,
  );
}

/** Abbonamento all'insieme: per la lista Seguiti che filtra le fonti lasciate. */
export function useUnfollowedVersion(): number {
  return useSyncExternalStore(
    unfollowedSourcesStore.subscribe,
    unfollowedSourcesStore.version,
    unfollowedSourcesStore.version,
  );
}

export function resetUnfollowedSourcesStore(): void {
  unfollowedSourcesStore.clear();
}
