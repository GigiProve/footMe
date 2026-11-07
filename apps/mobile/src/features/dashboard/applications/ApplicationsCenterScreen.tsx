/**
 * Centro Candidature ricevute (DAS-REV-22, screen 01, 02, 03, 04, 14, 15).
 *
 * Una sola pagina per sei stati: cambiano tab, filtri, permessi e stato dei
 * dati, non la struttura. Lo screen 03 è «lo screen 01 con lo sheet aperto»,
 * non una route nuova, e il 04 è il 01 con un filtro applicato.
 *
 * Tre query separate — intestazione, opzioni del filtro, lista — perché §27
 * chiede che falliscano separatamente: «Non mostrare contemporaneamente zero
 * risultati e un errore di caricamento», e «Errore nel caricamento delle
 * opzioni: selezioni applicate conservate, nessun falso reset».
 *
 * La route vive nello Stack annidato della tab Dashboard, quindi la bottom
 * navigation resta visibile con Dashboard selezionata (§11).
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
  DashboardGlobalOffline,
  DashboardOfflineNotice,
  DashboardSkeleton,
} from "../components/DashboardStates";
import { SocietyContextHeader } from "../components/SocietyContextHeader";
import { useDashboardIdentity } from "../identity/use-dashboard-identity";
import { useAccessWindow } from "../state/use-access-window";
import { useDashboardConnection } from "../state/use-dashboard-connection";
import { trackApplicationsEvent } from "./applications-analytics";
import { APPLICATIONS_QK } from "./applications-keys";
import {
  APPLICATIONS_COPY,
  APPLICATIONS_TABS,
  adoptEffectiveFilter,
  emptyCopy,
  filterSummary,
  isEmptyFilter,
  sameFilter,
} from "./applications-presentation";
import { APPLICATIONS_HREFS, type ApplicationsOrigin } from "./applications-routes";
import {
  APPLICATIONS_PAGE_SIZE,
  ApplicationsAccessError,
  fetchApplicationFilterOptions,
  fetchApplicationsCenter,
  fetchApplicationsPage,
} from "./applications-service";
import type {
  ApplicationRow,
  ApplicationsFilter,
  ApplicationsPage,
  ApplicationsTab,
} from "./applications-types";
import { ApplicationListRow } from "./components/ApplicationListRow";
import { ApplicationsFilterRow } from "./components/ApplicationsFilterRow";
import { ApplicationsFilterSheet } from "./components/ApplicationsFilterSheet";

function parseTab(value: unknown): ApplicationsTab {
  /* §12: «Default ingresso normale: Nuove. Se la route porta esplicitamente a
     Tutte … rispetta il contesto dopo averlo autorizzato.» */
  return value === "all" ? "all" : "new";
}

function parseOrigin(value: unknown): ApplicationsOrigin | null {
  return value === "dashboard" ||
    value === "notification" ||
    value === "position" ||
    value === "widget"
    ? value
    : null;
}

const EMPTY_FILTER: ApplicationsFilter = { adIds: [], teamIds: [] };

