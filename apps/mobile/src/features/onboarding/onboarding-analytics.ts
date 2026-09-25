/**
 * Eventi comuni dell'onboarding (§AU). Riguardano la meccanica del wizard —
 * uno step visto, uno step completato, un selector aperto — non il business
 * del singolo ruolo: quello resta ai rispettivi flussi.
 *
 * Nessun contenuto libero dei campi finisce qui (§AV): si misurano lo step, il
 * tipo di profilo e il nome del campo, mai il valore che l'utente ha scritto.
 */

import { trackEvent } from "../../lib/analytics";

export type OnboardingAnalyticsEvent =
  | { name: "onboarding_step_viewed"; step: string; profileType: string }
  | { name: "onboarding_step_completed"; step: string; profileType: string }
  | { name: "onboarding_back_used"; step: string; profileType: string }
  | {
      name: "onboarding_selector_opened";
      step: string;
      profileType: string;
      field: string;
    }
  | {
      name: "onboarding_validation_error";
      step: string;
      profileType: string;
      field: string;
    };

export function trackOnboardingEvent(event: OnboardingAnalyticsEvent) {
  const { name, ...props } = event;

  trackEvent(name, props);
}
