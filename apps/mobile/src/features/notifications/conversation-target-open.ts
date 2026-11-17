/**
 * DAS-REV-34 §25 — apertura di una conversazione da notifica o push.
 *
 * Il client non apre la chat prima della risposta del server: chiede
 * `resolve_conversation_target` e naviga all'esito (chat, Info gruppo o fallback
 * 11/12). Le dipendenze arrivano da fuori (RPC, router, toast, analytics) così
 * l'ordine «prima il server, poi la navigazione» e la distinzione fra esito
 * negato ed errore di rete si provano senza renderizzare.
 *
 * Errore di rete o di server ≠ revoca: nessuna navigazione, un toast ritentabile
 * e nessun evento di accesso negato. Il fallback «Non fai più parte di questo
 * gruppo» si apre solo quando è il server a dirlo.
 */

import type { ConversationTargetAnalyticsEvent, ConversationOpenOrigin } from "./conversation-target-analytics";
import {
  CONVERSATION_OPEN_ERROR_MESSAGE,
  conversationOutcomeHref,
  conversationTypeOf,
  isDeniedOutcome,
  type ConversationLink,
  type ConversationOutcome,
  type ConversationResolution,
} from "./conversation-target-presentation";

export type OpenConversationDeps = {
  navigate: (href: string) => void;
  resolve: (link: ConversationLink) => Promise<ConversationResolution>;
  showError: (message: string) => void;
  track: (event: ConversationTargetAnalyticsEvent) => void;
};

/** L'esito del server, o null se non c'è stata risposta (errore temporaneo, già segnalato). */
export async function openConversationLink(
  link: ConversationLink,
  origin: ConversationOpenOrigin,
  deps: OpenConversationDeps,
): Promise<ConversationOutcome | null> {
  let resolution: ConversationResolution;

  try {
    resolution = await deps.resolve(link);
  } catch {
    deps.showError(CONVERSATION_OPEN_ERROR_MESSAGE);
    return null;
  }

  const { outcome } = resolution;
  const conversation_type = conversationTypeOf(resolution.conversationType);

  if (isDeniedOutcome(outcome)) {
    deps.track({ conversation_type, name: "conversation_deeplink_denied", origin, outcome });
  } else if (origin === "push") {
    deps.track({ conversation_type, name: "conversation_opened_from_push", origin, outcome });
  }

  deps.navigate(conversationOutcomeHref(outcome, link.conversationId));

  return outcome;
}
