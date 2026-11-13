/**
 * Tipi di Dettagli e statistiche di un contenuto (HOM-05 §152–153).
 *
 * Specchiano 1:1, in snake_case, il JSON delle RPC `fetch_content_insights` e
 * `fetch_content_insights_trend` (contratto HOM-05): nel progetto non ci sono
 * tipi Supabase generati, quindi queste dichiarazioni SONO il contratto, come
 * in `media-search-types.ts` (CER-05).
 *
 * Convenzione dei valori (§118–120, §40): un numero è un dato reale, ZERO
 * incluso; `null` è «not_available» e la riga si NASCONDE. Il client non
 * trasforma mai un `null` in 0 e non calcola mai totali (§43): Interazioni e
 * Azioni generate arrivano già sommate dal backend.
 *
 * Nessun elenco viewer, nessuna audience, nessun body completo (§57, §86, §150).
 */

import type { FeedContentType } from "../feed/feed-types";

export type InsightsKind = "post" | "video" | "article";

export type InsightsFormat =
  | "text"
  | "photo"
  | "gallery"
  | "video"
  | "article"
  | "editorial_video"
  | "other";

export type InsightsIdentityType = "person" | "society" | "media";

/** §68: i quattro periodi pertinenti. */
export type InsightsPeriod = "24h" | "7d" | "30d" | "since_publication";

/** §66: una sola metrica per volta nel grafico. */
export type InsightsMetric = "views" | "reach" | "interactions";

/** §79: sorgenti normalizzate dal backend. Il client non ne inventa (§80). */
export type InsightsSource =
  | "HOME_FOR_YOU"
  | "HOME_FOLLOWING"
  | "PROFILE"
  | "SEARCH"
  | "SHARE"
  | "MESSAGE"
  | "REPOST"
  | "OTHER";

export type InsightsPreviewAuthor = {
  identity_type: InsightsIdentityType;
  id: string;
  name: string;
  avatar_url: string | null;
  is_verified: boolean;
};

/** §20–24: la preview compatta, non il Post HOM-02 intero. */
export type InsightsPreview = {
  content_type: FeedContentType;
  post_id: string;
  item_type: InsightsKind;
  format: InsightsFormat;
  title: string | null;
  /** Troncato dal server a ~140 caratteri: mai il body completo (§173). */
  excerpt: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  published_at: string;
  author: InsightsPreviewAuthor;
};

/** §28: i quattro KPI. `interactions` e `generated_actions` sono totali del backend (§42, §50). */
export type InsightsOverview = {
  views: number | null;
  reach: number | null;
  interactions: number | null;
  generated_actions: number | null;
};

/** §36–41: `null` = riga nascosta (Repost prima di HOM-10, Condivisioni prima di HOM-09). */
export type InsightsEngagement = {
  likes: number | null;
  comments: number | null;
  shares: number | null;
  reposts: number | null;
  saves: number | null;
};

export type InsightsInsightKind = "profile_visit_rate" | "society_visit_rate";

export type InsightsProfessionalActions = {
  profile_visits: number | null;
  society_visits: number | null;
  new_followers: number | null;
  tagged_opens: number | null;
  linked_content_opens: number | null;
  /** §58: presente solo quando statisticamente significativo, altrimenti `null`. */
  insight: { kind: InsightsInsightKind; percent: number } | null;
};

export type InsightsTrafficSource = {
  source: InsightsSource;
  percent: number;
};

export type InsightsVideoPerformance = {
  plays: number | null;
  avg_watch_seconds: number | null;
  completion_percent: number | null;
};

export type InsightsArticlePerformance = {
  opens: number | null;
  open_rate_percent: number | null;
  avg_read_seconds: number | null;
  link_clicks: number | null;
};

export type InsightsPeriodAvailability = {
  period: InsightsPeriod;
  available: boolean;
};

export type ContentInsights = {
  status: "ok";
  updated_at: string;
  tracking_started_at: string | null;
  insights_kind: InsightsKind;
  /** `views > 0`: sotto, il client mostra lo stato iniziale (§121–123). */
  has_data: boolean;
  content_preview: InsightsPreview;
  overview: InsightsOverview;
  engagement: InsightsEngagement | null;
  professional_actions: InsightsProfessionalActions | null;
  traffic_sources: InsightsTrafficSource[];
  video_insights: InsightsVideoPerformance | null;
  article_insights: InsightsArticlePerformance | null;
  periods: InsightsPeriodAvailability[];
  default_period: InsightsPeriod;
};

/** Contenuto assente / non pubblicato / non leggibile: risposta DEFINITIVA, non un guasto. */
export type ContentInsightsUnavailable = { status: "unavailable" };

export type ContentInsightsResult = ContentInsights | ContentInsightsUnavailable;

export type InsightsTrendInterval = "hour" | "day";

export type InsightsTrendPoint = {
  ts: string;
  value: number;
};

/** §73: serie cumulativa dall'inizio del periodo, mai raw event (§74). */
export type ContentInsightsTrend = {
  status: "ok";
  metric: InsightsMetric;
  period: InsightsPeriod;
  timezone: string;
  interval: InsightsTrendInterval;
  cumulative: boolean;
  /** Falso (e `points` vuoto) con meno di 3 bucket o valore finale 0: nessun grafico artificiale (§75). */
  sufficient: boolean;
  points: InsightsTrendPoint[];
};

export type ContentInsightsTrendResult = ContentInsightsTrend | ContentInsightsUnavailable;
