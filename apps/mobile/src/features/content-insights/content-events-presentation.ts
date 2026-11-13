/**
 * HOM-05 §144–149: derivazioni PURE degli eventi per contenuto. Nessuna rete,
 * nessuno stato di modulo: la coda sta in `content-events-service.ts`.
 *
 *  • §146 source normalizzata: ContentOrigin / tab del Feed → whitelist del
 *    server (mapping del contratto: HOME_PER_TE→HOME_FOR_YOU,
 *    HOME_SEGUITI→HOME_FOLLOWING, PROFILE, SEARCH, MESSAGE; SAVED, DEEP_LINK e
 *    origine assente → OTHER);
 *  • §149 metadata: il builder costruisce l'elemento di `p_events` con event_id,
 *    session_id e timestamp passati dal chiamante (così è deterministico);
 *  • §150 niente testo: le `props` sono ricostruite da una whitelist per tipo di
 *    evento, mai copiate. Un evento non valido è scartato qui (`null`), il server
 *    farebbe lo stesso ma il client non spreca banda;
 *  • §55–56 azioni professionali: un solo evento per tap. Aprire una Società
 *    (autore o taggata) è `society_open`, aprire un profilo autore è
 *    `author_profile_open`, aprire un profilo/squadra taggato è `tagged_open`:
 *    nessun doppio conteggio nelle «azioni generate».
 */

import type { ContentOrigin } from "../feed/content-routes";
import type { FeedScope } from "../feed/feed-types";
import {
  CONTENT_EVENT_CONTENT_TYPES,
  CONTENT_EVENT_LIMITS,
  CONTENT_EVENT_SOURCES,
  CONTENT_EVENT_TYPES,
  type ContentEvent,
  type ContentEventContentType,
  type ContentEventInput,
  type ContentEventProps,
  type ContentEventSource,
  type ContentEventTargetType,
  type ContentEventType,
} from "./content-events-types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/** §146: ContentOrigin → source. L'assenza è «altro», non un errore. */
export function sourceForOrigin(origin: ContentOrigin | null | undefined): ContentEventSource {
  switch (origin) {
    case "HOME_PER_TE":
      return "HOME_FOR_YOU";
    case "HOME_SEGUITI":
      return "HOME_FOLLOWING";
    case "PROFILE":
      return "PROFILE";
    case "SEARCH":
      return "SEARCH";
    case "MESSAGE":
      return "MESSAGE";
    case "SAVED":
    case "DEEP_LINK":
    case null:
    case undefined:
    default:
      return "OTHER";
  }
}

/** §146: la tab del Feed → source (Per te / Seguiti). */
export function sourceForScope(scope: FeedScope): ContentEventSource {
  return scope === "seguiti" ? "HOME_FOLLOWING" : "HOME_FOR_YOU";
}

export function isContentEventType(value: unknown): value is ContentEventType {
  return CONTENT_EVENT_TYPES.includes(value as ContentEventType);
}

export function isContentEventSource(value: unknown): value is ContentEventSource {
  return CONTENT_EVENT_SOURCES.includes(value as ContentEventSource);
}

export function isContentEventContentType(value: unknown): value is ContentEventContentType {
  return CONTENT_EVENT_CONTENT_TYPES.includes(value as ContentEventContentType);
}

/** La chiave `<content_type>:<uuid>` del Feed → tipo e id, o `null` se non valida. */
export function parseContentKey(
  key: string | null | undefined,
): { contentType: ContentEventContentType; postId: string } | null {
  if (!key) {
    return null;
  }
  const separator = key.indexOf(":");
  if (separator <= 0) {
    return null;
  }
  const contentType = key.slice(0, separator);
  const postId = key.slice(separator + 1);
  if (!isContentEventContentType(contentType) || !isUuid(postId)) {
    return null;
  }
  return { contentType, postId };
}

export function contentKey(contentType: string, postId: string): string {
  return `${contentType}:${postId}`;
}

/**
 * §101–§103: un contenuto Società è Articolo se non è un video e ha un testo
 * lungo. Specchio di `feed_content_index.content_format` (club_media:
 * `visual_type = 'video'` vince, poi `length(body) >= 400` → 'articolo'),
 * letto da `footme_feed_item_type`: le statistiche mostrano «Prestazioni
 * articolo» solo se il client emette davvero `article_open`/`article_read`.
 */
export const CLUB_MEDIA_ARTICLE_MIN_BODY = 400;

export function isClubMediaArticle(
  visualType: string | null | undefined,
  body: string | null | undefined,
): boolean {
  if (visualType === "video") {
    return false;
  }
  return Array.from(body ?? "").length >= CLUB_MEDIA_ARTICLE_MIN_BODY;
}

