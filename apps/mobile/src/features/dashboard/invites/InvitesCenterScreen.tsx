/**
 * Centro Inviti e richieste (DAS-REV-19, screen 01-03).
 *
 * Una sola pagina per i tre master: cambiano tab, filtro, permessi e stato
 * dei dati, non la struttura. Lo screen 03 è infatti «lo screen 01 con lo
 * sheet aperto», non una route nuova.
 *
 * Quattro query e quattro stati separati: intestazione, opzioni del filtro e
 * le due sezioni In attesa / Recenti. §13 chiede cursori e stati distinti —
 * «il caricamento dei Recenti non deve cancellare gli In attesa» — e §38 che
 * «un errore nella tab Richieste non cancelli gli Inviti già disponibili».
 *
 * La route vive nello Stack annidato della tab Dashboard, quindi la bottom
 * navigation resta visibile con Dashboard selezionata (§6).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
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
import { InviteListRow } from "./components/InviteListRow";
import { InviteScopeRow } from "./components/InviteScopeRow";
import { InviteScopeSheet } from "./components/InviteScopeSheet";
import { InvitesCenterHeader } from "./components/InvitesCenterHeader";
import { JOIN_LINKS_HREFS } from "../join-links/join-links-routes";
import { hasCapability } from "../dashboard-types";
import { isFeatureAvailable } from "../modules/dashboard-features";
import { trackInvitesEvent } from "./invites-analytics";
import { INVITES_QK } from "./invites-keys";

/**
 * DAS-REV-20 §6: l'ingresso ai Link di invito vive qui, non come terza
 * tab. Le due stringhe restano locali al punto d'uso: appartengono a quel
 * pack e non alla copy del Centro Inviti.
 */
const JOIN_LINKS_ENTRY_TITLE = "Link di invito";
const JOIN_LINKS_ENTRY_BODY =
  "Un link riutilizzabile per collegare più persone a una squadra.";
import {
  INVITES_COPY,
  INVITE_TABS,
  emptyCopy,
  filterSummary,
  listErrorCopy,
  retainAuthorizedTeams,
  sameFilter,
} from "./invites-presentation";
import { ROLE_LINK_HREFS } from "../../role-link/role-link-routes";
import { INVITES_HREFS, type InvitesOrigin } from "./invites-routes";
import {
  INVITES_PAGE_SIZE,
  InvitesAccessError,
  fetchInviteFilterTeams,
  fetchInvitesCenter,
  fetchInvitesPage,
} from "./invites-service";
import type {
  InviteRow,
  InvitesFilter,
  InvitesPage,
  InvitesSection,
  InvitesTab,
} from "./invites-types";

function parseTab(value: unknown): InvitesTab {
  return value === "received" ? "received" : "sent";
}

function parseOrigin(value: unknown): InvitesOrigin | null {
  return value === "dashboard" ||
    value === "deactivation" ||
    value === "roster" ||
    value === "structure" ||
    value === "team"
    ? value
    : null;
}

type ListItem =
  | { key: string; kind: "header"; title: string }
  | { key: string; kind: "row"; row: InviteRow };

