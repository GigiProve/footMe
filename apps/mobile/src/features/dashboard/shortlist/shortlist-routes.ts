/**
 * Destinazioni canoniche del pack Shortlist (§25).
 *
 * Tutte dentro lo Stack annidato della tab Dashboard: §25 — «La bottom
 * navigation rimane Home | Cerca | Dashboard | Messaggi | Profilo. Nei
 * percorsi di questa tavola Dashboard è selezionata.» Il vecchio `/shortlist`
 * viveva fuori dalle tab e perdeva la barra: resta come deep link e
 * reindirizza qui (§26, QA124).
 *
 * Negli href non passa mai niente di diverso da un id: §29 vieta di portare
 * in URL nomi di liste, note o dati personali.
 */

const CENTER = "/(tabs)/dashboard/shortlist";

export const SHORTLIST_HREFS = {
  /** Centro (screen 02-08). */
  center: () => CENTER,
  /** Vista base del pool di una Position (screen 11). */
  position: (positionId: string) =>
    `${CENTER}/position/${encodeURIComponent(positionId)}`,
  /**
   * Dettaglio di una lista personalizzata.
   *
   * §25: «tap CUSTOM → dettaglio canonico già esistente». La schermata è
   * quella di RET-07, montata anche qui perché §31 chiede che la bottom
   * navigation resti visibile: la route fuori dalle tab la perdeva.
   */
  customList: (shortlistId: string) =>
    `${CENTER}/list/${encodeURIComponent(shortlistId)}`,
} as const;
