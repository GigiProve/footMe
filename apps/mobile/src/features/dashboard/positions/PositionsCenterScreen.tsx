/**
 * Centro Posizioni aperte (DAS-REV-15, screen 01-06).
 *
 * Una sola pagina per i sei master: cambiano tab, filtro, permessi e stato
 * dei dati, non la struttura. §33 descrive infatti sei condizioni della
 * stessa schermata — «È lo screen 01 con overlay aperto, non una nuova
 * route» — e costruirne sei avrebbe prodotto sei spaziature diverse.
 *
 * La route vive nello Stack annidato della tab Dashboard, quindi la bottom
 * navigation resta visibile con Dashboard selezionata (§5).
 *
 * Tre query separate e tre stati separati: intestazione, opzioni del filtro e
 * lista. §26 chiede che «un errore di opzioni non cambi il filtro già
 * applicato o cancelli la lista sottostante», e §23 che «un servizio count
 * lento non blocchi titolo, Team e navigazione già disponibili».
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
import { AppText, Button, TabBar } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { STALE_MS } from "../cache/freshness-policy";
import { DashboardModuleError } from "../components/DashboardSection";
import {
  DashboardGlobalEmpty,
  DashboardGlobalError,
  DashboardGlobalOffline,
  DashboardOfflineNotice,
  DashboardSkeleton,
} from "../components/DashboardStates";
import { useDashboardIdentity } from "../identity/use-dashboard-identity";
import { useAccessWindow } from "../state/use-access-window";
import { useDashboardConnection } from "../state/use-dashboard-connection";
import { PositionListRow } from "./components/PositionListRow";
import { PositionScopeRow } from "./components/PositionScopeRow";
import { PositionScopeSheet } from "./components/PositionScopeSheet";
import { PositionsCenterHeader } from "./components/PositionsCenterHeader";
import { trackPositionsEvent } from "./positions-analytics";
import { POSITIONS_QK } from "./positions-keys";
import {
  POSITIONS_COPY,
  POSITION_TABS,
  emptyCopy,
  filterIsAuthorized,
  sameFilter,
} from "./positions-presentation";
import { POSITIONS_HREFS, type PositionsOrigin } from "./positions-routes";
import {
  PositionsAccessError,
  POSITIONS_PAGE_SIZE,
  fetchPositionFilterOptions,
  fetchPositionsCenter,
  fetchPositionsPage,
} from "./positions-service";
import type {
  PositionFilter,
  PositionGroup,
  PositionRow,
  PositionsPage,
} from "./positions-types";

function parseGroup(value: unknown): PositionGroup {
  return value === "drafts" || value === "closed" ? value : "active";
}

function parseOrigin(value: unknown): PositionsOrigin | null {
  return value === "dashboard" ||
    value === "deactivation" ||
    value === "structure" ||
    value === "team"
    ? value
    : null;
}

export function PositionsCenterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;
  const { connection, reportFailure, reportSuccess } = useDashboardConnection();

  const params = useLocalSearchParams<{
    from?: string;
    tab?: string;
    teamId?: string;
  }>();
  const origin = parseOrigin(params.from);
  const initialTeamId =
    typeof params.teamId === "string" && params.teamId ? params.teamId : null;

  /**
   * §8: «Attive è il default degli ingressi generici. Un ingresso esplicito
   * valido può preimpostare una delle altre tab.» §5: l'ingresso dalla
   * disattivazione arriva «con Team e tab Attive».
   */
  const [group, setGroup] = useState<PositionGroup>(() => parseGroup(params.tab));

  /**
   * §15: «Conserva filtro e tab durante la sessione del Centro.» Lo stato
   * vive qui e non in una preferenza globale, che §15 vieta esplicitamente.
   *
   * Il Team preimpostato entra senza etichetta: il nome arriva dalle opzioni
   * autorizzate, non dal parametro — un deep link non deve poter stampare il
   * nome di una squadra fuori perimetro.
   */
  const [filter, setFilter] = useState<PositionFilter>(() =>
    initialTeamId
      ? { isInactive: false, kind: "team", label: "", teamId: initialTeamId }
      : { kind: "all" },
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  /**
   * Una scelta dell'utente non produce avvisi; questo flag copre il solo
   * caso in cui il perimetro cambia **sotto** una selezione ancora valida,
   * che la derivazione sotto non può osservare da sola.
   */
  const [scopeChanged, setScopeChanged] = useState(false);

  // ── Intestazione ──────────────────────────────────────────────────────────

  const centerQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchPositionsCenter(clubId as string),
    queryKey: POSITIONS_QK.center(actorId, clubId ?? ""),
    // Un rifiuto autorizzativo non è un errore di rete da ritentare (§26).
    retry: (failureCount, error) =>
      !(error instanceof PositionsAccessError) && failureCount < 1,
    staleTime: STALE_MS.operational,
  });

  const loaded = centerQuery.data ?? null;

  const accessWindow = useAccessWindow({
    accessVerifiedAt: loaded?.accessVerifiedAt ?? null,
    isOrganizational: true,
  });

  // §24: payload, autorizzazione e sessione devono essere validi insieme.
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

  const filtersQuery = useQuery({
    enabled: !!clubId && !!actorId && !!center,
    queryFn: () =>
      fetchPositionFilterOptions({ clubId: clubId as string, group }),
    queryKey: POSITIONS_QK.filters(actorId, clubId ?? "", group),
    staleTime: STALE_MS.management,
  });

  const options = useMemo(() => filtersQuery.data ?? [], [filtersQuery.data]);

  /**
   * §14: «Con un solo contesto effettivo usa testo in chiaro senza
   * dropdown.» Il selector esiste quando esistono almeno due contesti — un
   * Team più l'ambito SOCIETY ne sono due.
   */
  const hasSelector = options.length > 1;

  /**
   * Il Team preimpostato prende il nome reale appena le opzioni arrivano.
   *
   * Derivato, non messo in stato: il nome **non** viene da `?teamId=`, che
   * è un parametro di ingresso qualunque, ma dalle opzioni autorizzate. §15
   * vieta di «mantenere nomi riservati dietro il messaggio», e un deep link
   * verso una squadra fuori perimetro non deve poterne stampare il nome.
   */
  const namedFilter = useMemo<PositionFilter>(() => {
    if (filter.kind !== "team" || filter.label) {
      return filter;
    }

    const match = options.find(
      (option) => option.kind === "team" && option.teamId === filter.teamId,
    );

    return match && match.kind === "team"
      ? {
          isInactive: match.isInactive,
          kind: "team",
          label: match.label,
          teamId: match.teamId,
        }
      : filter;
  }, [filter, options]);

  /**
   * §15: «Se il filtro diventa non autorizzato per cambio scope o revoca,
   * rimuovi subito dati e opzioni non più accessibili … e informa in modo
   * discreto quando la selezione è cambiata.»
   *
   * «Subito» significa **durante il render**, non al prossimo effetto: un
   * passaggio in cui la lista è già montata con il filtro revocato
   * mostrerebbe per un frame dati non più consentiti. Per questo il perimetro
   * è derivato e non messo in stato — lo stato conserva la sola scelta
   * esplicita dell'utente, che è un'altra cosa.
   *
   * Un Team storico selezionato nelle Chiuse resta invece valido passando
   * alle Attive: non compare fra le opzioni operative, ma §15 vieta di
   * «cambiare silenziosamente il Team selezionato con Prima squadra». Il caso
   * è distinto da una revoca perché il Team è ancora un'opzione di
   * **un'altra** tab, e l'empty contestuale spiega perché la lista è vuota.
   */
  const historicContext =
    namedFilter.kind === "team" && group === "active";

  const filterRevoked =
    filtersQuery.isSuccess &&
    !historicContext &&
    !filterIsAuthorized(namedFilter, options);

  /* Memoizzato per identità, non per costo: due callback lo hanno fra le
     dipendenze e un nuovo oggetto a ogni render le ricreerebbe sempre. */
  const activeFilter = useMemo<PositionFilter>(
    () => (filterRevoked ? { kind: "all" } : namedFilter),
    [filterRevoked, namedFilter],
  );

  /** §15: feedback discreto, senza nominare ciò che non è più accessibile. */
  const scopeNotice = filterRevoked || scopeChanged;

  // ── Lista ─────────────────────────────────────────────────────────────────

  const listQuery = useInfiniteQuery<
    PositionsPage,
    Error,
    InfiniteData<PositionsPage, string | null>,
    readonly unknown[],
    string | null
  >({
    enabled: !!clubId && !!actorId && !!center,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      fetchPositionsPage({
        clubId: clubId as string,
        cursor: pageParam,
        filter: activeFilter,
        group,
        limit: POSITIONS_PAGE_SIZE,
      }),
    queryKey: POSITIONS_QK.list(actorId, clubId ?? "", group, activeFilter),
    retry: (failureCount, error) =>
      !(error instanceof PositionsAccessError) && failureCount < 1,
    staleTime: STALE_MS.operational,
  });

  const rows: PositionRow[] = useMemo(
    () =>
      (listQuery.data?.pages ?? []).flatMap(
        (page: PositionsPage) => page.rows,
      ),
    [listQuery.data],
  );

  useEffect(() => {
    if (centerQuery.isSuccess) {
      reportSuccess();
    }
  }, [centerQuery.isSuccess, reportSuccess]);

  useEffect(() => {
    if (centerQuery.error) {
      reportFailure(centerQuery.error);
      trackPositionsEvent("positions_center_load_failed", {
        reason:
          centerQuery.error instanceof PositionsAccessError
            ? centerQuery.error.code
            : "network",
      });
    }
  }, [centerQuery.error, reportFailure]);

  useFocusEffect(
    useCallback(() => {
      trackPositionsEvent("positions_center_view", {
        source: origin ?? "unknown",
      });
    }, [origin]),
  );

  /**
   * §21: «Pull-to-refresh … rivalida accesso, capability, scope, opzioni del
   * filtro, lista, lifecycle e aggregati. Non aggiornare soltanto i numeri.»
   */
  const refresh = useCallback(async () => {
    trackPositionsEvent("positions_center_refresh", { tab: group });

    await Promise.all([
      centerQuery.refetch(),
      filtersQuery.refetch(),
      listQuery.refetch(),
    ]);
  }, [centerQuery, filtersQuery, group, listQuery]);

  /**
   * §28: «Un completamento confermato nelle destinazioni non può essere
   * annullato da una response vecchia.» Il ritorno da composer e dettaglio
   * riconcilia le proiezioni del Centro, mantenendo tab, filtro e scroll.
   */
  useFocusEffect(
    useCallback(() => {
      if (!actorId || !clubId) {
        return;
      }

      void queryClient.invalidateQueries({
        queryKey: POSITIONS_QK.center(actorId, clubId),
      });
      void queryClient.invalidateQueries({
        queryKey: ["society-positions-list", actorId, clubId],
      });
    }, [actorId, clubId, queryClient]),
  );

  const goBack = useCallback(() => {
    // §5: il back torna all'origine effettiva. Senza stack — un deep link —
    // si rientra nella Dashboard autorizzata, non in Home.
    if (router.canGoBack()) {
      router.back();

      return;
    }

    router.replace(
      (origin === "structure"
        ? "/(tabs)/dashboard/structure"
        : "/(tabs)/dashboard") as never,
    );
  }, [origin, router]);

  const openPosition = useCallback(
    (row: PositionRow) => {
      trackPositionsEvent(
        group === "drafts" ? "position_draft_resumed" : "position_opened_from_center",
        { tab: group },
      );

      router.push(POSITIONS_HREFS.detail(row.id) as never);
    },
    [group, router],
  );

  const startCreate = useCallback(() => {
    trackPositionsEvent("position_create_started", {
      filter: activeFilter.kind,
      tab: group,
    });

    router.push(
      POSITIONS_HREFS.compose(
        activeFilter.kind === "team"
          ? { scope: "team", teamId: activeFilter.teamId }
          : activeFilter.kind === "society"
            ? { scope: "society" }
            : {},
      ) as never,
    );
  }, [activeFilter, group, router]);

  const changeGroup = useCallback(
    (next: PositionGroup) => {
      if (next === group) {
        return;
      }

      trackPositionsEvent("positions_tab_changed", { tab: next });
      setGroup(next);
      setScopeChanged(false);
    },
    [group],
  );

  const chooseFilter = useCallback(
    (next: PositionFilter) => {
      setSheetOpen(false);
      setScopeChanged(false);

      if (sameFilter(next, activeFilter)) {
        return;
      }

      trackPositionsEvent("positions_team_filter_changed", {
        filter: next.kind,
        tab: group,
      });
      setFilter(next);
    },
    [activeFilter, group],
  );

  /**
   * Testata nota anche prima dei dati: back e titolo esistono sempre, il
   * nome della Società solo quando è già legittimamente noto. §25 vieta di
   * mostrare «dati o nomi dimostrativi» prima di conoscere l'accesso.
   */
  const shell = (body: React.ReactNode) => (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.navWrap}>
        <PositionsCenterHeader
          isVerified={center?.clubIsVerified ?? false}
          logoUrl={center?.clubLogoUrl ?? null}
          name={center?.clubName ?? ""}
          onBack={goBack}
          title={POSITIONS_COPY.centerTitle}
        />
      </View>
      {body}
    </View>
  );

  if (!clubId) {
    return shell(
      <DashboardGlobalEmpty
        copy={{
          actionLabel: "Torna alla Dashboard",
          body: "Seleziona la società da amministrare.",
          icon: "business-outline",
          title: "Nessuna società selezionata",
        }}
        onAction={() => router.replace("/(tabs)/dashboard" as never)}
      />,
    );
  }

  /**
   * §8: «non introdurre un pulsante bloccato o presentare un 403 come elenco
   * vuoto». Senza lettura Posizioni il Centro non si apre affatto.
   */
  if (
    centerQuery.error instanceof PositionsAccessError &&
    centerQuery.error.code === "POSITIONS_CENTER_NOT_AUTHORIZED"
  ) {
    return shell(
      <DashboardGlobalEmpty
        copy={{
          actionLabel: "Torna alla Dashboard",
          body: "Chiedi alla società l'accesso a questa area.",
          icon: "lock-closed-outline",
          title: "Non hai accesso alle posizioni della società.",
        }}
        onAction={() => router.replace("/(tabs)/dashboard" as never)}
      />,
    );
  }

  // §25: shell, Society nota, titolo e skeleton. Mai una pagina bianca con
  // uno spinner centrale, mai dati dimostrativi prima di conoscere l'accesso.
  if (centerQuery.isLoading && !center) {
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
          body={POSITIONS_COPY.offlineBody}
          onRetry={() => {
            trackPositionsEvent("positions_center_retry", { tab: group });
            void refresh();
          }}
        />,
      );
    }

    return shell(
      <DashboardGlobalError
        body={POSITIONS_COPY.retry}
        onRetry={() => {
          trackPositionsEvent("positions_center_retry", { tab: group });
          void refresh();
        }}
        title={POSITIONS_COPY.listError}
      />,
    );
  }

  const listFailed = Boolean(listQuery.error) && rows.length === 0;
  const listLoading = listQuery.isLoading && rows.length === 0;
  const empty =
    !listLoading && !listFailed && rows.length === 0 && listQuery.isSuccess;

  /**
   * §7, §27: la primaria sta sotto il titolo e prima delle tab — ma nel vuoto
   * Attive si sposta **dentro** il corpo, e «non duplicarla anche
   * nell'header». Una sola istanza, decisa qui.
   */
  const emptyCta = empty && group === "active" && center.canCreate;
  const headerCta = center.canCreate && !emptyCta;

  const copy = emptyCopy({
    canCreate: center.canCreate,
    filter: activeFilter,
    group,
  });

  const header = (
    <View>
      {connection === "offline" ? <DashboardOfflineNotice /> : null}

      {headerCta ? (
        <Button
          fullWidth
          label={POSITIONS_COPY.newPosition}
          onPress={startCreate}
          size="md"
          style={styles.headerCta}
          testID="positions-new-header"
          variant="primary"
        />
      ) : null}

      {/* §6: tab mai pillole. Testo nero e sottolineatura nera quando
          selezionate, grigio quando no. */}
      <TabBar
        active={group}
        items={POSITION_TABS}
        onChange={changeGroup}
        style={styles.tabs}
        testID="positions-tabs"
        tone="neutral"
      />

      {options.length > 0 || filtersQuery.isSuccess ? (
        <PositionScopeRow
          filter={activeFilter}
          onPress={
            hasSelector
              ? () => {
                  trackPositionsEvent("positions_team_filter_opened", {
                    tab: group,
                  });
                  setSheetOpen(true);
                }
              : null
          }
          readOnly={!center.canCreate}
          staticLabel={
            options.length === 0
              ? center.scopeLabel
                ? `Ambito: ${center.scopeLabel}`
                : null
              : undefined
          }
        />
      ) : null}

      {scopeNotice ? (
        <AppText
          accessibilityRole="alert"
          color="neutralMuted"
          style={styles.notice}
          variant="meta"
        >
          {POSITIONS_COPY.scopeChanged}
        </AppText>
      ) : null}

      {listLoading ? (
        <View style={styles.listLoading}>
          <DashboardSkeleton />
        </View>
      ) : null}

      {listFailed ? (
        <View style={styles.listError}>
          <DashboardModuleError
            isRetrying={listQuery.isRefetching}
            message={POSITIONS_COPY.listError}
            onRetry={() => {
              trackPositionsEvent("positions_center_retry", { tab: group });
              void listQuery.refetch();
            }}
          />
        </View>
      ) : null}

      {empty ? (
        <View style={styles.empty}>
          <DashboardGlobalEmpty
            copy={{
              actionLabel: POSITIONS_COPY.newPosition,
              body: copy.body ?? "",
              icon: "briefcase-outline",
              title: copy.title,
            }}
            onAction={emptyCta ? startCreate : null}
          />

          {/* §15: un filtro storico senza risultati può essere rimosso, ma
              solo se l'actor ha davvero un perimetro più ampio. */}
          {activeFilter.kind !== "all" && hasSelector ? (
            <Button
              label={POSITIONS_COPY.showAll}
              onPress={() => chooseFilter({ kind: "all" })}
              size="sm"
              style={styles.showAll}
              testID="positions-show-all"
              variant="neutralOutline"
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.navWrap}>
        <PositionsCenterHeader
          isVerified={center.clubIsVerified}
          logoUrl={center.clubLogoUrl}
          name={center.clubName}
          onBack={goBack}
          title={POSITIONS_COPY.centerTitle}
        />
      </View>

      <FlatList
        contentContainerStyle={[
          styles.content,
          { paddingBottom: spacing[32] + insets.bottom },
        ]}
        data={rows}
        keyExtractor={(row) => row.id}
        ListFooterComponent={
          <>
            {/* §13: helper descrittivo dello storico, non un link né una
                promessa di accesso senza permessi. Nel master 04 chiude la
                lista, non la precede. */}
            {group === "closed" && rows.length > 0 ? (
              <AppText
                color="neutralMuted"
                style={styles.historyHelper}
                variant="meta"
              >
                {POSITIONS_COPY.historyHelper}
              </AppText>
            ) : null}

            <ListFooter
              error={Boolean(listQuery.error) && rows.length > 0}
              loading={listQuery.isFetchingNextPage}
              onRetry={() => void listQuery.fetchNextPage()}
              visible={listQuery.hasNextPage ?? false}
            />
          </>
        }
        ListHeaderComponent={header}
        onEndReached={() => {
          if (listQuery.hasNextPage && !listQuery.isFetchingNextPage) {
            void listQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            onRefresh={() => void refresh()}
            refreshing={centerQuery.isRefetching}
            tintColor={colors.textNeutralMuted}
          />
        }
        renderItem={({ index, item }) => (
          <PositionListRow
            group={group}
            onPress={() => openPosition(item)}
            row={item}
            showDivider={index > 0}
          />
        )}
        testID="positions-center-list"
      />

      <PositionScopeSheet
        error={Boolean(filtersQuery.error)}
        loading={filtersQuery.isLoading}
        onClose={() => setSheetOpen(false)}
        onRetry={() => void filtersQuery.refetch()}
        onSelect={chooseFilter}
        options={options}
        selected={activeFilter}
        visible={sheetOpen}
      />
    </View>
  );
}

/**
 * §16: «L'errore di pagina successiva mantiene le pagine caricate e propone
 * un retry locale in fondo.» Non un errore globale, non uno skeleton eterno.
 */
function ListFooter({
  error,
  loading,
  onRetry,
  visible,
}: {
  error: boolean;
  loading: boolean;
  onRetry: () => void;
  visible: boolean;
}) {
  if (error) {
    return (
      <View style={styles.footer}>
        <DashboardModuleError
          isRetrying={loading}
          message={POSITIONS_COPY.nextPageError}
          onRetry={onRetry}
        />
      </View>
    );
  }

  if (!visible || !loading) {
    return null;
  }

  return (
    <View
      accessibilityLabel="Caricamento di altre posizioni"
      accessibilityRole="progressbar"
      style={styles.footer}
    >
      <AppText color="neutralMuted" variant="meta">
        Caricamento…
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  navWrap: {
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[8],
  },
  content: {
    paddingHorizontal: spacing[20],
  },
  headerCta: {
    marginBottom: spacing[16],
  },
  tabs: {
    marginHorizontal: -spacing[20],
  },
  notice: {
    paddingTop: spacing[10],
  },
  historyHelper: {
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: 1,
    paddingTop: spacing[12],
  },
  listLoading: {
    paddingTop: spacing[16],
  },
  listError: {
    paddingTop: spacing[16],
  },
  empty: {
    alignItems: "center",
    gap: spacing[12],
    paddingTop: spacing[16],
  },
  showAll: {
    minWidth: 200,
  },
  footer: {
    paddingTop: spacing[16],
  },
});
