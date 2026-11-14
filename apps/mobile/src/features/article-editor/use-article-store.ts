/**
 * Lettura reattiva dello store dell'Articolo (HOM-06.2 §73, §7T): ogni route
 * dell'editor — selector, editor, link, incolla, Anteprima — legge la stessa
 * sessione. `getState()` è sempre attuale anche dopo un `await`.
 */

import { useSyncExternalStore } from "react";

import { articleStore, type ArticleStoreState } from "./article-store";

export function useArticleStoreState(): ArticleStoreState {
  return useSyncExternalStore(articleStore.subscribe, articleStore.getState);
}
