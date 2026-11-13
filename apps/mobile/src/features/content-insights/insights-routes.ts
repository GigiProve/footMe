/**
 * Destinazione di Dettagli e statistiche (HOM-05 §3, §8–12, decisione D1).
 *
 * Una definizione sola per la route radice `/content/insights/[type]/[id]`, fuori
 * da `(tabs)` e quindi senza bottom navigation: stessa deviazione dichiarata dal
 * mockup che HOM-04 ha già per il dettaglio contenuto. L'`origin` viaggia nella
 * query string e il Back lo rispetta (§10–12): si torna nello stack esistente,
 * mai a una nuova istanza della Home.
 *
 * Il percorso ha quattro segmenti, quindi non collide con `/content/[type]/[id]`.
 */

import type { ContentOrigin } from "../feed/content-routes";
import type { FeedContentType } from "../feed/feed-types";

/** I sei tipi di `footme_content_table`: gli unici che il server accetta. */
export const INSIGHTS_CONTENT_TYPES: readonly FeedContentType[] = [
  "profile_post",
  "club_media",
  "media_profile",
  "media_tribuna",
  "fan_tribuna",
  "fan_media",
];

/** Il tipo dal parametro di route, o `null` se assente o sconosciuto (→ stato «non disponibile», §65). */
export function parseInsightsContentType(value: string | string[] | undefined): FeedContentType | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return INSIGHTS_CONTENT_TYPES.find((type) => type === raw) ?? null;
}

export function contentInsightsHref(
  contentType: FeedContentType,
  postId: string,
  origin: ContentOrigin | null = null,
): string {
  const base = `/content/insights/${contentType}/${postId}`;
  return origin ? `${base}?origin=${origin}` : base;
}
