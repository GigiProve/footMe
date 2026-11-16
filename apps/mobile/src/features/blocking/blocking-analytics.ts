/**
 * Eventi di prodotto di Blocca / Sblocca (HOM-12 §250–§253). Mai mostrati all'utente.
 *
 * I sedici eventi del §250, uno a uno. §252: mai testo di messaggi, motivo presunto
 * del Block, nomi o altro testo privato — le props sono solo `identity_type` e
 * `surface`, tipizzate per evento, così un testo non ci entra per distrazione.
 * §253: nessun evento «follow restored», perché il Follow non si ripristina.
 * Distinti per nome da Non mi interessa, Follow e Segnala (§165–§170).
 */

import { trackEvent, type AnalyticsProps } from "../../lib/analytics";
import type { BlockIdentityType, BlockSurface } from "./blocking-types";

export type BlockFailureReason = "network" | "not_allowed" | "unavailable";

type WithIdentity = { identityType: BlockIdentityType };
type WithSurface = WithIdentity & { surface: BlockSurface };

export type BlockingAnalyticsEvent =
  | ({ name: "profile_actions_open" } & WithIdentity)
  | ({ name: "block_selected" } & WithSurface)
  | ({ name: "block_confirmation_cancelled" } & WithSurface)
  | ({ name: "block_submit" } & WithSurface)
  | ({ name: "block_success" } & WithSurface)
  | ({ name: "block_failure"; reason: BlockFailureReason } & WithSurface)
  | ({ name: "blocked_profile_state_viewed_by_blocker" } & WithIdentity)
  | ({ name: "profile_unavailable_state_viewed" } & WithIdentity)
  | { name: "blocked_direct_opened_by_blocker" }
  | { name: "blocked_direct_opened_by_blocked" }
  | ({ name: "unblock_from_profile" } & WithIdentity)
  | { name: "unblock_from_chat" }
  | { name: "blocked_profiles_open" }
  | ({ name: "unblock_from_settings" } & WithIdentity)
  | ({ name: "unblock_success" } & WithSurface)
  | ({ name: "unblock_failure" } & WithSurface);

/** Gli eventi del §250, nell'ordine della specifica (il test li confronta uno a uno). */
export const BLOCKING_EVENT_NAMES = [
  "profile_actions_open",
  "block_selected",
  "block_confirmation_cancelled",
  "block_submit",
  "block_success",
  "block_failure",
  "blocked_profile_state_viewed_by_blocker",
  "profile_unavailable_state_viewed",
  "blocked_direct_opened_by_blocker",
  "blocked_direct_opened_by_blocked",
  "unblock_from_profile",
  "unblock_from_chat",
  "blocked_profiles_open",
  "unblock_from_settings",
  "unblock_success",
  "unblock_failure",
] as const satisfies readonly BlockingAnalyticsEvent["name"][];

export function trackBlocking(event: BlockingAnalyticsEvent): void {
  const { name, ...rest } = event;
  trackEvent(name, rest as AnalyticsProps);
}
