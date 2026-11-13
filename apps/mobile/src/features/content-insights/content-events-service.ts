/**
 * HOM-05 §144–149: la coda che porta gli eventi per contenuto a
 * `record_content_events(p_events jsonb)`.
 *
 * Servizio DEDICATO, non un sink globale su `lib/analytics.ts` (contratto,
 * «Client»): gli eventi tecnici della Home restano locali, questi vanno al
 * server e alimentano le statistiche.
 *
 *  • coda in memoria; ogni evento ha un `event_id` uuid (il server dedupe su di
 *    esso) e il `session_id` della sessione dell'app (un uuid per avvio);
 *  • si spedisce a 20 eventi, oppure 10s dopo il primo evento in coda, oppure
 *    quando l'app lascia lo stato attivo; mai più di 50 eventi per chiamata;
 *  • fire-and-forget: non solleva MAI e non va awaited dai call site. Un lotto
 *    che fallisce è scartato, senza ritentare: niente tempeste di retry (§151: il
 *    server aggrega, un evento perso è accettabile);
 *  • senza configurazione Supabase (test) non si spedisce nulla.
 *
 * Source «implicita»: il player video e le altre superfici interne non sanno da
 * dove sia arrivato il contenuto. `rememberContentSource` la registra quando il
 * contenuto compare (impression del Feed, apertura del dettaglio) e
 * `contentSourceOf` la restituisce agli eventi successivi dello stesso
 * contenuto; assente = `OTHER`.
 */

import { AppState } from "react-native";

import { hasSupabaseEnv, supabase } from "../../lib/supabase";
import {
  buildContentEvent,
  contentKey,
  parseContentKey,
} from "./content-events-presentation";
import {
  CONTENT_EVENT_LIMITS,
  type ContentEvent,
  type ContentEventInput,
  type ContentEventProps,
  type ContentEventSource,
  type ContentEventType,
} from "./content-events-types";

type ContentEventsSender = (events: ContentEvent[]) => Promise<void>;

async function defaultSender(events: ContentEvent[]): Promise<void> {
  if (!hasSupabaseEnv) {
    return;
  }

  const { error } = await supabase.rpc("record_content_events", { p_events: events });
  if (error) {
    throw error;
  }
}

let sender: ContentEventsSender = defaultSender;
let queue: ContentEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let sessionId: string | null = null;
let appStateSubscription: { remove: () => void } | null = null;

/** uuid v4: `randomUUID` se c'è (Hermes può non averlo), altrimenti il template. */
export function newContentEventId(): string {
  const globalCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof globalCrypto?.randomUUID === "function") {
    return globalCrypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

/** §149: lo stesso `session_id` per tutta la sessione dell'app. */
export function getContentEventsSessionId(): string {
  if (!sessionId) {
    sessionId = newContentEventId();
  }
  return sessionId;
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
    void flushContentEvents();
  }, CONTENT_EVENT_LIMITS.flushIntervalMs);
}

function ensureAppStateListener(): void {
  if (appStateSubscription) {
    return;
  }
  // Lo stub di react-native dei test non ha AppState: opzionale come altrove.
  appStateSubscription =
    AppState?.addEventListener?.("change", (state) => {
      if (state !== "active") {
        void flushContentEvents();
      }
    }) ?? null;
}

/** Spedisce la coda a lotti da 50. Non solleva mai; un lotto fallito è scartato. */
export async function flushContentEvents(): Promise<void> {
  clearTimer();
  if (flushing) {
    return;
  }

  flushing = true;
  try {
    while (queue.length > 0) {
      const batch = queue.splice(0, CONTENT_EVENT_LIMITS.maxBatch);
      try {
        await sender(batch);
      } catch {
        // Scartato, niente retry. Il resto della coda riparte al prossimo giro.
        break;
      }
    }
  } finally {
    flushing = false;
    armTimer();
  }
}

