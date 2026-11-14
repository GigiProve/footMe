/**
 * Eventi di prodotto del composer Post (HOM-06.1 §200–201).
 *
 * Come `features/feed/feed-analytics.ts`: la union tipizzata è il punto —
 * aggiungere un evento senza dichiararlo qui non compila, e il test verifica la
 * corrispondenza 1:1 con l'elenco del §200.
 *
 * PRIVACY (§201): mai il testo del Post, mai il testo delle mention, mai l'URL
 * completo (al massimo il dominio), mai la query di ricerca. Le proprietà sono
 * conteggi, tipi, esiti e id di contenuto già pubblicato.
 */

import { trackEvent, type AnalyticsProps } from "../../lib/analytics";
import type { FeedContentType, FeedIdentityType } from "../feed/feed-types";
import type { ComposerErrorKind, ComposerOrigin, ComposerSubmitErrorKind } from "./composer-types";

export const COMPOSER_ANALYTICS_EVENT_NAMES = [
  "composer_open",
  "identity_changed",
  "image_added",
  "video_added",
  "mixed_media_created",
  "media_removed",
  "media_reordered",
  "link_detected",
  "link_preview_success",
  "link_preview_failed",
  "link_preview_removed",
  "tag_selector_open",
  "tag_added",
  "tag_removed",
  "mention_added",
  "publish_attempt",
  "publish_success",
  "publish_failure",
  "upload_retry",
  "edit_open",
  "edit_success",
  "edit_failure",
] as const;

type MediaKind = "image" | "video";

export type ComposerAnalyticsEvent =
  | { name: "composer_open"; origin: ComposerOrigin; identityType: FeedIdentityType | null }
  | { name: "identity_changed"; from: FeedIdentityType; to: FeedIdentityType }
  | { name: "image_added"; count: number }
  | { name: "video_added"; count: number }
  // Un solo evento quando la gallery contiene sia immagini sia video (§220).
  | { name: "mixed_media_created"; images: number; videos: number }
  | { name: "media_removed"; mediaType: MediaKind }
  | { name: "media_reordered"; via: "drag" | "buttons" }
  // §201: del link si conserva solo il dominio.
  | { name: "link_detected"; domain: string }
  | { name: "link_preview_success"; domain: string }
  | { name: "link_preview_failed"; domain: string | null; retryable: boolean }
  | { name: "link_preview_removed"; domain: string }
  | { name: "tag_selector_open"; selected: number }
  | { name: "tag_added"; targetType: "profile" | "club" }
  | { name: "tag_removed"; targetType: "profile" | "club" }
  | { name: "mention_added"; targetType: "profile" | "club" }
  | ({ name: "publish_attempt" } & PublishProps)
  | ({ name: "publish_success" } & PublishProps & { contentType: FeedContentType; replayed: boolean })
  | ({ name: "publish_failure" } & PublishProps & { code: ComposerSubmitErrorKind })
  | { name: "upload_retry"; mediaType: MediaKind }
  | ({ name: "edit_open" } & EditProps)
  | ({ name: "edit_success" } & EditProps)
  | ({ name: "edit_failure" } & EditProps & { code: ComposerErrorKind });

/** Solo forma del Post, mai il suo contenuto. */
export type PublishProps = {
  origin: ComposerOrigin;
  identityType: FeedIdentityType;
  hasText: boolean;
  mediaCount: number;
  hasLink: boolean;
  tagCount: number;
  mentionCount: number;
};

export type EditProps = {
  contentId: string;
  contentType: FeedContentType;
  identityType: FeedIdentityType;
};

/** Dominio dell'URL (`https://www.example.com/x?y` → `example.com`), o `null` se non è un URL. */
export function domainOf(url: string): string | null {
  const match = /^https?:\/\/([^/?#\s]+)/i.exec(url.trim());
  const host = match?.[1]?.toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");
  return host && host.length > 0 ? host : null;
}

export function trackComposer(event: ComposerAnalyticsEvent): void {
  const { name, ...rest } = event;
  trackEvent(name, rest as AnalyticsProps);
}
