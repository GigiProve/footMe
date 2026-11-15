/**
 * Bozza del flow Segnala per target (HOM-11 §98–§99, §157).
 *
 * Categoria, sottocategoria, dettagli e chiave di idempotenza vivono qui e non nello
 * stato del componente: un errore di rete non costringe a ricominciare (§99), il retry
 * riparte dalla stessa bozza e dalla stessa chiave (§157–§158), e tornare alla scelta
 * con «Modifica» non cancella ciò che si è scritto (§98).
 *
 * Una bozza esiste finché il flow non si conclude: successo, già segnalato o target
 * non più disponibile la cancellano. Privacy: il testo libero è input privato di
 * moderazione (§184); logout e cambio account svuotano lo store in modo sincrono
 * (`resetUserInteractions`), così il testo di un utente non compare all'altro.
 *
 * Singleton di modulo (come `likeStore`); `createReportDraftStore` esiste per i test.
 */

import { useSyncExternalStore } from "react";

import { EMPTY_REPORT_DRAFT } from "./moderation-presentation";
import type { ReportDraft } from "./moderation-types";

type Listener = () => void;

export type ReportDraftStore = ReturnType<typeof createReportDraftStore>;

export function createReportDraftStore() {
  const drafts = new Map<string, ReportDraft>();
  const keyListeners = new Map<string, Set<Listener>>();

  function emit(key: string): void {
    for (const listener of keyListeners.get(key) ?? []) {
      listener();
    }
  }

  return {
    /** Sempre una bozza: senza una scritta vale quella vuota (identità stabile per la sottoscrizione). */
    get(key: string): ReportDraft {
      return drafts.get(key) ?? EMPTY_REPORT_DRAFT;
    },

    has(key: string): boolean {
      return drafts.has(key);
    },

    update(key: string, change: (draft: ReportDraft) => ReportDraft): ReportDraft {
      const next = change(drafts.get(key) ?? EMPTY_REPORT_DRAFT);
      drafts.set(key, next);
      emit(key);
      return next;
    },

    clear(key: string): void {
      if (drafts.delete(key)) {
        emit(key);
      }
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
    clearAll(): void {
      drafts.clear();
      for (const set of keyListeners.values()) {
        for (const listener of set) {
          listener();
        }
      }
    },
  };
}

export const reportDraftStore = createReportDraftStore();

export function useReportDraft(key: string): ReportDraft {
  return useSyncExternalStore(
    (listener) => reportDraftStore.subscribe(key, listener),
    () => reportDraftStore.get(key),
    () => EMPTY_REPORT_DRAFT,
  );
}

export function resetReportDraftStore(): void {
  reportDraftStore.clearAll();
}
