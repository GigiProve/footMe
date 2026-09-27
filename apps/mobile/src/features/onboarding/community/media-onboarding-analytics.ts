/**
 * Eventi del ramo Media / Creator (REV-ONB-09 §38).
 *
 * Misurano l'avanzamento e la sola categoria strutturata. Nome del progetto,
 * descrizione, testo libero di "Altro", username e link non entrano mai nel
 * payload: dei canali viaggia il tipo, non l'indirizzo.
 */
import { trackEvent } from "../../../lib/analytics";

import type { MediaChannelKey } from "./media-channels";
import type { MediaCreatorType } from "./media-taxonomy";

export type MediaOnboardingEvent =
  | { name: "onboarding_media_creator_started" }
  | { name: "media_creator_type_selected"; creatorType: MediaCreatorType }
  | { name: "media_project_details_completed" }
  | { name: "media_project_image_added" }
  | { name: "media_content_type_selected"; count: number }
  | { name: "media_scope_selected"; count: number }
  | { name: "media_external_channel_added"; channel: MediaChannelKey }
  | { name: "media_creator_onboarding_completed" };

export function trackMediaOnboardingEvent(event: MediaOnboardingEvent) {
  const { name, ...props } = event;

  trackEvent(name, props);
}
