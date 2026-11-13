/**
 * Dettagli e statistiche di un contenuto (HOM-05 §8, §13–14, §125–129, §133–141).
 *
 * Una sola schermata verticale scrollabile, senza tab analytics (§14) e senza
 * bottom navigation (decisione D1, come il dettaglio contenuto HOM-04).
 * L'ordine è fisso (§13): Preview → Panoramica → Interazioni → Azioni generate
 * → Andamento → Origine → Prestazioni video | articolo. Quali sezioni esistano
 * lo decide `buildInsightsViewModel` (pura, testata); qui si compone soltanto.
 *
 *  • due query indipendenti (§157–158): il dettaglio e il trend. Cambiare
 *    periodo o metrica tocca solo il trend e non resetta lo scroll (§72);
 *  • con cache valida si mostra subito e si aggiorna in background (§126);
 *    pull-to-refresh nativo che mantiene scroll e dati (§127–128);
 *  • permesso revocato, contenuto non disponibile ed errore hanno ciascuno il
 *    proprio stato (§135–138, §141): mai «nessuna statistica» per un guasto;
 *  • il Back torna nello stack esistente, quindi al Feed con tab e scroll
 *    (§10–12); `useBackToFeed` serve solo la CTA del contenuto non disponibile.
 */

import { useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Screen } from "../../../components/ui/screen";
import { colors, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { CONTENT_INSIGHTS_LABEL } from "../../feed/content-actions-presentation";
import { isContentPermissionError } from "../../feed/content-manage-service";
import { ContentUnavailableState } from "../../feed/components/ContentUnavailableState";
import { HOME_HREF, contentDetailHref, type ContentOrigin } from "../../feed/content-routes";
import type { FeedContentType } from "../../feed/feed-types";
import { useBackToFeed } from "../../feed/use-back-to-feed";
import { trackInsights } from "../insights-analytics";
import {
  DEFAULT_METRIC,
  INSIGHTS_SECTION_TITLES,
  buildInsightsViewModel,
  buildPeriodOptions,
  insightsLayoutFor,
  resolveInsightsScreenState,
  resolvePeriod,
  resolveTrendState,
} from "../insights-presentation";
import type { InsightsMetric, InsightsPeriod } from "../insights-types";
import { useContentInsights, useInsightsPermissionGuard } from "../use-content-insights";
import { useContentInsightsTrend } from "../use-content-insights-trend";
import { InsightsActionsSection, InsightsMetricRows } from "./InsightsMetricRows";
import { InsightsOverview } from "./InsightsOverview";
import { InsightsPreview } from "./InsightsPreview";
import { InsightsSources } from "./InsightsSources";
import {
  InsightsErrorState,
  InsightsInitialState,
  InsightsPermissionState,
  InsightsSkeleton,
} from "./InsightsStates";
import { InsightsTrend } from "./InsightsTrend";

export function ContentInsightsScreen({
  contentType,
  origin,
  postId,
}: {
  contentType: FeedContentType | null;
  origin: ContentOrigin | null;
  postId: string;
}) {
  const router = useRouter();
  const { profile } = useSession();
  const { fontScale } = useWindowDimensions();
  const viewerProfileId = profile?.id ?? null;
  const layout = insightsLayoutFor(fontScale);
  const backToFeed = useBackToFeed(origin);

  const [metric, setMetric] = useState<InsightsMetric>(DEFAULT_METRIC);
  const [selectedPeriod, setSelectedPeriod] = useState<InsightsPeriod | null>(null);
  const [isRefreshing, setRefreshing] = useState(false);

  const insights = useContentInsights({ contentType, postId, viewerProfileId });
  const okData = insights.data?.status === "ok" ? insights.data : null;
  const periodOptions = okData ? buildPeriodOptions(okData.periods) : [];
  const period = resolvePeriod(
    selectedPeriod,
    periodOptions,
    okData?.default_period ?? "since_publication",
  );

  const trendEnabled = okData !== null && okData.has_data && periodOptions.length > 0;
  const trend = useContentInsightsTrend({
    contentType,
    enabled: trendEnabled,
    metric,
    period,
    postId,
    viewerProfileId,
  });

  const permissionRevoked =
    isContentPermissionError(insights.error) || isContentPermissionError(trend.error);
  useInsightsPermissionGuard({ contentType, postId, revoked: permissionRevoked });

  const state = resolveInsightsScreenState({
    data: insights.data,
    hasError: insights.isError,
    hasTarget: contentType !== null && postId.length > 0,
    permissionRevoked,
  });

  useEffect(() => {
    if (contentType !== null) {
      trackInsights({ contentId: postId, contentType, name: "insights_open", origin });
    }
  }, [contentType, origin, postId]);

  const analyticsBase = { contentId: postId, contentType: contentType ?? "profile_post", origin } as const;

  function goBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(HOME_HREF as never);
    }
  }

  function openContent() {
    if (contentType === null) {
      return;
    }
    trackInsights({ ...analyticsBase, name: "original_content_open" });
    router.push(contentDetailHref(contentType, postId, { origin }) as never);
  }

  function changePeriod(next: InsightsPeriod) {
    if (next !== period) {
      trackInsights({ ...analyticsBase, from: period, metric, name: "period_changed", to: next });
      setSelectedPeriod(next);
    }
  }

  function changeMetric(next: InsightsMetric) {
    if (next !== metric) {
      trackInsights({ ...analyticsBase, from: metric, name: "metric_changed", period, to: next });
      setMetric(next);
    }
  }

  function retryAll() {
    trackInsights({ ...analyticsBase, name: "section_retry", section: "insights" });
    void insights.refetch();
  }

  function retryTrend() {
    trackInsights({ ...analyticsBase, name: "section_retry", section: "trend" });
    void trend.refetch();
  }

  async function refresh() {
    trackInsights({ ...analyticsBase, name: "insights_refresh", trigger: "pull" });
    setRefreshing(true);
    try {
      await Promise.all([insights.refetch(), trendEnabled ? trend.refetch() : Promise.resolve()]);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Torna indietro"
          accessibilityRole="button"
          onPress={goBack}
          style={styles.topBarButton}
          testID="insights-back"
        >
          <Ionicons color={colors.textPrimary} name="arrow-back" size={24} />
        </Pressable>
        <AppText accessibilityRole="header" style={styles.topBarTitle} variant="titleMd">
          {CONTENT_INSIGHTS_LABEL}
        </AppText>
      </View>

      {state.kind === "loading" ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <InsightsSkeleton />
        </ScrollView>
      ) : state.kind === "error" ? (
        <InsightsErrorState onRetry={retryAll} />
      ) : state.kind === "permission_revoked" ? (
        <InsightsPermissionState onBack={goBack} />
      ) : state.kind === "unavailable" ? (
        <ContentUnavailableState onBackToFeed={backToFeed} />
      ) : (
        <ReadyBody
          layout={layout}
          metric={metric}
          onChangeMetric={changeMetric}
          onChangePeriod={changePeriod}
          onOpenContent={openContent}
          onRefresh={refresh}
          onRetryTrend={retryTrend}
          period={period}
          refreshing={isRefreshing}
          trendState={resolveTrendState({ data: trend.data, hasError: trend.isError })}
          view={buildInsightsViewModel(state.data)}
        />
      )}
    </Screen>
  );
}

