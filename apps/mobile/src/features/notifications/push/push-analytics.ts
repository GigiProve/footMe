/**
 * Eventi di prodotto delle Preferenze notifiche e del permesso Push (HOM-14 §260).
 * Mai mostrati all'utente. Le props sono solo la categoria e lo stato del permesso:
 * nessun testo di notifiche né dati dell'account. Gli eventi del Centro (§255-§259)
 * stanno in `notification-analytics.ts`, non qui.
 */

import { trackEvent, type AnalyticsProps } from "../../../lib/analytics";
import type { PushPreferenceKey } from "../notification-preferences-types";
import type { PushPermissionState } from "./push-presentation";

export type PushAnalyticsEvent =
  | { name: "notification_preferences_open"; permission: PushPermissionState }
  | { name: "push_category_enabled"; category: PushPreferenceKey }
  | { name: "push_category_disabled"; category: PushPreferenceKey }
  | { name: "open_device_notification_settings"; permission: PushPermissionState };

/** Gli eventi del §260, nell'ordine della specifica. */
export const PUSH_PREFERENCE_EVENT_NAMES = [
  "notification_preferences_open",
  "push_category_enabled",
  "push_category_disabled",
  "open_device_notification_settings",
] as const satisfies readonly PushAnalyticsEvent["name"][];

export function trackPush(event: PushAnalyticsEvent): void {
  const { name, ...rest } = event;
  trackEvent(name, rest as AnalyticsProps);
}
