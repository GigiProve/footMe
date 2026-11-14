/**
 * Eventi tecnici del Mi piace (HOM-07 §189–§190). Mai mostrati all'utente.
 *
 * Gli otto eventi del §189 sul Like: aggiunta e rimozione (tentativo e
 * successo), fallimento, apertura della lista, apertura di un'identità dalla
 * lista, Segui dalla lista. Gli eventi del Salvato (`save_*`, `saved_*`) stanno
 * nel modulo dei Salvati.
 *
 * §190: solo id, tipo di contenuto e tipo di identità, mai il testo di un
 * contenuto né il nome di chi ha messo Mi piace. Lo stesso `trackEvent` del
 * resto dell'app: nessun nuovo sink. La tabella `content_likes` con
 * `created_at` è la sorgente degli eventi per le future notifiche social
 * (§191): qui non se ne emette nessuno.
 */

import { trackEvent, type AnalyticsProps } from "../../lib/analytics";
import type { InteractionIdentityType } from "./interaction-types";

/** Perché un Mi piace non è andato a buon fine, senza testo d'errore. */
export type LikeFailureReason = "no_identity" | "unavailable" | "forbidden" | "network";

type LikeEventBase = {
  contentType: string;
  contentId: string;
  identityType: InteractionIdentityType | null;
};

export type LikeAnalyticsEvent =
  | ({ name: "like_add_attempt" } & LikeEventBase)
  | ({ name: "like_add_success" } & LikeEventBase)
  | ({ name: "like_remove_attempt" } & LikeEventBase)
  | ({ name: "like_remove_success" } & LikeEventBase)
  | ({ name: "like_failure"; action: "add" | "remove"; reason: LikeFailureReason } & LikeEventBase)
  | { name: "likes_list_open"; contentType: string; contentId: string; likesCount: number }
  | {
      name: "identity_open_from_likes";
      contentType: string;
      contentId: string;
      actorType: InteractionIdentityType;
    }
  | {
      name: "follow_from_likes";
      contentType: string;
      contentId: string;
      actorType: InteractionIdentityType;
      following: boolean;
    };

export const LIKE_ANALYTICS_EVENT_NAMES = [
  "like_add_attempt",
  "like_add_success",
  "like_remove_attempt",
  "like_remove_success",
  "like_failure",
  "likes_list_open",
  "identity_open_from_likes",
  "follow_from_likes",
] as const satisfies readonly LikeAnalyticsEvent["name"][];

export function trackLike(event: LikeAnalyticsEvent): void {
  const { name, ...rest } = event;
  trackEvent(name, rest as AnalyticsProps);
}

/** Dall'errore della RPC a un motivo leggibile, mai al messaggio grezzo (§190). */
export function classifyLikeFailure(error: unknown): LikeFailureReason {
  const message =
    typeof error === "object" && error !== null
      ? String((error as { message?: unknown }).message ?? "")
      : "";

  if (message.includes("like_identity_forbidden")) {
    return "forbidden";
  }
  if (message.includes("content_unavailable")) {
    return "unavailable";
  }
  return "network";
}
