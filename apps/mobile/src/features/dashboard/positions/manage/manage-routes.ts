/**
 * Destinazioni del dettaglio gestionale e del suo editor (DAS-REV-17 §6).
 *
 * Due famiglie, due comportamenti di shell:
 *
 *   * il **dettaglio** è figlio della tab Dashboard, perché §6 chiede che
 *     «le pagine di dettaglio mantengono la navigazione Home | Cerca |
 *     Dashboard | Messaggi | Profilo, con Dashboard selezionata» — e il
 *     mockup la mostra negli screen 01, 04, 06, 07, 11 e 12;
 *   * **editor e anteprima** vivono fuori dalle tab, perché la stessa §6 li
 *     vuole «flussi focalizzati senza bottom navigation» (screen 02, 03, 08,
 *     09).
 *
 * `anchor` porta l'editor sul campo pertinente senza inventare un passo di
 * wizard: §6 vieta «1 di 3», progressi e sequenze obbligatorie su una
 * Position esistente.
 */

import { POSITIONS_HREFS, type PositionsOrigin } from "../positions-routes";

const FOCUSED = "/position-manage";

function query(params: Record<string, string | null | undefined>): string {
  const parts = Object.entries(params)
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`);

  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

export const MANAGE_HREFS = {
  /**
   * Dettaglio gestionale della stessa Position, mai la scheda visitor.
   *
   * Delegato al Centro e non ridefinito: due costruttori dello stesso
   * indirizzo divergerebbero al primo cambio di route, e in silenzio.
   */
  detail: (positionId: string, options?: { from?: PositionsOrigin }) =>
    POSITIONS_HREFS.detail(positionId, options),
  /**
   * Editor dell'oggetto esistente.
   *
   * `anchor` è la chiave di un campo dello schema condiviso: «Aggiungi
   * dettagli» apre sulla sezione dettagli, «Completa posizione» sul primo
   * campo obbligatorio mancante, e il tap su un singolo elemento mancante
   * su quel campo (§6).
   */
  edit: (positionId: string, options?: { anchor?: string | null }) =>
    `${FOCUSED}/${encodeURIComponent(positionId)}/edit${query({
      anchor: options?.anchor,
    })}`,
  /** Anteprima pubblica della versione candidata alla pubblicazione (§15). */
  preview: (positionId: string) =>
    `${FOCUSED}/${encodeURIComponent(positionId)}/preview`,
} as const;

/** L'ancora convenzionale della sezione «Dettagli dell'annuncio» (§6). */
export const DETAILS_SECTION_ANCHOR = "__details__";
