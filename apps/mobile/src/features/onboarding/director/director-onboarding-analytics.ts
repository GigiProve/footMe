/**
 * Eventi dell'onboarding Dirigente (REV-ONB-07 §AV).
 *
 * Misurano l'avanzamento del flusso, non il suo contenuto: ruoli, aree e
 * modalità viaggiano come tassonomia chiusa. Bio, descrizioni esperienza e
 * il ruolo libero di "Altro" non entrano mai nel payload.
 */
import { trackEvent } from "../../../lib/analytics";

export type DirectorOnboardingEvent =
  | { name: "onboarding_director_started" }
  | { name: "director_roles_selected"; count: number }
  | { name: "director_multi_role_used" }
  | { name: "director_primary_role_selected"; role: string }
  | { name: "director_responsibility_selected"; count: number }
  | { name: "director_focus_selected"; focus: string }
  | {
      name: "director_availability_changed";
      audience: string;
      enabled: boolean;
    }
  | { name: "director_career_entry_opened" }
  | { name: "director_experience_type_selected"; experienceType: string }
  | { name: "director_experience_saved" }
  | { name: "director_experience_edited" }
  | { name: "director_previous_experience_selected"; count: number }
  | { name: "director_previous_branch_opened"; branch: string }
  | { name: "director_additional_info_completed" }
  | { name: "onboarding_director_completed"; experienceCount: number };

export function trackDirectorOnboardingEvent(event: DirectorOnboardingEvent) {
  const { name, ...props } = event;

  trackEvent(name, props);
}
