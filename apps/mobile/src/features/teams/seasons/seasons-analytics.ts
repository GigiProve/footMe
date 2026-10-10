/**
 * Eventi di Stagioni e storico (§34).
 *
 * Naming `seasons_*` sul modello di `teams-analytics.ts`. §34 vieta di
 * inviare «nomi di persone/squadre, payload completi, testo libero, dettagli
 * di posizioni o inviti, elenco di ID personali o contenuto della bozza»:
 * le proprietà qui sono **esiti e quantità**, mai contenuto.
 *
 * Come per il Centro Squadre, `setAnalyticsSink` non è mai chiamato nel
 * progetto: `trackEvent` è un no-op e nessuno di questi eventi è stato
 * osservato su un sink reale.
 */
import { trackEvent } from "../../../lib/analytics";

export type SeasonsEventName =
  | "seasons_center_opened"
  | "seasons_team_opened"
  | "seasons_prepare_started"
  | "seasons_prepare_result"
  | "seasons_configure_started"
  | "seasons_history_opened"
  | "seasons_history_correct_started"
  | "seasons_history_correct_result"
  | "seasons_period_added"
  | "seasons_period_updated"
  | "seasons_period_removed"
  | "seasons_history_preview"
  | "seasons_history_commit_result"
  | "seasons_deactivate_started"
  | "seasons_deactivate_blocked"
  | "seasons_deactivate_result"
  | "seasons_inactive_opened"
  | "seasons_reactivate_started"
  | "seasons_reactivate_result"
  | "seasons_context_conflict"
  | "seasons_unsaved_exit";

export function trackSeasonsEvent(
  name: SeasonsEventName,
  properties: Record<string, string | number | boolean | null> = {},
): void {
  trackEvent(name, properties);
}
