/**
 * HOM-05 §144–149: il vocabolario degli eventi per contenuto che il client
 * spedisce a `record_content_events(p_events jsonb)`.
 *
 * Il contratto con il backend (hom05-contract.md, «Eventi — ingestion») è
 * vincolante: event_type, source e content_type sono whitelist chiuse, e il
 * server SCARTA (non rifiuta) ciò che non conosce. Tenerle come `as const` qui
 * rende un evento fuori whitelist non rappresentabile nel client.
 *
 * Decisioni tecniche del lead citate dal contratto:
 *  • la chiave del contenuto è `(content_type, post_id)`; il client non manda
 *    mai autore o publisher (§149 `author_identity_id`): il server li rilegge da
 *    `footme_content_rights` e non si fida del client;
 *  • §150: nessun testo del contenuto viaggia mai negli eventi. Le `props`
 *    ammesse sono poche e numeriche/enumerate, vedi `ContentEventProps`.
 *
 * Distinto dal vocabolario tecnico di `features/feed/feed-analytics.ts`
 * (§25 Home, mai spedito): quello resta sul sink locale, questo va al server.
 */

/** §144, §145, §147, §148: gli eventi che la pipeline accetta. */
export const CONTENT_EVENT_TYPES = [
  "impression",
  "article_open",
  "article_link_click",
  "article_read",
  "video_play",
  "video_progress",
  "video_watch",
  "author_profile_open",
  "society_open",
  "tagged_open",
  "linked_content_open",
] as const;

export type ContentEventType = (typeof CONTENT_EVENT_TYPES)[number];

/** §146: la source normalizzata, whitelist del server. */
export const CONTENT_EVENT_SOURCES = [
  "HOME_FOR_YOU",
  "HOME_FOLLOWING",
  "PROFILE",
  "SEARCH",
  "SHARE",
  "MESSAGE",
  "REPOST",
  "OTHER",
] as const;

export type ContentEventSource = (typeof CONTENT_EVENT_SOURCES)[number];

/** I sei tipi di `footme_content_table` (stessi del Feed e del dettaglio). */
export const CONTENT_EVENT_CONTENT_TYPES = [
  "profile_post",
  "club_media",
  "media_profile",
  "media_tribuna",
  "fan_tribuna",
  "fan_media",
] as const;

export type ContentEventContentType = (typeof CONTENT_EVENT_CONTENT_TYPES)[number];

/** `tagged_open.target_type`: il tipo di identità aperta, mai il suo nome. */
export type ContentEventTargetType = "profile" | "club" | "team";

/**
 * Le sole proprietà ammesse (§150). Nessun campo di testo libero: un titolo o un
 * corpo non possono finirci perché il tipo non li ammette e il builder scarta
 * qualunque altra chiave.
 */
export type ContentEventProps = {
  /** `video_progress`: intero 0–100. */
  percent?: number;
  /** `video_watch` / `article_read`: secondi ATTIVI, mai il tempo trascorso. */
  seconds?: number;
  /** `video_progress` / `video_watch`: l'id del media (uuid), se noto. */
  mediaId?: string | null;
  /** `tagged_open`. */
  targetType?: ContentEventTargetType;
};

/** Ciò che il call site decide: tipo, contenuto, source e proprietà. */
export type ContentEventInput = {
  eventType: ContentEventType;
  contentType: string;
  postId: string;
  source: ContentEventSource;
  props?: ContentEventProps;
};

/** Il JSON esatto di un elemento di `p_events` (snake_case, come il contratto). */
export type ContentEvent = {
  event_id: string;
  event_type: ContentEventType;
  content_type: ContentEventContentType;
  post_id: string;
  source: ContentEventSource;
  session_id: string;
  occurred_at: string;
  props: {
    percent?: number;
    seconds?: number;
    media_id?: string;
    target_type?: ContentEventTargetType;
  };
};

/** Soglie della coda (contratto: 20 eventi / 10s / background, batch ≤ 50). */
export const CONTENT_EVENT_LIMITS = {
  /** Si spedisce subito raggiunto questo numero di eventi in coda. */
  flushThreshold: 20,
  /** Altrimenti entro questo intervallo dal primo evento in coda. */
  flushIntervalMs: 10_000,
  /** Il server rifiuta lotti oltre 50: mai di più per chiamata. */
  maxBatch: 50,
  /**
   * Tetto della coda in memoria. Se il backend non risponde non cresce senza
   * limite: si perdono gli eventi più vecchi (un evento perso è accettabile,
   * come per `trackEvent`).
   */
  maxQueue: 500,
  /** Tetto sensato per i secondi di un solo evento (24h): oltre è un errore. */
  maxSeconds: 86_400,
} as const;
