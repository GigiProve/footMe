/**
 * Pool di una Position (DAS-REV-25 §12, §13, §14 — screen 02, 04, 11, 13, 16).
 *
 * La 24 aveva consegnato qui una vista base deliberatamente minima. §3 della
 * 25 la completa: filtri, conteggi reali, paginazione, e il tap di riga che
 * porta alla scheda interna invece che al profilo pubblico.
 *
 * Quattro superfici e non quattro schermate (§5): lista, lista filtrata,
 * vuoto reale e vuoto filtrato sono stati dello stesso componente, e quale
 * mostrare lo decide `poolPresentation`, non un `if` qui dentro — §28 vuole
 * che vuoto reale e vuoto filtrato restino **distinti**, ed è l'errore più
 * facile da commettere con un solo `rows.length === 0`.
 *
 * «Posizione chiusa» è un metadato neutro accanto al conteggio, non un
 * blocco: §23 — «Position CLOSED | Entry conservate e azioni autorizzate
 * ancora disponibili» (screen 13).
 *
 * I due conteggi arrivano dal server: §14 — «Questi numeri non sono il
 * conteggio del batch già caricato.»
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { STALE_MS } from "../cache/freshness-policy";
import {
  DashboardGlobalEmpty,
  DashboardGlobalError,
  DashboardGlobalOffline,
} from "../components/DashboardStates";
import { SocietyContextHeader } from "../components/SocietyContextHeader";
import { useDashboardIdentity } from "../identity/use-dashboard-identity";
import { useDashboardConnection } from "../state/use-dashboard-connection";
import { ShortlistFilterControl } from "./components/ShortlistFilterControl";
import { ShortlistFilterSheet } from "./components/ShortlistFilterSheet";
import { ShortlistPoolRowView } from "./components/ShortlistPoolRow";
import { ShortlistSectionSkeleton } from "./components/ShortlistSection";
import { SHORTLIST_QK } from "./shortlist-keys";
import {
  EMPTY_FILTERS,
  SHORTLIST_COPY,
  filtersAreActive,
  filtersKey,
  poolCountLabel,
  poolPresentation,
} from "./shortlist-presentation";
import { SHORTLIST_HREFS } from "./shortlist-routes";
import { fetchShortlistContext, fetchShortlistPoolPage } from "./shortlist-service";
import {
  ShortlistError,
  type ShortlistFilters,
  type ShortlistPoolPage,
} from "./shortlist-types";

const DOUBLE_TAP_MS = 600;

type Props = {
  /** Una delle due: il centro passa la Position, un deep link la lista. */
  positionId?: string;
  shortlistId?: string;
};

