/**
 * Gruppi archiviati (DAS-REV-33 §21; PNG 18).
 *
 * Destinazione reale raggiunta dal Centro 32: lista **amministrativa** della
 * stessa Società — avatar, nome, «Squadra · N persone» e «Archiviato» — senza
 * un solo dato di chat (nessuna anteprima, unread, mittente, attività). Vive
 * nello Stack della tab Dashboard (bottom navigation, Dashboard selezionata).
 *
 * Una riga apre la stessa Info gruppo del resto (`origin = "dashboard"`): da
 * lì si riattiva, si recupera un gruppo senza ADMIN o lo si elimina, secondo le
 * capability del server. Vuoto: «Nessun gruppo archiviato»; ricerca senza
 * match: «Nessun gruppo trovato» (§27). Un errore non è un elenco vuoto.
 */
import { useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Button, SearchField } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { STALE_MS } from "../cache/freshness-policy";
import { DashboardGlobalEmpty, DashboardGlobalError, DashboardGlobalOffline } from "../components/DashboardStates";
import { useDashboardIdentity } from "../identity/use-dashboard-identity";
import { PositionsCenterHeader } from "../positions/components/PositionsCenterHeader";
import { GroupAvatar } from "./components/GroupAvatar";
import { trackGroupRetry } from "./groups-analytics";
import { GROUP_MANAGE_COPY as C, GROUPS_COPY } from "./groups-copy";
import { GROUPS_QK } from "./groups-keys";
import { archivedMetaOf, archivedStatusOf, loadFailureOf } from "./groups-manage-presentation";
import { centerBodyOf } from "./groups-presentation";
import { GROUP_MANAGE_HREFS, GROUPS_HREFS } from "./groups-routes";
import { fetchArchivedGroupsPage, toGroupsError } from "./groups-service";
import type { ArchivedGroupRow, ArchivedGroupsPage } from "./groups-types";
import { GroupRowsSkeleton } from "./manage/components/GroupManageChrome";

const SEARCH_DEBOUNCE_MS = 300;

function ArchivedRow({ onPress, row, showDivider }: { onPress: () => void; row: ArchivedGroupRow; showDivider: boolean }) {
  const meta = archivedMetaOf(row);
  const status = archivedStatusOf(row);

  return (
    <Pressable
      accessibilityLabel={`${row.name}, ${meta}, ${status}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, showDivider ? styles.rowDivider : null, pressed ? styles.pressed : null]}
      testID={`groups-archived-row-${row.conversationId}`}
    >
      <GroupAvatar name={row.name} path={row.avatarPath} />
      <View style={styles.rowText}>
        <AppText color="neutral" numberOfLines={1} variant="titleSm">
          {row.name}
        </AppText>
        <AppText color="neutralMuted" numberOfLines={1} variant="meta">
          {meta}
        </AppText>
        <AppText color="neutralMuted" numberOfLines={1} variant="meta">
          {status}
        </AppText>
      </View>
      <Ionicons color={colors.textNeutralMuted} name="chevron-forward" size={18} />
    </Pressable>
  );
}

export function ArchivedGroupsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  /* La chiave contiene la query: una risposta di una ricerca superata non può
     sostituire quella corrente (§12). */
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [search]);

  const archived = useInfiniteQuery<
    ArchivedGroupsPage,
    Error,
    InfiniteData<ArchivedGroupsPage, string | null>,
    readonly unknown[],
    string | null
  >({
    enabled: !!clubId && !!actorId,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    initialPageParam: null,
    queryFn: ({ pageParam }) => fetchArchivedGroupsPage({ clubId: clubId as string, cursor: pageParam, query }),
    queryKey: GROUPS_QK.archived(actorId, clubId ?? "", query),
    retry: (count, error) => !toGroupsError(error).isAuthorization && count < 1,
    staleTime: STALE_MS.operational,
  });

  const error = archived.error ? toGroupsError(archived.error) : null;
  const rows = (archived.data?.pages.flatMap((page) => page.items) ?? []).filter(
    (row, index, all) => all.findIndex((other) => other.conversationId === row.conversationId) === index,
  );

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();

      return;
    }

    router.replace(GROUPS_HREFS.center() as never);
  };

  const retry = () => {
    trackGroupRetry("archived");
    void archived.refetch();
  };

  const header = (
    <View style={styles.navWrap}>
      <PositionsCenterHeader
        isVerified={current?.isVerified ?? false}
        logoUrl={current?.avatarUrl ?? null}
        name={current?.name ?? ""}
        onBack={goBack}
        title={C.archivedGroupsTitle}
      />
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

  /* Non autorizzato non è un elenco vuoto (CC-07). */
  if (error?.isAuthorization) {
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

  const body = centerBodyOf({ error: !!error, loaded: !!archived.data, query, rows: rows.length });

  if (body === "error" && !query) {
    return shell(
      error?.code === "NETWORK" ? (
        <DashboardGlobalOffline body={loadFailureOf(error, "archived")} onRetry={retry} />
      ) : (
        <DashboardGlobalError body={C.archivedLoadError} onRetry={retry} title={C.archivedLoadError} />
      ),
    );
  }

  if (body === "empty") {
    return shell(
      <View style={styles.state}>
        <DashboardGlobalEmpty
          copy={{ actionLabel: "", body: C.archivedEmptyBody, icon: "archive-outline", title: C.archivedEmptyTitle }}
          onAction={null}
        />
      </View>,
    );
  }

  const listHeader = (
    <View>
      <SearchField
        onChangeText={setSearch}
        onClear={() => setSearch("")}
        placeholder={GROUPS_COPY.searchPlaceholder}
        style={styles.search}
        testID="groups-archived-search"
        value={search}
      />

      {body === "loading" ? <GroupRowsSkeleton rows={3} /> : null}

      {body === "error" ? (
        <View style={styles.searchEmpty}>
          <AppText color="neutralMuted" variant="bodySm">
            {C.archivedLoadError}
          </AppText>
          <Button label={C.retry} onPress={retry} size="sm" style={styles.clear} variant="neutralOutline" />
        </View>
      ) : null}

      {body === "search_empty" ? (
        <View style={styles.searchEmpty} testID="groups-archived-search-empty">
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

      {/* Dati in cache con aggiornamento fallito restano leggibili (§27). */}
      {error && rows.length > 0 ? (
        <AppText color="neutralMuted" style={styles.refreshFailed} variant="meta">
          {C.refreshFailed}
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
          archived.isFetchingNextPage ? (
            <AppText color="neutralMuted" style={styles.footer} variant="meta">
              {C.loading}
            </AppText>
          ) : null
        }
        ListHeaderComponent={listHeader}
        onEndReached={() => {
          if (archived.hasNextPage && !archived.isFetchingNextPage) {
            void archived.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            onRefresh={() => void archived.refetch()}
            refreshing={archived.isRefetching && !archived.isFetchingNextPage}
            tintColor={colors.textNeutralMuted}
          />
        }
        renderItem={({ index, item }) => (
          <ArchivedRow
            onPress={() => router.push(GROUP_MANAGE_HREFS.info(item.conversationId, "dashboard") as never)}
            row={item}
            showDivider={index > 0}
          />
        )}
        testID="groups-archived-list"
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
    minHeight: 72,
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
    marginTop: spacing[8],
  },
  searchEmpty: {
    gap: spacing[4],
    paddingTop: spacing[24],
  },
  state: {
    paddingHorizontal: spacing[20],
    paddingTop: spacing[24],
  },
});