type ReadyBodyProps = {
  layout: ReturnType<typeof insightsLayoutFor>;
  metric: InsightsMetric;
  onChangeMetric: (metric: InsightsMetric) => void;
  onChangePeriod: (period: InsightsPeriod) => void;
  onOpenContent: () => void;
  onRefresh: () => void;
  onRetryTrend: () => void;
  period: InsightsPeriod;
  refreshing: boolean;
  trendState: ReturnType<typeof resolveTrendState>;
  view: ReturnType<typeof buildInsightsViewModel>;
};

function ReadyBody({
  layout,
  metric,
  onChangeMetric,
  onChangePeriod,
  onOpenContent,
  onRefresh,
  onRetryTrend,
  period,
  refreshing,
  trendState,
  view,
}: ReadyBodyProps) {
  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl colors={[colors.accent]} onRefresh={onRefresh} refreshing={refreshing} />
      }
      testID="insights-scroll"
    >
      <InsightsPreview layout={layout} model={view.preview} onOpenContent={onOpenContent} />

      {view.updatedLabel ? (
        <AppText align="right" color="muted" variant="caption">
          {view.updatedLabel}
        </AppText>
      ) : null}

      {view.overview ? <InsightsOverview kpis={view.overview} layout={layout} /> : null}

      {view.interactions ? (
        <InsightsMetricRows
          rows={view.interactions}
          testID="insights-interactions"
          title={INSIGHTS_SECTION_TITLES.interactions}
          tone="neutral"
        />
      ) : null}

      {view.actions ? <InsightsActionsSection model={view.actions} /> : null}

      {view.trend ? (
        <InsightsTrend
          metric={metric}
          onChangeMetric={onChangeMetric}
          onChangePeriod={onChangePeriod}
          onRetry={onRetryTrend}
          period={period}
          periods={view.trend.periods}
          state={trendState}
        />
      ) : null}

      {view.sources ? <InsightsSources rows={view.sources} /> : null}

      {view.video ? (
        <InsightsMetricRows
          rows={view.video}
          testID="insights-video"
          title={INSIGHTS_SECTION_TITLES.video}
          tone="accent"
        />
      ) : null}

      {view.article ? (
        <InsightsMetricRows
          rows={view.article}
          testID="insights-article"
          title={INSIGHTS_SECTION_TITLES.article}
          tone="accent"
        />
      ) : null}

      {view.initialState ? <InsightsInitialState variant={view.initialState} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing[20],
    paddingBottom: spacing[32],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[8],
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
    minHeight: 44,
  },
  topBarButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  topBarTitle: {
    flex: 1,
  },
});
