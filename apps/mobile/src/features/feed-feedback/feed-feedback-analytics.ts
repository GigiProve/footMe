/**
 * Eventi di prodotto di «Non mi interessa» (HOM-11 §186). Mai mostrati all'utente.
 *
 * I sei eventi del §186, uno a uno. Solo id, tipi e origin: nessun testo del
 * contenuto, nessuna identità del viewer verso l'autore (§191). L'id del motivo è
 * un identificatore interno non sensibile (§190). Distinti per nome dagli eventi
 * Follow e Segnala (§297): le tre famiglie non si confondono.
 */

import { trackEvent, type AnalyticsProps } from "../../lib/analytics";
import type { ContentOrigin } from "../feed/content-routes";
import type { FeedContentType } from "../feed/feed-types";

type Base = {
  contentType: FeedContentType;
  contentId: string;
  origin: ContentOrigin | null;
  /** §39: l'elemento visto era un Simple Repost. */
  simpleRepost: boolean;
};

export type FeedFeedbackFailure = "network" | "not_allowed";

export type FeedFeedbackAnalyticsEvent =
  | ({ name: "not_interested_selected" } & Base)
  | ({ name: "not_interested_success"; unavailable: boolean } & Base)
  | ({ name: "not_interested_failure"; reason: FeedFeedbackFailure } & Base)
  | ({ name: "not_interested_undo" } & Base)
  | ({ name: "not_interested_reason_open" } & Base)
  | ({ name: "not_interested_reason_selected"; reasonId: string } & Base);

/** Gli eventi del §186, nell'ordine della specifica (il test li confronta uno a uno). */
export const FEED_FEEDBACK_EVENT_NAMES = [
  "not_interested_selected",
  "not_interested_success",
  "not_interested_failure",
  "not_interested_undo",
  "not_interested_reason_open",
  "not_interested_reason_selected",
] as const satisfies readonly FeedFeedbackAnalyticsEvent["name"][];

export function trackFeedFeedback(event: FeedFeedbackAnalyticsEvent): void {
  const { name, ...rest } = event;
  trackEvent(name, rest as AnalyticsProps);
}
