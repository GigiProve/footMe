/**
 * Eventi dell'onboarding Staff tecnico (REV-ONB-04 §AX).
 *
 * Misurano l'avanzamento del flusso, non il suo contenuto: ruoli e modalità
 * viaggiano come tassonomia chiusa, regioni e province solo come conteggio.
 * Nessun testo libero entra mai nel payload.
 */
import { trackEvent } from "../../../lib/analytics";

export type StaffOnboardingEvent =
  | { name: "onboarding_staff_started" }
  | { name: "staff_roles_selected"; count: number }
  | { name: "staff_primary_role_selected"; role: string }
  | { name: "staff_availability_changed"; available: boolean }
  | { name: "staff_geo_mode_selected"; mode: string }
  | { name: "staff_regions_selected"; count: number }
  | { name: "staff_provinces_selected"; count: number }
  | { name: "staff_experience_type_selected"; experienceType: string }
  | { name: "staff_experience_added" }
  | { name: "staff_experience_edited" }
  | { name: "previous_coach_experience_selected" }
  | { name: "previous_player_experience_selected" }
  | { name: "onboarding_staff_completed"; experienceCount: number };

export function trackStaffOnboardingEvent(event: StaffOnboardingEvent) {
  const { name, ...props } = event;

  trackEvent(name, props);
}
