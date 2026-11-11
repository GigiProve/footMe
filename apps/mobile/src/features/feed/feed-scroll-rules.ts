/**
 * Regole del ripristino della posizione di lettura (§18) — funzioni pure.
 *
 * Sono estratte dai componenti perché sono la parte del §18 più facile da
 * sbagliare e l'unica che si può verificare senza un renderer.
 */

import type { FeedScrollState } from "./feed-cache";

/**
 * Un offset salvato si applica SOLO se la lista mostrata è quella da cui
 * l'offset proviene.
 *
 * `hydratedFromCache` è il vincolo che conta: se la lista è stata rifetchata da
 * zero, l'offset punta a contenuti che non ci sono più e il ripristino
 * atterrerebbe in un punto arbitrario. `itemCount` copre il caso in cui la
 * lista si è accorciata rispetto a quando l'offset è stato salvato.
 */
export function shouldRestoreOffset(
  saved: FeedScrollState | null,
  itemCount: number,
  hydratedFromCache: boolean,
): boolean {
  if (!saved || !hydratedFromCache) {
    return false;
  }

  // Sotto la soglia il ripristino non si distingue dal normale inizio lista.
  if (saved.offset <= MIN_RESTORE_OFFSET) {
    return false;
  }

  return saved.itemCount <= itemCount;
}

/** Sotto questa soglia non vale la pena ripristinare nulla. */
export const MIN_RESTORE_OFFSET = 8;
