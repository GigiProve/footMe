/**
 * Cache che dipendono dal salvataggio di una Posizione (HOM-07 §130, §133).
 *
 * Lo stato del bookmark è nello store Salvati, ma la tab «Salvate» di Posizioni
 * e la Dashboard personale hanno liste e conteggi propri (disponibili / non più
 * disponibili, segnali di scadenza): un salvataggio o una rimozione fatti da
 * qualunque superficie li ricalcola, perché l'ultima parola sul gruppo di
 * appartenenza è del backend (DAS-REV-05 §24).
 *
 * Le liste di Esplora e Per te NON si invalidano: leggono il bookmark dallo
 * store, e ricaricarle farebbe saltare la lista sotto il dito.
 */

import type { QueryKey } from "@tanstack/react-query";

import { DASHBOARD_QK_PREFIXES } from "../dashboard/dashboard-keys";
import { POSITIONS_QK } from "../search/positions/positions-criteria";

export const POSITION_SAVED_INVALIDATIONS: readonly QueryKey[] = [
  [POSITIONS_QK, "saved"],
  ...DASHBOARD_QK_PREFIXES.map((prefix): QueryKey => [prefix]),
];
