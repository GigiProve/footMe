/**
 * HOM-13 §252–§259: la coda che porta gli eventi Feed a `record_feed_events(p_events jsonb)`.
 *
 * Stessa meccanica di `content-insights/content-events-service` (HOM-05 §144–149),
 * di cui riusa l'uuid e le soglie: coda in memoria, `event_id` uuid (il server deduplica
 * su di esso), spedizione a 20 eventi / 10s / app non attiva, mai oltre 50 per chiamata,
 * fire-and-forget (non solleva, non si attende, un lotto fallito è scartato). Servizio
 * separato perché la RPC e il vocabolario sono altri: gli eventi tecnici locali di
 * `feed-analytics` restano locali, questi vanno al server.
 *
 * Contiene anche il `feed_session_id` LOCALE di Seguiti (§256): Seguiti non ha sessioni
 * server (§267), ma le impression HOM-05 e la sua attribuzione ne vogliono una.
 */

import { AppState } from "react-native";

import { newContentEventId } from "../content-insights/content-events-service";
import { hasSupabaseEnv, supabase } from "../../lib/supabase";
import {
  buildFeedEvent,
  FEED_EVENT_LIMITS,
  type FeedEvent,
  type FeedEventInput,
} from "./feed-events-presentation";

type FeedEventsSender = (events: FeedEvent[]) => Promise<void>;

async function defaultSender(events: FeedEvent[]): Promise<void> {
  if (!hasSupabaseEnv) {
    return;
  }

  const { error } = await supabase.rpc("record_feed_events", { p_events: events });
  if (error) {
    throw error;
  }
}

let sender: FeedEventsSender = defaultSender;
let queue: FeedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let localSeguitiSessionId: string | null = null;
let appStateSubscription: { remove: () => void } | null = null;

/** §256: l'id locale di Seguiti, uno per avvio dell'app, usato come `session_id` HOM-05. */
export function getSeguitiLocalSessionId(): string {
  if (!localSeguitiSessionId) {
    localSeguitiSessionId = newContentEventId();
  }
  return localSeguitiSessionId;
}

function clearTimer(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

function armTimer(): void {
  if (timer || queue.length === 0) {
    return;
  }
  timer = setTimeout(() => {
    timer = null;
    void flushFeedEvents();
  }, FEED_EVENT_LIMITS.flushIntervalMs);
}

function ensureAppStateListener(): void {
  if (appStateSubscription) {
    return;
  }
  // Lo stub di react-native dei test non ha AppState: opzionale come altrove.
  appStateSubscription =
    AppState?.addEventListener?.("change", (state) => {
      if (state !== "active") {
        void flushFeedEvents();
      }
    }) ?? null;
}

/** Spedisce la coda a lotti da 50. Non solleva mai; un lotto fallito è scartato. */
export async function flushFeedEvents(): Promise<void> {
  clearTimer();
  if (flushing) {
    return;
  }

  flushing = true;
  try {
    while (queue.length > 0) {
      const batch = queue.splice(0, FEED_EVENT_LIMITS.maxBatch);
      try {
        await sender(batch);
      } catch {
        // Scartato, niente retry: nessuna tempesta. Il resto riparte al prossimo giro.
        break;
      }
    }
  } finally {
    flushing = false;
    armTimer();
  }
}

/** Valida, accoda e, se serve, spedisce. Mai un'eccezione verso l'interfaccia. */
export function emitFeedEvent(input: FeedEventInput): void {
  try {
    const event = buildFeedEvent(input, {
      eventId: newContentEventId(),
      occurredAt: new Date().toISOString(),
    });
    if (!event) {
      return;
    }

    ensureAppStateListener();
    queue.push(event);
    if (queue.length > FEED_EVENT_LIMITS.maxQueue) {
      queue.splice(0, queue.length - FEED_EVENT_LIMITS.maxQueue);
    }

    if (queue.length >= FEED_EVENT_LIMITS.flushThreshold) {
      void flushFeedEvents();
      return;
    }
    armTimer();
  } catch {
    // Un evento perso è accettabile; un'eccezione in un handler no.
  }
}

/** Sessione chiusa (logout, scadenza): gli eventi in coda non sono del prossimo account. */
export function discardFeedEvents(): void {
  clearTimer();
  queue = [];
  localSeguitiSessionId = null;
}

/** Solo per i test: sostituisce l'invio (`null` ripristina quello reale). */
export function setFeedEventsSender(next: FeedEventsSender | null): void {
  sender = next ?? defaultSender;
}

/** Solo per i test: azzera coda, timer e sessione locale. */
export function resetFeedEventsForTest(): void {
  clearTimer();
  queue = [];
  flushing = false;
  localSeguitiSessionId = null;
  appStateSubscription?.remove();
  appStateSubscription = null;
  sender = defaultSender;
}

/** Solo per i test: quanti eventi sono in coda. */
export function pendingFeedEventsCount(): number {
  return queue.length;
}
