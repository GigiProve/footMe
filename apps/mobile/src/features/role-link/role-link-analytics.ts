/**
 * Eventi del collegamento Persona–Società (§50).
 *
 * «Parametri ammessi quando necessari: origine del flow, categoria di
 * operazione, actor_type, scope_type, esito, motivo tecnico normalizzato e
 * booleani funzionali. Non inviare nomi, email, telefono, testo custom,
 * richiesta completa, token/URL invito, ID di profili o il diff personale
 * integrale nel tracking di prodotto.»
 *
 * Per questo non esiste un evento di "ruolo scelto" che porti la label: il
 * `role_id` canonico è un'enumerazione, il custom è testo libero della
 * persona e non esce da qui.
 */
import { trackEvent, type AnalyticsProps } from "../../lib/analytics";

export type RoleLinkEventName =
  | "role_link_block_viewed"
  | "role_request_form_opened"
  | "role_request_review_opened"
  | "role_request_submitted"
  | "role_request_submit_result"
  | "role_request_detail_opened"
  | "role_request_cancel_confirm_opened"
  | "role_request_cancel_result"
  | "role_request_resolve_result"
  | "role_link_societies_opened"
  | "role_link_society_opened"
  | "role_link_assignment_opened"
  | "role_link_assignment_form_opened"
  | "role_link_assignment_save_result"
  | "role_link_assignment_add_result"
  | "role_link_assignment_restore_result"
  | "role_link_assignment_remove_confirm_opened"
  | "role_link_assignment_remove_result"
  | "role_link_terminate_confirm_opened"
  | "role_link_terminate_result"
  | "role_link_unsaved_exit"
  | "role_link_module_error";

export function trackRoleLinkEvent(
  name: RoleLinkEventName,
  params?: AnalyticsProps,
): void {
  trackEvent(name, params);
}
