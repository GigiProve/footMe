/**
 * Ramo "Media e tifosi" dell'onboarding (REV-ONB-08).
 *
 * Il bivio Tifoso / Media-Creator e il percorso Tifoso vivono sulle pagine
 * del Master (REV-ONB-01); gli step editoriali del Media / Creator restano
 * quelli precedenti, in attesa della task dedicata.
 */

export {
  CommunityOnboardingFlow,
  isCommunityMasterStep,
} from "./CommunityOnboardingFlow";
export { CommunityPathStep } from "./CommunityPathStep";
export { FanFootballTypesStep } from "./FanFootballTypesStep";
export { FanTerritoriesStep } from "./FanTerritoriesStep";
export { CommunityBasicInfoStep } from "./CommunityBasicInfoStep";
export { CommunityChipGroup } from "./CommunityChipGroup";
export { MediaChannelsStep } from "./MediaChannelsStep";
export { MediaCollaborationsStep } from "./MediaCollaborationsStep";
export { MediaEntityStep } from "./MediaEntityStep";
export {
  COMMUNITY_PATH_OPTIONS,
  FAN_FOOTBALL_TYPE_OPTIONS,
  FAN_TERRITORY_MODE_COPY,
  formatFanFootballTypes,
  isFanFootballType,
  type CommunityPath,
  type FanFootballType,
} from "./fan-taxonomy";
export {
  trackFanOnboardingEvent,
  type FanOnboardingEvent,
} from "./fan-onboarding-analytics";
