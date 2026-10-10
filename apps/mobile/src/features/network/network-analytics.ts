/**
 * Eventi della Rete societaria (§30).
 *
 * «Tracciare soltanto azioni osservabili. Apertura dello share sheet non
 * significa consegna; click sul link non significa consenso; tap sul profilo
 * non significa accesso amministrativo.»
 *
 * Per questo non esiste un `network_invite_delivered`: non è osservabile. Le
 * proprietà sono tipo di azione, esito ed error category — mai il token, mai
 * la query digitata, mai il nome descrittivo (§30).
 *
 * `setAnalyticsSink` non è mai chiamato nel progetto, quindi `trackEvent` è
 * oggi un no-op: gli eventi sono definiti perché il contratto li richiede e
 * nessuno è stato osservato su un sink reale.
 */
import { trackEvent } from "../../lib/analytics";

export type NetworkEventName =
  | "network_center_opened"
  | "network_tab_changed"
  | "network_history_opened"
  | "network_detail_opened"
  | "network_profile_opened"
  | "network_search_opened"
  | "network_search_result_selected"
  | "network_type_selected"
  | "network_role_selected"
  | "network_request_submitted"
  | "network_request_result"
  | "network_decision_submitted"
  | "network_decision_result"
  | "network_invite_started"
  | "network_invite_link_result"
  | "network_invite_share_opened"
  | "network_invite_revoked"
  | "network_invite_landing_opened"
  | "network_invite_handoff_started"
  | "network_invite_resolved"
  | "network_unsaved_exit"
  | "network_module_error"
  | "network_module_retry";

export function trackNetworkEvent(
  name: NetworkEventName,
  properties: Record<string, string | number | boolean | null> = {},
): void {
  trackEvent(name, properties);
}
