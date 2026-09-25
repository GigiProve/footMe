/**
 * Eventi dell'onboarding Calciatore (REV-ONB-02 §CM).
 *
 * Misurano l'avanzamento del flusso, non il suo contenuto: nome, cognome,
 * telefono, data di nascita completa e testo libero dei premi non entrano
 * mai nel payload. Le regioni e le province viaggiano come conteggio.
 */
import { trackEvent } from "../../../lib/analytics";

export type PlayerOnboardingEvent =
  | { name: "onboarding_profile_type_selected"; profileType: string }
  | { name: "player_onboarding_started" }
  | { name: "personal_info_completed" }
  | { name: "profile_photo_added" }
  | { name: "primary_role_selected"; role: string }
  | { name: "secondary_role_selected"; role: string }
  | { name: "availability_mode_selected"; mode: string }
  | { name: "regions_selected"; count: number }
  | { name: "provinces_selected"; count: number }
  | { name: "categories_interest_selected"; count: number }
  | { name: "career_step_opened"; experienceCount: number }
  | { name: "experience_add_started" }
  | { name: "experience_type_selected"; experienceType: string }
  | { name: "experience_saved"; experienceType?: string }
  | { name: "experience_edited" }
  | { name: "additional_experience_started" }
  | { name: "player_onboarding_completed"; experienceCount: number };

export function trackPlayerOnboardingEvent(event: PlayerOnboardingEvent) {
  const { name, ...props } = event;

  trackEvent(name, props);
}
