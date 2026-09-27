/**
 * Ramo "Media e tifosi" dell'onboarding (REV-ONB-08, REV-ONB-09).
 *
 * Il bivio Tifoso / Media-Creator, i dati personali e la foto vivono sulle
 * pagine del Master (REV-ONB-01) per entrambi i percorsi; qui restano solo le
 * schermate che qualificano il singolo sotto-profilo.
 */

export {
  CommunityOnboardingFlow,
  isCommunityMasterStep,
} from "./CommunityOnboardingFlow";
export { CommunityPathStep } from "./CommunityPathStep";
export { FanFootballTypesStep } from "./FanFootballTypesStep";
export { FanTerritoriesStep } from "./FanTerritoriesStep";
export {
  MediaOnboardingFlow,
  isMediaMasterStep,
} from "./MediaOnboardingFlow";
export { MediaChannelsStep } from "./MediaChannelsStep";
export { MediaChipSelectionStep } from "./MediaChipSelectionStep";
export { MediaCreatorTypeStep } from "./MediaCreatorTypeStep";
export { MediaProjectImageStep } from "./MediaProjectImageStep";
export {
  MediaProjectStep,
  MEDIA_PROJECT_DESCRIPTION_MAX_LENGTH,
} from "./MediaProjectStep";
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
  MEDIA_CONTENT_TYPE_OPTIONS,
  MEDIA_CREATOR_TYPE_OPTIONS,
  MEDIA_SCOPE_OPTIONS,
  coerceMediaCreatorType,
  formatMediaCreatorType,
  isMediaCreatorType,
  mediaKindFromCreatorType,
  normalizeMediaContentTypes,
  normalizeMediaScopes,
  type MediaCreatorType,
} from "./media-taxonomy";
export {
  validateMediaChannel,
  type MediaChannelKey,
  type MediaChannelResult,
} from "./media-channels";
export {
  trackFanOnboardingEvent,
  type FanOnboardingEvent,
} from "./fan-onboarding-analytics";
export {
  trackMediaOnboardingEvent,
  type MediaOnboardingEvent,
} from "./media-onboarding-analytics";
