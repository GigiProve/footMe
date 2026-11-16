/**
 * Eventi di prodotto del Centro Notifiche (HOM-14 §256–§257). Mai mostrati
 * all'utente.
 *
 * §261: niente testo di commenti, anteprime, nomi o altro contenuto privato. Le
 * props sono solo tipo di notifica, conteggi e provenienza, tipizzate per evento
 * così un testo non ci entra per distrazione. Gli eventi lato backend (§258
 * aggregazione, §259 push) non passano da qui. Distinti per nome: apertura del
 * Centro (badge azzerato), vista in lotto (SEEN) e apertura della singola
 * notifica (OPENED).
 */

import { trackEvent, type AnalyticsProps } from "../../lib/analytics";

/** Da dove arriva l'apertura: la riga nel Centro o il tap su un push (§177). */
export type NotificationOpenOrigin = "center" | "push";

type WithType = { notificationType: string };

export type NotificationAnalyticsEvent =
  | { name: "notification_center_open"; badgeCount: number }
  | { name: "notification_center_seen_batch"; seenCount: number }
  | { name: "notification_badge_cleared_on_center_open"; clearedCount: number }
  | ({ name: "notification_impression"; eventCount: number; isOpened: boolean } & WithType)
  | ({ name: "notification_open"; origin: NotificationOpenOrigin; wasOpened: boolean } & WithType)
  | ({ name: "notification_target_open_success"; origin: NotificationOpenOrigin } & WithType)
  | ({ name: "notification_target_unavailable"; origin: NotificationOpenOrigin } & WithType)
  | { name: "notification_load_more"; loadedCount: number }
  | { name: "notification_refresh" };

/** Gli eventi del §256–§257 nell'ordine della specifica (il test li confronta uno a uno). */
export const NOTIFICATION_EVENT_NAMES = [
  "notification_center_open",
  "notification_center_seen_batch",
  "notification_badge_cleared_on_center_open",
  "notification_impression",
  "notification_open",
  "notification_target_open_success",
  "notification_target_unavailable",
  "notification_load_more",
  "notification_refresh",
] as const satisfies readonly NotificationAnalyticsEvent["name"][];

export function trackNotification(event: NotificationAnalyticsEvent): void {
  const { name, ...rest } = event;
  trackEvent(name, rest as AnalyticsProps);
}
