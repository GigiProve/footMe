/**
 * Centro Provini, stage e open day (DAS-REV-28 §4, §10–§12, §24; screen 01,
 * 02, 03, 13, 14, 15, 16).
 *
 * Una sola lista verticale con tre sezioni nell'ordine fisso In programma,
 * Bozze, Storico (§10). Non tab: lo screen 02 è «continuazione dello stesso
 * Centro, non altra tab».
 *
 * Tre letture separate, una per sezione, ognuna con il proprio cursore
 * (§12: «pagine per sezione … non impedire di raggiungere Bozze/Storico
 * perché In programma continua all'infinito»). Le prime due sezioni
 * crescono con «Mostra altri eventi»; lo Storico, che chiude la lista,
 * carica anche allo scorrimento.
 *
 * La route vive nello Stack della tab Dashboard: bottom navigation visibile
 * con Dashboard selezionata (§4).
 */
import { useCallback, useEffect, useMemo } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import { useToast } from "../../../ui/Toast/ToastProvider";
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
import { PositionsCenterHeader } from "../positions/components/PositionsCenterHeader";
import { useAccessWindow } from "../state/use-access-window";
import { useDashboardConnection } from "../state/use-dashboard-connection";
import { SelectionEventRow } from "./components/SelectionEventRow";
import { EVENTS_COPY, SELECTION_EVENTS_MODULE_TITLE } from "./events-copy";
import { SELECTION_EVENTS_QK } from "./events-keys";
import {
  SECTION_TITLES,
  centerBodyState,
  rowsOf,
  uniqueRows,
  type SectionState,
} from "./events-presentation";
import { SELECTION_EVENTS_HREFS } from "./events-routes";
import {
  SECTION_PAGE_SIZE,
  SelectionEventsError,
  fetchSelectionEventsCenter,
  fetchSelectionEventsPage,
} from "./events-service";
import {
  EVENT_SECTIONS,
  type EventSection,
  type SelectionEventRow as Row,
  type SelectionEventsPage,
} from "./events-types";

type ListItem =
  | { key: string; kind: "section"; section: EventSection }
  | { key: string; kind: "row"; row: Row; section: EventSection; showDivider: boolean }
  | { key: string; kind: "more"; section: EventSection }
  | { key: string; kind: "sectionError"; section: EventSection };

const notAuthorized = (error: unknown) =>
  error instanceof SelectionEventsError && error.isAuthorization;

/** Una sezione del Centro: prima pagina più pagine successive (§12). */
function useSection(
  actorId: string,
  clubId: string | null,
  section: EventSection,
  enabled: boolean,
) {
  return useInfiniteQuery<
    SelectionEventsPage,
    Error,
    InfiniteData<SelectionEventsPage, string | null>,
    readonly unknown[],
    string | null
  >({
    enabled: enabled && !!clubId && !!actorId,
    getNextPageParam: (last) => (last.hasMore ? last.nextCursor : undefined),
    initialPageParam: null,
    queryFn: ({ pageParam }) =>
      fetchSelectionEventsPage({
        clubId: clubId as string,
        cursor: pageParam,
        limit: SECTION_PAGE_SIZE,
        section,
      }),
    queryKey: SELECTION_EVENTS_QK.section(actorId, clubId ?? "", section),
    retry: (count, error) => !notAuthorized(error) && count < 1,
    staleTime: STALE_MS.operational,
  });
}

