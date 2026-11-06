/**
 * Centro Link di invito (DAS-REV-20, screen 01).
 *
 * Una sola intestazione più due code indipendenti (Attivi/Disattivati),
 * ciascuna con il proprio cursore: cambiare tab non deve far sparire la
 * pagina già caricata dell'altra tab (stesso principio di DAS-REV-19 §13).
 * Un rifiuto autorizzativo sul centro non è un errore di rete da ritentare,
 * e non si confonde mai con una lista vuota (§38 del Centro Inviti, valido
 * anche qui).
 */
import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useInfiniteQuery, useQuery, type InfiniteData } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, sizes, spacing } from "../../../theme/tokens";
import { AppText, Button, TabBar } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { STALE_MS } from "../cache/freshness-policy";
import { DashboardModuleError } from "../components/DashboardSection";
import {
  DashboardGlobalEmpty,
  DashboardGlobalError,
  DashboardGlobalOffline,
  DashboardSkeleton,
} from "../components/DashboardStates";
import { SocietyContextHeader } from "../components/SocietyContextHeader";
import { useDashboardIdentity } from "../identity/use-dashboard-identity";
import { useAccessWindow } from "../state/use-access-window";
import { useDashboardConnection } from "../state/use-dashboard-connection";
import { JoinLinkListRow } from "./components/JoinLinkListRow";
import { trackJoinLinksEvent } from "./join-links-analytics";
import { JOIN_LINKS_QK } from "./join-links-keys";
import { JOIN_LINKS_COPY, JOIN_LINKS_TABS, emptyCopy } from "./join-links-presentation";
import { JOIN_LINKS_HREFS } from "./join-links-routes";
import {
  JOIN_LINKS_PAGE_SIZE,
  isAuthorizationError,
  fetchJoinLinksCenter,
  fetchJoinLinksPage,
} from "./join-links-service";
import type { JoinLinkRow, JoinLinksPage, JoinLinksTab } from "./join-links-types";

