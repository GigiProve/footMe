/**
 * Eventi del Centro Posizioni aperte (§31).
 *
 * «Non inviare nomi persone, titolo integrale della Position, nome
 * Team/Society, ID dei profili, candidature, contatti, descrizioni, valori
 * dei campi, URL completi o payload privati.»
 *
 * Per questo i parametri hanno cardinalità controllata — tab, tipo di filtro,
 * sola consultazione, presenza di nuove come booleano, categoria tecnica di
 * errore — e nessuno di essi trasporta un identificativo di risorsa. Un
 * Position ID non è un dato di prodotto: correlarlo appartiene ai sistemi
 * protetti del progetto, non all'analytics.
 *
 * `position_opened_from_center` è emesso **una volta** per tap: §31 vieta di
 * «creare due eventi per lo stesso tap mediante handler della riga e del
 * chevron», e il chevron qui non ha un handler proprio.
 */
import { trackEvent, type AnalyticsProps } from "../../../lib/analytics";

export type PositionsEventName =
  | "positions_center_view"
  | "positions_tab_changed"
  | "positions_team_filter_opened"
  | "positions_team_filter_changed"
  | "position_opened_from_center"
  | "position_draft_resumed"
  | "position_create_started"
  | "positions_center_refresh"
  | "positions_center_load_failed"
  | "positions_center_retry";

export function trackPositionsEvent(
  name: PositionsEventName,
  params?: AnalyticsProps,
): void {
  trackEvent(name, params);
}
