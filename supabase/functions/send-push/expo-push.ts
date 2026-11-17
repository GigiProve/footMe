/**
 * HOM-14 §173–§179, §211 — logica pura della Edge Function `send-push`:
 * costruzione dei messaggi Expo e lettura dei ticket. Nessun accesso a rete o
 * database: è la parte che si può testare senza Expo.
 *
 * Payload minimo (§211): titolo, corpo breve già composto dal database
 * (`claim_push_deliveries`) e dati tecnici. Mai il testo di un commento, mai
 * l'id del contenuto: il tap risolve il target dal Centro (Target Resolver +
 * visibility, §167).
 *
 * DAS-REV-34 §15, DOD-025: la stessa coda porta anche push di conversazione
 * (messaggi DIRECT/GROUP, archiviazione/riattivazione dei gruppi). Il payload
 * `data` è UNO di due, mai misto:
 *   - notifica della campanella  → `{ notification_id }` (invariato);
 *   - chat / lifecycle           → `{ conversation_id, period_id, kind }`
 *     (solo identificativi tecnici, il testo non viaggia nei dati).
 * `threadId` = conversation_id quando la push riguarda una conversazione
 * (iOS raggruppa per conversazione). MAI `collapseId`: sostituirebbe
 * messaggi distinti della stessa chat. `ttl` (secondi) è il residuo deciso
 * dal database: una push ritardata non sopravvive oltre la propria validità.
 */

export type NotificationPushData = { notification_id: string };
export type ConversationPushData = {
  conversation_id: string;
  period_id: string | null;
  kind: "message" | "lifecycle";
};
export type PushData = NotificationPushData | ConversationPushData;

export type ClaimedDelivery = {
  d_id: number;
  /** Nullo per chat e lifecycle (non hanno una riga di campanella). */
  d_notification_id: string | null;
  d_recipient: string;
  d_priority: "high" | "medium" | "low";
  d_title: string | null;
  d_body: string | null;
  d_data: Partial<NotificationPushData> & Partial<ConversationPushData>;
  d_tokens: { device_id: string; token: string }[];
  /* Assenti se il database è ancora alla versione precedente della claim:
     la funzione resta compatibile con le righe nel vecchio formato. */
  d_kind?: "notification" | "chat_message" | "group_lifecycle";
  d_thread_id?: string | null;
  d_ttl_seconds?: number | null;
};

export type ExpoMessage = {
  to: string;
  title: string;
  body?: string;
  data: PushData;
  sound: "default";
  priority: "high" | "default";
  channelId: string;
  threadId?: string;
  ttl?: number;
};

/**
 * Whitelist del payload `data`: copia solo le chiavi ammesse per il tipo
 * della delivery. Qualunque altra chiave arrivi dal database non viaggia mai
 * verso il dispositivo.
 */
export function buildData(delivery: ClaimedDelivery): PushData {
  const kind = delivery.d_kind ?? "notification";
  if (kind === "notification") {
    return { notification_id: delivery.d_data.notification_id ?? delivery.d_notification_id ?? "" };
  }
  return {
    conversation_id: delivery.d_data.conversation_id ?? "",
    period_id: delivery.d_data.period_id ?? null,
    kind: kind === "chat_message" ? "message" : "lifecycle",
  };
}

export type ExpoTicket =
  | { status: "ok"; id?: string }
  | { status: "error"; message?: string; details?: { error?: string } };

export const EXPO_BATCH_SIZE = 100;

export function buildMessages(delivery: ClaimedDelivery): ExpoMessage[] {
  const title = (delivery.d_title ?? "").trim() || "ProLink";
  const body = delivery.d_body?.trim() || undefined;
  const data = buildData(delivery);
  const threadId = delivery.d_thread_id?.trim() || undefined;
  const ttl =
    typeof delivery.d_ttl_seconds === "number" && delivery.d_ttl_seconds > 0
      ? Math.floor(delivery.d_ttl_seconds)
      : undefined;
  return delivery.d_tokens.map((t) => ({
    to: t.token,
    title,
    ...(body ? { body } : {}),
    data,
    sound: "default" as const,
    // HIGH (menzioni, risposte, fallimenti, messaggi) esce con priorità alta (§141).
    priority: delivery.d_priority === "high" ? ("high" as const) : ("default" as const),
    channelId: "default",
    ...(threadId ? { threadId } : {}),
    ...(ttl ? { ttl } : {}),
  }));
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export type DeliveryOutcome = {
  status: "sent" | "failed" | "retry";
  reason: string | null;
  invalidTokens: string[];
};

/**
 * `tickets` è nello stesso ordine di `messages`. Inviata se almeno un
 * dispositivo ha accettato il messaggio; DeviceNotRegistered disattiva il
 * token; senza alcun ticket ok, un errore transitorio (rete/limite) riprova,
 * il resto fallisce.
 */
export function summarizeTickets(messages: ExpoMessage[], tickets: (ExpoTicket | null)[]): DeliveryOutcome {
  const invalid: string[] = [];
  let ok = 0;
  let transient = false;
  let lastReason: string | null = null;

  messages.forEach((message, i) => {
    const ticket = tickets[i] ?? null;
    if (!ticket) {
      transient = true;
      lastReason = "no_ticket";
      return;
    }
    if (ticket.status === "ok") {
      ok += 1;
      return;
    }
    const code = ticket.details?.error ?? "error";
    lastReason = code;
    if (code === "DeviceNotRegistered") invalid.push(message.to);
    else if (code === "MessageRateExceeded" || code === "error") transient = true;
  });

  if (ok > 0) return { status: "sent", reason: null, invalidTokens: invalid };
  return { status: transient ? "retry" : "failed", reason: lastReason, invalidTokens: invalid };
}
