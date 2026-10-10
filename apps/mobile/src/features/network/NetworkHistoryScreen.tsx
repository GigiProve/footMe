/**
 * Storico collegamenti (master 10).
 *
 * §23: «mostra relazioni dirette realmente attivate e successivamente
 * terminate». Le richieste rifiutate o annullate non compaiono — non sono mai
 * state un collegamento — e il filtro non è qui ma nel database, dove un
 * CHECK rende impossibile uno `ended` senza `accepted_at`.
 *
 * La riga non ripete "Terminata": §23 lo vieta perché il titolo della pagina
 * dichiara già il contesto.
 */
import { useCallback, useMemo } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";

import { colors, spacing } from "../../theme/tokens";
import { AppText } from "../../ui";
import { useSession } from "../auth/use-session";
import { useDashboardIdentity } from "../dashboard/identity/use-dashboard-identity";
import {
  DashboardGlobalError,
  DashboardSkeleton,
} from "../dashboard/components/DashboardStates";
import { STALE_MS } from "../dashboard/cache/freshness-policy";
import { NetworkNavBar } from "./components/NetworkNavBar";
import { SocietyIdentityRow } from "./components/SocietyIdentityRow";
import { SocietyListRow } from "./components/SocietyListRow";
import { NETWORK_QK } from "./network-keys";
import { NETWORK_EMPTY, historyPeriodLabel } from "./network-presentation";
import { fetchNetworkHistoryPage } from "./network-service";
import type { NetworkListPage } from "./network-types";
import { trackNetworkEvent } from "./network-analytics";

const PAGE_SIZE = 20;

export function NetworkHistoryScreen() {
  const router = useRouter();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;

  const historyQuery = useInfiniteQuery({
    enabled: !!clubId && !!actorId,
    getNextPageParam: (last: NetworkListPage) => last.nextCursor,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      fetchNetworkHistoryPage(clubId as string, pageParam, PAGE_SIZE),
    queryKey: NETWORK_QK.history(actorId, clubId ?? ""),
    staleTime: STALE_MS.management,
  });

  const items = useMemo(
    () => historyQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [historyQuery.data],
  );

  const openDetail = useCallback(
    (relationshipId: string) => {
      trackNetworkEvent("network_detail_opened", { status: "ended" });
      router.push(`/(tabs)/dashboard/network/${relationshipId}`);
    },
    [router],
  );

  if (!clubId) {
    return (
      <View style={styles.root}>
        <NetworkNavBar onBack={() => router.back()} title="Storico collegamenti" />
        <DashboardGlobalError
          body="Seleziona una società per consultare lo storico."
          onRetry={() => router.back()}
          title="Nessuna società selezionata"
        />
      </View>
    );
  }

  if (historyQuery.isLoading) {
    return (
      <View style={styles.root}>
        <NetworkNavBar onBack={() => router.back()} title="Storico collegamenti" />
        <DashboardSkeleton />
      </View>
    );
  }

  if (historyQuery.isError) {
    return (
      <View style={styles.root}>
        <NetworkNavBar onBack={() => router.back()} title="Storico collegamenti" />
        <DashboardGlobalError
          body="Riprova tra poco."
          onRetry={() => void historyQuery.refetch()}
          title="Non è stato possibile caricare lo storico"
        />
      </View>
    );
  }

  const society = items[0]
    ? items[0].viewerSide === "a"
      ? items[0].clubA
      : items[0].clubB
    : null;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <NetworkNavBar onBack={() => router.back()} title="Storico collegamenti" />

        {society ? (
          <SocietyIdentityRow society={society} subtitle="Società" />
        ) : null}

        <AppText color="neutralSoft" variant="meta">
          I collegamenti conclusi restano consultabili.
        </AppText>
      </View>

      <FlatList
        contentContainerStyle={styles.listContent}
        data={items}
        keyExtractor={(item) => item.relationshipId}
        ListEmptyComponent={
          <View style={styles.empty} testID="network-history-empty">
            <AppText color="neutral" variant="titleMd">
              {NETWORK_EMPTY.history.title}
            </AppText>
            <AppText color="neutralMuted" variant="bodySm">
              {NETWORK_EMPTY.history.body}
            </AppText>
          </View>
        }
        ListFooterComponent={
          historyQuery.isFetchingNextPage ? (
            <ActivityIndicator color={colors.textNeutralMuted} style={styles.spinner} />
          ) : null
        }
        onEndReached={() => {
          if (historyQuery.hasNextPage && !historyQuery.isFetchingNextPage) {
            void historyQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        renderItem={({ item }) => (
          <SocietyListRow
            detail={[item.typeLabel, historyPeriodLabel(item)]
              .filter((part): part is string => !!part)
              .join(" · ")}
            onPress={() => openDetail(item.relationshipId)}
            society={item.counterpart}
            testID={`network-history-${item.relationshipId}`}
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
  },
  header: {
    gap: spacing[12],
    paddingBottom: spacing[8],
    paddingHorizontal: spacing[20],
  },
  listContent: {
    paddingBottom: spacing[24],
    paddingHorizontal: spacing[20],
  },
  empty: {
    gap: spacing[8],
    paddingTop: spacing[40],
  },
  spinner: {
    paddingVertical: spacing[16],
  },
});
