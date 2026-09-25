/**
 * Onboarding Allenatore (REV-ONB-03).
 *
 * È un'estensione nativa del Master UI (REV-ONB-01) che riusa le logiche
 * approvate per il Calciatore (REV-ONB-02): non un flusso parallelo.
 */

export { CoachOnboardingFlow, isCoachMasterStep } from "./CoachOnboardingFlow";
export { CoachQualificationStep } from "./CoachQualificationStep";
export { CoachAvailabilityStep } from "./CoachAvailabilityStep";
export { CoachExperiencesStep } from "./CoachExperiencesStep";
export { CoachPlayerCareerChoiceStep } from "./CoachPlayerCareerChoiceStep";
export { CoachPhilosophyStep } from "./CoachPhilosophyStep";
export { CoachExperienceForm } from "./CoachExperienceForm";
export { CoachExperienceRow } from "./CoachExperienceRow";
export { CoachExperienceTypeSelector } from "./CoachExperienceTypeSelector";
export { useCoachExperienceFlow } from "./use-coach-experience-flow";
export {
  formatCoachExperiencePeriod,
  formatCoachExperienceSubtitle,
} from "./coach-experience-display";
export {
  AVAILABLE_FROM_OPTIONS,
  COACH_CATEGORY_OPTIONS,
  COACH_FORMATION_OPTIONS,
  COACH_LANGUAGE_OPTIONS,
  COACH_PHILOSOPHY_MAX_LENGTH,
  COACH_PLAY_STYLE_OPTIONS,
  COACH_PRIMARY_ROLE_OPTIONS,
  COACH_ROLE_OPTIONS,
  LICENSE_TYPE_OPTIONS,
} from "./coach-options";