/** §55: l'apertura dell'autore. Società → `society_open`, altrimenti profilo. */
export function authorOpenEventType(
  authorKind: "club" | "profile" | null | undefined,
): "society_open" | "author_profile_open" {
  return authorKind === "club" ? "society_open" : "author_profile_open";
}

/**
 * §56: il tap su una mention o un tag. Una Società è `society_open`; profilo e
 * squadra sono `tagged_open` con il tipo di bersaglio.
 */
export function identityOpenEvent(identityType: ContentEventTargetType): {
  eventType: "society_open" | "tagged_open";
  props?: ContentEventProps;
} {
  if (identityType === "club") {
    return { eventType: "society_open" };
  }
  return { eventType: "tagged_open", props: { targetType: identityType } };
}

/** Intero 0–100, o `null` se non lo è. */
function cleanPercent(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const rounded = Math.round(value);
  return rounded >= 0 && rounded <= 100 ? rounded : null;
}

/** Secondi attivi positivi, arrotondati al decimo e limitati a 24h; `null` altrimenti. */
function cleanSeconds(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  const rounded = Math.round(value * 10) / 10;
  if (rounded <= 0) {
    return null;
  }
  return Math.min(rounded, CONTENT_EVENT_LIMITS.maxSeconds);
}

const TARGET_TYPES: readonly ContentEventTargetType[] = ["profile", "club", "team"];

/**
 * §150: ricostruisce le props da una whitelist per tipo di evento. Restituisce
 * `null` se una proprietà obbligatoria manca o non è valida (evento da
 * scartare); le proprietà opzionali non valide si omettono soltanto.
 */
export function sanitizeEventProps(
  eventType: ContentEventType,
  props: ContentEventProps | undefined,
): ContentEvent["props"] | null {
  const input = props ?? {};

  switch (eventType) {
    case "video_progress": {
      const percent = cleanPercent(input.percent);
      if (percent === null) {
        return null;
      }
      return isUuid(input.mediaId)
        ? { media_id: input.mediaId, percent }
        : { percent };
    }
    case "video_watch": {
      const seconds = cleanSeconds(input.seconds);
      if (seconds === null) {
        return null;
      }
      return isUuid(input.mediaId)
        ? { media_id: input.mediaId, seconds }
        : { seconds };
    }
    case "article_read": {
      const seconds = cleanSeconds(input.seconds);
      return seconds === null ? null : { seconds };
    }
    case "tagged_open":
      return input.targetType && TARGET_TYPES.includes(input.targetType)
        ? { target_type: input.targetType }
        : {};
    default:
      return {};
  }
}

/**
 * Valida e costruisce l'elemento di `p_events`. `null` = scartato lato client:
 * tipo/source/content_type fuori whitelist, post_id o event_id non uuid,
 * session_id vuoto, occurred_at non parsabile, props obbligatorie invalide.
 */
export function buildContentEvent(
  input: ContentEventInput,
  meta: { eventId: string; sessionId: string; occurredAt: string },
): ContentEvent | null {
  if (
    !isContentEventType(input.eventType) ||
    !isContentEventSource(input.source) ||
    !isContentEventContentType(input.contentType) ||
    !isUuid(input.postId) ||
    !isUuid(meta.eventId) ||
    !meta.sessionId ||
    meta.sessionId.length > 64 ||
    Number.isNaN(Date.parse(meta.occurredAt))
  ) {
    return null;
  }

  const props = sanitizeEventProps(input.eventType, input.props);
  if (props === null) {
    return null;
  }

  return {
    content_type: input.contentType,
    event_id: meta.eventId,
    event_type: input.eventType,
    occurred_at: meta.occurredAt,
    post_id: input.postId,
    props,
    session_id: meta.sessionId,
    source: input.source,
  };
}

/**
 * §107: tempo di lettura ATTIVO. Si accumula solo tra `start()` e `pause()`:
 * il chiamante avvia quando la schermata è a fuoco E l'app è attiva, e mette in
 * pausa a blur, background e uscita. `take()` restituisce i secondi interi
 * accumulati e azzera, lasciando il contatore in corsa se era attivo.
 */
export function createActiveTimeTracker(now: () => number = Date.now) {
  let accumulatedMs = 0;
  let startedAt: number | null = null;

  return {
    start() {
      if (startedAt === null) {
        startedAt = now();
      }
    },
    pause() {
      if (startedAt !== null) {
        accumulatedMs += Math.max(0, now() - startedAt);
        startedAt = null;
      }
    },
    take(): number {
      const running = startedAt !== null ? Math.max(0, now() - (startedAt ?? 0)) : 0;
      const total = accumulatedMs + running;
      accumulatedMs = 0;
      if (startedAt !== null) {
        startedAt = now();
      }
      return Math.round(total / 1000);
    },
  };
}
