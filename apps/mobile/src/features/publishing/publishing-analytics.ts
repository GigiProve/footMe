/**
 * Eventi di prodotto di launcher, bozze e programmazione (HOM-06.2 §256–§257).
 *
 * Union tipizzata come `composer-analytics.ts`: un evento non dichiarato non
 * compila, il test verifica la corrispondenza con l'elenco del §256 per la parte
 * condivisa. Gli eventi propri dell'Articolo stanno in
 * `article-editor/article-analytics.ts`.
 *
 * PRIVACY (§257): mai testo, titolo, URL, dominio o fonte. Solo formato,
 * identità, conteggi ed esiti.
 */

import { trackEvent, type AnalyticsProps } from "../../lib/analytics";
import type { FeedIdentityType } from "../feed/feed-types";
import type { ContentFormat, DraftsTab, PublishingErrorKind } from "./publishing-types";

export const PUBLISHING_ANALYTICS_EVENT_NAMES = [
  "content_launcher_open",
  "post_selected",
  "article_selected",
  "drafts_scheduled_open",
  "autosave_started",
  "autosave_success",
  "autosave_failed",
  "schedule_opened",
  "schedule_now_selected",
  "schedule_future_selected",
  "schedule_confirmed",
  "drafts_opened",
  "scheduled_opened",
  "draft_opened",
  "draft_deleted",
  "scheduled_opened_item",
  "scheduled_time_changed",
  "publish_now_selected",
  "scheduled_to_draft",
  "scheduled_retry",
] as const;

type FormatProps = { format: ContentFormat };

export type PublishingAnalyticsEvent =
  | { name: "content_launcher_open"; canPublishArticle: boolean; pending: number }
  | { name: "post_selected" }
  | { name: "article_selected" }
  | { name: "drafts_scheduled_open"; from: "launcher" | "notification" | "other" }
  | ({ name: "autosave_started" } & FormatProps)
  | ({ name: "autosave_success" } & FormatProps & { created: boolean })
  | ({ name: "autosave_failed" } & FormatProps & { code: PublishingErrorKind })
  | ({ name: "schedule_opened" } & FormatProps)
  | ({ name: "schedule_now_selected" } & FormatProps)
  | ({ name: "schedule_future_selected" } & FormatProps)
  | ({ name: "schedule_confirmed" } & FormatProps & { identityType: FeedIdentityType | null })
  | { name: "drafts_opened"; tab: DraftsTab }
  | { name: "scheduled_opened"; tab: DraftsTab }
  | ({ name: "draft_opened" } & FormatProps)
  | ({ name: "draft_deleted" } & FormatProps)
  | ({ name: "scheduled_opened_item" } & FormatProps)
  | ({ name: "scheduled_time_changed" } & FormatProps)
  | ({ name: "publish_now_selected" } & FormatProps)
  | ({ name: "scheduled_to_draft" } & FormatProps)
  | ({ name: "scheduled_retry" } & FormatProps & { success: boolean });

export function trackPublishing(event: PublishingAnalyticsEvent): void {
  const { name, ...rest } = event;
  trackEvent(name, rest as AnalyticsProps);
}
