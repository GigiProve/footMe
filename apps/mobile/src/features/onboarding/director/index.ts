/**
 * Onboarding Dirigente (REV-ONB-07).
 *
 * Stessa declinazione degli altri profili professionali: Master UI da
 * REV-ONB-01, schermate comuni e carriera da calciatore da REV-ONB-02,
 * esperienze senza statistiche da REV-ONB-03, carriera staff da REV-ONB-04.
 * Qui vivono solo le specificità del ruolo — ruoli multipli nel club, ruolo
 * principale, aree di responsabilità, focus, disponibilità di contatto e le
 * altre esperienze nel calcio.
 */

export {
  DirectorOnboardingFlow,
  isDirectorMasterStep,
} from "./DirectorOnboardingFlow";
export { DirectorAvailabilityStep } from "./DirectorAvailabilityStep";
export { DirectorCareerStep } from "./DirectorCareerStep";
export { DirectorClubRoleStep } from "./DirectorClubRoleStep";
export { DirectorFocusStep } from "./DirectorFocusStep";
export { DirectorGenericExperiencesStep } from "./DirectorGenericExperiencesStep";
export { DirectorPresentationStep } from "./DirectorPresentationStep";
export { DirectorPreviousExperiencesStep } from "./DirectorPreviousExperiencesStep";
export { DirectorResponsibilitiesStep } from "./DirectorResponsibilitiesStep";
export {
  DIRECTOR_BIO_MAX_LENGTH,
  DIRECTOR_CLUB_ROLE_OPTIONS,
  DIRECTOR_CONTACT_AUDIENCE_OPTIONS,
  DIRECTOR_FOCUS_CARD_OPTIONS,
  DIRECTOR_OTHER_ROLE_VALUE,
  DIRECTOR_RESPONSIBILITY_CHIP_OPTIONS,
  getDirectorExperienceRoleOptions,
  type DirectorContactAudience,
} from "./director-taxonomy";
export {
  DIRECTOR_PREVIOUS_ROLE_OPTIONS,
  buildDirectorPreviousRolesPatch,
  getDirectorGenericRoleOptions,
  getNextDirectorSubFlowStep,
  getPreviousDirectorSubFlowStep,
  readDirectorPreviousRoles,
  toggleDirectorPreviousRole,
  type DirectorPreviousRole,
} from "./director-previous-roles";
export {
  trackDirectorOnboardingEvent,
  type DirectorOnboardingEvent,
} from "./director-onboarding-analytics";
