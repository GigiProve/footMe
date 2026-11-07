/**
 * Candidature di una singola Position (screen 12, 13).
 *
 * §23: «Tap apre lo stesso elenco canonico limitato all'esatto position_id:
 * contesto ruolo/squadra o Intera società evidente in alto; Nuove e Tutte;
 * **nessun selector Squadre/Posizioni**, perché il contesto è già fissato;
 * nessuna ricerca o tab shortlist aggiuntiva; nessuna ripetizione della
 * stessa vacancy dentro ogni riga.»
 *
 * Da cui due differenze dal centro generale, e nessuna terza: niente riga
 * filtro, e le righe non ripetono il contesto della Position. Il dettaglio
 * raggiunto di qui è lo stesso: §23 — «con le stesse capacità, la stessa
 * lettura e la stessa shortlist della Position».
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, TabBar } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { STALE_MS } from "../cache/freshness-policy";
import {
  DashboardGlobalEmpty,
  DashboardGlobalError,
  DashboardSkeleton,
} from "../components/DashboardStates";
import { SocietyContextHeader } from "../components/SocietyContextHeader";
import { useDashboardIdentity } from "../identity/use-dashboard-identity";
import { trackApplicationsEvent } from "./applications-analytics";
import { APPLICATIONS_QK } from "./applications-keys";
import {
  APPLICATIONS_COPY,
  APPLICATIONS_TABS,
  positionLine,
} from "./applications-presentation";
import { APPLICATIONS_HREFS } from "./applications-routes";
import {
  APPLICATIONS_PAGE_SIZE,
  ApplicationsAccessError,
  fetchApplicationsCenter,
  fetchApplicationsPage,
} from "./applications-service";
import type {
  ApplicationRow,
  ApplicationsPage,
  ApplicationsTab,
} from "./applications-types";
import { ApplicationListRow } from "./components/ApplicationListRow";

export function PositionApplicationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;

  const params = useLocalSearchParams<{ positionId?: string; tab?: string }>();
  const positionId =
    typeof params.positionId === "string" ? params.positionId : "";

  /**
   * §23: «Nel normale ingresso a una Position PUBLISHED il default resta
   * Nuove. Rispetta una tab esplicita nel contesto di navigazione.» Lo
   * storico di una CLOSED arriva con `tab=all` dalla route che lo apre.
   */
  const [tab, setTab] = useState<ApplicationsTab>(() =>
    params.tab === "all" ? "all" : "new",
  );

  const centerQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchApplicationsCenter(clubId as string),
    queryKey: APPLICATIONS_QK.center(actorId, clubId ?? ""),
    retry: (failureCount, error) =>
      !(error instanceof ApplicationsAccessError) && failureCount < 1,
    staleTime: STALE_MS.operational,
  });

  const center = centerQuery.data ?? null;

  const listQuery = useInfiniteQuery<
    ApplicationsPage,
    Error,
    InfiniteData<ApplicationsPage, string | null>,
    readonly unknown[],
    string | null
  >({
    enabled: !!clubId && !!actorId && !!positionId,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      fetchApplicationsPage({
        adId: positionId,
        clubId: clubId as string,
        cursor: pageParam,
        limit: APPLICATIONS_PAGE_SIZE,
        tab,
      }),
    queryKey: APPLICATIONS_QK.positionList(
      actorId,
      clubId ?? "",
      positionId,
      tab,
    ),
    retry: (failureCount: number, error: Error) =>
      !(error instanceof ApplicationsAccessError) && failureCount < 1,
    staleTime: STALE_MS.operational,
  });

  const pages = useMemo(() => listQuery.data?.pages ?? [], [listQuery.data]);
  const rows = useMemo(() => pages.flatMap((page) => page.rows), [pages]);
  const context = pages[0]?.positionContext ?? null;

  useFocusEffect(
    useCallback(() => {
      if (!actorId || !clubId) {
        return;
      }

      void queryClient.invalidateQueries({
        queryKey: ["society-position-applications", actorId, clubId, positionId],
      });
    }, [actorId, clubId, positionId, queryClient]),
  );

  useEffect(() => {
    trackApplicationsEvent("applications_center_view", { source: "position" });
  }, []);

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();

      return;
    }

    /* §29: senza stack si ricostruisce la catena verso la Position, non
       verso Home. */
    router.replace(
      `/(tabs)/dashboard/positions/${encodeURIComponent(positionId)}` as never,
    );
  }, [positionId, router]);

  const openRow = useCallback(
    (row: ApplicationRow) => {
      trackApplicationsEvent("application_opened", {
        source: "position",
        tab,
      });
      router.push(
        APPLICATIONS_HREFS.detail(row.id, {
          adId: positionId,
          from: "position",
        }) as never,
      );
    },
    [positionId, router, tab],
  );

  const shell = (body: React.ReactNode) => (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <SocietyContextHeader
        isVerified={center?.clubIsVerified ?? false}
        logoUrl={center?.clubLogoUrl ?? null}
        name={center?.clubName ?? ""}
        onBack={goBack}
        title={null}
      />
      {body}
    </View>
  );

  if (
    listQuery.error instanceof ApplicationsAccessError &&
    (listQuery.error.code === "APPLICATIONS_NOT_AUTHORIZED" ||
      listQuery.error.code === "APPLICATION_NOT_AVAILABLE")
  ) {
    return shell(
      <DashboardGlobalEmpty
        copy={{
          actionLabel: APPLICATIONS_COPY.backToDashboard,
          body: APPLICATIONS_COPY.unavailableBody,
          icon: "lock-closed-outline",
          title: APPLICATIONS_COPY.unavailableTitle,
        }}
        onAction={() => router.replace("/(tabs)/dashboard" as never)}
      />,
    );
  }

  const listFailed = Boolean(listQuery.error) && rows.length === 0;
  const listLoading = listQuery.isLoading && rows.length === 0;
  const empty =
    !listLoading && !listFailed && rows.length === 0 && listQuery.isSuccess;

  /* Come nel centro (§12, screen 12 e 13): contesto, titolo e tab restano
     visibili mentre scorrono le sole righe. */
  const chrome = (
    <View style={styles.header}>
      {/* §23: «contesto ruolo/squadra o Intera società evidente in alto».
          Una riga sola: non si ripete poi in ogni row. */}
      {context ? (
        <AppText color="neutralMuted" variant="bodySm">
          {positionLine({
            roleLabel: context.roleLabel,
            teamLabel: context.teamLabel,
          })}
        </AppText>
      ) : null}

      <AppText accessibilityRole="header" color="neutral" variant="screenTitle">
        {APPLICATIONS_COPY.centerTitle}
      </AppText>

      <TabBar
        active={tab}
        fill
        items={APPLICATIONS_TABS}
        onChange={(next) => {
          if (next !== tab) {
            trackApplicationsEvent("applications_tab_changed", { tab: next });
            setTab(next);
          }
        }}
        style={styles.tabs}
        testID="position-applications-tabs"
      />

      {/* §23, screen 13: nello storico la riga spiega perché le candidature
          sono ancora lì, senza promettere che se ne riceveranno altre. */}
      {context?.status === "closed" ? (
        <AppText color="neutralMuted" style={styles.note} variant="bodySm">
          {APPLICATIONS_COPY.closedHistoryNote}
        </AppText>
      ) : null}
    </View>
  );

  return shell(
    <>
      {chrome}

      <FlatList
      contentContainerStyle={[
        styles.list,
        { paddingBottom: spacing[24] + insets.bottom },
      ]}
      data={rows}
      keyExtractor={(row) => row.id}
      ListEmptyComponent={
        listLoading ? (
          <DashboardSkeleton />
        ) : listFailed ? (
          <DashboardGlobalError
            body={APPLICATIONS_COPY.listErrorBody}
            onRetry={() => void listQuery.refetch()}
            title={APPLICATIONS_COPY.listErrorTitle}
          />
        ) : empty ? (
          /* §23: «Nuove applica la stessa eligibility operativa e risulta
             vuota per CLOSED.» È un empty valido, non un errore, e non si
             cambia tab di nascosto. */
          <DashboardGlobalEmpty
            copy={{
              actionLabel: "Vedi tutte",
              body:
                tab === "new"
                  ? "Le candidature già consultate sono in Tutte."
                  : "Le candidature a questa posizione compariranno qui.",
              icon: "document-text-outline",
              title:
                tab === "new"
                  ? "Nessuna nuova candidatura"
                  : "Nessuna candidatura ricevuta",
            }}
            onAction={tab === "new" ? () => setTab("all") : null}
          />
        ) : null
      }
      onEndReached={() => {
        if (listQuery.hasNextPage && !listQuery.isFetchingNextPage) {
          void listQuery.fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.4}
      refreshControl={
        <RefreshControl
          onRefresh={() => void listQuery.refetch()}
          refreshing={listQuery.isRefetching && rows.length > 0}
          tintColor={colors.textNeutralSoft}
        />
      }
      renderItem={({ index, item }) => (
        <ApplicationListRow
          /* §23: «nessuna ripetizione della stessa vacancy dentro ogni
             riga» — il contesto è già nel titolo. */
          hidePositionLine
          onPress={() => openRow(item)}
          row={item}
          showDivider={index > 0}
        />
      )}
      testID="position-applications-list"
      />
    </>,
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  list: {
    paddingHorizontal: spacing[20],
  },
  header: {
    gap: spacing[4],
    paddingBottom: spacing[4],
    paddingHorizontal: spacing[20],
  },
  tabs: {
    marginTop: spacing[8],
  },
  note: {
    paddingTop: spacing[8],
  },
});
