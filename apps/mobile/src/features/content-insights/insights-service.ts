/**
 * Lettura di Dettagli e statistiche (HOM-05 §4–5, §151–152, §156–158).
 *
 * Due RPC, entrambe `security definer` e con accesso rivalidato lato server
 * (§5): `fetch_content_insights` (tutto tranne il grafico) e
 * `fetch_content_insights_trend` (lazy, §157), così cambiare periodo o metrica
 * ricarica solo la serie (§72). Le due richieste sono indipendenti e partono in
 * parallelo (§158): niente waterfall.
 *
 * Esiti, tenuti distinti perché la UI è diversa:
 *  • `{status:'unavailable'}` → il contenuto non c'è / non è pubblicato / non è
 *    leggibile: risposta DEFINITIVA, stato «Contenuto non disponibile»;
 *  • errcode 42501 → `ContentPermissionError`: il contenuto c'è ma il permesso
 *    `can_view_insights` è stato revocato (§137–138). NON è «eliminato»;
 *  • qualunque altro errore (rete, timeout, risposta malformata) resta un errore
 *    e si mostra «Statistiche non disponibili» + Riprova (§135): mai
 *    «nessuna statistica» (§136).
 *
 * Il pattern è quello di `deleteContent` (HOM-04): stessa classe d'errore per il
 * 42501, nessuna seconda definizione.
 */

import { supabase } from "../../lib/supabase";
import { ContentPermissionError } from "../feed/content-manage-service";
import type { FeedContentType } from "../feed/feed-types";
import type {
  ContentInsights,
  ContentInsightsResult,
  ContentInsightsTrend,
  ContentInsightsTrendResult,
  InsightsMetric,
  InsightsPeriod,
  InsightsTrendPoint,
} from "./insights-types";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** La RPC `returns jsonb` arriva a volte avvolta in un array a un elemento. */
function unwrap(data: unknown): unknown {
  return Array.isArray(data) ? data[0] : data;
}

function asRecordOrNull(value: unknown): JsonRecord | null {
  return isRecord(value) ? value : null;
}

/**
 * Pura: dal jsonb della RPC all'esito. Una risposta senza stato, o `ok` senza
 * anteprima e panoramica, non è un esito: è un errore (§136). I blocchi opzionali
 * assenti valgono `null` → la sezione si omette (§117, §153).
 */
export function parseContentInsights(data: unknown): ContentInsightsResult {
  const raw = unwrap(data);

  if (!isRecord(raw) || typeof raw.status !== "string") {
    throw new Error("fetch_content_insights: risposta senza stato");
  }

  if (raw.status === "unavailable") {
    return { status: "unavailable" };
  }

  if (raw.status !== "ok" || !isRecord(raw.content_preview) || !isRecord(raw.overview)) {
    throw new Error("fetch_content_insights: risposta non valida");
  }

  const preview = raw.content_preview;

  if (!isRecord(preview.author)) {
    throw new Error("fetch_content_insights: anteprima senza autore");
  }

  return {
    article_insights: asRecordOrNull(raw.article_insights) as ContentInsights["article_insights"],
    content_preview: preview as ContentInsights["content_preview"],
    default_period: raw.default_period as ContentInsights["default_period"],
    engagement: asRecordOrNull(raw.engagement) as ContentInsights["engagement"],
    has_data: raw.has_data === true,
    insights_kind: raw.insights_kind as ContentInsights["insights_kind"],
    overview: raw.overview as ContentInsights["overview"],
    periods: Array.isArray(raw.periods) ? (raw.periods as ContentInsights["periods"]) : [],
    professional_actions: asRecordOrNull(
      raw.professional_actions,
    ) as ContentInsights["professional_actions"],
    status: "ok",
    tracking_started_at:
      typeof raw.tracking_started_at === "string" ? raw.tracking_started_at : null,
    traffic_sources: Array.isArray(raw.traffic_sources)
      ? (raw.traffic_sources as ContentInsights["traffic_sources"])
      : [],
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : "",
    video_insights: asRecordOrNull(raw.video_insights) as ContentInsights["video_insights"],
  };
}

function parsePoints(value: unknown): InsightsTrendPoint[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry): InsightsTrendPoint[] =>
    isRecord(entry) &&
    typeof entry.ts === "string" &&
    typeof entry.value === "number" &&
    Number.isFinite(entry.value)
      ? [{ ts: entry.ts, value: entry.value }]
      : [],
  );
}

/** Pura: dal jsonb del trend all'esito. `sufficient` assente vale falso: nessun grafico inventato (§75). */
export function parseContentInsightsTrend(data: unknown): ContentInsightsTrendResult {
  const raw = unwrap(data);

  if (!isRecord(raw) || typeof raw.status !== "string") {
    throw new Error("fetch_content_insights_trend: risposta senza stato");
  }

  if (raw.status === "unavailable") {
    return { status: "unavailable" };
  }

  if (raw.status !== "ok") {
    throw new Error("fetch_content_insights_trend: risposta non valida");
  }

  return {
    cumulative: raw.cumulative !== false,
    interval: raw.interval === "hour" ? "hour" : "day",
    metric: raw.metric as ContentInsightsTrend["metric"],
    period: raw.period as ContentInsightsTrend["period"],
    points: parsePoints(raw.points),
    status: "ok",
    sufficient: raw.sufficient === true,
    timezone: typeof raw.timezone === "string" ? raw.timezone : "UTC",
  };
}

function rethrow(error: { code?: string }): never {
  if (error.code === "42501") {
    throw new ContentPermissionError();
  }
  throw error;
}

export async function fetchContentInsights(
  contentType: FeedContentType,
  postId: string,
): Promise<ContentInsightsResult> {
  const { data, error } = await supabase.rpc("fetch_content_insights", {
    p_content_type: contentType,
    p_post_id: postId,
  });

  if (error) {
    rethrow(error);
  }

  return parseContentInsights(data);
}

export async function fetchContentInsightsTrend(
  contentType: FeedContentType,
  postId: string,
  metric: InsightsMetric,
  period: InsightsPeriod,
  timezone: string,
): Promise<ContentInsightsTrendResult> {
  const { data, error } = await supabase.rpc("fetch_content_insights_trend", {
    p_content_type: contentType,
    p_metric: metric,
    p_period: period,
    p_post_id: postId,
    p_timezone: timezone,
  });

  if (error) {
    rethrow(error);
  }

  return parseContentInsightsTrend(data);
}
