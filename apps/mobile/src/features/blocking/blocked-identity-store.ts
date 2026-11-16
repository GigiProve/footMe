/**
 * Store normalizzato di sessione dei Block (HOM-12 §193–§194, §198–§205, §208–§210).
 *
 * Una cella per target (`blockTargetKey`): è ciò che fa passare nello STESSO istante
 * profilo, chat e liste allo stato «bloccato» senza copie per schermata. Il backend
 * resta la fonte di verità (§194): ogni lettura server (`seed`) più recente della
 * cella la riallinea, ed è così che un Block fatto su un altro device converge (§209).
 *
 *  • `beginBlock` → ottimistico (§198): la cella nasce `pending_block`; un doppio tap
 *    (cella già bloccata o in volo) ritorna `null` e non parte una seconda richiesta (§206);
 *  • `settleBlock` → `blocked` con il `block_id`; `failBlock` → ROLLBACK completo alla
 *    fase di prima (§199, §201);
 *  • `beginUnblock` / `settleUnblock` / `failUnblock` → durante lo sblocco la UI resta
 *    bloccata (§205), e se fallisce il Block resta (§203);
 *  • `seed(key, blocked, blockId, at)` → dato server dell'istante `at`: non tocca una
 *    cella con un tentativo in volo, e non sovrascrive conoscenza più recente.
 *
 * Privacy: logout e cambio account lo svuotano in modo sincrono
 * (`resetUserInteractions`); `epoch` cambia a ogni svuotamento e una risposta partita
 * per l'utente di prima non scrive nello store del successivo.
 *
 * Singleton di modulo (come `likeStore`); `createBlockedIdentityStore` esiste per i test.
 */

import { useSyncExternalStore } from "react";

import { isBlockedPhase } from "./blocking-presentation";
import type { BlockEntry } from "./blocking-types";

type Listener = () => void;

export type BlockedIdentityStore = ReturnType<typeof createBlockedIdentityStore>;

export function createBlockedIdentityStore() {
  const entries = new Map<string, BlockEntry>();
  const keyListeners = new Map<string, Set<Listener>>();
  let attempts = 0;
  let epoch = 0;

  function emit(key: string): void {
    for (const listener of keyListeners.get(key) ?? []) {
      listener();
    }
  }

  function nextAttempt(): number {
    attempts += 1;
    return attempts;
  }

  function settled(entry: BlockEntry): "blocked" | "unblocked" {
    return entry.phase === "blocked" || entry.phase === "pending_unblock" ? "blocked" : "unblocked";
  }

  return {
    epoch(): number {
      return epoch;
    },

    get(key: string): BlockEntry | undefined {
      return entries.get(key);
    },

    /** `true`/`false` se la cella esiste, `null` se lo store non sa nulla del target. */
    isBlocked(key: string): boolean | null {
      const entry = entries.get(key);
      return entry ? isBlockedPhase(entry) : null;
    },

    /** §198: blocca subito. `null` se già bloccato o in volo (doppio tap, §206). */
    beginBlock(key: string): number | null {
      const entry = entries.get(key);
      if (entry && (isBlockedPhase(entry) || entry.phase === "pending_block")) {
        return null;
      }
      const attempt = nextAttempt();
      entries.set(key, {
        at: entry?.at ?? 0,
        attempt,
        blockId: entry?.blockId ?? null,
        phase: "pending_block",
        previous: "unblocked",
      });
      emit(key);
      return attempt;
    },

    settleBlock(key: string, attempt: number, blockId: string | null, at: number): boolean {
      const entry = entries.get(key);
      if (!entry || entry.attempt !== attempt || entry.phase !== "pending_block") {
        return false;
      }
      entries.set(key, { at, attempt, blockId, phase: "blocked", previous: null });
      emit(key);
      return true;
    },

    /** §199, §201: rollback alla fase di prima, nessuno stato parziale. */
    failBlock(key: string, attempt: number): boolean {
      const entry = entries.get(key);
      if (!entry || entry.attempt !== attempt || entry.phase !== "pending_block") {
        return false;
      }
      entries.set(key, { ...entry, phase: "unblocked", previous: null });
      emit(key);
      return true;
    },

    /** §202: `null` se il target non è bloccato o lo sblocco è già in volo (§207). */
    beginUnblock(key: string, knownBlockId: string | null = null): number | null {
      const entry = entries.get(key);
      if (entry && (entry.phase === "pending_unblock" || entry.phase === "pending_block")) {
        return null;
      }
      if (entry?.phase === "unblocked") {
        return null;
      }
      const attempt = nextAttempt();
      entries.set(key, {
        at: entry?.at ?? 0,
        attempt,
        blockId: entry?.blockId ?? knownBlockId,
        phase: "pending_unblock",
        previous: "blocked",
      });
      emit(key);
      return attempt;
    },

    settleUnblock(key: string, attempt: number, at: number): boolean {
      const entry = entries.get(key);
      if (!entry || entry.attempt !== attempt || entry.phase !== "pending_unblock") {
        return false;
      }
      entries.set(key, { at, attempt, blockId: null, phase: "unblocked", previous: null });
      emit(key);
      return true;
    },

    /** §203, §205: lo sblocco fallito lascia il Block attivo. */
    failUnblock(key: string, attempt: number): boolean {
      const entry = entries.get(key);
      if (!entry || entry.attempt !== attempt || entry.phase !== "pending_unblock") {
        return false;
      }
      entries.set(key, { ...entry, phase: "blocked", previous: null });
      emit(key);
      return true;
    },

    /**
     * Dato letto dal server all'istante `at` (availability, meta chat, lista). Con un
     * tentativo in volo non tocca la cella; con conoscenza più recente è un no-op.
     */
    seed(key: string, blocked: boolean, blockId: string | null, at: number): void {
      const entry = entries.get(key);

      if (!entry) {
        entries.set(key, {
          at,
          attempt: 0,
          blockId: blocked ? blockId : null,
          phase: blocked ? "blocked" : "unblocked",
          previous: null,
        });
        emit(key);
        return;
      }
      if (entry.phase === "pending_block" || entry.phase === "pending_unblock") {
        return;
      }
      if (at <= entry.at) {
        return;
      }
      if (settled(entry) === (blocked ? "blocked" : "unblocked")) {
        entries.set(key, { ...entry, at, blockId: blocked ? (blockId ?? entry.blockId) : null });
        return;
      }
      entries.set(key, {
        at,
        attempt: entry.attempt,
        blockId: blocked ? blockId : null,
        phase: blocked ? "blocked" : "unblocked",
        previous: null,
      });
      emit(key);
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

export const blockedIdentityStore = createBlockedIdentityStore();

/** La cella di un target, aggiornata per cella. */
export function useBlockEntry(key: string | null): BlockEntry | undefined {
  return useSyncExternalStore(
    (listener) => (key ? blockedIdentityStore.subscribe(key, listener) : () => undefined),
    () => (key ? blockedIdentityStore.get(key) : undefined),
    () => undefined,
  );
}

export function resetBlockedIdentityStore(): void {
  blockedIdentityStore.clear();
}
