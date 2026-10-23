/**
 * Eventi di Ruoli, permessi, ambito e ownership (§35).
 *
 * «Distingui intenzione, conferma locale, comando inviato ed esito server.
 * Conferma permessi non è role_update_success; Continua nel picker Owner non
 * è owner_transfer_success.» Da cui i nomi: `*_confirmed` è la conferma
 * locale di un pannello, `*_submitted` è il comando partito, `*_result`
 * l'esito canonico.
 *
 * Nessun parametro porta nomi di persone, Società, ruoli custom o squadre
 * (§35): solo tipo di area, livello, tipo di scope e conteggi.
 */
import { trackEvent, type AnalyticsProps } from "../../../lib/analytics";

export type RolesEventName =
  | "roles_center_opened"
  | "role_editor_opened"
  | "role_area_sheet_opened"
  | "role_area_level_confirmed"
  | "role_custom_opened"
  | "role_custom_confirmed"
  | "role_save_submitted"
  | "role_save_result"
  | "role_archive_submitted"
  | "role_archive_result"
  | "admin_access_opened"
  | "admin_role_change_submitted"
  | "admin_role_change_result"
  | "admin_scope_opened"
  | "admin_scope_teams_confirmed"
  | "admin_scope_submitted"
  | "admin_scope_result"
  | "admin_revoke_opened"
  | "admin_revoke_submitted"
  | "admin_revoke_result"
  | "admin_invite_cancel_opened"
  | "admin_invite_cancel_submitted"
  | "admin_invite_cancel_result"
  | "owner_transfer_opened"
  | "owner_candidate_selected"
  | "owner_transfer_reviewed"
  | "owner_transfer_submitted"
  | "owner_transfer_result"
  | "roles_unsaved_exit"
  | "roles_module_error";

export function trackRolesEvent(
  name: RolesEventName,
  params?: AnalyticsProps,
): void {
  trackEvent(name, params);
}
