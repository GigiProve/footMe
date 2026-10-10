/**
 * Dettaglio operativo Squadra (DAS-REV-09).
 *
 * **Una sola pagina con scroll.** Gli screen 01 e 02 del mockup sono due
 * posizioni di scorrimento dello stesso stato dati, non due route, due tab o
 * due copie dei moduli: non esiste qui un ramo che renda "la seconda
 * schermata". Allo stesso modo i master 03, 04, 05 e 06 sono quattro esiti
 * dello stesso componente — cambiano dati e permessi, non l'impaginazione.
 *
 * La pagina vive **dentro** lo Stack della tab Dashboard, così la bottom
 * navigation resta visibile con Dashboard selezionata (§6). La Società
 * rimane l'identità operativa: il Team è il contesto, non una nuova identità.
 *
 * Due provider paralleli (§24, §25): la base della pagina e le Posizioni. È
 * la ragione per cui l'errore del master 06 è davvero locale — il modulo
 * Posizioni fallisce mentre Organico, Candidature e Inviti restano leggibili
 * e il retry ricarica solo il dominio in errore.
 *
 * Questa pagina **legge** (§28): nessuna GET modifica Team, membership,
 * lifecycle, stato di consultazione o permessi. Aprirla non marca le
 * candidature come lette.
 */
import { useCallback, useEffect, useMemo } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button, ScreenHeader, Skeleton } from "../../../ui";
import { useSession } from "../../auth/use-session";
import {
  DashboardGlobalError,
  DashboardOfflineNotice,
  DashboardSkeleton,
} from "../../dashboard/components/DashboardStates";
import { STALE_MS } from "../../dashboard/cache/freshness-policy";
import { useAccessWindow } from "../../dashboard/state/use-access-window";
import { useDashboardConnection } from "../../dashboard/state/use-dashboard-connection";
import { TEAMS_QK } from "../teams-keys";
import { trackTeamsEvent } from "../teams-analytics";
import { TEAM_ERROR_COPY } from "../teams-presentation";
import { toTeamError } from "../teams-service";
import { TeamDetailHeader } from "./components/TeamDetailHeader";
import {
  TeamDetailModule,
  TeamModuleError,
  TeamModuleLink,
  TeamSummaryRow,
} from "./components/TeamDetailModule";
import { TeamGroupRow } from "./components/TeamGroupRow";
import { TeamPositionRow } from "./components/TeamPositionRow";
import { TeamRosterPreview } from "./components/TeamRosterPreview";
import { TEAM_DETAIL_HREFS } from "./team-detail-hrefs";
import {
  applicationsSummaryLine,
  invitesSummaryLine,
  positionsCountLabel,
  teamDetailComposition,
} from "./team-detail-presentation";
import {
  fetchTeamDetail,
  fetchTeamPositionsPreview,
} from "./team-detail-service";

