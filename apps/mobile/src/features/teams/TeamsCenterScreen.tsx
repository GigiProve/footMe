/**
 * Centro Squadre della Società (DAS-REV-08, master 01 / 07 / 08).
 *
 * Un solo centro (§12): ci arrivano "Vedi tutte" della Dashboard Società, gli
 * accessi gestionali del profilo Società e i deep link. Gli stati del mockup
 * — elenco pieno, nessuna squadra, ambito limitato — non sono tre schermate
 * ma tre esiti dello stesso provider, perché la differenza è nei permessi e
 * non nel rendering.
 *
 * La bottom navigation resta visibile con Dashboard selezionata (§4): la
 * route vive dentro lo Stack annidato nella tab Dashboard, non fuori dalle
 * tab. Creazione e modifica sono invece flussi focalizzati e stanno fuori.
 */
import { useCallback, useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";

import { colors, radius, sizes, spacing } from "../../theme/tokens";
import { AppText, Button, ScreenHeader } from "../../ui";
import { useSession } from "../auth/use-session";
import { useDashboardIdentity } from "../dashboard/identity/use-dashboard-identity";
import { isFeatureAvailable } from "../dashboard/modules/dashboard-features";
import {
  DashboardGlobalError,
  DashboardOfflineNotice,
  DashboardSkeleton,
} from "../dashboard/components/DashboardStates";
import { useDashboardConnection } from "../dashboard/state/use-dashboard-connection";
import { STALE_MS } from "../dashboard/cache/freshness-policy";
import { TeamRow } from "./components/TeamRow";
import { TeamsContextHeader } from "./components/TeamsContextHeader";
import { TEAMS_QK } from "./teams-keys";
import { teamsEmptyState, teamsTotalLabel } from "./teams-presentation";
import {
  fetchTeamsCenter,
  fetchTeamsCenterPage,
  type TeamsCenterPage,
} from "./teams-service";
import { trackTeamsEvent } from "./teams-analytics";

const PAGE_SIZE = 20;

export function TeamsCenterScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;
  const connection = useDashboardConnection();

  const headerQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchTeamsCenter(clubId as string),
    queryKey: TEAMS_QK.center(actorId, clubId ?? ""),
    staleTime: STALE_MS.management,
  });

  const pageQuery = useInfiniteQuery({
    enabled: !!clubId && !!actorId,
    getNextPageParam: (last: TeamsCenterPage) => last.nextCursor,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      fetchTeamsCenterPage(clubId as string, pageParam, PAGE_SIZE),
    queryKey: TEAMS_QK.page(actorId, clubId ?? ""),
    staleTime: STALE_MS.management,
  });

  const header = headerQuery.data ?? null;
  const rows = useMemo(
    () => pageQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [pageQuery.data],
  );

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: TEAMS_QK.center(actorId, clubId ?? ""),
      }),
      queryClient.invalidateQueries({
        queryKey: TEAMS_QK.page(actorId, clubId ?? ""),
      }),
    ]);
  }, [actorId, clubId, queryClient]);

  const isLoading = headerQuery.isLoading || pageQuery.isLoading;
  const isError = headerQuery.isError || pageQuery.isError;
  const error = headerQuery.error ?? pageQuery.error;

  const { reportFailure, reportSuccess } = connection;

  useEffect(() => {
    if (error) {
      reportFailure(error);
    } else if (!isLoading) {
      reportSuccess();
    }
  }, [error, isLoading, reportFailure, reportSuccess]);

  const openCreate = useCallback(() => {
    if (!clubId) {
      return;
    }

    trackTeamsEvent("teams_create_started", { origin: "center" });
    router.push(`/club-teams/new?clubId=${encodeURIComponent(clubId)}`);
  }, [clubId, router]);

  /**
   * Destinazione della riga (§9, §12).
   *
   * DAS-REV-09 ha reso disponibile il dettaglio operativo: la riga apre
   * quello, con il Team ID stabile, e non più il form di modifica. Il form
   * resta raggiungibile da "Modifica squadra" dentro il dettaglio, dove
   * l'autorizzazione viene rivalidata.
   *
   * Finché il flag fosse di nuovo falso la destinazione tornerebbe al form:
   * §12 vieta le frecce verso pagine inesistenti, e questo è l'unico punto
   * in cui la scelta è espressa.
   */
  const openTeam = useCallback(
    (teamId: string) => {
      const hasDetail = isFeatureAvailable("society_team_detail");

      trackTeamsEvent("teams_team_opened", {
        destination: hasDetail ? "detail" : "edit",
      });

      router.push(
        hasDetail
          ? `/(tabs)/dashboard/team/${encodeURIComponent(teamId)}`
          : `/club-teams/${encodeURIComponent(teamId)}`,
      );
    },
    [router],
  );

  const navBar = (
    <View style={styles.headerRow}>
      <ScreenHeader
        title="Squadre"
        action={
          <Pressable
            accessibilityLabel="Indietro"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Ionicons color={colors.textPrimary} name="arrow-back" size={20} />
          </Pressable>
        }
      />
    </View>
  );

  if (!clubId) {
    return (
      <View style={styles.root}>
        {navBar}
        <View style={styles.centered}>
          <AppText color="secondary" style={styles.centeredText} variant="bodySm">
            Apri la Dashboard della società per gestire le squadre.
          </AppText>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.root}>
        {navBar}
        <DashboardSkeleton />
      </View>
    );
  }

  // §24: l'errore globale esiste solo senza dati affidabili. Con righe in
  // cache il Centro resta leggibile e l'avviso è locale.
  if (isError && rows.length === 0) {
    return (
      <View style={styles.root}>
        {navBar}
        <DashboardGlobalError onRetry={() => void refresh()} />
      </View>
    );
  }

  if (header && !header.canView) {
    return (
      <View style={styles.root}>
        {navBar}
        <View style={styles.centered}>
          <AppText color="secondary" style={styles.centeredText} variant="bodySm">
            Nessuna squadra disponibile nel tuo ambito
          </AppText>
        </View>
      </View>
    );
  }

  const total = teamsTotalLabel(header?.totalCount ?? null);
  const empty = teamsEmptyState({
    canCreate: header?.canCreate ?? false,
    hasScopeRestriction: Boolean(header?.scopeLabel),
  });

  return (
    <View style={styles.root}>
      {navBar}

      <FlatList
        contentContainerStyle={styles.content}
        data={rows}
        keyExtractor={(item) => item.teamId}
        ListEmptyComponent={
          <View style={styles.empty} testID="teams-empty">
            <Ionicons color={colors.textMuted} name="people-outline" size={44} />

            <AppText style={styles.emptyTitle} variant="headingSm">
              {empty.title}
            </AppText>

            {empty.body ? (
              <AppText color="secondary" style={styles.centeredText} variant="bodySm">
                {empty.body}
              </AppText>
            ) : null}

            {empty.action ? (
              <Button
                fullWidth
                label={empty.action}
                onPress={openCreate}
                testID="teams-empty-cta"
              />
            ) : null}
          </View>
        }
        ListFooterComponent={
          pageQuery.isFetchingNextPage ? (
            <View style={styles.footer}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : null
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {connection.connection === "offline" ? (
              <DashboardOfflineNotice />
            ) : null}

            <TeamsContextHeader
              isVerified={header?.clubIsVerified ?? false}
              logoUrl={header?.clubLogoUrl ?? null}
              name={header?.clubName ?? current?.name ?? "Società"}
              scopeLabel={header?.scopeLabel ?? null}
              seasonLabel={header?.seasonLabel ?? null}
            />

            {/*
              §11, master 07: niente "metrica zero decorativa" e nessuna
              seconda CTA accanto all'empty state. Con la lista vuota la riga
              del totale sparisce del tutto, e la sola azione è quella
              dell'empty.
            */}
            {rows.length > 0 ? (
              <View style={styles.totalRow}>
                <AppText color="secondary" style={styles.total} variant="metaStrong">
                  {total ?? ""}
                </AppText>

                {header?.canCreate ? (
                  <Pressable
                    accessibilityLabel="Nuova squadra"
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={openCreate}
                    style={({ pressed }) => [
                      styles.newAction,
                      pressed ? styles.pressed : null,
                    ]}
                    testID="teams-new-action"
                  >
                    <Ionicons color={colors.accent} name="add" size={16} />
                    <AppText color="accent" variant="actionLabel">
                      Nuova
                    </AppText>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        }
        onEndReached={() => {
          if (pageQuery.hasNextPage && !pageQuery.isFetchingNextPage) {
            void pageQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            onRefresh={() => void refresh()}
            refreshing={headerQuery.isRefetching || pageQuery.isRefetching}
            tintColor={colors.accent}
          />
        }
        renderItem={({ index, item }) => (
          <TeamRow
            onPress={
              isFeatureAvailable("society_team_detail") || item.canEdit
                ? () => openTeam(item.teamId)
                : null
            }
            row={item}
            showDivider={index > 0}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.background,
    flex: 1,
    paddingHorizontal: spacing[20],
    paddingTop: spacing[24],
  },
  headerRow: {
    marginBottom: spacing[12],
  },
  backButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  content: {
    paddingBottom: spacing[40],
  },
  listHeader: {
    gap: spacing[12],
    paddingBottom: spacing[6],
  },
  totalRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: sizes.touchTarget,
  },
  total: {
    flex: 1,
  },
  newAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
    minHeight: sizes.touchTarget,
    paddingLeft: spacing[12],
  },
  empty: {
    alignItems: "center",
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingTop: spacing[48],
  },
  emptyTitle: {
    textAlign: "center",
  },
  centered: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing[20],
  },
  centeredText: {
    textAlign: "center",
  },
  footer: {
    paddingVertical: spacing[16],
  },
  pressed: {
    opacity: 0.6,
  },
});
