/**
 * Eventi di prodotto dei Link di invito (§47).
 *
 * «Distinguere apertura da registrazione e da collegamento realmente
 * completato. L'evento di successo arriva dopo il commit e non si duplica al
 * retry. Aprire lo share sheet non è una consegna confermata.»
 *
 * Nessuna proprietà porta token, URL completo, nome, recapito o testo custom
 * del ruolo: §47 lo vieta esplicitamente, e il modo di garantirlo è passare
 * solo enum, booleani e conteggi.
 */
import { trackEvent, type AnalyticsProps } from "../../../lib/analytics";

export type JoinLinksEventName =
  | "join_links_center_view"
  | "join_links_center_retry"
  | "join_links_center_load_failed"
  | "join_links_tab_changed"
  | "join_link_row_opened"
  | "join_link_compose_started"
  | "join_link_categories_configured"
  | "join_link_roles_configured"
  | "join_link_review_opened"
  | "join_link_submitted"
  | "join_link_submit_result"
  | "join_link_unsaved_exit"
  | "join_link_share_opened"
  | "join_link_copied"
  | "join_link_detail_opened"
  | "join_link_expiry_sheet_opened"
  | "join_link_expiry_result"
  | "join_link_limit_sheet_opened"
  | "join_link_limit_result"
  | "join_link_revoke_confirm_opened"
  | "join_link_revoke_result"
  | "join_link_people_opened"
  | "join_link_person_opened"
  | "join_link_remove_confirm_opened"
  | "join_link_remove_result"
  | "join_landing_opened"
  | "join_handoff_started"
  | "join_context_resolved"
  | "join_profile_selected"
  | "join_role_selected"
  | "join_consent_submitted"
  | "join_consent_result"
  | "join_links_module_error";

export function trackJoinLinksEvent(
  name: JoinLinksEventName,
  params?: AnalyticsProps,
): void {
  trackEvent(name, params);
}