export function TeamDetailScreen({ teamId }: { teamId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const connection = useDashboardConnection();

  const detailQuery = useQuery({
    enabled: !!teamId && !!actorId,
    queryFn: () => fetchTeamDetail(teamId),
    queryKey: TEAMS_QK.detail(actorId, teamId),
    // Dati di squadra poco variabili: 5 minuti (§26). I conteggi operativi
    // viaggiano nello stesso payload e il pull-to-refresh li rivalida
    // comunque, quindi non serve una seconda chiave più nervosa.
    staleTime: STALE_MS.management,
  });

  const positionsQuery = useQuery({
    enabled: !!teamId && !!actorId,
    queryFn: () => fetchTeamPositionsPreview(teamId),
    queryKey: TEAMS_QK.detailPositions(actorId, teamId),
    staleTime: STALE_MS.operational,
  });

  /**
   * Finestra di accesso organizzativa (§26).
   *
   * Alla scadenza i dati privati smettono di essere mostrabili **a pagina
   * aperta**, senza che l'utente faccia nulla: è il tick dell'hook a
   * imporlo. Una scadenza non è una revoca confermata — si chiede una
   * sincronizzazione, non si dichiara l'accesso perduto.
   */
  const accessWindow = useAccessWindow({
    accessVerifiedAt: detailQuery.data?.accessVerifiedAt ?? null,
    isOrganizational: true,
  });

  const team = accessWindow.isValid ? (detailQuery.data ?? null) : null;
  const positions = accessWindow.isValid ? (positionsQuery.data ?? null) : null;
  const positionsFailed = positionsQuery.isError;

  const detailError = detailQuery.error;
  const errorCode = detailError ? toTeamError(detailError).code : null;
  const isMissing = errorCode === "TEAM_NOT_FOUND";

  const { reportFailure, reportSuccess } = connection;

  useEffect(() => {
    if (detailError) {
      reportFailure(detailError);
    } else if (!detailQuery.isLoading) {
      reportSuccess();
    }
  }, [detailError, detailQuery.isLoading, reportFailure, reportSuccess]);

  useEffect(() => {
    if (positionsQuery.isError) {
      trackTeamsEvent("teams_detail_module_error", { module: "positions" });
    }
  }, [positionsQuery.isError]);

  useEffect(() => {
    if (team) {
      trackTeamsEvent("teams_detail_opened", { has_season: team.hasSeasonConfig });
    }
    // Un solo evento per apertura di una squadra: le rivalidazioni
    // successive non sono nuove aperture (§30).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team?.teamId]);

  const refreshAll = useCallback(async () => {
    trackTeamsEvent("teams_detail_refreshed");
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: TEAMS_QK.detail(actorId, teamId),
      }),
      queryClient.invalidateQueries({
        queryKey: TEAMS_QK.detailPositions(actorId, teamId),
      }),
    ]);
  }, [actorId, queryClient, teamId]);

  /** Retry del solo dominio Posizioni (§24): nessun overlay, nessun reset. */
  const retryPositions = useCallback(() => {
    trackTeamsEvent("teams_detail_module_retry", { module: "positions" });
    void positionsQuery.refetch();
  }, [positionsQuery]);

  /**
   * Navigazione tracciata (§30).
   *
   * Il tap registra l'**apertura**, non un'operazione completata: la
   * destinazione registrerà per conto proprio ciò che vi accade davvero.
   *
   * `as never` sul path è la convenzione già in uso nella Foundation: gli
   * href canonici sono composti in `team-detail-hrefs.ts` e le route tipate
   * di expo-router non riconoscono una stringa costruita a runtime.
   */
  const go = useCallback(
    (event: Parameters<typeof trackTeamsEvent>[0], href: string) => {
      trackTeamsEvent(event);
      router.push(href as never);
    },
    [router],
  );

  const back = useCallback(() => {
    // Deep link senza origine nello stack: il fallback è il Centro Squadre
    // della Società, non la radice dell'app (§18).
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(TEAM_DETAIL_HREFS.teamsCenter as never);
  }, [router]);

  const composition = useMemo(
    () =>
      team
        ? teamDetailComposition({ positions, positionsFailed, team })
        : [],
    [positions, positionsFailed, team],
  );

  const navBar = (
    <View style={styles.navBar}>
      <ScreenHeader
        action={
          team?.canEdit ? (
            <Pressable
              accessibilityLabel="Modifica squadra"
              accessibilityRole="button"
              hitSlop={10}
              onPress={() =>
                go("teams_edit_started", TEAM_DETAIL_HREFS.edit(teamId))
              }
              style={({ pressed }) => (pressed ? styles.pressed : null)}
              testID="team-detail-edit"
            >
              <AppText color="accent" variant="actionLabel">
                Modifica squadra
              </AppText>
            </Pressable>
          ) : null
        }
        leading={
          <Pressable
            accessibilityLabel="Indietro"
            accessibilityRole="button"
            hitSlop={10}
            onPress={back}
            style={({ pressed }) => [
              styles.backButton,
              pressed ? styles.pressed : null,
            ]}
            testID="team-detail-back"
          >
            <Ionicons color={colors.textPrimary} name="arrow-back" size={20} />
          </Pressable>
        }
        title="Squadra"
      />
    </View>
  );

  // Primo caricamento senza cache: shell e skeleton generico. Prima di
  // conoscere i permessi non si anticipano nomi e moduli riservati (§27).
  if (detailQuery.isLoading && !team) {
    return (
      <View style={styles.root}>
        {navBar}
        <DashboardSkeleton />
      </View>
    );
  }

  // Squadra inesistente, non più accessibile o revocata: messaggio neutro e
  // ritorno a una destinazione autorizzata, senza rivelare nulla della
  // risorsa (§27).
  if (isMissing || (!team && !accessWindow.isValid)) {
    return (
      <View style={styles.root}>
        {navBar}

        <View style={styles.centered} testID="team-detail-unavailable">
          <AppText color="secondary" style={styles.centeredText} variant="bodySm">
            {isMissing
              ? TEAM_ERROR_COPY.TEAM_NOT_FOUND
              : "Per continuare serve una nuova verifica dell'accesso."}
          </AppText>

          <Button
            label={isMissing ? "Torna alle squadre" : "Aggiorna"}
            onPress={() =>
              isMissing
                ? router.replace(TEAM_DETAIL_HREFS.teamsCenter as never)
                : void refreshAll()
            }
            size="md"
            variant="outline"
          />
        </View>
      </View>
    );
  }

  // Errore globale solo senza una base affidabile utilizzabile (§27).
  if (!team) {
    return (
      <View style={styles.root}>
        {navBar}
        <DashboardGlobalError
          body="Riprova tra poco."
          onRetry={() => void refreshAll()}
          title="Non è stato possibile caricare la squadra"
        />
      </View>
    );
  }

  const canOpenRoster = team.canViewRoster && team.isOwner;
  const canInvite = team.canManageRoster && team.isOwner;
  const canOpenPositions = team.canViewPositions && team.isOwner;
  const canCreatePosition = team.canCreatePositions && team.isOwner;
  const canOpenApplications = team.canViewApplications && team.isOwner;
  const canOpenInvites = team.canViewInvites && team.isOwner;

  return (
    <View style={styles.root}>
      {navBar}

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            onRefresh={() => void refreshAll()}
            refreshing={detailQuery.isRefetching || positionsQuery.isRefetching}
            tintColor={colors.accent}
          />
        }
        testID="team-detail-scroll"
      >
        {connection.connection === "offline" ? (
          <View style={styles.notice}>
            <DashboardOfflineNotice />
          </View>
        ) : null}

        {/*
          Aggiornamento fallito con dati ancora utilizzabili (§26): avviso
          discreto, la pagina resta leggibile. Non sostituisce il contenuto.
        */}
        {detailQuery.isError && connection.connection !== "offline" ? (
          <View style={styles.notice}>
            <AppText color="secondary" variant="caption">
              Impossibile aggiornare la squadra. Riprova.
            </AppText>
          </View>
        ) : null}

        <View style={styles.headerBlock}>
          <TeamDetailHeader team={team} />
        </View>

        {composition.map((moduleId) => {
          switch (moduleId) {
            case "roster":
              return (
                <TeamDetailModule
                  action={
                    canOpenRoster
                      ? {
                          label: "Vedi organico",
                          onPress: () =>
                            go(
                              "teams_detail_roster_opened",
                              TEAM_DETAIL_HREFS.roster(teamId),
                            ),
                        }
                      : null
                  }
                  key={moduleId}
                  title="Organico"
                >
                  <TeamRosterPreview
                    avatars={team.rosterAvatars}
                    onInvite={
                      canInvite
                        ? () =>
                            go(
                              "teams_detail_invite_started",
                              TEAM_DETAIL_HREFS.invitePerson(teamId),
                            )
                        : null
                    }
                    playersCount={team.rosterPlayersCount}
                    staffCount={team.rosterStaffCount}
                  />
                </TeamDetailModule>
              );

            case "positions":
              return (
                <TeamDetailModule
                  key={moduleId}
                  // Il conteggio viene dal backend e non dalla dimensione
                  // dell'array di anteprima (§13). In errore non esiste
                  // conteggio: non si scrive "0 attive".
                  meta={
                    positionsFailed
                      ? null
                      : positionsCountLabel(positions?.activeCount ?? null)
                  }
                  title="Posizioni aperte"
                >
                  {positionsFailed ? (
                    <TeamModuleError
                      isRetrying={positionsQuery.isFetching}
                      message="Non è stato possibile caricare le posizioni."
                      onRetry={retryPositions}
                      testID="team-positions-error"
                    />
                  ) : !positions ? (
                    /*
                      Non ancora arrivato ≠ zero (§14, §25). La base della
                      pagina può essere pronta mentre questo provider è
                      ancora in volo: senza questo ramo comparirebbe per un
                      istante "Nessuna posizione aperta", cioè uno zero che
                      nessuna risposta ha confermato.
                    */
                    <View style={styles.modulePlaceholder} testID="team-positions-loading">
                      <Skeleton.Row style={styles.placeholderRow} />
                      <Skeleton.Row style={styles.placeholderRow} />
                    </View>
                  ) : (positions.items.length ?? 0) > 0 ? (
                    <>
                      {positions.items.map((position, index) => (
                        <TeamPositionRow
                          key={position.id}
                          onPress={
                            canOpenPositions
                              ? () =>
                                  go(
                                    "teams_detail_position_opened",
                                    TEAM_DETAIL_HREFS.position(
                                      teamId,
                                      position.id,
                                    ),
                                  )
                              : null
                          }
                          position={position}
                          showDivider={index > 0}
                        />
                      ))}

                      {canOpenPositions ? (
                        <TeamModuleLink
                          label="Vedi posizioni"
                          onPress={() =>
                            go(
                              "teams_detail_positions_opened",
                              TEAM_DETAIL_HREFS.positions(teamId),
                            )
                          }
                          testID="team-positions-link"
                        />
                      ) : null}

                      {canCreatePosition ? (
                        <Button
                          fullWidth
                          label="Nuova posizione"
                          leftIcon={
                            <Ionicons
                              color={colors.textPrimary}
                              name="add"
                              size={18}
                            />
                          }
                          onPress={() =>
                            go(
                              "teams_detail_position_create_started",
                              TEAM_DETAIL_HREFS.newPosition(teamId),
                            )
                          }
                          testID="team-positions-new"
                          textStyle={styles.outlineLabel}
                          variant="outline"
                        />
                      ) : null}
                    </>
                  ) : (
                    /*
                      Zero confermato (§14): un solo accesso al composer, non
                      "Crea posizione" più "Nuova posizione" più "Vedi
                      posizioni" senza utilità.
                    */
                    <View style={styles.emptyModule} testID="team-positions-empty">
                      <View style={styles.emptyRow}>
                        <Ionicons
                          color={colors.textMuted}
                          name="document-text-outline"
                          size={22}
                        />

                        <AppText color="secondary" style={styles.emptyText} variant="bodySm">
                          Nessuna posizione aperta
                        </AppText>
                      </View>

                      {canCreatePosition ? (
                        <Button
                          fullWidth
                          label="Crea posizione"
                          onPress={() =>
                            go(
                              "teams_detail_position_create_started",
                              TEAM_DETAIL_HREFS.newPosition(teamId),
                            )
                          }
                          testID="team-positions-create"
                          textStyle={styles.outlineLabel}
                          variant="outline"
                        />
                      ) : null}
                    </View>
                  )}
                </TeamDetailModule>
              );

            case "applications": {
              const summary = applicationsSummaryLine(team);

              return (
                <TeamDetailModule key={moduleId} title="Candidature">
                  <TeamSummaryRow
                    accessibilityLabel={`Vedi candidature: ${summary ?? ""}`}
                    onPress={
                      canOpenApplications
                        ? () =>
                            go(
                              "teams_detail_applications_opened",
                              TEAM_DETAIL_HREFS.applications(teamId),
                            )
                        : null
                    }
                    summary={summary ?? ""}
                    testID="team-applications-row"
                  />
                </TeamDetailModule>
              );
            }

            case "invites": {
              const summary = invitesSummaryLine(team.invitesPendingCount);

              return (
                <TeamDetailModule key={moduleId} title="Inviti e richieste">
                  <TeamSummaryRow
                    accessibilityLabel={`Gestisci inviti e richieste: ${summary ?? ""}`}
                    onPress={
                      canOpenInvites
                        ? () =>
                            go(
                              "teams_detail_invites_opened",
                              TEAM_DETAIL_HREFS.invites(teamId),
                            )
                        : null
                    }
                    summary={summary ?? ""}
                    testID="team-invites-row"
                  />
                </TeamDetailModule>
              );
            }

            case "group":
              return (
                <TeamDetailModule key={moduleId} title="Gruppo squadra">
                  <TeamGroupRow
                    memberCount={team.groupMemberCount}
                    onPress={
                      team.groupConversationId
                        ? () =>
                            go(
                              "teams_detail_group_opened",
                              TEAM_DETAIL_HREFS.group(
                                team.groupConversationId as string,
                              ),
                            )
                        : null
                    }
                    title={team.groupTitle ?? team.name}
                  />
                </TeamDetailModule>
              );

            default:
              return null;
          }
        })}

        {/*
          Spazio naturale prima della safe area (§20): niente "Informazioni
          squadra", KPI o suggerimenti per riempire il residuo.
        */}
        <View style={styles.tail} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
  navBar: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingBottom: spacing[12],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[24],
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
    gap: spacing[8],
    paddingBottom: spacing[40],
  },
  notice: {
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  headerBlock: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[16],
  },
  emptyModule: {
    gap: spacing[12],
  },
  modulePlaceholder: {
    gap: spacing[10],
  },
  placeholderRow: {
    borderRadius: radius[8],
    height: 44,
  },
  emptyRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: spacing[36],
  },
  emptyText: {
    flex: 1,
  },
  centered: {
    alignItems: "center",
    flex: 1,
    gap: spacing[16],
    justifyContent: "center",
    paddingHorizontal: spacing[20],
  },
  centeredText: {
    textAlign: "center",
  },
  outlineLabel: {
    color: colors.textPrimary,
  },
  tail: {
    height: spacing[8],
  },
  pressed: {
    opacity: 0.6,
  },
});
