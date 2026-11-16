/**
 * HOM-14 §173–§179, §203–§212, §267–§269 — Edge Function `send-push`.
 *
 * Drena la coda `notification_push_deliveries` e chiama l'API Expo push. Tutta
 * la decisione (preferenza, priorità, rate limit, blocco, contenuto eliminato)
 * sta nel database: `claim_push_deliveries` RIVALIDA ogni delivery al momento
 * dell'invio e restituisce solo quelle ancora legittime, già con titolo e corpo
 * brevi (§211). Qui c'è solo il trasporto.
 *
 * Il service role vive SOLO qui, mai nel client mobile.
 *
 * Trigger: `footme_push_wake()` (pg_cron + pg_net, migrazione
 * 20261129090000) la chiama ogni minuto se la coda non è vuota. Richiede:
 *   - secret di funzione PUSH_WEBHOOK_SECRET (stesso valore di
 *     app_policy_settings 'notification.push.webhook_secret')
 *   - app_policy_settings 'notification.push.function_url' = URL della funzione
 * Senza pg_net/pg_cron la funzione resta invocabile da uno scheduler esterno
 * con l'header `x-push-secret`.
 *
 * Deploy: `supabase functions deploy send-push --no-verify-jwt` (l'autenticazione
 * è il segreto condiviso, non un JWT utente).
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

import {
  buildMessages,
  chunk,
  EXPO_BATCH_SIZE,
  summarizeTickets,
  type ClaimedDelivery,
  type ExpoMessage,
  type ExpoTicket,
} from "./expo-push.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

const EXPO_URL = "https://exp.host/--/api/v2/push/send";
const CLAIM_SIZE = 50;
const MAX_ROUNDS = 4;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sendToExpo(messages: ExpoMessage[]): Promise<(ExpoTicket | null)[]> {
  const tickets: (ExpoTicket | null)[] = [];
  for (const batch of chunk(messages, EXPO_BATCH_SIZE)) {
    try {
      const headers: Record<string, string> = {
        accept: "application/json",
        "content-type": "application/json",
      };
      const accessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
      if (accessToken) headers.authorization = `Bearer ${accessToken}`;

      const response = await fetch(EXPO_URL, { method: "POST", headers, body: JSON.stringify(batch) });
      if (!response.ok) {
        batch.forEach(() => tickets.push(null));
        continue;
      }
      const payload = (await response.json()) as { data?: ExpoTicket[] };
      batch.forEach((_, i) => tickets.push(payload.data?.[i] ?? null));
    } catch {
      batch.forEach(() => tickets.push(null));
    }
  }
  return tickets;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const expected = Deno.env.get("PUSH_WEBHOOK_SECRET");
  const given = request.headers.get("x-push-secret") ?? "";
  if (!expected || !timingSafeEqual(expected, given)) return json({ error: "unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "misconfigured" }, 500);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  let claimed = 0;
  let sent = 0;
  let failed = 0;
  let retried = 0;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const { data, error } = await admin.rpc("claim_push_deliveries", { p_limit: CLAIM_SIZE });
    if (error) return json({ error: "claim_failed", claimed, sent, failed, retried }, 500);

    const deliveries = (data ?? []) as ClaimedDelivery[];
    if (deliveries.length === 0) break;
    claimed += deliveries.length;

    for (const delivery of deliveries) {
      const messages = buildMessages(delivery);
      const tickets = await sendToExpo(messages);
      const outcome = summarizeTickets(messages, tickets);

      const { error: completeError } = await admin.rpc("complete_push_delivery", {
        p_id: delivery.d_id,
        p_status: outcome.status,
        p_reason: outcome.reason,
        p_invalid_tokens: outcome.invalidTokens.length ? outcome.invalidTokens : null,
      });
      if (completeError) continue;

      if (outcome.status === "sent") sent += 1;
      else if (outcome.status === "retry") retried += 1;
      else failed += 1;
    }

    if (deliveries.length < CLAIM_SIZE) break;
  }

  return json({ claimed, sent, failed, retried });
});
