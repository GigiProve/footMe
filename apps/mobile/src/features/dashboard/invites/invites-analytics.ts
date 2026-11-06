/**
 * Eventi del pack Inviti (§42).
 *
 * «Parametri solo aggregati/enumerati quando consentiti: origine, tipo
 * schermata, tipo profilo, tipo ambito, numero di Team nel filtro, esito,
 * categoria di errore. Non inviare nome, query integrale, città, foto, nome
 * Team/Society, custom role, contatti, testo della proposta, payload privati
 * o identificativi personali.»
 *
 * Per questo non esiste `invite_delivered`: la consegna di una push non è
 * osservabile, e §42 vieta di «tracciare come consegnata o letta una push
 * soltanto perché è stata pianificata». Nemmeno `invite_read`: aprire la
 * notifica non è accettare il rapporto.
 */
import { trackEvent, type AnalyticsProps } from "../../../lib/analytics";

export type InvitesEventName =
  | "invites_center_view"
  | "invites_center_retry"
  | "invites_center_load_failed"
  | "invites_tab_changed"
  | "invites_filter_opened"
  | "invites_filter_applied"
  | "invite_row_opened"
  | "invite_compose_started"
  | "invite_search_performed"
  | "invite_candidate_selected"
  | "invite_step_advanced"
  | "invite_role_selected"
  | "invite_scope_selected"
  | "invite_team_selected"
  | "invite_submitted"
  | "invite_submit_result"
  | "invite_unsaved_exit"
  | "invite_detail_opened"
  | "invite_cancel_confirm_opened"
  | "invite_cancel_result"
  | "invite_response_confirm_opened"
  | "invite_response_result"
  | "invite_request_opened"
  | "invites_module_error";

export function trackInvitesEvent(
  name: InvitesEventName,
  params?: AnalyticsProps,
): void {
  trackEvent(name, params);
}
