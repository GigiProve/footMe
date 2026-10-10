/**
 * Squadre non attive — screen 09.
 *
 * Vista di consultazione: bottom navigation visibile con Dashboard
 * selezionata (§9, §28). La riga apre il contesto stagioni **dello stesso
 * Team**, non la riattivazione — §28 è esplicito: «Non avvia automaticamente
 * la riattivazione».
 *
 * `Storico disponibile` è l'unico metadato, ed è vero o assente: §28 vieta
 * di «riempire lo spazio con dati dimostrativi o metriche zero».
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
import { SeasonsIdentityHeader } from "./components/SeasonsIdentityHeader";
import { SeasonsListRow } from "./components/SeasonsListRow";
import { SeasonsNavBar } from "./components/SeasonsNavBar";
import { SEASONS_QK } from "./seasons-keys";
import {
  fetchInactiveTeams,
  fetchSeasonsCenter,
  type CursorPage,
  type InactiveTeamRow,
} from "./seasons-service";
import { trackSeasonsEvent } from "./seasons-analytics";

const PAGE_SIZE = 20;

export function InactiveTeamsScreen() {
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
    getNextPageParam: (last: CursorPage<InactiveTeamRow>) => last.nextCursor,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      fetchInactiveTeams(clubId as string, pageParam, PAGE_SIZE),
    queryKey: SEASONS_QK.inactive(actorId, clubId ?? ""),
    staleTime: STALE_MS.management,
  });

  const header = headerQuery.data ?? null;
  const rows = useMemo(
    () => pageQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [pageQuery.data],
  );

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: SEASONS_QK.inactive(actorId, clubId ?? ""),
    });
  }, [actorId, clubId, queryClient]);

  useEffect(() => {
    trackSeasonsEvent("seasons_inactive_opened", { origin: "list" });
  }, []);

  const navBar = (
    <SeasonsNavBar onBack={() => router.back()} title="Squadre non attive" />
  );

  if (!clubId || pageQuery.isLoading) {
    return (
      <View style={styles.root}>
        {navBar}
        <DashboardSkeleton />
      </View>
    );
  }

  // §28: «Un errore resta un errore» — non una lista vuota.
  if (pageQuery.isError && rows.length === 0) {
    return (
      <View style={styles.root}>
        {navBar}
        <DashboardGlobalError onRetry={() => void refresh()} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {navBar}

      <FlatList
        contentContainerStyle={styles.content}
        data={rows}
        keyExtractor={(item) => item.teamId}
        ListEmptyComponent={
          <AppText color="neutralMuted" variant="bodySm">
            Nessuna squadra non attiva nel tuo ambito
          </AppText>
        }
        ListFooterComponent={
          pageQuery.isFetchingNextPage ? (
            <View style={styles.footer}>
              <ActivityIndicator color={colors.textNeutralMuted} />
            </View>
          ) : null
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

            <AppText color="neutralMuted" variant="bodySm">
              Consulta lo storico o riattiva una squadra.
            </AppText>
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
            refreshing={pageQuery.isRefetching}
            tintColor={colors.textNeutralMuted}
          />
        }
        renderItem={({ index, item }) => (
          <SeasonsListRow
            avatarUrl={item.crestUrl}
            meta={item.hasHistory ? "Storico disponibile" : null}
            onPress={() =>
              router.push(
                `/(tabs)/dashboard/seasons/${encodeURIComponent(item.teamId)}`,
              )
            }
            showAvatar
            showDivider={index > 0}
            testID={`seasons-inactive-${item.teamId}`}
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
    paddingVertical: spacing[16],
  },
});
