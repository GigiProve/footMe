/**
 * Il grafico Andamento, caricato a parte (HOM-05 §72–73, §157).
 *
 * Query indipendente da quella del dettaglio: cambiare periodo o metrica cambia
 * solo la key del trend, quindi si ricarica soltanto il grafico e la pagina non
 * si riscrive né perde lo scroll (§72). Se fallisce, fallisce solo questa
 * sezione e le altre restano visibili (§133). `enabled` lo decide la schermata:
 * senza visualizzazioni non c'è serie da chiedere (§75, §121).
 *
 * Nessun `keepPreviousData`: durante il cambio il grafico mostra il suo
 * skeleton di altezza fissa invece della serie della metrica precedente sotto
 * l'etichetta della nuova.
 */

import { useQuery } from "@tanstack/react-query";

import { isContentPermissionError } from "../feed/content-manage-service";
import type { FeedContentType } from "../feed/feed-types";
import { deviceTimeZone } from "./insights-presentation";
import { INSIGHTS_QK } from "./insights-keys";
import { fetchContentInsightsTrend } from "./insights-service";
import type { InsightsMetric, InsightsPeriod } from "./insights-types";
import { INSIGHTS_GC_TIME_MS, INSIGHTS_STALE_TIME_MS } from "./use-content-insights";

export function useContentInsightsTrend({
  contentType,
  enabled,
  metric,
  period,
  postId,
  viewerProfileId,
}: {
  contentType: FeedContentType | null;
  enabled: boolean;
  metric: InsightsMetric;
  period: InsightsPeriod;
  postId: string;
  viewerProfileId: string | null;
}) {
  const active = enabled && contentType !== null && postId.length > 0 && !!viewerProfileId;

  return useQuery({
    enabled: active,
    gcTime: INSIGHTS_GC_TIME_MS,
    queryFn: () =>
      fetchContentInsightsTrend(
        contentType as FeedContentType,
        postId,
        metric,
        period,
        deviceTimeZone(),
      ),
    queryKey: INSIGHTS_QK.trend(
      viewerProfileId ?? "",
      contentType ?? "profile_post",
      postId,
      metric,
      period,
    ),
    retry: (failureCount, error) => !isContentPermissionError(error) && failureCount < 1,
    staleTime: INSIGHTS_STALE_TIME_MS,
  });
}