/** Valida, accoda e, se serve, spedisce. Mai un'eccezione verso l'interfaccia. */
export function emitContentEvent(input: ContentEventInput): void {
  try {
    const event = buildContentEvent(input, {
      eventId: newContentEventId(),
      occurredAt: new Date().toISOString(),
      sessionId: getContentEventsSessionId(),
    });
    if (!event) {
      return;
    }

    ensureAppStateListener();
    queue.push(event);
    if (queue.length > CONTENT_EVENT_LIMITS.maxQueue) {
      queue.splice(0, queue.length - CONTENT_EVENT_LIMITS.maxQueue);
    }

    if (queue.length >= CONTENT_EVENT_LIMITS.flushThreshold) {
      void flushContentEvents();
      return;
    }
    armTimer();
  } catch {
    // Un evento perso è accettabile; un'eccezione in un handler non lo è.
  }
}

// ────────────────────────────────────────────────────────────────
// Source per contenuto
// ────────────────────────────────────────────────────────────────

const MAX_REMEMBERED_SOURCES = 300;
const sourceByKey = new Map<string, ContentEventSource>();

export function rememberContentSource(
  contentType: string,
  postId: string,
  source: ContentEventSource,
): void {
  const key = contentKey(contentType, postId);
  // Delete + set: l'ordine di inserimento è la recenza, si espelle il più vecchio.
  sourceByKey.delete(key);
  sourceByKey.set(key, source);
  if (sourceByKey.size > MAX_REMEMBERED_SOURCES) {
    const oldest = sourceByKey.keys().next().value;
    if (oldest !== undefined) {
      sourceByKey.delete(oldest);
    }
  }
}

export function contentSourceOf(contentType: string, postId: string): ContentEventSource {
  return sourceByKey.get(contentKey(contentType, postId)) ?? "OTHER";
}

/**
 * Per chi ha solo la chiave del Feed (`<content_type>:<uuid>`), come il player
 * video. Chiave non valida = nessun evento. Senza `source` usa quella ricordata.
 */
export function emitContentEventForKey(
  key: string,
  eventType: ContentEventType,
  options: { source?: ContentEventSource; props?: ContentEventProps } = {},
): void {
  const parsed = parseContentKey(key);
  if (!parsed) {
    return;
  }

  emitContentEvent({
    contentType: parsed.contentType,
    eventType,
    postId: parsed.postId,
    props: options.props,
    source: options.source ?? contentSourceOf(parsed.contentType, parsed.postId),
  });
}

/**
 * Logout (§149): gli eventi in coda appartengono all'utente che esce. Il
 * server attribuisce il viewer da `auth.uid()`, quindi vanno spediti PRIMA
 * del signOut e poi scartati: dopo, verrebbero firmati dal prossimo account
 * che accede sullo stesso dispositivo.
 *
 * L'invio è best effort e limitato nel tempo: il logout non deve mai
 * dipendere dalla rete (stessa regola di `logout.ts`).
 */
export const SIGN_OUT_DRAIN_TIMEOUT_MS = 1500;

export async function drainContentEventsForSignOut(
  timeoutMs: number = SIGN_OUT_DRAIN_TIMEOUT_MS,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    await Promise.race([
      flushContentEvents(),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
    discardContentEvents();
  }
}

/**
 * Sessione chiusa senza passare da `logout()` (scadenza, SIGNED_OUT forzato):
 * la coda non può più essere spedita a nome di chi l'ha prodotta, si scarta.
 */
export function discardContentEvents(): void {
  clearTimer();
  queue = [];
  sessionId = null;
  sourceByKey.clear();
}

// ────────────────────────────────────────────────────────────────
// Test
// ────────────────────────────────────────────────────────────────

/** Solo per i test: sostituisce l'invio (`null` ripristina quello reale). */
export function setContentEventsSender(next: ContentEventsSender | null): void {
  sender = next ?? defaultSender;
}

/** Solo per i test: azzera coda, timer, sessione e source ricordate. */
export function resetContentEventsForTest(): void {
  clearTimer();
  queue = [];
  flushing = false;
  sessionId = null;
  sourceByKey.clear();
  appStateSubscription?.remove();
  appStateSubscription = null;
  sender = defaultSender;
}

/** Solo per i test: quanti eventi sono in coda. */
export function pendingContentEventsCount(): number {
  return queue.length;
}
