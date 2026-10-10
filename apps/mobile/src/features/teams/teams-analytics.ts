/**
 * Eventi del Centro Squadre (§29).
 *
 * Naming `teams_*` sul modello di `dashboard-analytics.ts`. §29 vieta di
 * registrare nomi digitati, città specifiche, testo delle segnalazioni, URL
 * degli asset o roster: le proprietà qui sono **tipo di azione, esito e
 * flag**, mai contenuto.
 *
 * `setAnalyticsSink` non è mai chiamato nel progetto, quindi `trackEvent` è
 * oggi un no-op: gli eventi sono definiti perché il contratto lo richiede e
 * nessuno è stato osservato su un sink reale.
 */
import { trackEvent } from "../../lib/analytics";

export type TeamsEventName =
  | "teams_center_opened"
  | "teams_team_opened"
  | "teams_create_started"
  | "teams_edit_started"
  | "teams_type_changed"
  | "teams_level_changed"
  | "teams_crest_mode_changed"
  | "teams_city_mode_changed"
  | "teams_level_report_submitted"
  | "teams_duplicate_warning_shown"
  | "teams_duplicate_choice"
  | "teams_create_result"
  | "teams_update_result"
  | "teams_version_conflict"
  | "teams_unsaved_exit";

export function trackTeamsEvent(
  name: TeamsEventName,
  properties: Record<string, string | number | boolean | null> = {},
): void {
  trackEvent(name, properties);
}
