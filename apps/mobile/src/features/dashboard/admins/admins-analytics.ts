/**
 * Eventi del Centro Amministratori (§32).
 *
 * «Registra esiti realmente conosciuti: share aperto non è consegna;
 * apertura store non è installazione riuscita; ritorno in app non è
 * accettazione.»
 *
 * Per questo non esiste `admin_invite_delivered` né `admin_app_installed`:
 * non sono osservabili. I parametri hanno cardinalità controllata — tipo di
 * percorso, tipo di ambito, esito, sorgente — e non contengono nomi, email,
 * query digitate, token, URL completi o nomi di squadre.
 */
import { trackEvent, type AnalyticsProps } from "../../../lib/analytics";

export type AdminEventName =
  | "admin_center_opened"
  | "admin_roles_opened"
  | "admin_detail_opened"
  | "admin_invite_started"
  | "admin_invite_search_performed"
  | "admin_invite_candidate_selected"
  | "admin_invite_candidate_blocked"
  | "admin_invite_role_selected"
  | "admin_invite_scope_selected"
  | "admin_invite_submitted"
  | "admin_invite_result"
  | "admin_invite_link_created"
  | "admin_invite_share_opened"
  | "admin_invite_link_copied"
  | "admin_invite_landing_opened"
  | "admin_invite_handoff_started"
  | "admin_invite_binding_result"
  | "admin_invite_review_opened"
  | "admin_invite_decision_submitted"
  | "admin_invite_decision_result"
  | "admin_unsaved_exit"
  | "admin_module_error";

export function trackAdminEvent(
  name: AdminEventName,
  params?: AnalyticsProps,
): void {
  trackEvent(name, params);
}
