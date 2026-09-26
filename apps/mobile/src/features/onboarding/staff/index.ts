/**
 * Onboarding Staff tecnico (REV-ONB-04).
 *
 * Declinazione dello stesso sistema onboarding degli altri profili
 * professionali: Master UI da REV-ONB-01, disponibilità geografica da
 * REV-ONB-02, esperienze professionali senza statistiche da REV-ONB-03.
 * Qui vivono solo le specificità del ruolo — ruoli multipli, ruolo
 * principale, esperienze precedenti multi-selezione.
 */

export { StaffOnboardingFlow, isStaffMasterStep } from "./StaffOnboardingFlow";
export { StaffRolesStep } from "./StaffRolesStep";
export { StaffAvailabilityStep } from "./StaffAvailabilityStep";
export { StaffExperiencesStep } from "./StaffExperiencesStep";
export { StaffPreviousExperiencesStep } from "./StaffPreviousExperiencesStep";
export {
  STAFF_EXPERIENCE_ROLE_OPTIONS,
  getStaffExperienceRoleOptions,
} from "./staff-options";
export {
  buildStaffPreviousExperiencePatch,
  getNextStaffSubFlowStep,
  readStaffPreviousExperiences,
  toggleStaffPreviousExperience,
  type StaffPreviousExperience,
} from "./staff-previous-experiences";
export {
  trackStaffOnboardingEvent,
  type StaffOnboardingEvent,
} from "./staff-onboarding-analytics";
