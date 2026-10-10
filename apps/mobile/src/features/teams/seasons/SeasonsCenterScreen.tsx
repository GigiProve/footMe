/**
 * Centro Stagioni e storico della Società — screen 01.
 *
 * §9: «Dashboard Società → Stagioni e storico → squadra.» La route vive
 * dentro lo Stack annidato nella tab Dashboard, quindi la bottom navigation
 * resta visibile con Dashboard selezionata, e il passaggio dal Centro
 * Squadre **non** è obbligatorio.
 *
 * L'identità resta la Società (§9): la squadra è il contesto delle pagine
 * successive e non compare nel selector della Dashboard.
 */
import { useCallback, useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";

import { colors, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { useDashboardIdentity } from "../../dashboard/identity/use-dashboard-identity";
import {
  DashboardGlobalError,
  DashboardOfflineNotice,
  DashboardSkeleton,
} from "../../dashboard/components/DashboardStates";
import { useDashboardConnection } from "../../dashboard/state/use-dashboard-connection";
import { STALE_MS } from "../../dashboard/cache/freshness-policy";
import { SeasonBlock } from "./components/SeasonBlock";
import { SeasonsIdentityHeader } from "./components/SeasonsIdentityHeader";
import { SeasonsListRow } from "./components/SeasonsListRow";
import { SeasonsNavBar } from "./components/SeasonsNavBar";
import { SEASONS_QK } from "./seasons-keys";
import { centerRowMeta, nextSeasonSummary } from "./seasons-presentation";
import {
  fetchSeasonsCenter,
  fetchSeasonsCenterPage,
  type CursorPage,
  type SeasonsCenterRow,
} from "./seasons-service";
import { trackSeasonsEvent } from "./seasons-analytics";

const PAGE_SIZE = 20;

export function SeasonsCenterScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;
  const connection = useDashboardConnection();

  const headerQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchSeasonsCenter(clubId as string),
    queryKey: SEASONS_QK.center(actorId, clubId ?? ""),
    staleTime: STALE_MS.management,
  });

  const pageQuery = useInfiniteQuery({
    enabled: !!clubId && !!actorId,
    getNextPageParam: (last: CursorPage<SeasonsCenterRow>) => last.nextCursor,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      fetchSeasonsCenterPage(clubId as string, pageParam, PAGE_SIZE),
    queryKey: SEASONS_QK.centerPage(actorId, clubId ?? ""),
    staleTime: STALE_MS.management,
  });

  const header = headerQuery.data ?? null;
  const rows = useMemo(
    () => pageQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [pageQuery.data],
  );

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: SEASONS_QK.center(actorId, clubId ?? ""),
      }),
      queryClient.invalidateQueries({
        queryKey: SEASONS_QK.centerPage(actorId, clubId ?? ""),
      }),
    ]);
  }, [actorId, clubId, queryClient]);

  const isLoading = headerQuery.isLoading || pageQuery.isLoading;
  const isError = headerQuery.isError || pageQuery.isError;
  const error = headerQuery.error ?? pageQuery.error;

  const { reportFailure, reportSuccess } = connection;

  useEffect(() => {
    if (error) {
      reportFailure(error);
    } else if (!isLoading) {
      reportSuccess();
    }
  }, [error, isLoading, reportFailure, reportSuccess]);

  useEffect(() => {
    if (header?.canView) {
      trackSeasonsEvent("seasons_center_opened", {
        has_next_season: header.nextSeasonId !== null,
      });
    }
  }, [header?.canView, header?.nextSeasonId]);

  const openTeam = useCallback(
    (teamId: string) => {
      trackSeasonsEvent("seasons_team_opened", { origin: "center" });
      router.push(
        `/(tabs)/dashboard/seasons/${encodeURIComponent(teamId)}`,
      );
    },
    [router],
  );

  const navBar = (
    <SeasonsNavBar onBack={() => router.back()} title="Stagioni e storico" />
  );

  if (!clubId) {
    return (
      <View style={styles.root}>
        {navBar}
        <View style={styles.centered}>
          <AppText color="neutralMuted" style={styles.centeredText} variant="bodySm">
            Apri la Dashboard della società per gestire le stagioni.
          </AppText>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.root}>
        {navBar}
        <DashboardSkeleton />
      </View>
    );
  }

  // §33: l'errore globale esiste solo senza dati affidabili. Con righe in
  // cache la pagina resta leggibile e l'avviso è locale.
  if (isError && rows.length === 0) {
    return (
      <View style={styles.root}>
        {navBar}
        <DashboardGlobalError onRetry={() => void refresh()} />
      </View>
    );
  }

  if (header && !header.canView) {
    return (
      <View style={styles.root}>
        {navBar}
        <View style={styles.centered}>
          <AppText color="neutralMuted" style={styles.centeredText} variant="bodySm">
            Nessuna squadra disponibile nel tuo ambito
          </AppText>
        </View>
      </View>
    );
  }

  const summary = nextSeasonSummary({
    preparedCount: header?.preparedCount ?? null,
    toPrepareCount: header?.toPrepareCount ?? null,
  });

  return (
    <View style={styles.root}>
      {navBar}

      <FlatList
        contentContainerStyle={styles.content}
        data={rows}
        keyExtractor={(item) => item.teamId}
        ListEmptyComponent={
          <View style={styles.empty} testID="seasons-center-empty">
            <AppText color="neutral" style={styles.centeredText} variant="titleSm">
              Nessuna squadra attiva nel tuo ambito
            </AppText>

            <AppText color="neutralMuted" style={styles.centeredText} variant="bodySm">
              Le squadre attive della società compariranno qui con la loro
              stagione corrente.
            </AppText>
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {pageQuery.isFetchingNextPage ? (
              <ActivityIndicator color={colors.textNeutralMuted} />
            ) : null}

            <SeasonBlock
              headline={header?.nextSeasonLabel ?? null}
              meta={
                header?.nextSeasonId
                  ? summary
                  : // §6: la prossima stagione non disponibile è un messaggio
                    // discreto, non una label fabbricata né una CTA finta.
                    "Non ancora disponibile nel calendario."
              }
              testID="seasons-next-block"
              title="Prossima stagione"
            />

            {header?.canViewInactive ? (
              <SeasonsListRow
                onPress={() => {
                  trackSeasonsEvent("seasons_inactive_opened", { origin: "center" });
                  router.push("/(tabs)/dashboard/seasons/inactive");
                }}
                showDivider
                testID="seasons-inactive-row"
                title="Squadre non attive"
              />
            ) : null}
          </View>
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {connection.connection === "offline" ? <DashboardOfflineNotice /> : null}

            <SeasonsIdentityHeader
              isVerified={header?.clubIsVerified ?? false}
              logoUrl={header?.clubLogoUrl ?? null}
              name={header?.clubName ?? current?.name ?? "Società"}
              subtitle="Società"
            />

            {header?.scopeLabel ? (
              <AppText color="neutralMuted" variant="meta">
                {`Ambito: ${header.scopeLabel}`}
              </AppText>
            ) : null}

            <SeasonBlock
              headline={header?.seasonLabel ?? null}
              testID="seasons-current-block"
              title="Stagione corrente"
            />
          </View>
        }
        onEndReached={() => {
          if (pageQuery.hasNextPage && !pageQuery.isFetchingNextPage) {
            void pageQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            onRefresh={() => void refresh()}
            refreshing={headerQuery.isRefetching || pageQuery.isRefetching}
            tintColor={colors.textNeutralMuted}
          />
        }
        renderItem={({ index, item }) => (
          <SeasonsListRow
            avatarUrl={item.crestUrl}
            meta={centerRowMeta(item)}
            onPress={() => openTeam(item.teamId)}
            showAvatar
            showDivider={index > 0}
            testID={`seasons-team-${item.teamId}`}
            title={item.name}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    flex: 1,
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  content: {
    paddingBottom: spacing[40],
  },
  listHeader: {
    gap: spacing[12],
    paddingBottom: spacing[8],
  },
  footer: {
    gap: spacing[16],
    paddingTop: spacing[20],
  },
  empty: {
    gap: spacing[8],
    paddingTop: spacing[32],
  },
  centered: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing[20],
  },
  centeredText: {
    textAlign: "center",
  },
});
