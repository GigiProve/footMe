/**
 * Stagioni della squadra — screen 02, più lo sheet di conferma dello
 * screen 08.
 *
 * Tre sezioni e un elenco (§11): Stagione corrente, Prossima stagione,
 * Stagioni precedenti. Non è una lista di stagioni da interpretare: sono
 * tre domande diverse — che cosa vale oggi, che cosa è già deciso per
 * domani, che cosa è stato — e il payload del server le separa già.
 *
 * Lo screen 08 è uno sheet su **questa** pagina (§9: «uno sheet sopra la
 * pagina di consultazione attenuata»), non una route: la conferma di
 * disattivazione appartiene al contesto che la mostra.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
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

import { colors, sizes, spacing } from "../../../theme/tokens";
import { ActionSheet, AppText, BottomSheet, Button, useToast } from "../../../ui";
import { useSession } from "../../auth/use-session";
import {
  DashboardGlobalError,
  DashboardOfflineNotice,
  DashboardSkeleton,
} from "../../dashboard/components/DashboardStates";
import { useDashboardConnection } from "../../dashboard/state/use-dashboard-connection";
import { STALE_MS } from "../../dashboard/cache/freshness-policy";
import { SeasonBlock } from "./components/SeasonBlock";
import { SeasonsIdentityHeader } from "./components/SeasonsIdentityHeader";
import { SeasonsListRow } from "./components/SeasonsListRow";
import { SeasonsNavBar } from "./components/SeasonsNavBar";
import { SEASONS_QK } from "./seasons-keys";
import {
  SEASON_LIFECYCLE_LABEL,
  classificationLine,
  currentSeasonLifecycle,
  nextSeasonLifecycle,
  seasonErrorMessage,
} from "./seasons-presentation";
import {
  checkTeamDeactivation,
  deactivateClubTeam,
  fetchTeamSeasonHistoryPage,
  fetchTeamSeasonsContext,
  toSeasonError,
  type CursorPage,
  type TeamSeasonHistoryRow,
} from "./seasons-service";
import { trackSeasonsEvent } from "./seasons-analytics";
import { newOperationKey } from "./operation-key";

const PAGE_SIZE = 20;

export function TeamSeasonsScreen({ teamId }: { teamId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const connection = useDashboardConnection();
  const { showToast } = useToast();

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [operationKey, setOperationKey] = useState(() => newOperationKey());

  const contextQuery = useQuery({
    enabled: !!actorId,
    queryFn: () => fetchTeamSeasonsContext(teamId),
    queryKey: SEASONS_QK.teamContext(actorId, teamId),
    staleTime: STALE_MS.management,
  });

  const context = contextQuery.data ?? null;

  const historyQuery = useInfiniteQuery({
    enabled: !!actorId && context?.canViewHistory === true,
    getNextPageParam: (last: CursorPage<TeamSeasonHistoryRow>) => last.nextCursor,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      fetchTeamSeasonHistoryPage(teamId, pageParam, PAGE_SIZE),
    queryKey: SEASONS_QK.historyPage(actorId, teamId),
    staleTime: STALE_MS.management,
  });

  const history = useMemo(
    () => historyQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [historyQuery.data],
  );

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: SEASONS_QK.teamContext(actorId, teamId),
      }),
      queryClient.invalidateQueries({
        queryKey: SEASONS_QK.historyPage(actorId, teamId),
      }),
    ]);
  }, [actorId, queryClient, teamId]);

  const { reportFailure, reportSuccess } = connection;
  const error = contextQuery.error;
  const isLoading = contextQuery.isLoading;

  useEffect(() => {
    if (error) {
      reportFailure(error);
    } else if (!isLoading) {
      reportSuccess();
    }
  }, [error, isLoading, reportFailure, reportSuccess]);

  useEffect(() => {
    if (context) {
      trackSeasonsEvent("seasons_team_opened", {
        is_archived: context.isArchived,
        has_current_config: context.currentConfig !== null,
      });
    }
  }, [context]);

  /**
   * Controllo impedimenti (§25).
   *
   * Provider separato e **on demand**: §25 lo vuole read-only e server-driven,
   * e §24 vieta che «una GET, un'apertura di pagina o la visita al riepilogo»
   * cambi lifecycle o stato operativo. Viene quindi eseguito quando l'actor
   * chiede di disattivare, non all'apertura della pagina.
   */
  const startDeactivation = useCallback(async () => {
    setMenuOpen(false);
    trackSeasonsEvent("seasons_deactivate_started", {});

    try {
      const check = await queryClient.fetchQuery({
        queryFn: () => checkTeamDeactivation(teamId),
        queryKey: SEASONS_QK.teamDeactivation(actorId, teamId),
        staleTime: 0,
      });

      if (!check.authorized) {
        showToast({ message: "Non hai i permessi per questa operazione." });
        return;
      }

      if (!check.allowed) {
        trackSeasonsEvent("seasons_deactivate_blocked", {
          blockers: check.blockers.length,
        });
        router.push(`/team-seasons/deactivate?teamId=${encodeURIComponent(teamId)}`);
        return;
      }

      setDeactivateError(null);
      setOperationKey(newOperationKey());
      setConfirmOpen(true);
    } catch (caught) {
      // §26: «Se il controllo fallisce … non interpretarlo come assenza di
      // blocker.» La conferma non si apre.
      const seasonError = toSeasonError(caught);
      showToast({
        message: seasonErrorMessage(
          seasonError.code,
          "Non è stato possibile verificare le attività della squadra. Riprova.",
        ),
      });
    }
  }, [actorId, queryClient, router, showToast, teamId]);

  const confirmDeactivation = useCallback(async () => {
    if (!context) {
      return;
    }

    setDeactivating(true);
    setDeactivateError(null);

    try {
      await deactivateClubTeam({
        expectedVersion: context.teamVersion,
        idempotencyKey: operationKey,
        teamId,
      });

      trackSeasonsEvent("seasons_deactivate_result", { outcome: "success" });
      setConfirmOpen(false);
      await refresh();
      await queryClient.invalidateQueries({ queryKey: ["seasons-center"] });
      await queryClient.invalidateQueries({ queryKey: ["seasons-center-page"] });
      await queryClient.invalidateQueries({ queryKey: ["teams-center"] });
      await queryClient.invalidateQueries({ queryKey: ["teams-center-page"] });
      await queryClient.invalidateQueries({ queryKey: ["team-detail"] });
      showToast({ message: "Squadra disattivata", tone: "success" });
    } catch (caught) {
      const seasonError = toSeasonError(caught);
      trackSeasonsEvent("seasons_deactivate_result", {
        code: seasonError.code,
        outcome: "error",
      });

      if (seasonError.code === "TEAM_HAS_OPEN_ACTIVITY") {
        // L'attività è nata fra il controllo e la conferma: §27 vuole
        // l'elenco aggiornato, non un errore generico.
        setConfirmOpen(false);
        router.push(`/team-seasons/deactivate?teamId=${encodeURIComponent(teamId)}`);
        return;
      }

      setDeactivateError(
        seasonErrorMessage(
          seasonError.code,
          "Non è stato possibile disattivare la squadra. Riprova.",
        ),
      );
    } finally {
      setDeactivating(false);
    }
  }, [context, operationKey, queryClient, refresh, router, showToast, teamId]);

  const navBar = (
    <SeasonsNavBar
      action={
        /*
          §11: il menu contestuale compare «quando contiene azioni
          autorizzate». Oggi ne contiene una sola famiglia — Disattiva e
          Riattiva — quindi la condizione è `teams_lifecycle`: con
          `seasons_prepare` soltanto, il bottone aprirebbe uno sheet vuoto.
        */
        context && context.canManageLifecycle ? (
          <Pressable
            accessibilityLabel="Altre azioni"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setMenuOpen(true)}
            style={styles.menuButton}
            testID="seasons-team-menu"
          >
            <Ionicons
              color={colors.textNeutral}
              name="ellipsis-horizontal"
              size={20}
            />
          </Pressable>
        ) : undefined
      }
      onBack={() => router.back()}
      title="Stagioni e storico"
    />
  );

  if (isLoading) {
    return (
      <View style={styles.root}>
        {navBar}
        <DashboardSkeleton />
      </View>
    );
  }

  if (!context) {
    return (
      <View style={styles.root}>
        {navBar}
        <DashboardGlobalError onRetry={() => void refresh()} />
      </View>
    );
  }

  const currentState = currentSeasonLifecycle({
    hasConfig: context.currentConfig !== null,
    isArchived: context.isArchived,
  });

  const nextState = nextSeasonLifecycle(context.nextConfig !== null);

  const menuActions = [
    context.canManageLifecycle && !context.isArchived
      ? {
          label: "Disattiva squadra",
          onPress: () => void startDeactivation(),
        }
      : null,
    context.canManageLifecycle && context.isArchived
      ? {
          label: "Riattiva squadra",
          onPress: () => {
            setMenuOpen(false);
            trackSeasonsEvent("seasons_reactivate_started", { origin: "menu" });
            router.push(
              `/team-seasons/reactivate?teamId=${encodeURIComponent(teamId)}`,
            );
          },
        }
      : null,
  ].filter((action): action is { label: string; onPress: () => void } => !!action);

  return (
    <View style={styles.root}>
      {navBar}

      <FlatList
        contentContainerStyle={styles.content}
        data={context.canViewHistory ? history : []}
        keyExtractor={(item) => item.teamSeasonId}
        ListEmptyComponent={
          context.canViewHistory && !historyQuery.isLoading ? (
            <AppText color="neutralMuted" variant="bodySm">
              Nessuna stagione precedente registrata.
            </AppText>
          ) : null
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {historyQuery.isFetchingNextPage ? (
              <ActivityIndicator color={colors.textNeutralMuted} />
            ) : null}

            {context.canAddHistory ? (
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() =>
                  router.push(
                    `/team-seasons/history-period?teamId=${encodeURIComponent(teamId)}`,
                  )
                }
                style={styles.linkRow}
                testID="seasons-add-history"
              >
                {/* §11: «Aggiungi stagione precedente, senza + o icona plus».
                    §4 conserva l'accento sui piccoli link funzionali del
                    mockup: è un link, e deve sembrarlo. */}
                <AppText color="accent" variant="actionLabel">
                  Aggiungi stagione precedente
                </AppText>
              </Pressable>
            ) : null}
          </View>
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {connection.connection === "offline" ? <DashboardOfflineNotice /> : null}

            <SeasonsIdentityHeader
              isVerified={context.clubIsVerified}
              logoUrl={context.crestUrl}
              name={context.name}
              statusLabel={
                context.isArchived
                  ? SEASON_LIFECYCLE_LABEL.teamInactive
                  : null
              }
              subtitle={`Squadra di ${context.clubName}`}
            />

            <SeasonBlock
              headline={context.seasonLabel}
              meta={
                context.currentConfig
                  ? classificationLine(
                      context.currentConfig.typeLabel,
                      context.currentConfig.levelLabel,
                    )
                  : "Stagione da configurare"
              }
              statusLabel={currentState ? SEASON_LIFECYCLE_LABEL[currentState] : null}
              testID="seasons-current-block"
              title="Stagione corrente"
            >
              {/* §11: «Per la corrente mancante, usare Configura stagione se
                  consentito.» Su squadra non attiva la configurazione passa
                  dalla riattivazione (§29), quindi qui non compare. */}
              {!context.currentConfig && context.canPrepare && !context.isArchived ? (
                <Button
                  fullWidth
                  label="Configura stagione"
                  onPress={() => {
                    trackSeasonsEvent("seasons_configure_started", {});
                    router.push(
                      `/team-seasons/config?teamId=${encodeURIComponent(teamId)}&target=current`,
                    );
                  }}
                  testID="seasons-configure-cta"
                  variant="neutralOutline"
                />
              ) : null}
            </SeasonBlock>

            <SeasonBlock
              headline={context.nextSeasonLabel}
              meta={
                !context.nextSeasonId
                  ? "Non ancora disponibile nel calendario."
                  : context.nextConfig
                    ? classificationLine(
                        context.nextConfig.typeLabel,
                        context.nextConfig.levelLabel,
                      )
                    : SEASON_LIFECYCLE_LABEL.toPrepare
              }
              statusLabel={
                context.nextSeasonId && context.nextConfig
                  ? SEASON_LIFECYCLE_LABEL[nextState]
                  : null
              }
              testID="seasons-next-block"
              title="Prossima stagione"
            >
              {context.nextSeasonId && context.canPrepare && !context.isArchived ? (
                <Button
                  fullWidth
                  // §11: una prossima stagione già preparata non offre una
                  // seconda creazione, ma la modifica dello stesso record.
                  label={
                    context.nextConfig ? "Modifica preparazione" : "Prepara nuova stagione"
                  }
                  onPress={() => {
                    trackSeasonsEvent("seasons_prepare_started", {
                      mode: context.nextConfig ? "edit" : "create",
                    });
                    router.push(
                      `/team-seasons/config?teamId=${encodeURIComponent(teamId)}&target=next`,
                    );
                  }}
                  testID="seasons-prepare-cta"
                  variant="neutralOutline"
                />
              ) : null}
            </SeasonBlock>

            {context.canViewHistory ? (
              <View style={styles.historyHeading}>
                <AppText color="neutral" variant="titleSm">
                  Stagioni precedenti
                </AppText>
                <View style={styles.divider} />
              </View>
            ) : null}
          </View>
        }
        onEndReached={() => {
          if (historyQuery.hasNextPage && !historyQuery.isFetchingNextPage) {
            void historyQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            onRefresh={() => void refresh()}
            refreshing={contextQuery.isRefetching}
            tintColor={colors.textNeutralMuted}
          />
        }
        renderItem={({ index, item }) => (
          <SeasonsListRow
            // §11: «Nel riepilogo storico non ripetere Conclusa su ogni riga.»
            meta={classificationLine(item.typeLabel, item.levelLabel)}
            onPress={() =>
              router.push(
                `/team-seasons/history-season?teamSeasonId=${encodeURIComponent(item.teamSeasonId)}`,
              )
            }
            showDivider={index > 0}
            testID={`seasons-history-${item.seasonId}`}
            title={item.seasonLabel}
          />
        )}
      />

      <ActionSheet
        actions={menuActions}
        onClose={() => setMenuOpen(false)}
        visible={menuOpen && menuActions.length > 0}
      />

      {/* ── Screen 08 ─────────────────────────────────────────────────── */}
      <BottomSheet
        onClose={() => (isDeactivating ? undefined : setConfirmOpen(false))}
        visible={confirmOpen}
      >
        <View style={styles.sheet}>
          <AppText color="neutral" variant="titleMd">
            {`Disattivare ${context.name}?`}
          </AppText>

          <AppText color="neutralMuted" variant="bodySm">
            La squadra non comparirà tra quelle attive. Le stagioni e lo storico
            resteranno disponibili.
          </AppText>

          {deactivateError ? (
            <AppText accessibilityRole="alert" color="danger" variant="bodySm">
              {deactivateError}
            </AppText>
          ) : null}

          <Button
            fullWidth
            label="Disattiva squadra"
            loading={isDeactivating}
            onPress={() => void confirmDeactivation()}
            testID="seasons-confirm-deactivate"
            variant="neutralOutline"
          />

          <Pressable
            accessibilityRole="button"
            disabled={isDeactivating}
            hitSlop={8}
            onPress={() => setConfirmOpen(false)}
            style={styles.linkRow}
            testID="seasons-keep-active"
          >
            <AppText color="accent" variant="actionLabel">
              Mantieni attiva
            </AppText>
          </Pressable>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    flex: 1,
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  content: {
    paddingBottom: spacing[40],
  },
  listHeader: {
    gap: spacing[20],
    paddingBottom: spacing[4],
  },
  historyHeading: {
    gap: spacing[8],
  },
  divider: {
    backgroundColor: colors.dividerNeutral,
    height: 1,
  },
  footer: {
    gap: spacing[8],
    paddingTop: spacing[12],
  },
  linkRow: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: sizes.touchTarget,
  },
  menuButton: {
    alignItems: "center",
    height: sizes.touchTarget,
    justifyContent: "center",
    width: sizes.touchTarget,
  },
  sheet: {
    gap: spacing[12],
    paddingBottom: spacing[8],
  },
});