export function PositionShortlistScreen({ positionId, shortlistId }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;
  const { connection } = useDashboardConnection();
  const params = useLocalSearchParams<{ focus?: string }>();
  const focusEntryId = typeof params.focus === "string" ? params.focus : null;

  /* §13: i filtri **applicati**. Il draft vive nello sheet, e una chiusura
     senza Applica non li tocca. */
  const [filters, setFilters] = useState<ShortlistFilters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);

  /* §24: «Se il pool visitato in precedenza aveva filtri che escludono
     quella persona, questa apertura contestuale parte senza restrizioni.»
     L'apertura con `focus` è quella di Vedi nella shortlist. */
  useEffect(() => {
    if (focusEntryId) {
      setFilters(EMPTY_FILTERS);
    }
  }, [focusEntryId]);

  const ref = positionId
    ? ({ positionId } as const)
    : ({ shortlistId: shortlistId ?? "" } as const);
  const refKey = positionId ?? shortlistId ?? "";

  const contextQuery = useQuery({
    enabled: !!actorId && !!refKey,
    queryFn: () => fetchShortlistContext(ref),
    queryKey: SHORTLIST_QK.context(actorId, refKey),
    retry: (failureCount, error) =>
      !(error instanceof ShortlistError && error.kind !== "network") &&
      failureCount < 1,
    staleTime: STALE_MS.operational,
  });

  const context = contextQuery.data ?? null;
  const listId = context?.shortlistId ?? null;
  const appliedKey = filtersKey(filters);

  /**
   * §14: paginazione server-side con cursore. La chiave di cache porta i
   * filtri **normalizzati**, quindi due selezioni equivalenti condividono
   * una pagina sola; e «Dopo applicazione azzera il cursore della lista»
   * viene gratis, perché cambiando chiave cambia la query.
   */
  const poolQuery = useInfiniteQuery<
    ShortlistPoolPage,
    Error,
    { pageParams: (string | null)[]; pages: ShortlistPoolPage[] },
    readonly unknown[],
    string | null
  >({
    enabled: !!listId,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null,
    queryFn: ({ pageParam }) =>
      fetchShortlistPoolPage(listId as string, filters, pageParam),
    queryKey: SHORTLIST_QK.pool(actorId, listId ?? "", appliedKey),
    retry: (failureCount, error) =>
      !(error instanceof ShortlistError && error.kind !== "network") &&
      failureCount < 1,
    staleTime: STALE_MS.operational,
  });

  const pages = poolQuery.data?.pages ?? [];
  const head = pages[0] ?? null;
  const rows = pages.flatMap((page) => page.rows);

  /**
   * §24: «Raggiungere la entry tramite cursore/ancora autorizzata o lookup
   * paginato compatibile: non scaricare l'intera lista e non alterare
   * l'ordinamento.»
   *
   * Si avanza di una pagina per volta finché la persona non compare o le
   * pagine finiscono — nello stesso ordine di sempre, con gli stessi
   * cursori autorizzati. Niente salto, niente lista intera.
   */
  const focusReached =
    !focusEntryId || rows.some((row) => row.entryId === focusEntryId);

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = poolQuery;

  useEffect(() => {
    if (!focusReached && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, focusReached, hasNextPage, isFetchingNextPage]);

  const lastPushRef = useRef<{ at: number; href: string } | null>(null);

  const go = useCallback(
    (href: string) => {
      const now = Date.now();
      const last = lastPushRef.current;

      if (last && last.href === href && now - last.at < DOUBLE_TAP_MS) {
        return;
      }

      lastPushRef.current = { at: now, href };
      router.push(href as never);
    },
    [router],
  );

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: SHORTLIST_QK.context(actorId, refKey),
      }),
      queryClient.invalidateQueries({
        queryKey: SHORTLIST_QK.pool(actorId, listId ?? "", appliedKey),
      }),
    ]);
  }, [actorId, appliedKey, listId, queryClient, refKey]);

  const header = (title: string | null) => (
    <SocietyContextHeader
      isVerified={current?.isVerified ?? false}
      logoUrl={current?.avatarUrl ?? null}
      name={current?.name ?? ""}
      onBack={() => router.back()}
      title={title}
    />
  );

  const shell = (children: React.ReactNode) => (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {header(SHORTLIST_COPY.title)}
      {children}
    </View>
  );

  if (!clubId) {
    return shell(
      <DashboardGlobalEmpty
        copy={{
          actionLabel: SHORTLIST_COPY.backToDashboard,
          body: SHORTLIST_COPY.unavailableBody,
          icon: "lock-closed-outline",
          title: SHORTLIST_COPY.unavailableTitle,
        }}
        onAction={() => router.replace("/(tabs)/dashboard")}
      />,
    );
  }

  if (contextQuery.error instanceof ShortlistError &&
      contextQuery.error.kind !== "network") {
    /* §9: la bozza senza perimetro ha un rimedio proprio — completare il
       contesto nel flusso Position — quindi non si confonde con «non
       disponibile». */
    const scopeUndefined = contextQuery.error.kind === "scopeUndefined";

    return shell(
      <DashboardGlobalEmpty
        copy={{
          actionLabel: SHORTLIST_COPY.backToDashboard,
          body: scopeUndefined
            ? SHORTLIST_COPY.scopeUndefinedBody
            : SHORTLIST_COPY.unavailableBody,
          icon: scopeUndefined ? "alert-circle-outline" : "lock-closed-outline",
          title: scopeUndefined
            ? SHORTLIST_COPY.scopeUndefinedTitle
            : SHORTLIST_COPY.unavailableTitle,
        }}
        onAction={() => router.back()}
      />,
    );
  }

  if (contextQuery.isError) {
    return shell(
      <DashboardGlobalError
        body={SHORTLIST_COPY.errorBody}
        onRetry={() => void refresh()}
        title={SHORTLIST_COPY.poolErrorTitle}
      />,
    );
  }

  if (!context) {
    /* §28: offline senza dati utilizzabili è uno stato proprio, non un
       empty operativo. La query resta in pausa e non va in errore. */
    if (connection === "offline") {
      return shell(
        <DashboardGlobalOffline
          body={SHORTLIST_COPY.poolOfflineBody}
          onRetry={() => void refresh()}
        />,
      );
    }

    return shell(
      <View style={styles.content}>
        <ShortlistSectionSkeleton rows={4} />
      </View>,
    );
  }

  /* §14: il totale è quello del server. Finché la prima pagina non è
     arrivata resta quello del contesto, che è la stessa count. */
  const total = head?.total ?? context.profilesCount;
  const filtersApplied = head?.filtersApplied ?? filtersAreActive(filters);
  const filtered = head?.filtered ?? total;
  const surface = poolPresentation({
    filtersApplied,
    rowCount: rows.length,
    total,
  });

  const contextLine = [context.title, context.scopeLabel]
    .filter((part): part is string => !!part && part.length > 0)
    .join(" · ");

  /* §9 e §10 della 24: metadati neutri, uno per volta. Una bozza non è
     chiusa, e la Position non può essere entrambe. */
  const lifecycleLabel = context.isClosed
    ? SHORTLIST_COPY.positionClosed
    : context.isDraft
      ? SHORTLIST_COPY.draftLabel
      : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {header(SHORTLIST_COPY.title)}

      <View style={styles.context} testID="shortlist-pool-context">
        <AppText color="neutral" variant="bodySm">
          {contextLine}
        </AppText>

        {lifecycleLabel ? (
          <AppText color="neutralMuted" variant="meta">
            {lifecycleLabel}
          </AppText>
        ) : null}

        <View style={styles.countRow}>
          <AppText
            accessibilityLiveRegion="polite"
            color="neutral"
            style={styles.count}
            testID="shortlist-pool-count"
            variant="bodySm"
          >
            {poolCountLabel({ filtered, filtersApplied, total })}
          </AppText>

          {/* §28: «Nascondi il filtro non utile nel viewport vuoto senza
              convertirne lo stato memorizzato in una cancellazione delle
              preferenze.» Lo stato resta in `filters`: se arrivano entry,
              il controllo torna con la selezione di prima. */}
          {total > 0 ? (
            <ShortlistFilterControl
              active={filtersApplied}
              onPress={() => setFilterOpen(true)}
            />
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: spacing[32] + insets.bottom },
        ]}
        onMomentumScrollEnd={(event) => {
          const { contentOffset, contentSize, layoutMeasurement } =
            event.nativeEvent;

          if (
            poolQuery.hasNextPage &&
            !poolQuery.isFetchingNextPage &&
            contentOffset.y + layoutMeasurement.height >=
              contentSize.height - 120
          ) {
            void poolQuery.fetchNextPage();
          }
        }}
        refreshControl={
          <RefreshControl
            onRefresh={() => void refresh()}
            refreshing={poolQuery.isRefetching}
            tintColor={colors.textNeutralMuted}
          />
        }
        testID="shortlist-pool-scroll"
      >
        {poolQuery.isLoading && rows.length === 0 ? (
          <ShortlistSectionSkeleton rows={3} />
        ) : null}

        {/* §28: «Errore caricamento pool: Impossibile caricare la shortlist
            / Riprova.» Locale al dominio, non un reload della Dashboard. */}
        {poolQuery.isError ? (
          <DashboardGlobalError
            body={SHORTLIST_COPY.errorBody}
            onRetry={() => void poolQuery.refetch()}
            title={SHORTLIST_COPY.poolErrorTitle}
          />
        ) : null}

        {!poolQuery.isLoading && !poolQuery.isError && surface === "empty" ? (
          /* §28: «Vuoto reale, dopo una lettura valida con totale 0.»
             Nessun Crea shortlist, nessun Cerca profili. */
          <View style={styles.empty} testID="shortlist-pool-empty">
            <Ionicons
              color={colors.textNeutralSoft}
              name="star-outline"
              size={40}
            />

            <AppText color="neutral" variant="titleSm">
              {SHORTLIST_COPY.poolEmptyTitle}
            </AppText>

            <AppText color="neutralMuted" variant="bodySm">
              {SHORTLIST_COPY.poolEmptyBody}
            </AppText>
          </View>
        ) : null}

        {!poolQuery.isLoading &&
        !poolQuery.isError &&
        surface === "filteredEmpty" ? (
          /* §13: «La CTA Azzera filtri nello stato senza risultati agisce
             invece subito sui filtri applicati e ricarica l'elenco
             completo.» */
          <View style={styles.empty} testID="shortlist-pool-filtered-empty">
            <Ionicons
              color={colors.textNeutralSoft}
              name="star-outline"
              size={40}
            />

            <AppText color="neutral" variant="titleSm">
              {SHORTLIST_COPY.poolFilteredEmptyTitle}
            </AppText>

            <AppText color="neutralMuted" variant="bodySm">
              {SHORTLIST_COPY.poolFilteredEmptyBody}
            </AppText>

            <Button
              fullWidth
              label={SHORTLIST_COPY.filterClear}
              onPress={() => setFilters(EMPTY_FILTERS)}
              size="lg"
              testID="shortlist-pool-clear-filters"
              variant="primary"
            />
          </View>
        ) : null}

        {rows.map((row, index) => (
          <ShortlistPoolRowView
            focused={focusEntryId === row.entryId}
            key={row.entryId}
            onPress={() => go(SHORTLIST_HREFS.entry(row.entryId))}
            row={row}
            showDivider={index > 0}
          />
        ))}

        {poolQuery.isFetchingNextPage ? (
          <ShortlistSectionSkeleton rows={1} />
        ) : null}
      </ScrollView>

      <ShortlistFilterSheet
        applied={filters}
        onApply={(next) => {
          setFilters(next);
          setFilterOpen(false);
        }}
        onClose={() => setFilterOpen(false)}
        visible={filterOpen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    flex: 1,
    paddingHorizontal: spacing[20],
  },
  context: {
    gap: spacing[4],
    paddingBottom: spacing[8],
  },
  countRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    paddingTop: spacing[4],
  },
  count: {
    flex: 1,
  },
  content: {
    gap: 0,
  },
  empty: {
    alignItems: "center",
    gap: spacing[8],
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[40],
  },
});
