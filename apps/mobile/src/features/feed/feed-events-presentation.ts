/**
 * HOM-13 §252–§259: il vocabolario degli eventi Feed che il client spedisce a
 * `record_feed_events(p_events jsonb)` — funzioni pure, nessuna rete, nessuno stato.
 *
 * Contratto database (hom13-contract §6): `event_type` e `tab` sono whitelist
 * chiuse, il server scarta in silenzio ciò che non conosce. Tenerle come `as const`
 * rende un evento fuori whitelist non rappresentabile nel client. Gli altri eventi
 * del §259 (`feed_candidate_source`, `broadening_level`, fallback, dedup server) sono
 * SERVER-ONLY e qui non esistono.
 *
 * §258: nessun peso, formula o score. Nessuna reason (§214–§216). Nessun testo di
 * contenuto (§250–§251): solo id, tipo di unit, posizione e tipo di bersaglio.
 *
 * Le impression dei CONTENUTI non passano da qui: restano su `record_content_events`
 * di HOM-05 con `session_id = feed_session_id` (§252–§253).
 */

import { isUuid } from "../content-insights/content-events-presentation";
import type { FeedItem, FeedScope, FeedUnitType } from "./feed-types";
import { unitTypeOf } from "./feed-session-presentation";

export const FEED_EVENT_TYPES = [
  "feed_session_start",
  "feed_refresh",
  "feed_load_more",
  "new_content_pill_shown",
  "new_content_pill_tap",
  "feed_unit_impression",
  "feed_unit_open",
  "opportunity_impression",
  "opportunity_open",
  "suggested_profiles_impression",
  "suggested_profile_open",
  "follow_from_feed",
] as const;

export type FeedEventType = (typeof FEED_EVENT_TYPES)[number];

export type FeedEventTab = "HOME_FOR_YOU" | "HOME_FOLLOWING";

export type FeedEventTargetType = "profile" | "club" | "position" | "content";

/** Ciò che il call site decide. */
export type FeedEventInput = {
  eventType: FeedEventType;
  tab: FeedScope;
  /** Solo Per te; per Seguiti si omette (il server lo annullerebbe comunque). */
  feedSessionId?: string | null;
  unitType?: FeedUnitType;
  /** `feed_unit_id`, ≤ 200 caratteri. */
  unitKey?: string;
  position?: number;
  targetType?: FeedEventTargetType;
  targetId?: string | null;
};

/** Il JSON esatto di un elemento di `p_events`. */
export type FeedEvent = {
  event_id: string;
  event_type: FeedEventType;
  tab: FeedEventTab;
  occurred_at: string;
  feed_session_id?: string;
  unit_type?: FeedUnitType;
  unit_key?: string;
  position?: number;
  target_type?: FeedEventTargetType;
  target_id?: string;
};

/** Stesse soglie della coda HOM-05: 20 eventi / 10s / background, batch ≤ 50. */
export const FEED_EVENT_LIMITS = {
  flushThreshold: 20,
  flushIntervalMs: 10_000,
  maxBatch: 50,
  maxQueue: 500,
  maxUnitKey: 200,
  maxPosition: 99_999,
} as const;

const TARGET_TYPES: readonly FeedEventTargetType[] = ["profile", "club", "position", "content"];

export function isFeedEventType(value: unknown): value is FeedEventType {
  return FEED_EVENT_TYPES.includes(value as FeedEventType);
}

export function feedEventTab(scope: FeedScope): FeedEventTab {
  return scope === "seguiti" ? "HOME_FOLLOWING" : "HOME_FOR_YOU";
}

/**
 * Valida e costruisce l'elemento di `p_events`. `null` = scartato lato client (tipo
 * fuori whitelist o `event_id` non uuid). I campi opzionali non validi si omettono
 * soltanto: un `feed_session_id` che non è uuid non deve far perdere l'evento.
 */
export function buildFeedEvent(
  input: FeedEventInput,
  meta: { eventId: string; occurredAt: string },
): FeedEvent | null {
  if (
    !isFeedEventType(input.eventType) ||
    !isUuid(meta.eventId) ||
    Number.isNaN(Date.parse(meta.occurredAt))
  ) {
    return null;
  }

  const event: FeedEvent = {
    event_id: meta.eventId,
    event_type: input.eventType,
    occurred_at: meta.occurredAt,
    tab: feedEventTab(input.tab),
  };

  if (input.tab === "per_te" && isUuid(input.feedSessionId)) {
    event.feed_session_id = input.feedSessionId;
  }
  if (input.unitType) {
    event.unit_type = input.unitType;
  }
  if (input.unitKey && input.unitKey.length > 0) {
    event.unit_key = input.unitKey.slice(0, FEED_EVENT_LIMITS.maxUnitKey);
  }
  if (typeof input.position === "number" && Number.isFinite(input.position)) {
    event.position = Math.min(
      FEED_EVENT_LIMITS.maxPosition,
      Math.max(0, Math.round(input.position)),
    );
  }
  if (input.targetType && TARGET_TYPES.includes(input.targetType) && isUuid(input.targetId)) {
    event.target_type = input.targetType;
    event.target_id = input.targetId;
  }

  return event;
}

/**
 * Gli eventi di una unit: impression e apertura. Un'Opportunity è registrata a parte
 * (§254), i suggeriti pure (§255); un contenuto ha `feed_unit_open`. Le impression dei
 * contenuti vanno ANCHE a HOM-05 (vedi `FeedPane`), ma qui resta `feed_unit_impression`.
 */
export function impressionEventFor(item: FeedItem): FeedEventType {
  switch (unitTypeOf(item)) {
    case "OPPORTUNITY":
      return "opportunity_impression";
    case "SUGGESTED_PROFILES":
      return "suggested_profiles_impression";
    default:
      return "feed_unit_impression";
  }
}

export function openEventFor(item: FeedItem): FeedEventType {
  return unitTypeOf(item) === "OPPORTUNITY" ? "opportunity_open" : "feed_unit_open";
}

/** Il bersaglio apribile di una unit: la Posizione per l'Opportunity. Altrimenti il contenuto (se uuid). */
export function openTargetFor(
  item: FeedItem,
): { targetType: FeedEventTargetType; targetId: string } | null {
  if (item.type === "suggested_position") {
    return { targetId: item.payload.adId, targetType: "position" };
  }
  if (item.type === "post" || item.type === "article" || item.type === "video") {
    return { targetId: item.payload.postId, targetType: "content" };
  }
  return null;
}

/** Evento standard di una unit (impression o open) pronto per `emitFeedEvent`. */
export function unitEventInput(
  item: FeedItem,
  scope: FeedScope,
  kind: "impression" | "open",
): FeedEventInput {
  const target = kind === "open" ? openTargetFor(item) : null;

  return {
    eventType: kind === "open" ? openEventFor(item) : impressionEventFor(item),
    feedSessionId: scope === "per_te" ? (item.feedSessionId ?? null) : null,
    position: item.rank,
    tab: scope,
    unitKey: item.id,
    unitType: unitTypeOf(item),
    ...(target ?? {}),
  };
}
