/**
 * Query key di Dettagli e statistiche (HOM-05 §131–132, contratto «Client»).
 *
 * La cache dipende da: viewer (contesto di identità che autorizza, §132),
 * contenuto (tipo + id: lo stesso uuid non identifica un contenuto da solo) e,
 * per il trend, metrica e periodo. Il fuso NON è nella key: il dispositivo ne ha
 * uno solo per sessione.
 *
 * Lo stesso prefisso `content-insights` serve a tre invalidazioni:
 *  • eliminazione del contenuto (§140–141): per prefisso, in
 *    `CONTENT_DELETE_INVALIDATIONS`, e per contenuto con `isInsightsKeyFor`;
 *  • permesso revocato (§137–138): si tolgono dalla cache dettaglio e trend;
 *  • ritorno dal contenuto originale (§27): la stessa key riporta la cache.
 */

import type { FeedContentType } from "../feed/feed-types";
import type { InsightsMetric, InsightsPeriod } from "./insights-types";

export const INSIGHTS_ROOT_KEY = "content-insights" as const;

export const INSIGHTS_QK = {
  root: [INSIGHTS_ROOT_KEY] as const,
  detail: (viewerProfileId: string, contentType: FeedContentType, postId: string) =>
    [INSIGHTS_ROOT_KEY, viewerProfileId, contentType, postId] as const,
  trend: (
    viewerProfileId: string,
    contentType: FeedContentType,
    postId: string,
    metric: InsightsMetric,
    period: InsightsPeriod,
  ) => [INSIGHTS_ROOT_KEY, viewerProfileId, contentType, postId, "trend", metric, period] as const,
};

/** Vero per ogni query di insights (dettaglio e trend) di UN contenuto, qualunque viewer. */
export function isInsightsKeyFor(
  queryKey: readonly unknown[],
  contentType: FeedContentType,
  postId: string,
): boolean {
  return (
    queryKey[0] === INSIGHTS_ROOT_KEY && queryKey[2] === contentType && queryKey[3] === postId
  );
}