export function ApplicationsCenterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;
  const { connection, reportFailure, reportSuccess } = useDashboardConnection();

  const params = useLocalSearchParams<{ from?: string; tab?: string }>();
  const origin = parseOrigin(params.from);

  const [tab, setTab] = useState<ApplicationsTab>(() => parseTab(params.tab));
  /**
   * §14: «Mantieni selezioni e tab nel normale stack di navigazione, senza
   * introdurre preset salvati o preferenze permanenti.» Il filtro vive
   * quindi qui e muore con la schermata.
   */
  const [filter, setFilter] = useState<ApplicationsFilter>(EMPTY_FILTER);
  const [sheetOpen, setSheetOpen] = useState(false);

  // ── Intestazione ──────────────────────────────────────────────────────────

  const centerQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchApplicationsCenter(clubId as string),
    queryKey: APPLICATIONS_QK.center(actorId, clubId ?? ""),
    /* Un rifiuto autorizzativo non è un errore di rete da ritentare (§27). */
    retry: (failureCount, error) =>
      !(error instanceof ApplicationsAccessError) && failureCount < 1,
    staleTime: STALE_MS.operational,
  });

  const loaded = centerQuery.data ?? null;

  const accessWindow = useAccessWindow({
    accessVerifiedAt: loaded?.accessVerifiedAt ?? null,
    isOrganizational: true,
  });

  /* §28: payload, autorizzazione e sessione devono essere validi insieme. */
  const center = accessWindow.isValid ? loaded : null;

  useEffect(() => {
    if (!accessWindow.isValid && loaded && !centerQuery.isFetching) {
      void centerQuery.refetch();
    }
    // Solo la transizione di validità rivalida: le altre dipendenze cambiano
    // a ogni fetch e produrrebbero un ciclo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessWindow.isValid]);

  // ── Opzioni del filtro ────────────────────────────────────────────────────

  const optionsQuery = useQuery({
    enabled: !!clubId && !!actorId && !!center,
    queryFn: () => fetchApplicationFilterOptions(clubId as string),
    queryKey: APPLICATIONS_QK.filters(actorId, clubId ?? ""),
    staleTime: STALE_MS.management,
  });

  const options = useMemo(() => optionsQuery.data ?? [], [optionsQuery.data]);

  // ── Lista ─────────────────────────────────────────────────────────────────

  const listQuery = useInfiniteQuery<
    ApplicationsPage,
    Error,
    InfiniteData<ApplicationsPage, string | null>,
    readonly unknown[],
    string | null
  >({
    enabled: !!clubId && !!actorId && !!center,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      fetchApplicationsPage({
        clubId: clubId as string,
        cursor: pageParam,
        filter,
        limit: APPLICATIONS_PAGE_SIZE,
        tab,
      }),
    queryKey: APPLICATIONS_QK.list(actorId, clubId ?? "", tab, filter),
    retry: (failureCount: number, error: Error) =>
      !(error instanceof ApplicationsAccessError) && failureCount < 1,
    staleTime: STALE_MS.operational,
  });

  const pages = useMemo(() => listQuery.data?.pages ?? [], [listQuery.data]);
  const rows = useMemo(() => pages.flatMap((page) => page.rows), [pages]);
  const firstPage = pages[0] ?? null;

  /**
   * §14, §26: «Il client li riconcilia insieme ai risultati, rimuovendo dati
   * non più autorizzati. Non interpretare un errore di caricamento delle
   * opzioni come comando di reset.»
   *
   * Si riconcilia sulla **risposta**, non sulle opzioni: una lista di opzioni
   * ancora in volo non prova che una selezione sia decaduta, mentre i filtri
   * effettivi restituiti dal server sì.
   */
  useEffect(() => {
    if (!firstPage) {
      return;
    }

    setFilter((current) => adoptEffectiveFilter(current, firstPage.effectiveFilter));
  }, [firstPage]);

  useEffect(() => {
    if (centerQuery.isSuccess) {
      reportSuccess();
    }
  }, [centerQuery.isSuccess, reportSuccess]);

  useEffect(() => {
    if (centerQuery.error) {
      reportFailure(centerQuery.error);
      trackApplicationsEvent("applications_center_load_failed", {
        reason:
          centerQuery.error instanceof ApplicationsAccessError
            ? centerQuery.error.code
            : "network",
      });
    }
  }, [centerQuery.error, reportFailure]);

  useFocusEffect(
    useCallback(() => {
      trackApplicationsEvent("applications_center_view", {
        source: origin ?? "unknown",
      });
    }, [origin]),
  );

  /**
   * §29: «Back dal dettaglio globale ripristina il centro. Se la candidatura
   * letta è uscita da Nuove, conserva una posizione ragionevole» — il
   * ripristino avviene invalidando, non rimontando: TanStack conserva le
   * pagine già caricate e `FlatList` la posizione di scroll.
   */
  useFocusEffect(
    useCallback(() => {
      if (!actorId || !clubId) {
        return;
      }

      void queryClient.invalidateQueries({
        queryKey: APPLICATIONS_QK.center(actorId, clubId),
      });
      void queryClient.invalidateQueries({
        queryKey: ["society-applications-list", actorId, clubId],
      });
    }, [actorId, clubId, queryClient]),
  );

  const refresh = useCallback(async () => {
    await Promise.all([
      centerQuery.refetch(),
      optionsQuery.refetch(),
      listQuery.refetch(),
    ]);
  }, [centerQuery, listQuery, optionsQuery]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();

      return;
    }

    router.replace("/(tabs)/dashboard" as never);
  }, [router]);

  const openRow = useCallback(
    (row: ApplicationRow) => {
      trackApplicationsEvent("application_opened", {
        source: "center",
        tab,
      });

      router.push(
        APPLICATIONS_HREFS.detail(row.id, { from: "dashboard" }) as never,
      );
    },
    [router, tab],
  );

  const changeTab = useCallback(
    (next: ApplicationsTab) => {
      if (next === tab) {
        return;
      }

      /* §14: «Cambio tab e ritorno dal dettaglio: filtri conservati.» */
      trackApplicationsEvent("applications_tab_changed", { tab: next });
      setTab(next);
    },
    [tab],
  );

  const applyFilter = useCallback(
    (next: ApplicationsFilter) => {
      setSheetOpen(false);

      if (sameFilter(next, filter)) {
        return;
      }

      trackApplicationsEvent("applications_filter_applied", {
        positions: next.adIds.length,
        teams: next.teamIds.length,
      });
      /* §14: «Applica filtri conferma atomicamente e chiude», e il cursore
         precedente decade con la query key. */
      setFilter(next);
    },
    [filter],
  );

  const clearFilter = useCallback(() => {
    trackApplicationsEvent("applications_filter_cleared", { source: "empty" });
    setFilter(EMPTY_FILTER);
  }, []);

  const shell = (body: React.ReactNode) => (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <SocietyContextHeader
        isVerified={center?.clubIsVerified ?? false}
        logoUrl={center?.clubLogoUrl ?? null}
        name={center?.clubName ?? ""}
        onBack={goBack}
        title={APPLICATIONS_COPY.centerTitle}
      />
      {body}
    </View>
  );

  if (!clubId) {
    return shell(
      <DashboardGlobalEmpty
        copy={{
          actionLabel: APPLICATIONS_COPY.backToDashboard,
          body: "Seleziona la società da amministrare.",
          icon: "business-outline",
          title: "Nessuna società selezionata",
        }}
        onAction={() => router.replace("/(tabs)/dashboard" as never)}
      />,
    );
  }

  /**
   * §25: lo stato generico non rivela quale permesso manchi né se la risorsa
   * appartenga a un'altra Società, e §27 vieta di presentare un rifiuto come
   * elenco vuoto.
   */
  if (
    centerQuery.error instanceof ApplicationsAccessError &&
    centerQuery.error.code === "APPLICATIONS_NOT_AUTHORIZED"
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

  if (centerQuery.isLoading && !center) {
    /* §27: «mostra immediatamente shell e identità già verificata, poi
       skeleton delle righe». Niente pagina bianca e niente nomi demo. */
    return shell(
      <View style={styles.content}>
        <DashboardSkeleton />
      </View>,
    );
  }

  if (!center) {
    if (connection === "offline") {
      return shell(
        <DashboardGlobalOffline
          body={APPLICATIONS_COPY.offlineBody}
          onRetry={() => {
            trackApplicationsEvent("applications_center_retry", { tab });
            void refresh();
          }}
        />,
      );
    }

    return shell(
      <DashboardGlobalError
        body={APPLICATIONS_COPY.listErrorBody}
        onRetry={() => {
          trackApplicationsEvent("applications_center_retry", { tab });
          void refresh();
        }}
        title={APPLICATIONS_COPY.listErrorTitle}
      />,
    );
  }

  const filtered = !isEmptyFilter(filter);
  const listFailed = Boolean(listQuery.error) && rows.length === 0;
  const listLoading = listQuery.isLoading && rows.length === 0;
  const empty = !listLoading && !listFailed && rows.length === 0 && listQuery.isSuccess;

  /**
   * §27: la copy dell'empty di Nuove dipende da **cosa** contiene lo storico.
   *
   * «Le candidature già consultate sono in Tutte» è vera solo se in Tutte
   * esiste almeno una candidatura che potrebbe essere nuova — attiva su una
   * Position pubblicata. Se ci sono solo ritirate e posizioni chiuse, quella
   * frase afferma una lettura che non è mai avvenuta, e §27 la vieta
   * esplicitamente.
   */
  const historyTotal = firstPage?.filteredTotal ?? center.totalCount ?? 0;
  const operative = firstPage?.filteredOperative ?? null;
  const copy = emptyCopy({
    filtered,
    hasHistory: historyTotal > 0,
    historyIsInactiveOnly: operative === 0 && historyTotal > 0,
    tab,
  });

  /*
    §12 e screen 02: scorrendo «Tutte» restano visibili tab e riga filtro —
    la tavola mostra la stessa testata degli screen 01 e 04 con la lista già
    scorsa. Per questo tab e filtro stanno **fuori** dalla FlatList: come
    `ListHeaderComponent` scorrerebbero via insieme alle righe, e la tab
    attiva — che §31 chiede di annunciare sempre — sparirebbe dallo schermo.
  */
  const chrome = (
    <View style={styles.chrome}>
      {connection === "offline" ? <DashboardOfflineNotice /> : null}

      <TabBar
        active={tab}
        fill
        items={APPLICATIONS_TABS}
        onChange={changeTab}
        style={styles.tabs}
        testID="applications-tabs"
      />

      {/* §12: «Il controllo filtro è una riga semplice con icona/chevron.»
          Compare solo quando c'è davvero qualcosa fra cui scegliere. */}
      {options.length > 0 ? (
        <ApplicationsFilterRow
          label={filterSummary(filter, options)}
          onPress={() => {
            trackApplicationsEvent("applications_filter_opened", { tab });
            setSheetOpen(true);
          }}
        />
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
            /* §27, screen 15: l'errore è distinto dall'empty, e il retry è
               reale — non un refetch che mostra di nuovo lo stesso vuoto. */
            <DashboardGlobalError
              body={APPLICATIONS_COPY.listErrorBody}
              onRetry={() => {
                trackApplicationsEvent("applications_center_retry", { tab });
                void listQuery.refetch();
              }}
              title={APPLICATIONS_COPY.listErrorTitle}
            />
          ) : empty ? (
            /* screen 14 */
            <DashboardGlobalEmpty
              copy={{
                actionLabel: copy.actionLabel ?? "",
                body: copy.body,
                icon: "document-text-outline",
                title: copy.title,
              }}
              onAction={
                copy.actionLabel === null
                  ? null
                  : filtered
                    ? clearFilter
                    : () => changeTab("all")
              }
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
            onRefresh={() => void refresh()}
            refreshing={listQuery.isRefetching && rows.length > 0}
            tintColor={colors.textNeutralSoft}
          />
        }
        renderItem={({ index, item }) => (
          <ApplicationListRow
            onPress={() => openRow(item)}
            row={item}
            showDivider={index > 0}
          />
        )}
        testID="applications-list"
      />

      {listQuery.isFetchingNextPage ? (
        <AppText color="neutralMuted" style={styles.footer} variant="bodySm">
          Caricamento…
        </AppText>
      ) : null}

      <ApplicationsFilterSheet
        applied={filter}
        error={optionsQuery.isError}
        loading={optionsQuery.isLoading}
        onApply={applyFilter}
        onClose={() => setSheetOpen(false)}
        onRetry={() => void optionsQuery.refetch()}
        options={options}
        visible={sheetOpen}
      />
    </>,
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[20],
  },
  list: {
    paddingHorizontal: spacing[20],
  },
  chrome: {
    paddingHorizontal: spacing[20],
  },
  tabs: {
    marginTop: spacing[4],
  },
  footer: {
    paddingBottom: spacing[12],
    textAlign: "center",
  },
});
