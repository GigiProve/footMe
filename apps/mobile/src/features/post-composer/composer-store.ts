/**
 * Store esterno del composer Post (HOM-06.1 §119, §134, §68–70).
 *
 * Perché non un semplice `useReducer`: la pubblicazione è asincrona e deve
 * leggere lo stato PIÙ RECENTE dopo ogni `await` (upload che finiscono mentre si
 * attende, §68; media falliti, §70). Con `useReducer` quello stato è nella
 * closure del render in cui è stato premuto Pubblica, quindi vecchio. Con uno
 * store esterno `getState()` è sempre attuale, e il secondo tap su Pubblica vede
 * subito `publishing` (§119) senza aspettare un render.
 *
 * Il reducer resta `composerReducer`: lo store è solo il contenitore. Si legge
 * da React con `useSyncExternalStore(store.subscribe, store.getState)`.
 */

import { composerReducer, type ComposerAction, type ComposerState } from "./composer-reducer";

export type ComposerStore = {
  getState: () => ComposerState;
  dispatch: (action: ComposerAction) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createComposerStore(initial: ComposerState): ComposerStore {
  let state = initial;
  const listeners = new Set<() => void>();

  return {
    dispatch(action) {
      const next = composerReducer(state, action);

      // Il reducer restituisce lo stesso oggetto quando l'azione non cambia nulla.
      if (next !== state) {
        state = next;
        listeners.forEach((listener) => listener());
      }
    },
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
