/**
 * Onboarding Calciatore (REV-ONB-02).
 *
 * Declinazione del Master UI REV-ONB-01 sul profilo Calciatore: qui vivono
 * solo le specificità del ruolo — campo da calcio, disponibilità geografica,
 * carriera. Tipografia, CTA, input, chip, bottom sheet e progress vengono
 * da `../ui` e non vengono ridefiniti.
 */

export { FootballPitchRoleSelector } from "./FootballPitchRoleSelector";
export { AvailabilityModeCard } from "./AvailabilityModeCard";
export { GeographicPickerScreen } from "./GeographicPickerScreen";
export { PlayerAvailabilityStep } from "./PlayerAvailabilityStep";
export { PlayerCareerStep } from "./PlayerCareerStep";
export {
  PlayerOnboardingFlow,
  isPlayerMasterStep,
} from "./PlayerOnboardingFlow";
export { PlayerPersonalDataStep } from "./PlayerPersonalDataStep";
export { PlayerPhotoStep } from "./PlayerPhotoStep";
export { PlayerSportsProfileStep } from "./PlayerSportsProfileStep";
export { PlayerMeasureField } from "./PlayerMeasureField";
export {
  buildAvailabilityRecap,
  buildAvailabilitySummary,
  buildSelectionCountLabel,
  getAvailabilityErrorMessage,
  isAvailabilityComplete,
  resolveActiveAvailability,
  type GeographicAvailabilityDraft,
} from "./geographic-availability";
export {
  PITCH_SLOTS,
  getPitchSlotAccessibilityLabel,
  getPitchSlotState,
  getSecondaryPositionOptions,
  revalidateSecondaryPosition,
  type PitchSlot,
  type PitchSlotState,
} from "./player-pitch-positions";
export {
  trackPlayerOnboardingEvent,
  type PlayerOnboardingEvent,
} from "./player-onboarding-analytics";
