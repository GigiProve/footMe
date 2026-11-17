/**
 * DAS-REV-34 §27 — eventi di prodotto dell'apertura di una conversazione da push
 * o da notifica. Mai mostrati all'utente.
 *
 * Solo enumerazioni: tipo di conversazione (DIRECT | GROUP), esito del resolver e
 * provenienza. Nessun id, nome, testo o periodo: il segnale serve a sapere quante
 * aperture riescono e quante trovano un accesso non più valido, non chi o dove.
 */

import { trackEvent, type AnalyticsProps } from "../../lib/analytics";
import type { ConversationDeniedOutcome } from "./conversation-target-presentation";

/** `unknown` quando il resolver non lo sa (conversazione estranea o inesistente): niente deduzioni. */
export type ConversationAnalyticsType = "DIRECT" | "GROUP" | "unknown";

/** `push` include il tap ripreso dopo il login (stesso gesto, path opaco). */
export type ConversationOpenOrigin = "push" | "center";

export type ConversationTargetAnalyticsEvent =
  | {
      name: "conversation_opened_from_push";
      conversation_type: ConversationAnalyticsType;
      outcome: "open" | "info";
      origin: ConversationOpenOrigin;
    }
  | {
      name: "conversation_deeplink_denied";
      conversation_type: ConversationAnalyticsType;
      outcome: ConversationDeniedOutcome;
      origin: ConversationOpenOrigin;
    };

export function trackConversationTarget(event: ConversationTargetAnalyticsEvent): void {
  const { name, ...rest } = event;
  trackEvent(name, rest as AnalyticsProps);
}