export function JoinLinksCenterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;
  const { connection, reportFailure, reportSuccess } = useDashboardConnection();

  const params = useLocalSearchParams<{ from?: string; teamId?: string }>();
  const [tab, setTab] = useState<JoinLinksTab>("active");

  /* Il contesto è una proprietà della navigazione, non uno stato che
     l'utente cambia qui: il centro non ha un selettore di squadra. */
  const [teamId, setTeamId] = useState<string | null>(
    typeof params.teamId === "string" && params.teamId ? params.teamId : null,
  );

  const centerQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchJoinLinksCenter(clubId as string),
    queryKey: JOIN_LINKS_QK.center(actorId, clubId ?? ""),
    retry: (failureCount, error) => !isAuthorizationError(error) && failureCount < 1,
    staleTime: STALE_MS.operational,
  });

  const loaded = centerQuery.data ?? null;

  const accessWindow = useAccessWindow({
    accessVerifiedAt: loaded?.accessVerifiedAt ?? null,
    isOrganizational: true,
  });

  const center = accessWindow.isValid ? loaded : null;

  useEffect(() => {
    if (!accessWindow.isValid && loaded && !centerQuery.isFetching) {
      void centerQuery.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessWindow.isValid]);

  const tabOptions = (section: JoinLinksTab) => ({
    enabled: !!clubId && !!actorId && !!center,
    getNextPageParam: (last: JoinLinksPage) => (last.hasMore ? last.nextCursor : undefined),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      fetchJoinLinksPage({
        clubId: clubId as string,
        cursor: pageParam,
        limit: JOIN_LINKS_PAGE_SIZE,
        tab: section,
        teamId,
      }),
    queryKey: JOIN_LINKS_QK.list(actorId, clubId ?? "", section, teamId),
    retry: (failureCount: number, error: Error) =>
      !isAuthorizationError(error) && failureCount < 1,
    staleTime: STALE_MS.operational,
  });

  const activeQuery = useInfiniteQuery<
    JoinLinksPage,
    Error,
    InfiniteData<JoinLinksPage, string | null>,
    readonly unknown[],
    string | null
  >(tabOptions("active"));

  const revokedQuery = useInfiniteQuery<
    JoinLinksPage,
    Error,
    InfiniteData<JoinLinksPage, string | null>,
    readonly unknown[],
    string | null
  >(tabOptions("revoked"));

  const currentQuery = tab === "active" ? activeQuery : revokedQuery;
  const rows = (currentQuery.data?.pages ?? []).flatMap((page) => page.rows);

  useEffect(() => {
    if (centerQuery.isSuccess) {
      reportSuccess();
    }
  }, [centerQuery.isSuccess, reportSuccess]);

  useEffect(() => {
    if (centerQuery.error) {
      reportFailure(centerQuery.error);
      trackJoinLinksEvent("join_links_center_load_failed", {
        reason: isAuthorizationError(centerQuery.error) ? "not_authorized" : "network",
      });
    }
  }, [centerQuery.error, reportFailure]);

  useFocusEffect(
    useCallback(() => {
      trackJoinLinksEvent("join_links_center_view", {});
    }, []),
  );

  const refresh = useCallback(async () => {
    await Promise.all([centerQuery.refetch(), activeQuery.refetch(), revokedQuery.refetch()]);
  }, [activeQuery, centerQuery, revokedQuery]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();

      return;
    }

    router.replace("/(tabs)/dashboard" as never);
  }, [router]);

  const openRow = useCallback(
    (row: JoinLinkRow) => {
      trackJoinLinksEvent("join_link_row_opened", { status: row.status });
      router.push(JOIN_LINKS_HREFS.detail(row.id, { from: "dashboard" }) as never as Parameters<typeof router.push>[0]);
    },
    [router],
  );

  const startCreate = useCallback(() => {
    trackJoinLinksEvent("join_link_compose_started", { source: "center" });
    router.push(JOIN_LINKS_HREFS.composeConfigure({ from: "dashboard" }) as never as Parameters<typeof router.push>[0]);
  }, [router]);

  const changeTab = useCallback((next: JoinLinksTab) => {
    trackJoinLinksEvent("join_links_tab_changed", { tab: next });
    setTab(next);
  }, []);

  const shell = (body: React.ReactNode) => (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.navWrap}>
        <SocietyContextHeader
          isVerified={center?.clubIsVerified ?? false}
          logoUrl={center?.clubLogoUrl ?? null}
          name={center?.clubName ?? ""}
          onBack={goBack}
          title={JOIN_LINKS_COPY.centerTitle}
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

  if (isAuthorizationError(centerQuery.error)) {
    return shell(
      <DashboardGlobalEmpty
        copy={{
          actionLabel: "Torna alla Dashboard",
          body: "Chiedi a un amministratore di abilitarti.",
          icon: "lock-closed-outline",
          title: JOIN_LINKS_COPY.notAuthorized,
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
          onRetry={() => {
            trackJoinLinksEvent("join_links_center_retry", {});
            void refresh();
          }}
        />,
      );
    }

    return shell(
      <DashboardGlobalError
        onRetry={() => {
          trackJoinLinksEvent("join_links_center_retry", {});
          void refresh();
        }}
        title={JOIN_LINKS_COPY.listError}
      />,
    );
  }

  const listFailed = Boolean(currentQuery.error) && rows.length === 0;
  const listLoading = currentQuery.isLoading && rows.length === 0;
  const empty =
    !listLoading && !listFailed && rows.length === 0 && currentQuery.isSuccess;
  const copy = emptyCopy(tab);

  const contextTeamName =
    teamId === null ? null : (rows.find((row) => row.teamId === teamId)?.teamName ?? null);

  const header = (
    <View>
      {center.canCreate ? (
        <Button
          fullWidth
          label={JOIN_LINKS_COPY.create}
          onPress={startCreate}
          size="md"
          style={styles.cta}
          testID="join-links-create"
          variant="primary"
        />
      ) : null}

      {teamId ? (
        <Pressable
          accessibilityLabel={`Contesto ${contextTeamName ?? "squadra"}. Mostra tutte le squadre`}
          accessibilityRole="button"
          onPress={() => setTeamId(null)}
          style={({ pressed }) => [
            styles.contextRow,
            pressed ? styles.contextPressed : null,
          ]}
          testID="join-links-team-context"
        >
          <AppText color="neutralMuted" numberOfLines={1} style={styles.contextLabel} variant="meta">
            {contextTeamName ?? "Una squadra"}
          </AppText>

          <AppText color="accent" variant="actionLabel">
            Tutte le squadre
          </AppText>
        </Pressable>
      ) : null}

      <TabBar
        active={tab}
        fill
        items={JOIN_LINKS_TABS}
        onChange={changeTab}
        style={styles.tabs}
        testID="join-links-tabs"
        tone="neutral"
      />

      {listLoading ? (
        <View style={styles.listLoading}>
          <DashboardSkeleton />
        </View>
      ) : null}

      {listFailed ? (
        <View style={styles.listError}>
          <DashboardModuleError
            isRetrying={currentQuery.isRefetching}
            message={JOIN_LINKS_COPY.listError}
            onRetry={() => {
              trackJoinLinksEvent("join_links_center_retry", { tab });
              void currentQuery.refetch();
            }}
          />
        </View>
      ) : null}

      {empty ? (
        <View style={styles.empty}>
          <DashboardGlobalEmpty
            copy={{
              actionLabel: "",
              body: copy.body,
              icon: "link-outline",
              title: copy.title,
            }}
            onAction={null}
          />
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.navWrap}>
        <SocietyContextHeader
          isVerified={center.clubIsVerified}
          logoUrl={center.clubLogoUrl}
          name={center.clubName}
          onBack={goBack}
          title={JOIN_LINKS_COPY.centerTitle}
        />
      </View>

      <FlatList
        contentContainerStyle={[styles.content, { paddingBottom: spacing[32] + insets.bottom }]}
        data={rows}
        keyExtractor={(row) => row.id}
        ListHeaderComponent={header}
        onEndReached={() => {
          if (currentQuery.hasNextPage && !currentQuery.isFetchingNextPage) {
            void currentQuery.fetchNextPage();
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
          <JoinLinkListRow onPress={() => openRow(item)} row={item} showDivider={index > 0} />
        )}
        testID="join-links-center-list"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contextRow: {
    alignItems: "center",
    borderBottomColor: colors.dividerNeutral,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[8],
    justifyContent: "space-between",
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[8],
  },
  contextLabel: {
    flexShrink: 1,
  },
  contextPressed: {
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
  title: {
    marginBottom: spacing[16],
  },
  cta: {
    marginBottom: spacing[16],
  },
  tabs: {
    marginBottom: spacing[4],
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
});