export function SelectionEventsCenterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;
  const { connection, reportFailure, reportSuccess } = useDashboardConnection();

  // ── Intestazione e capability ─────────────────────────────────────────────

  const centerQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchSelectionEventsCenter(clubId as string),
    queryKey: SELECTION_EVENTS_QK.center(actorId, clubId ?? ""),
    retry: (count, error) => !notAuthorized(error) && count < 1,
    staleTime: STALE_MS.operational,
  });

  const loaded = centerQuery.data ?? null;
  const accessWindow = useAccessWindow({
    accessVerifiedAt: loaded?.accessVerifiedAt ?? null,
    isOrganizational: true,
  });

  /* §22: offline si leggono dati privati solo con un'autorizzazione cached
     ancora utilizzabile (15 minuti, DAS-REV-02). Oltre, niente dati. */
  const center = accessWindow.isValid ? loaded : null;

  useEffect(() => {
    if (!accessWindow.isValid && loaded && !centerQuery.isFetching) {
      void centerQuery.refetch();
    }
    // Solo la transizione di validità rivalida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessWindow.isValid]);

  const ready = !!center;
  const upcoming = useSection(actorId, clubId, "upcoming", ready);
  const drafts = useSection(actorId, clubId, "drafts", ready);
  const history = useSection(actorId, clubId, "history", ready);

  const queries = useMemo(
    () => ({ drafts, history, upcoming }),
    [drafts, history, upcoming],
  );

  const sectionStates = useMemo(() => {
    const state = (query: typeof upcoming): SectionState => ({
      error: Boolean(query.error) && !query.data,
      loaded: query.isSuccess || Boolean(query.data),
      pages: query.data?.pages ?? null,
    });

    return {
      drafts: state(drafts),
      history: state(history),
      upcoming: state(upcoming),
    } satisfies Record<EventSection, SectionState>;
  }, [drafts, history, upcoming]);

  const body = centerBodyState(sectionStates, EVENT_SECTIONS);

  /* §24: una revoca scoperta da una sezione rimuove tutto, non solo la
     sezione. Il Centro si richiede di nuovo e risponde con il rifiuto. */
  const sectionRevoked = [upcoming, drafts, history].some((query) =>
    notAuthorized(query.error),
  );

  useEffect(() => {
    if (sectionRevoked) {
      void queryClient.removeQueries({
        queryKey: ["selection-events-section", actorId, clubId ?? ""],
      });
      void centerQuery.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionRevoked]);

  useEffect(() => {
    if (centerQuery.isSuccess) {
      reportSuccess();
    }
  }, [centerQuery.isSuccess, reportSuccess]);

  useEffect(() => {
    if (centerQuery.error) {
      reportFailure(centerQuery.error);
    }
  }, [centerQuery.error, reportFailure]);

  /**
   * §22: il ritorno dal wizard riconcilia le sezioni. Salva bozza aggiorna
   * Bozze; Pubblica sposta lo stesso record in In programma. Si invalida
   * per prefisso dell'actor e della Società correnti, mai di altri.
   */
  useFocusEffect(
    useCallback(() => {
      if (!actorId || !clubId) {
        return;
      }

      void queryClient.invalidateQueries({
        queryKey: SELECTION_EVENTS_QK.center(actorId, clubId),
      });
      void queryClient.invalidateQueries({
        queryKey: ["selection-events-section", actorId, clubId],
      });
    }, [actorId, clubId, queryClient]),
  );

  /**
   * Pull-to-refresh rivaluta accesso, capability e sezioni (CC-14). Un
   * aggiornamento fallito con dati validi non li cancella: feedback leggero.
   */
  const refresh = useCallback(async () => {
    const results = await Promise.all([
      centerQuery.refetch(),
      upcoming.refetch(),
      drafts.refetch(),
      history.refetch(),
    ]);

    if (results.some((result) => result.isError) && results.some((result) => result.data)) {
      showToast({
        id: "selection-events-refresh-failed",
        message: EVENTS_COPY.refreshFailed,
        tone: "neutral",
      });
    }
  }, [centerQuery, drafts, history, showToast, upcoming]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();

      return;
    }

    router.replace("/(tabs)/dashboard" as never);
  }, [router]);

  const startCreate = useCallback(() => {
    router.push(SELECTION_EVENTS_HREFS.create() as never);
  }, [router]);

  /**
   * §23: le bozze riaprono il wizard con lo stesso ID. Gli eventi in
   * programma e storici aprono il dettaglio canonico **quando esisterà**:
   * fino ad allora la riga non è tappabile, invece di portare a un 404.
   */
  const openRow = useCallback(
    (row: Row, section: EventSection): (() => void) | null => {
      if (section === "drafts") {
        return row.canEdit
          ? () => {
              router.push(SELECTION_EVENTS_HREFS.draft(row.id) as never);
            }
          : null;
      }

      /* Gate `society_selection_event_detail` (dashboard-features): spento
         finché la 29–31 non costruisce il dettaglio. Quel pack aggiunge la
         destinazione a SELECTION_EVENTS_HREFS e la collega qui, sullo
         stesso ID. */
      return null;
    },
    [router],
  );

  const items = useMemo<ListItem[]>(() => {
    if (body.kind !== "ready") {
      return [];
    }

    return body.sections.flatMap<ListItem>((section) => {
      const state = sectionStates[section];
      const rows = uniqueRows(rowsOf(state));
      const query = queries[section];

      const list: ListItem[] = [{ key: `h-${section}`, kind: "section", section }];

      if (state.error) {
        list.push({ key: `e-${section}`, kind: "sectionError", section });
      }

      rows.forEach((row, index) =>
        list.push({
          key: row.id,
          kind: "row",
          row,
          section,
          showDivider: index > 0,
        }),
      );

      if (query.hasNextPage && section !== "history") {
        list.push({ key: `m-${section}`, kind: "more", section });
      }

      return list;
    });
  }, [body, queries, sectionStates]);

  const header = (
    <View style={styles.navWrap}>
      <PositionsCenterHeader
        isVerified={center?.clubIsVerified ?? false}
        logoUrl={center?.clubLogoUrl ?? null}
        name={center?.clubName ?? ""}
        onBack={goBack}
        title={SELECTION_EVENTS_MODULE_TITLE}
      />

      {/* Screen 02: titolo e supporting restano visibili mentre le sezioni
          scorrono — §4 «conserva app bar e contesto». */}
      <AppText color="neutralMuted" style={styles.supporting} variant="bodySm">
        {EVENTS_COPY.centerSupporting}
      </AppText>

      {/* Screen 16: il perimetro limitato si legge, ma solo con i nomi già
          autorizzati — mai un conteggio di ciò che sta fuori. */}
      {center?.scopeLabel ? (
        <AppText color="accent" style={styles.scope} testID="events-scope" variant="meta">
          {center.scopeLabel}
        </AppText>
      ) : null}
    </View>
  );

  const shell = (content: React.ReactNode) => (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {header}
      {content}
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

  /* CC-07: un modulo non autorizzato è assente, non un elenco vuoto. */
  if (notAuthorized(centerQuery.error)) {
    return shell(
      <DashboardGlobalEmpty
        copy={{
          actionLabel: "Torna alla Dashboard",
          body: EVENTS_COPY.notAuthorizedBody,
          icon: "lock-closed-outline",
          title: EVENTS_COPY.notAuthorizedTitle,
        }}
        onAction={() => router.replace("/(tabs)/dashboard" as never)}
      />,
    );
  }

  /* §24: «header/identity e skeleton righe. Niente pagina bianca.» */
  if (!center && centerQuery.isLoading) {
    return shell(
      <View style={styles.content}>
        <DashboardSkeleton />
      </View>,
    );
  }

  if (!center) {
    return shell(
      connection === "offline" ? (
        <DashboardGlobalOffline body={EVENTS_COPY.offlineBody} onRetry={() => void refresh()} />
      ) : (
        <DashboardGlobalError
          body={EVENTS_COPY.loadErrorBody}
          onRetry={() => void refresh()}
          title={EVENTS_COPY.loadError}
        />
      ),
    );
  }

  /* §7: CTA nascosta senza permesso o squadra utilizzabile, mai disabled.
     Nel vuoto sta nel corpo, non anche sopra (screen 03). */
  const emptyCta = body.kind === "empty" && center.canCreate;
  const headerCta = center.canCreate && body.kind === "ready";

  const listHeader = (
    <View>
      {connection === "offline" ? <DashboardOfflineNotice /> : null}

      {headerCta ? (
        <Button
          fullWidth
          label={`+ ${EVENTS_COPY.createEvent}`}
          onPress={startCreate}
          size="md"
          style={styles.headerCta}
          testID="events-create"
          variant="primary"
        />
      ) : null}

      {body.kind === "loading" ? <DashboardSkeleton /> : null}

      {body.kind === "error" ? (
        <View style={styles.state}>
          <DashboardGlobalError
            body={EVENTS_COPY.loadErrorBody}
            onRetry={() => void refresh()}
            title={EVENTS_COPY.loadError}
          />
        </View>
      ) : null}

      {body.kind === "empty" ? (
        <View style={styles.state}>
          <DashboardGlobalEmpty
            copy={{
              actionLabel: EVENTS_COPY.createEvent,
              body: EVENTS_COPY.emptyBody,
              icon: "calendar-outline",
              title: EVENTS_COPY.emptyTitle,
            }}
            onAction={emptyCta ? startCreate : null}
          />
        </View>
      ) : null}
    </View>
  );

  const currentYear = new Date().getFullYear();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {header}

      <FlatList
        contentContainerStyle={[
          styles.content,
          { paddingBottom: spacing[32] + insets.bottom },
        ]}
        data={items}
        keyExtractor={(item) => item.key}
        ListFooterComponent={
          history.isFetchingNextPage ? (
            <AppText color="neutralMuted" style={styles.footer} variant="meta">
              Caricamento…
            </AppText>
          ) : null
        }
        ListHeaderComponent={listHeader}
        onEndReached={() => {
          if (history.hasNextPage && !history.isFetchingNextPage) {
            void history.fetchNextPage();
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
        renderItem={({ item }) => {
          if (item.kind === "section") {
            return (
              <AppText
                accessibilityRole="header"
                color="neutral"
                style={styles.sectionTitle}
                testID={`events-section-${item.section}`}
                variant="titleSm"
              >
                {SECTION_TITLES[item.section]}
              </AppText>
            );
          }

          if (item.kind === "sectionError") {
            return (
              <DashboardModuleError
                isRetrying={queries[item.section].isRefetching}
                message={EVENTS_COPY.sectionError}
                onRetry={() => void queries[item.section].refetch()}
              />
            );
          }

          if (item.kind === "more") {
            const query = queries[item.section];

            return (
              <Button
                label={EVENTS_COPY.showMore}
                loading={query.isFetchingNextPage}
                onPress={() => void query.fetchNextPage()}
                size="sm"
                style={styles.more}
                testID={`events-more-${item.section}`}
                variant="neutralOutline"
              />
            );
          }

          return (
            <SelectionEventRow
              currentYear={currentYear}
              onPress={openRow(item.row, item.section)}
              row={item.row}
              section={item.section}
              showDivider={item.showDivider}
            />
          );
        }}
        testID="events-center-list"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing[20],
  },
  footer: {
    paddingTop: spacing[16],
  },
  headerCta: {
    marginBottom: spacing[8],
    marginTop: spacing[8],
  },
  more: {
    alignSelf: "flex-start",
    marginTop: spacing[8],
  },
  navWrap: {
    paddingHorizontal: spacing[20],
    paddingTop: spacing[8],
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  scope: {
    paddingTop: spacing[4],
  },
  sectionTitle: {
    paddingBottom: spacing[4],
    paddingTop: spacing[20],
  },
  state: {
    paddingTop: spacing[24],
  },
  supporting: {
    marginTop: -spacing[8],
    paddingBottom: spacing[4],
  },
});
