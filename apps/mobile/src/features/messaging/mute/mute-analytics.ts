/**
 * Eventi di prodotto delle Notifiche di conversazione (DAS-REV-34 §27).
 * Mai mostrati all'utente. §27: niente nomi di persone o gruppi, body, id di
 * conversazione; solo tipo, durata scelta (enumerata) ed esito. DIRECT e GROUP
 * usano gli stessi eventi, distinti dal solo `conversation_type`.
 */
import { trackEvent, type AnalyticsProps } from "../../../lib/analytics";
import type { ConversationKind, MuteChoice } from "./mute-types";

export type ConversationTypeProp = "DIRECT" | "GROUP";

export type MuteAnalyticsEvent =
  | { name: "conversation_notifications_opened"; conversationType: ConversationTypeProp }
  | {
      name: "conversation_mute_changed";
      conversationType: ConversationTypeProp;
      duration: MuteChoice;
      /** `recovered`: l'esito è stato recuperato dal server dopo una risposta persa. */
      outcome: "applied" | "recovered";
    };

/** Gli eventi del §27 usati da questo filone, nell'ordine della specifica. */
export const MUTE_EVENT_NAMES = [
  "conversation_notifications_opened",
  "conversation_mute_changed",
] as const satisfies readonly MuteAnalyticsEvent["name"][];

export function conversationTypeProp(kind: ConversationKind): ConversationTypeProp {
  return kind === "group" ? "GROUP" : "DIRECT";
}

export function trackMute(event: MuteAnalyticsEvent): void {
  const { name, conversationType, ...rest } = event;

  trackEvent(name, { conversation_type: conversationType, ...rest } as AnalyticsProps);
}
