/**
 * Centro Gruppi della Società (DAS-REV-32 §10, §27; screen 02 e 16).
 *
 * Proiezione amministrativa: righe con avatar, nome, contesto (Squadra o
 * Società), persone e chevron. Nessuna preview, unread, mittente o mute
 * (§9, DoD-07): il server non li restituisce e qui non c'è dove metterli.
 * L'ordine è quello amministrativo del server — un messaggio nuovo non
 * sposta un gruppo (§10, QA-014).
 *
 * Vive nello Stack della tab Dashboard: bottom navigation visibile con
 * Dashboard selezionata (§5).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Button, SearchField } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { STALE_MS } from "../cache/freshness-policy";
import {
  DashboardGlobalEmpty,
  DashboardGlobalError,
  DashboardGlobalOffline,
  DashboardOfflineNotice,
  DashboardSkeleton,
} from "../components/DashboardStates";
import { useDashboardIdentity } from "../identity/use-dashboard-identity";
import { PositionsCenterHeader } from "../positions/components/PositionsCenterHeader";
import { useDashboardConnection } from "../state/use-dashboard-connection";
import { GroupAvatar } from "./components/GroupAvatar";
import { trackGroupsCenterOpened, trackGroupsSearchCompleted } from "./groups-analytics";
import { GROUPS_COPY, GROUPS_MODULE_TITLE } from "./groups-copy";
import { GROUPS_QK } from "./groups-keys";
import { centerBodyOf, groupRowMeta, uniqueById } from "./groups-presentation";
import { GROUPS_HREFS } from "./groups-routes";
import { GroupsError, fetchSocietyGroupsPage } from "./groups-service";
import type { SocietyGroupRow, SocietyGroupsPage } from "./groups-types";

const SEARCH_DEBOUNCE_MS = 300;
const CHEVRON_SIZE = 18;

const isAuthorizationError = (error: unknown) => error instanceof GroupsError && error.isAuthorization;

function GroupRow({ onPress, row, showDivider }: { onPress: () => void; row: SocietyGroupRow; showDivider: boolean }) {
  const meta = groupRowMeta(row);

  return (
    <Pressable
      accessibilityLabel={`${row.name}, ${meta}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, showDivider ? styles.rowDivider : null, pressed ? styles.pressed : null]}
      testID={`groups-row-${row.conversationId}`}
    >
      <GroupAvatar name={row.name} path={row.avatarPath} />
      <View style={styles.rowText}>
        <AppText color="neutral" variant="titleSm">
          {row.name}
        </AppText>
        <AppText color="neutralMuted" variant="meta">
          {meta}
        </AppText>
      </View>
      <Ionicons color={colors.textNeutralMuted} name="chevron-forward" size={CHEVRON_SIZE} />
    </Pressable>
  );
}

export function GroupsCenterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;
  const { connection, reportFailure, reportSuccess } = useDashboardConnection();

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  /* §10: debounce; la chiave contiene la query, quindi una risposta di una
     query precedente non può sovrascrivere quella corrente (QA-017). */
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const groups = useInfiniteQuery<
    SocietyGroupsPage,
    Error,
    InfiniteData<SocietyGroupsPage, string | null>,
    readonly unknown[],
    string | null
  >({
    enabled: !!clubId && !!actorId,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    initialPageParam: null,
    queryFn: ({ pageParam }) => fetchSocietyGroupsPage({ clubId: clubId as string, cursor: pageParam, query }),
    queryKey: GROUPS_QK.center(actorId, clubId ?? "", query),
    retry: (count, error) => !isAuthorizationError(error) && count < 1,
    staleTime: STALE_MS.operational,
  });

  const firstPage = groups.data?.pages[0] ?? null;
  const rows = uniqueById(groups.data?.pages.flatMap((page) => page.items) ?? []);
  const canCreate = firstPage?.canCreate === true;
  const revoked = isAuthorizationError(groups.error);

  useEffect(() => {
    trackGroupsCenterOpened();
  }, []);

  /* §29: ricerca completata, senza la query in chiaro. */
  const firstPageCount = groups.data?.pages[0]?.items.length ?? null;
  useEffect(() => {
    if (query && firstPageCount !== null) trackGroupsSearchCompleted(firstPageCount);
  }, [firstPageCount, query]);

  useEffect(() => {
    if (groups.isSuccess) reportSuccess();
  }, [groups.isSuccess, reportSuccess]);

  useEffect(() => {
    if (groups.error && !revoked) reportFailure(groups.error);
  }, [groups.error, reportFailure, revoked]);

  /* §24: una revoca rimuove i dati amministrativi della Società, non solo la
     query corrente (QA-027). */
  useEffect(() => {
    if (revoked && actorId && clubId) {
      queryClient.removeQueries({ queryKey: ["society-groups-center", actorId, clubId] });
      queryClient.removeQueries({ queryKey: ["society-group-detail", actorId, clubId] });
    }
  }, [actorId, clubId, queryClient, revoked]);

  /* §27: il ritorno da wizard o chat riconcilia la lista dallo stesso oggetto. */
  /* useCallback necessario: useFocusEffect riesegue a ogni nuova identità
     della funzione, e una funzione nuova a ogni render invaliderebbe la
     lista in loop. */
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      /* Il primo focus coincide con il caricamento: niente doppia lettura. */
      if (!focusedOnce.current) {
        focusedOnce.current = true;
        return;
      }

      if (actorId && clubId) {
        void queryClient.invalidateQueries({ queryKey: ["society-groups-center", actorId, clubId] });
      }
    }, [actorId, clubId, queryClient]),
  );

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/dashboard" as never);
  };

  const startCreate = () => {
    router.push(GROUPS_HREFS.create("dashboard", clubId) as never);
  };

  const header = (
    <View style={styles.navWrap}>
      <PositionsCenterHeader
        isVerified={current?.isVerified ?? false}
        logoUrl={current?.avatarUrl ?? null}
        name={current?.name ?? ""}
        onBack={goBack}
        title={GROUPS_MODULE_TITLE}
      />
      <AppText color="neutralMuted" style={styles.supporting} variant="bodySm">
        {GROUPS_COPY.centerSupporting}
      </AppText>
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
          actionLabel: GROUPS_COPY.backToDashboard,
          body: GROUPS_COPY.noSociety,
          icon: "business-outline",
          title: GROUPS_COPY.notAuthorizedTitle,
        }}
        onAction={() => router.replace("/(tabs)/dashboard" as never)}
      />,
    );
  }

  /* CC-07: non autorizzato non è un elenco vuoto. */
  if (revoked) {
    return shell(
      <DashboardGlobalEmpty
        copy={{
          actionLabel: GROUPS_COPY.backToDashboard,
          body: GROUPS_COPY.notAuthorizedBody,
          icon: "lock-closed-outline",
          title: GROUPS_COPY.notAuthorizedTitle,
        }}
        onAction={() => router.replace("/(tabs)/dashboard" as never)}
      />,
    );
  }

  const body = centerBodyOf({
    error: !!groups.error,
    loaded: !!groups.data,
    query,
    rows: rows.length,
  });

  /* §27: offline senza cache non deve sembrare «Nessun gruppo». */
  if (body === "error" && !query) {
    return shell(
      connection === "offline" ? (
        <DashboardGlobalOffline body={GROUPS_COPY.offlineBody} onRetry={() => void groups.refetch()} />
      ) : (
        <DashboardGlobalError
          body={GROUPS_COPY.loadError}
          onRetry={() => void groups.refetch()}
          title={GROUPS_COPY.loadError}
        />
      ),
    );
  }

  /* Screen 16: il vuoto vero porta la CTA nel corpo, non anche sopra. */
  if (body === "empty") {
    return shell(
      <View style={styles.state}>
        <DashboardGlobalEmpty
          copy={{
            actionLabel: GROUPS_COPY.createGroup,
            body: canCreate ? GROUPS_COPY.emptyBody : GROUPS_COPY.emptyBodyReadOnly,
            icon: "people-outline",
            title: GROUPS_COPY.emptyTitle,
          }}
          onAction={canCreate ? startCreate : null}
        />
      </View>,
    );
  }

  const listHeader = (
    <View>
      {connection === "offline" ? <DashboardOfflineNotice /> : null}

      {canCreate ? (
        <Button
          fullWidth
          label={`+ ${GROUPS_COPY.createGroup}`}
          onPress={startCreate}
          size="md"
          style={styles.headerCta}
          testID="groups-create"
          variant="primary"
        />
      ) : null}

      <SearchField
        onChangeText={setSearch}
        onClear={() => setSearch("")}
        placeholder={GROUPS_COPY.searchPlaceholder}
        style={styles.search}
        testID="groups-search"
        value={search}
      />

      {body === "loading" ? <DashboardSkeleton /> : null}

      {body === "error" ? (
        <DashboardGlobalError
          body={GROUPS_COPY.loadError}
          onRetry={() => void groups.refetch()}
          title={GROUPS_COPY.loadError}
        />
      ) : null}

      {body === "search_empty" ? (
        <View style={styles.searchEmpty} testID="groups-search-empty">
          <AppText color="neutral" variant="titleSm">
            {GROUPS_COPY.searchEmptyTitle}
          </AppText>
          <AppText color="neutralMuted" variant="bodySm">
            {GROUPS_COPY.searchEmptyBody}
          </AppText>
          <Button
            label={GROUPS_COPY.clearSearch}
            onPress={() => setSearch("")}
            size="sm"
            style={styles.clear}
            variant="neutralOutline"
          />
        </View>
      ) : null}

      {/* §27: dati in cache con aggiornamento fallito restano leggibili. */}
      {groups.error && rows.length > 0 ? (
        <AppText color="neutralMuted" style={styles.refreshFailed} variant="meta">
          {GROUPS_COPY.refreshFailed}
        </AppText>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {header}
      <FlatList
        contentContainerStyle={[styles.content, { paddingBottom: spacing[32] + insets.bottom }]}
        data={body === "ready" ? rows : []}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(row) => row.conversationId}
        ListFooterComponent={
          groups.isFetchingNextPage ? (
            <AppText color="neutralMuted" style={styles.footer} variant="meta">
              Caricamento…
            </AppText>
          ) : null
        }
        ListHeaderComponent={listHeader}
        onEndReached={() => {
          if (groups.hasNextPage && !groups.isFetchingNextPage) {
            void groups.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            onRefresh={() => void groups.refetch()}
            refreshing={groups.isRefetching && !groups.isFetchingNextPage}
            tintColor={colors.textNeutralMuted}
          />
        }
        renderItem={({ index, item }) => (
          <GroupRow
            onPress={() => router.push(GROUPS_HREFS.detail(item.conversationId) as never)}
            row={item}
            showDivider={index > 0}
          />
        )}
        testID="groups-center-list"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  clear: {
    alignSelf: "flex-start",
    marginTop: spacing[12],
  },
  content: {
    paddingHorizontal: spacing[20],
  },
  footer: {
    paddingTop: spacing[16],
  },
  headerCta: {
    marginBottom: spacing[12],
    marginTop: spacing[8],
  },
  navWrap: {
    paddingHorizontal: spacing[20],
    paddingTop: spacing[8],
  },
  pressed: {
    opacity: 0.6,
  },
  refreshFailed: {
    paddingTop: spacing[8],
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 64,
    paddingVertical: spacing[12],
  },
  rowDivider: {
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowText: {
    flex: 1,
    gap: spacing[4],
  },
  search: {
    marginBottom: spacing[8],
  },
  searchEmpty: {
    paddingTop: spacing[24],
    gap: spacing[4],
  },
  state: {
    paddingHorizontal: spacing[20],
    paddingTop: spacing[24],
  },
  supporting: {
    marginTop: -spacing[8],
    paddingBottom: spacing[8],
  },
});
