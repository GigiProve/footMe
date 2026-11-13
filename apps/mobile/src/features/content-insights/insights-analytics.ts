/**
 * Eventi di Dettagli e statistiche (HOM-05 §172–173).
 *
 * Sono eventi tecnici sull'uso della schermata, non le statistiche del
 * contenuto (quelle le produce `content-events-*`, il flusso verso il backend).
 * Passano dal sink minimo `trackEvent` (`lib/analytics.ts`), come quelli del Feed.
 *
 * §173: mai il testo del contenuto. Le proprietà sono solo id, tipo, provenienza
 * e, dove serve, periodo / metrica / sezione. Nessun titolo, nessun estratto,
 * nessun nome d'autore.
 */

import { trackEvent, type AnalyticsProps } from "../../lib/analytics";
import type { ContentOrigin } from "../feed/content-routes";
import type { FeedContentType } from "../feed/feed-types";
import type { InsightsMetric, InsightsPeriod } from "./insights-types";

export type InsightsAnalyticsBase = {
  contentId: string;
  contentType: FeedContentType;
  origin: ContentOrigin | null;
};

/** §172: i sei eventi minimi, con i nomi esatti della task. */
export type InsightsAnalyticsEvent =
  | ({ name: "insights_open" } & InsightsAnalyticsBase)
  | ({ name: "original_content_open" } & InsightsAnalyticsBase)
  | ({
      name: "period_changed";
      from: InsightsPeriod;
      to: InsightsPeriod;
      metric: InsightsMetric;
    } & InsightsAnalyticsBase)
  | ({
      name: "metric_changed";
      from: InsightsMetric;
      to: InsightsMetric;
      period: InsightsPeriod;
    } & InsightsAnalyticsBase)
  | ({ name: "section_retry"; section: "insights" | "trend" } & InsightsAnalyticsBase)
  | ({ name: "insights_refresh"; trigger: "pull" } & InsightsAnalyticsBase);

export function trackInsights(event: InsightsAnalyticsEvent): void {
  const { name, ...rest } = event;
  trackEvent(name, rest as AnalyticsProps);
}
