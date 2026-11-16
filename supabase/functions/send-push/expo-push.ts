/**
 * HOM-14 §173–§179, §211 — logica pura della Edge Function `send-push`:
 * costruzione dei messaggi Expo e lettura dei ticket. Nessun accesso a rete o
 * database: è la parte che si può testare senza Expo.
 *
 * Payload minimo (§211): titolo, corpo breve già composto dal database
 * (`claim_push_deliveries`) e `data.notification_id`. Mai il testo di un
 * commento, mai l'id del contenuto: il tap risolve il target dal Centro
 * (Target Resolver + visibility, §167).
 */

export type ClaimedDelivery = {
  d_id: number;
  d_notification_id: string;
  d_recipient: string;
  d_priority: "high" | "medium" | "low";
  d_title: string | null;
  d_body: string | null;
  d_data: { notification_id: string };
  d_tokens: { device_id: string; token: string }[];
};

export type ExpoMessage = {
  to: string;
  title: string;
  body?: string;
  data: { notification_id: string };
  sound: "default";
  priority: "high" | "default";
  channelId: string;
};

export type ExpoTicket =
  | { status: "ok"; id?: string }
  | { status: "error"; message?: string; details?: { error?: string } };

export const EXPO_BATCH_SIZE = 100;

export function buildMessages(delivery: ClaimedDelivery): ExpoMessage[] {
  const title = (delivery.d_title ?? "").trim() || "ProLink";
  const body = delivery.d_body?.trim() || undefined;
  return delivery.d_tokens.map((t) => ({
    to: t.token,
    title,
    ...(body ? { body } : {}),
    data: { notification_id: delivery.d_data.notification_id },
    sound: "default" as const,
    // HIGH (menzioni, risposte, fallimenti) esce con priorità alta (§141).
    priority: delivery.d_priority === "high" ? ("high" as const) : ("default" as const),
    channelId: "default",
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
