/**
 * Eventi del ramo "Media e tifosi" (REV-ONB-08 §AT).
 *
 * Misurano l'avanzamento, non il contenuto: nome, cognome, telefono, data di
 * nascita e testo digitato nella ricerca territoriale non entrano mai nel
 * payload. Regioni e province viaggiano come conteggio.
 */
import { trackEvent } from "../../../lib/analytics";

export type FanOnboardingEvent =
  | { name: "community_onboarding_started" }
  | { name: "community_path_selected"; path: "fan" | "media" }
  | { name: "fan_onboarding_started" }
  | { name: "fan_football_types_selected"; count: number }
  | { name: "fan_territory_mode_selected"; mode: string }
  | { name: "fan_territory_branch_opened"; branch: "regions" | "provinces" }
  | { name: "fan_regions_selected"; count: number }
  | { name: "fan_provinces_selected"; count: number }
  | { name: "fan_onboarding_completed"; footballTypeCount: number; mode: string }
  | { name: "fan_discover_cta_pressed" };

export function trackFanOnboardingEvent(event: FanOnboardingEvent) {
  const { name, ...props } = event;

  trackEvent(name, props);
}
