/**
 * Contatori in formato italiano (HOM-02 §105): 146, 1.234, 12.486.
 *
 * Niente "1,2K", "12K" o "1M". Il raggruppamento è manuale e non passa da
 * `Intl`/`toLocaleString`: Hermes e alcune build di Node non raggruppano i
 * numeri a quattro cifre in it-IT (la regola locale vuole il punto solo da
 * cinque cifre in su), mentre il design chiede "1.234".
 */

/** Intero non negativo: i contatori non sono mai frazionari né negativi. */
export function normalizeCount(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
}

export function formatCount(value: number | null | undefined): string {
  return String(normalizeCount(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
