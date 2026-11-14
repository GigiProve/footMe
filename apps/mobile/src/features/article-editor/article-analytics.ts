/**
 * Eventi di prodotto dell'Articolo (HOM-06.2 §256–§257). Gli eventi condivisi
 * con il Post (launcher, autosave, scheduling, bozze) sono in
 * `publishing/publishing-analytics.ts`.
 *
 * PRIVACY (§257): mai body, titolo, testo incollato, URL o dominio della fonte,
 * nome della fonte o dell'autore originale, dichiarazione dei diritti. Solo
 * modalità, identità, conteggi ed esiti.
 */

import { trackEvent, type AnalyticsProps } from "../../lib/analytics";
import type { FeedIdentityType } from "../feed/feed-types";
import type { ArticleCreationMode } from "../publishing/publishing-types";

export const ARTICLE_ANALYTICS_EVENT_NAMES = [
  "article_editor_open",
  "article_identity_changed",
  "cover_added",
  "cover_removed",
  "formatting_used",
  "inline_link_added",
  "rich_link_generated",
  "preview_opened",
  "article_creation_mode_opened",
  "article_creation_mode_selected",
  "external_article_url_submitted",
  "external_article_metadata_success",
  "external_article_metadata_failure",
  "external_article_duplicate_detected",
  "external_article_opened",
  "article_paste_started",
  "article_paste_parsed",
  "article_paste_parse_warning",
  "article_rights_confirmed",
  "article_source_updated",
] as const;

type ModeProps = { mode: ArticleCreationMode };

export type ArticleAnalyticsEvent =
  | ({ name: "article_editor_open" } & ModeProps & { restored: boolean })
  | { name: "article_identity_changed"; from: FeedIdentityType; to: FeedIdentityType }
  | { name: "cover_added" }
  | { name: "cover_removed" }
  | { name: "formatting_used"; format: "heading" | "bold" | "italic" | "unordered_list" | "ordered_list" }
  | { name: "inline_link_added" }
  | { name: "rich_link_generated"; success: boolean }
  | ({ name: "preview_opened" } & ModeProps)
  | { name: "article_creation_mode_opened"; available: number }
  | ({ name: "article_creation_mode_selected" } & ModeProps)
  | { name: "external_article_url_submitted" }
  | { name: "external_article_metadata_success"; hasTitle: boolean; hasImage: boolean }
  | { name: "external_article_metadata_failure"; reason: "invalid" | "blocked" | "unavailable" }
  | { name: "external_article_duplicate_detected" }
  | { name: "external_article_opened" }
  | { name: "article_paste_started" }
  | { name: "article_paste_parsed"; blocks: number; proposedTitle: boolean; plainFallback: boolean }
  | { name: "article_paste_parse_warning"; kind: "removed_unsupported" | "plain_fallback" | "too_large" | "too_many_blocks" | "empty" }
  | { name: "article_rights_confirmed" }
  | { name: "article_source_updated"; field: "published_elsewhere" | "source_name" | "original_author" | "original_url" | "no_link" };

export function trackArticle(event: ArticleAnalyticsEvent): void {
  const { name, ...rest } = event;
  trackEvent(name, rest as AnalyticsProps);
}
