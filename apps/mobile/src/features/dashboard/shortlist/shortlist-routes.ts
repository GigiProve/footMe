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
  /**
   * Scheda interna «Profilo in shortlist» (DAS-REV-25 §15, screen 05).
   *
   * Dentro lo Stack della tab Dashboard, non fuori: §4 della 25 — «Le
   * pagine gestionali mantengono Home | Cerca | Dashboard | Messaggi |
   * Profilo, Dashboard selezionata», e gli screen 05/08/14/15 la mostrano.
   * L'editor invece è focalizzato e **non** è una route: vive come modale
   * sopra la schermata che lo apre, così il ritorno dopo Salva è quello
   * giusto per costruzione (§19, §24).
   */
  entry: (entryId: string) =>
    `${CENTER}/entry/${encodeURIComponent(entryId)}`,
  /**
   * Il pool con una persona da raggiungere (§24).
   *
   * «Per Vedi nella shortlist, apri un contesto di consultazione completo
   * della stessa lista con focus sulla entry. Se il pool visitato in
   * precedenza aveva filtri che escludono quella persona, questa apertura
   * contestuale parte senza restrizioni.» Il parametro porta solo un id:
   * §29 vieta nomi, note o dati personali negli URL.
   */
  positionFocused: (positionId: string, entryId: string) =>
    `${CENTER}/position/${encodeURIComponent(positionId)}?focus=${encodeURIComponent(entryId)}`,
} as const;
