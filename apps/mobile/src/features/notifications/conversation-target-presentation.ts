/**
 * DAS-REV-34 §15–§18, §20, §25 — derivazioni pure del target «conversation».
 *
 * Una notifica strutturale dei gruppi (aggiunta, rimozione, ruolo, eliminazione) e
 * una push di chat portano solo identificativi opachi: l'id della Conversation, il
 * periodo e l'intento. Un id non è una capability (§25): la destinazione la decide
 * `resolve_conversation_target` sul server, con account, periodo e stato correnti.
 * Qui si decide soltanto cosa fare di ciascun esito, mai se l'accesso è valido, e
 * mai dal copy (§147 HOM-14).
 *
 *   • open        → la chat;
 *   • info        → Info gruppo (promozione/demozione: l'avviso parla del ruolo);
 *   • revoked / deleted / unavailable → il fallback focalizzato (screen 11/12),
 *     senza cronologia né composer sotto.
 *
 * Un errore di rete non è un esito: non si apre il fallback (che direbbe «non fai
 * più parte» a chi ha solo perso il segnale) e non si apre la chat.
 */

import { conversationUnavailableRoute, groupInfoRoute } from "../messaging/messaging-routes";

export const CONVERSATION_INTENTS = ["message", "added", "role", "lifecycle", "removed", "deleted"] as const;
export type ConversationIntent = (typeof CONVERSATION_INTENTS)[number];

export const CONVERSATION_OUTCOMES = ["open", "info", "revoked", "deleted", "unavailable"] as const;
export type ConversationOutcome = (typeof CONVERSATION_OUTCOMES)[number];

/** Gli esiti che non portano a una conversazione: aprono il fallback e contano come «negati». */
export type ConversationDeniedOutcome = Extract<ConversationOutcome, "revoked" | "deleted" | "unavailable">;

export type ConversationLink = {
  conversationId: string;
  intent: ConversationIntent;
  /** Periodo di accesso dell'evento (GROUP); null per le DIRECT. */
  periodId: string | null;
};

/** §343: copy neutro dell'esito non disponibile (toast del Centro). */
export const CONVERSATION_UNAVAILABLE_MESSAGE = "Questa conversazione non è più disponibile.";

/** Errore temporaneo (rete, timeout): ritentabile, senza dire nulla sull'accesso. */
export const CONVERSATION_OPEN_ERROR_MESSAGE = "Non siamo riusciti ad aprire la conversazione. Riprova.";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Gli id finiscono in un path di navigazione e in una query: solo uuid. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function isConversationIntent(value: unknown): value is ConversationIntent {
  return typeof value === "string" && (CONVERSATION_INTENTS as readonly string[]).includes(value);
}

function isConversationOutcome(value: unknown): value is ConversationOutcome {
  return typeof value === "string" && (CONVERSATION_OUTCOMES as readonly string[]).includes(value);
}

/**
 * Il link di una notifica con target `conversation` (`target_id` = Conversation,
 * `target_params` = {period_id, intent, …}). Null se gli identificativi non sono
 * uuid: il chiamante tratta il target come non disponibile.
 */
export function conversationLinkFromTarget(target: {
  id: string;
  params: Record<string, unknown>;
}): ConversationLink | null {
  if (!isUuid(target.id)) {
    return null;
  }

  const period = target.params.period_id;

  if (period !== undefined && period !== null && !isUuid(period)) {
    return null;
  }

  const intent = target.params.intent;

  return {
    conversationId: target.id,
    // Un intento mancante o sconosciuto non concede nulla: il server decide dalla membership.
    intent: isConversationIntent(intent) ? intent : "message",
    periodId: typeof period === "string" ? period : null,
  };
}

/** La risposta del resolver: l'esito e, se il server lo dice, il tipo di conversazione. */
export type ConversationResolution = {
  /** `conversation_type` della RPC ('direct' | 'group'); null per un estraneo o un id inesistente. */
  conversationType: "DIRECT" | "GROUP" | null;
  outcome: ConversationOutcome;
};

/** La risposta jsonb della RPC; null se la forma non è quella attesa. */
export function parseConversationResolution(raw: unknown): ConversationResolution | null {
  const row = Array.isArray(raw) ? raw[0] : raw;

  if (typeof row !== "object" || row === null) {
    return null;
  }

  const { conversation_type: type, outcome } = row as Record<string, unknown>;

  if (!isConversationOutcome(outcome)) {
    return null;
  }

  const normalized = typeof type === "string" ? type.toUpperCase() : null;

  return {
    conversationType: normalized === "DIRECT" || normalized === "GROUP" ? normalized : null,
    outcome,
  };
}

/** Solo l'esito dalla risposta jsonb della RPC; null se la forma non è quella attesa. */
export function parseConversationOutcome(raw: unknown): ConversationOutcome | null {
  return parseConversationResolution(raw)?.outcome ?? null;
}

export function isDeniedOutcome(outcome: ConversationOutcome): outcome is ConversationDeniedOutcome {
  return outcome === "revoked" || outcome === "deleted" || outcome === "unavailable";
}

/** `app/messages/unavailable.tsx` (fallback 11/12): il motivo è l'esito del server. Una sola definizione, del modulo Messaggi. */
export function conversationFallbackHref(reason: ConversationDeniedOutcome): string {
  return conversationUnavailableRoute(reason);
}

export function conversationChatHref(conversationId: string): string {
  return `/messages/${encodeURIComponent(conversationId)}`;
}

/** La destinazione di un esito del server. */
export function conversationOutcomeHref(outcome: ConversationOutcome, conversationId: string): string {
  switch (outcome) {
    case "open":
      return conversationChatHref(conversationId);
    case "info":
      return groupInfoRoute(conversationId);
    default:
      return conversationFallbackHref(outcome);
  }
}

/**
 * §27: `conversation_type` per l'analytics, solo quello restituito dal resolver. Con null
 * (conversazione estranea o inesistente) non si deduce nulla dal link, che un estraneo
 * può manomettere: vale `unknown`.
 */
export function conversationTypeOf(
  serverType: ConversationResolution["conversationType"],
): "DIRECT" | "GROUP" | "unknown" {
  return serverType ?? "unknown";
}

/**
 * Il path opaco che sopravvive a login e onboarding (§293, HOM-15 §297) quando
 * il tap su un push arriva senza sessione. Porta solo gli identificativi: il
 * Centro li rilegge, li passa dal resolver con l'account che ha davvero fatto
 * accesso e non mostra nulla prima della risposta.
 */
export function conversationPendingHref(link: ConversationLink): string {
  const params = [`conversation=${link.conversationId}`, `intent=${link.intent}`];

  if (link.periodId) {
    params.push(`period=${link.periodId}`);
  }

  return `/notifications?${params.join("&")}`;
}

/** Il link dai parametri della route `/notifications?conversation=…`; null se non validi. */
export function conversationLinkFromParams(params: {
  conversation?: string | null;
  intent?: string | null;
  period?: string | null;
}): ConversationLink | null {
  const conversationId = params.conversation;

  if (!isUuid(conversationId)) {
    return null;
  }

  if (params.period && !isUuid(params.period)) {
    return null;
  }

  return {
    conversationId,
    intent: isConversationIntent(params.intent) ? params.intent : "message",
    periodId: params.period || null,
  };
}