export function InvitesCenterScreen() {
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

  /** §12: «Default Inviti inviati, salvo origine esplicitamente contestuale.» */
  const [tab, setTab] = useState<InvitesTab>(() => parseTab(params.tab));

  /**
   * §14: «La selezione resta passando tra le due tab. È scoped a
   * account/actor, Society e origine»: vive quindi qui, non in una
   * preferenza globale che seguirebbe l'utente in un'altra Società.
   */
  const [filter, setFilter] = useState<InvitesFilter>(() =>
    initialTeamId ? { kind: "teams", teamIds: [initialTeamId] } : { kind: "all" },
  );
  const [sheetOpen, setSheetOpen] = useState(false);

  // ── Intestazione ──────────────────────────────────────────────────────────

  const centerQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchInvitesCenter(clubId as string),
    queryKey: INVITES_QK.center(actorId, clubId ?? ""),
    // Un rifiuto autorizzativo non è un errore di rete da ritentare (§37).
    retry: (failureCount, error) =>
      !(error instanceof InvitesAccessError) && failureCount < 1,
    staleTime: STALE_MS.operational,
  });

  const loaded = centerQuery.data ?? null;

  const accessWindow = useAccessWindow({
    accessVerifiedAt: loaded?.accessVerifiedAt ?? null,
    isOrganizational: true,
  });

  // §36: payload, autorizzazione e sessione devono essere validi insieme.
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

  const teamsQuery = useQuery({
    enabled: !!clubId && !!actorId && !!center,
    queryFn: () => fetchInviteFilterTeams(clubId as string),
    queryKey: INVITES_QK.filterTeams(actorId, clubId ?? ""),
    staleTime: STALE_MS.management,
  });

  const teams = useMemo(() => teamsQuery.data ?? [], [teamsQuery.data]);

  /**
   * §14: «Nessuno scope si allarga se una squadra non è più disponibile:
   * rimuovere una restrizione non più autorizzata non deve passare
   * silenziosamente a Tutti gli ambiti.»
   *
   * Derivato e non messo in stato: «subito» significa durante il render, non
   * al prossimo effetto — un frame con la lista montata sul filtro revocato
   * mostrerebbe dati non più consentiti.
   */
  const reconciled = useMemo(() => {
    if (!teamsQuery.isSuccess) {
      return { filter, lost: false };
    }

    const { kept, lost } = retainAuthorizedTeams(filter, teams);

    if (!lost) {
      return { filter, lost: false };
    }

    return {
      filter: kept.length > 0 ? { kind: "teams" as const, teamIds: kept } : filter,
      /* Quando non resta nessuna squadra accessibile il filtro **non**
         diventa generale: §14 chiede una nuova scelta valida, e lo sheet è
         dove si fa. */
      lost: true,
    };
  }, [filter, teams, teamsQuery.isSuccess]);

  const activeFilter = reconciled.filter;
  const hasSelector = teams.length > 0;

  // ── Liste ─────────────────────────────────────────────────────────────────

  /**
   * Le due sezioni sono due query indipendenti, scritte per esteso e non
   * generate da un helper: §13 chiede cursori e stati separati, e un hook
   * condiviso li renderebbe due istanze della stessa cosa — comoda da
   * scrivere, impossibile da far fallire separatamente come §38 richiede.
   */
  const sectionOptions = (section: InvitesSection) => ({
    enabled: !!clubId && !!actorId && !!center,
    getNextPageParam: (lastPage: InvitesPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      fetchInvitesPage({
        clubId: clubId as string,
        cursor: pageParam,
        filter: activeFilter,
        limit: INVITES_PAGE_SIZE,
        section,
        tab,
      }),
    queryKey: INVITES_QK.list(actorId, clubId ?? "", tab, section, activeFilter),
    retry: (failureCount: number, error: Error) =>
      !(error instanceof InvitesAccessError) && failureCount < 1,
    staleTime: STALE_MS.operational,
  });

  const pendingQuery = useInfiniteQuery<
    InvitesPage,
    Error,
    InfiniteData<InvitesPage, string | null>,
    readonly unknown[],
    string | null
  >(sectionOptions("pending"));

  const recentQuery = useInfiniteQuery<
    InvitesPage,
    Error,
    InfiniteData<InvitesPage, string | null>,
    readonly unknown[],
    string | null
  >(sectionOptions("recent"));

  const pendingRows = useMemo(
    () => (pendingQuery.data?.pages ?? []).flatMap((page) => page.rows),
    [pendingQuery.data],
  );
  const recentRows = useMemo(
    () => (recentQuery.data?.pages ?? []).flatMap((page) => page.rows),
    [recentQuery.data],
  );

  const items = useMemo<ListItem[]>(() => {
    const result: ListItem[] = [];

    if (pendingRows.length > 0) {
      result.push({
        key: "header-pending",
        kind: "header",
        title: INVITES_COPY.pendingSection,
      });
      pendingRows.forEach((row) =>
        result.push({ key: `p-${row.id}`, kind: "row", row }),
      );
    }

    if (recentRows.length > 0) {
      result.push({
        key: "header-recent",
        kind: "header",
        title: INVITES_COPY.recentSection,
      });
      recentRows.forEach((row) =>
        result.push({ key: `r-${row.id}`, kind: "row", row }),
      );
    }

    return result;
  }, [pendingRows, recentRows]);

  useEffect(() => {
    if (centerQuery.isSuccess) {
      reportSuccess();
    }
  }, [centerQuery.isSuccess, reportSuccess]);

  useEffect(() => {
    if (centerQuery.error) {
      reportFailure(centerQuery.error);
      trackInvitesEvent("invites_center_load_failed", {
        reason:
          centerQuery.error instanceof InvitesAccessError
            ? centerQuery.error.code
            : "network",
      });
    }
  }, [centerQuery.error, reportFailure]);

  useFocusEffect(
    useCallback(() => {
      trackInvitesEvent("invites_center_view", { source: origin ?? "unknown" });
    }, [origin]),
  );

  /**
   * §35: il ritorno da composer e dettaglio riconcilia le proiezioni del
   * Centro mantenendo tab, filtro e scroll.
   */
  useFocusEffect(
    useCallback(() => {
      if (!actorId || !clubId) {
        return;
      }

      void queryClient.invalidateQueries({
        queryKey: INVITES_QK.center(actorId, clubId),
      });
      void queryClient.invalidateQueries({
        queryKey: ["society-invites-list", actorId, clubId],
      });
    }, [actorId, clubId, queryClient]),
  );

  const refresh = useCallback(async () => {
    await Promise.all([
      centerQuery.refetch(),
      teamsQuery.refetch(),
      pendingQuery.refetch(),
      recentQuery.refetch(),
    ]);
  }, [centerQuery, pendingQuery, recentQuery, teamsQuery]);

  const goBack = useCallback(() => {
    // §6: il back torna all'origine effettiva. Senza stack — un deep link —
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

  const openRow = useCallback(
    (row: InviteRow) => {
      trackInvitesEvent("invite_row_opened", { kind: row.kind, tab });

      /* DAS-REV-21 §20: stessa route, due letture. Il `kind` arriva dal
         backend e decide quale dominio risolve l'ID — una richiesta
         canonica e una riga storica non sono lo stesso oggetto. */
      router.push(
        (row.kind === "invite"
          ? INVITES_HREFS.sentDetail(row.id)
          : row.kind === "role_request"
            ? ROLE_LINK_HREFS.societyRequest(row.id)
            : INVITES_HREFS.requestDetail(row.id)) as never,
      );
    },
    [router, tab],
  );

  const startCompose = useCallback(() => {
    trackInvitesEvent("invite_compose_started", {
      filter: activeFilter.kind,
      source: "center",
    });

    router.push(
      INVITES_HREFS.composeSearch({
        /* §16: «Dal centro filtrato su più squadre non scegliere
           arbitrariamente la prima per un nuovo invito.» Una sola squadra
           selezionata è invece un contesto esplicito. */
        teamId:
          activeFilter.kind === "teams" && activeFilter.teamIds.length === 1
            ? activeFilter.teamIds[0]
            : undefined,
      }) as never,
    );
  }, [activeFilter, router]);

  const changeTab = useCallback(
    (next: InvitesTab) => {
      if (next === tab) {
        return;
      }

      trackInvitesEvent("invites_tab_changed", { tab: next });
      setTab(next);
    },
    [tab],
  );

  const applyFilter = useCallback(
    (next: InvitesFilter) => {
      setSheetOpen(false);

      if (sameFilter(next, activeFilter)) {
        return;
      }

      trackInvitesEvent("invites_filter_applied", {
        mode: next.kind,
        teams: next.kind === "teams" ? next.teamIds.length : 0,
      });
      setFilter(next);
    },
    [activeFilter],
  );

  const shell = (body: React.ReactNode) => (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.navWrap}>
        <InvitesCenterHeader
          isVerified={center?.clubIsVerified ?? false}
          logoUrl={center?.clubLogoUrl ?? null}
          name={center?.clubName ?? ""}
          onBack={goBack}
          title={INVITES_COPY.centerTitle}
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
   * §8: «Nascondi azioni non autorizzate senza placeholder o controlli
   * permanentemente disabled» e §38 vieta di presentare un 403 come elenco
   * vuoto. Senza nessuna delle due letture il Centro non si apre.
   */
  if (
    centerQuery.error instanceof InvitesAccessError &&
    centerQuery.error.code === "INVITES_CENTER_NOT_AUTHORIZED"
  ) {
    return shell(
      <DashboardGlobalEmpty
        copy={{
          actionLabel: "Torna alla Dashboard",
          body: "Chiedi alla società l'accesso a questa area.",
          icon: "lock-closed-outline",
          title: "Non hai accesso agli inviti della società.",
        }}
        onAction={() => router.replace("/(tabs)/dashboard" as never)}
      />,
    );
  }

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
          body={INVITES_COPY.offlineBody}
          onRetry={() => {
            trackInvitesEvent("invites_center_retry", { tab });
            void refresh();
          }}
        />,
      );
    }

    return shell(
      <DashboardGlobalError
        body="Riprova."
        onRetry={() => {
          trackInvitesEvent("invites_center_retry", { tab });
          void refresh();
        }}
        title={listErrorCopy(tab)}
      />,
    );
  }

  /* §12: una sola tab leggibile non diventa due. Il contratto resta a due
     tab; quella non autorizzata non viene offerta. */
  const visibleTabs = INVITE_TABS.filter((item) =>
    item.value === "sent" ? center.canViewSent : center.canViewRequests,
  );
  const activeTab: InvitesTab = visibleTabs.some((item) => item.value === tab)
    ? tab
    : (visibleTabs[0]?.value ?? "sent");

  const listFailed =
    Boolean(pendingQuery.error ?? recentQuery.error) && items.length === 0;
  const listLoading =
    (pendingQuery.isLoading || recentQuery.isLoading) && items.length === 0;
  const empty =
    !listLoading &&
    !listFailed &&
    items.length === 0 &&
    pendingQuery.isSuccess &&
    recentQuery.isSuccess;

  const copy = emptyCopy({
    filtered: activeFilter.kind === "teams",
    tab: activeTab,
  });

  /*
   * DAS-REV-20 §6: «La voce è presente solo quando il modulo è realmente
   * disponibile e consultabile.» La capability lato client decide se
   * **mostrare** l'ingresso; la destinazione rivalida comunque sul server,
   * dove vive l'autorizzazione vera.
   */
  const canViewJoinLinks =
    isFeatureAvailable("society_join_links") &&
    hasCapability(current, "join_links_view");

  const openJoinLinks = () => {
    router.push(
      JOIN_LINKS_HREFS.center({ from: "invites" }) as Parameters<
        typeof router.push
      >[0],
    );
  };

  const header = (
    <View>
      {connection === "offline" ? <DashboardOfflineNotice /> : null}

      {/* DAS-REV-20 §6: «Il Centro Inviti conserva le due tab Inviti
          inviati e Richieste ricevute: non aggiungere una terza tab di link
          e non mescolare le relative righe.» L'ingresso è quindi una riga di
          navigazione verso una destinazione dedicata, e compare solo quando
          il modulo è davvero disponibile e consultabile. */}
      {canViewJoinLinks ? (
        <Pressable
          accessibilityLabel={`${JOIN_LINKS_ENTRY_TITLE}. ${JOIN_LINKS_ENTRY_BODY}`}
          accessibilityRole="button"
          onPress={openJoinLinks}
          style={({ pressed }) => [
            styles.joinLinksRow,
            pressed ? styles.joinLinksPressed : null,
          ]}
          testID="invites-join-links"
        >
          <View style={styles.joinLinksText}>
            <AppText color="neutral" variant="titleSm">
              {JOIN_LINKS_ENTRY_TITLE}
            </AppText>
            <AppText color="neutralMuted" variant="bodySm">
              {JOIN_LINKS_ENTRY_BODY}
            </AppText>
          </View>

          <Ionicons
            color={colors.textNeutralSoft}
            name="chevron-forward"
            size={18}
          />
        </Pressable>
      ) : null}

      {/* §12: CTA primaria sotto il titolo, solo quando autorizzata. */}
      {center.canInvite ? (
        <Button
          fullWidth
          label={INVITES_COPY.invitePerson}
          onPress={startCompose}
          size="md"
          style={styles.headerCta}
          testID="invites-compose"
          variant="primary"
        />
      ) : null}

      <TabBar
        active={activeTab}
        fill
        items={visibleTabs}
        onChange={changeTab}
        style={styles.tabs}
        testID="invites-tabs"
      />

      {hasSelector || center.scopeLabel ? (
        <InviteScopeRow
          label={
            hasSelector
              ? filterSummary(activeFilter, teams)
              : (center.scopeLabel ?? INVITES_COPY.allScopes)
          }
          onPress={
            hasSelector
              ? () => {
                  trackInvitesEvent("invites_filter_opened", { tab: activeTab });
                  setSheetOpen(true);
                }
              : null
          }
        />
      ) : null}

      {reconciled.lost ? (
        <AppText
          accessibilityRole="alert"
          color="neutralMuted"
          style={styles.notice}
          variant="meta"
        >
          {INVITES_COPY.scopeChanged}
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
            isRetrying={pendingQuery.isRefetching || recentQuery.isRefetching}
            message={listErrorCopy(activeTab)}
            onRetry={() => {
              trackInvitesEvent("invites_center_retry", { tab: activeTab });
              void pendingQuery.refetch();
              void recentQuery.refetch();
            }}
          />
        </View>
      ) : null}

      {empty ? (
        <View style={styles.empty}>
          <DashboardGlobalEmpty
            copy={{
              actionLabel: INVITES_COPY.editFilter,
              body: copy.body,
              icon: "mail-outline",
              title: copy.title,
            }}
            onAction={
              activeFilter.kind === "teams" && hasSelector
                ? () => setSheetOpen(true)
                : null
            }
          />
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.navWrap}>
        <InvitesCenterHeader
          isVerified={center.clubIsVerified}
          logoUrl={center.clubLogoUrl}
          name={center.clubName}
          onBack={goBack}
          title={INVITES_COPY.centerTitle}
        />
      </View>

      <FlatList
        contentContainerStyle={[
          styles.content,
          { paddingBottom: spacing[32] + insets.bottom },
        ]}
        data={items}
        keyExtractor={(item) => item.key}
        ListFooterComponent={
          <ListFooter
            error={Boolean(recentQuery.error) && items.length > 0}
            loading={recentQuery.isFetchingNextPage}
            onRetry={() => void recentQuery.fetchNextPage()}
            visible={recentQuery.hasNextPage ?? false}
          />
        }
        ListHeaderComponent={header}
        onEndReached={() => {
          /* I Recenti si estendono per ultimi: finché la coda degli In
             attesa ha pagine, è quella a continuare. */
          if (pendingQuery.hasNextPage && !pendingQuery.isFetchingNextPage) {
            void pendingQuery.fetchNextPage();

            return;
          }

          if (recentQuery.hasNextPage && !recentQuery.isFetchingNextPage) {
            void recentQuery.fetchNextPage();
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
        renderItem={({ index, item }) =>
          item.kind === "header" ? (
            <AppText
              accessibilityRole="header"
              color="neutral"
              style={styles.sectionTitle}
              variant="metaStrong"
            >
              {item.title}
            </AppText>
          ) : (
            <InviteListRow
              onPress={() => openRow(item.row)}
              row={item.row}
              showDivider={items[index - 1]?.kind === "row"}
            />
          )
        }
        testID="invites-center-list"
      />

      <InviteScopeSheet
        error={Boolean(teamsQuery.error)}
        loading={teamsQuery.isLoading}
        onApply={applyFilter}
        onClose={() => setSheetOpen(false)}
        onRetry={() => void teamsQuery.refetch()}
        selected={activeFilter}
        teams={teams}
        visible={sheetOpen}
      />
    </View>
  );
}

/**
 * §13: l'errore della pagina successiva mantiene le pagine caricate e
 * propone un retry locale in fondo. Non un errore globale, non uno skeleton
 * eterno.
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
          message={INVITES_COPY.nextPageError}
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
      accessibilityLabel="Caricamento di altri risultati"
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
  joinLinksRow: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    marginBottom: spacing[12],
    minHeight: 44,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  joinLinksText: {
    flex: 1,
    gap: spacing[4],
  },
  joinLinksPressed: {
    opacity: 0.6,
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  navWrap: {
    paddingHorizontal: spacing[20],
  },
  content: {
    paddingHorizontal: spacing[20],
  },
  headerCta: {
    marginBottom: spacing[16],
  },
  tabs: {
    marginBottom: spacing[4],
  },
  notice: {
    paddingTop: spacing[8],
  },
  sectionTitle: {
    paddingBottom: spacing[6],
    paddingTop: spacing[20],
  },
  listLoading: {
    paddingTop: spacing[20],
  },
  listError: {
    paddingTop: spacing[20],
  },
  empty: {
    paddingTop: spacing[24],
  },
  footer: {
    paddingVertical: spacing[16],
  },
});
