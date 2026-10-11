/**
 * Hub Struttura societaria (DAS-REV-12, sei screen master).
 *
 * Una sola pagina per i sei stati della tavola: cambiano dati, accessi e
 * stato, non il layout (§16 — «non attraverso switch hardcoded sul nome della
 * Society»). Il master 05 non è una variante Primavera: è questa pagina con
 * un solo dominio autorizzato.
 *
 * L'hub **non possiede** i dati che riassume. Squadre, relazioni e richieste
 * arrivano dai provider canonici dei rispettivi centri, con le loro chiavi di
 * cache: è ciò che rende i numeri uguali a quelli della destinazione e, come
 * chiede §18, rende possibile lo screen 06 — un riepilogo fallisce e gli
 * altri tre domini restano utilizzabili.
 *
 * La bottom navigation resta visibile con Dashboard selezionata: la route
 * vive nello Stack annidato nella tab Dashboard.
 */
import { useCallback, useEffect, useRef } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, sizes, spacing } from "../../../theme/tokens";
import { AppText, Avatar } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { fetchNetworkHeader } from "../../network/network-service";
import { NETWORK_QK } from "../../network/network-keys";
import { fetchTeamsCenter } from "../../teams/teams-service";
import { TEAMS_QK } from "../../teams/teams-keys";
import { NetworkNavBar } from "../../network/components/NetworkNavBar";
import { STALE_MS } from "../cache/freshness-policy";
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
import { StructureActionable } from "./components/StructureActionable";
import { StructureRow } from "./components/StructureRow";
import {
  StructureSection,
  StructureSummaryError,
  StructureSummarySkeleton,
} from "./components/StructureSection";
import { STRUCTURE_QK } from "./structure-keys";
import {
  STRUCTURE_COPY,
  adminsSummary,
  domainRows,
  isDomainVisible,
  networkSummary,
  signalHref,
  teamsSummary,
} from "./structure-presentation";
import {
  StructureAccessError,
  fetchSocietyStructure,
} from "./structure-service";
import { structureRowEvent, trackStructureEvent } from "./structure-analytics";
import { STRUCTURE_DOMAINS, type StructureSignal } from "./structure-types";

/** Finestra entro cui un secondo tap sulla stessa riga è un doppio tap. */
const DOUBLE_TAP_MS = 600;

const DOMAIN_TITLES = {
  admins: "Amministrazione e accessi",
  company: "Dati della società",
  network: "Società collegate",
  teams: "Squadre del club",
} as const;

export function SocietyStructureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;
  const { connection, reportFailure, reportSuccess } = useDashboardConnection();

  // ── Eligibility e composizione ────────────────────────────────────────
  //
  // §16: «Determina l'eligibility prima di renderizzare dati sensibili.» I
  // provider di dominio restano disabilitati finché questa risposta non dice
  // quali domini esistono per questo actor.
  const hubQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchSocietyStructure(clubId as string),
    queryKey: STRUCTURE_QK.hub(actorId, clubId ?? ""),
    // Un accesso negato non diventa un 200 al secondo tentativo (§18).
    retry: (failureCount, error) =>
      !(error instanceof StructureAccessError) && failureCount < 1,
    staleTime: STALE_MS.operational,
  });

  const loaded = hubQuery.data ?? null;

  /**
   * §21: «La scadenza della verifica organizzativa deve rendere inaccessibili
   * i dati privati anche nella pagina rimasta aperta.» Il tick di
   * `useAccessWindow` lo impone senza aspettare una navigazione.
   */
  const accessWindow = useAccessWindow({
    accessVerifiedAt: loaded?.accessVerifiedAt ?? null,
    isOrganizational: true,
  });

  const structure = accessWindow.isValid ? loaded : null;

  // Scaduta la finestra si **rivalida**, non si dichiara una revoca: §21
  // distingue «la scadenza temporale della cache di accesso» da una revoca
  // confermata.
  useEffect(() => {
    if (!accessWindow.isValid && loaded && !hubQuery.isFetching) {
      void hubQuery.refetch();
    }
    // Solo la transizione di validità deve innescare la rivalidazione: le
    // altre dipendenze cambiano a ogni fetch e produrrebbero un ciclo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessWindow.isValid]);

  const canViewTeams = structure?.canViewTeams ?? false;
  const canViewNetwork = structure?.canViewNetwork ?? false;
  const canViewRequests = structure?.canViewRequests ?? false;

  // ── Provider di dominio, indipendenti fra loro (§15, §18) ─────────────

  const teamsQuery = useQuery({
    enabled: !!clubId && !!actorId && canViewTeams,
    queryFn: () => fetchTeamsCenter(clubId as string),
    queryKey: TEAMS_QK.center(actorId, clubId ?? ""),
    staleTime: STALE_MS.management,
  });

  const networkQuery = useQuery({
    enabled: !!clubId && !!actorId && (canViewNetwork || canViewRequests),
    queryFn: () => fetchNetworkHeader(clubId as string),
    queryKey: NETWORK_QK.center(actorId, clubId ?? ""),
    staleTime: STALE_MS.operational,
  });

  // ── Connessione ───────────────────────────────────────────────────────

  useEffect(() => {
    if (hubQuery.error) {
      reportFailure(hubQuery.error);
    } else if (hubQuery.isSuccess) {
      reportSuccess();
    }
  }, [hubQuery.error, hubQuery.isSuccess, reportFailure, reportSuccess]);

  // ── Analytics (§26) ───────────────────────────────────────────────────

  const viewReportedRef = useRef<string | null>(null);

  useEffect(() => {
    // Una sola apertura per ciclo di navigazione: l'aggiornamento di un
    // conteggio non è una nuova visualizzazione.
    if (!structure || viewReportedRef.current === structure.clubId) {
      return;
    }

    viewReportedRef.current = structure.clubId;

    trackStructureEvent("company_structure_hub_view", {
      scope: structure.scopeLabel ? "team" : "society",
      signals: structure.signals.length,
    });
  }, [structure]);

  useEffect(() => {
    if (!hubQuery.error) {
      return;
    }

    trackStructureEvent("company_structure_load_error", {
      authorization: hubQuery.error instanceof StructureAccessError,
    });
  }, [hubQuery.error]);

  // ── Navigazione ───────────────────────────────────────────────────────

  const lastPushRef = useRef<{ at: number; href: string } | null>(null);

  const go = useCallback(
    (href: string) => {
      // §14: «protezioni condivise contro doppi tap di navigazione, evitando
      // duplicazioni dello stack». Il lock è sulla **destinazione**, non
      // sulla pagina: due tap sulla stessa riga non impilano due volte la
      // stessa schermata, ma passare da una riga all'altra resta immediato.
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

  const openRow = useCallback(
    (rowId: string, href: string) => {
      const event = structureRowEvent(rowId);

      if (event) {
        trackStructureEvent(event, {});
      }

      go(href);
    },
    [go],
  );

  const openSignal = useCallback(
    (signal: StructureSignal) => {
      const href = signalHref(signal);

      if (!href) {
        return;
      }

      // §26: «Il successo di un tap significa apertura della destinazione.»
      // Nessun evento di accettazione o completamento parte da qui.
      trackStructureEvent("company_structure_actionable_open", {
        kind: signal.kind,
      });

      go(href);
    },
    [go],
  );

  // ── Refresh (§21) ─────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: STRUCTURE_QK.hub(actorId, clubId ?? ""),
      }),
      queryClient.invalidateQueries({
        queryKey: TEAMS_QK.center(actorId, clubId ?? ""),
      }),
      queryClient.invalidateQueries({
        queryKey: NETWORK_QK.center(actorId, clubId ?? ""),
      }),
    ]);
  }, [actorId, clubId, queryClient]);

  /**
   * Ritorno da un centro (§23).
   *
   * «Al ritorno da un centro, rivalida i dati coinvolti anche se non è
   * arrivato un evento realtime. Gestisci modifiche effettuate da un altro
   * amministratore o dispositivo al successivo sync.»
   *
   * È un'**invalidazione**, non un refetch forzato: i dati restano a schermo
   * e TanStack rilegge solo ciò che è davvero stantio. Un form aperto e poi
   * annullato non produce quindi gli aggiornamenti di una mutation riuscita
   * — semplicemente non c'è niente di nuovo da leggere.
   */
  const hasFocusedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedRef.current) {
        hasFocusedRef.current = true;
        return;
      }

      void refresh();
    }, [refresh]),
  );

  const navBar = (
    <NetworkNavBar onBack={() => router.back()} title="Struttura societaria" />
  );

  const shell = (children: React.ReactNode) => (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {navBar}
      {children}
    </View>
  );

  if (!clubId) {
    return shell(
      <DashboardGlobalError
        body="Seleziona una società per vederne la struttura."
        onRetry={() => router.back()}
        title="Nessuna società selezionata"
      />,
    );
  }

  // §19: «Se l'hub era già aperto o viene raggiunto con un vecchio link, usa
  // il fallback autorizzato e un feedback discreto.» Non una pagina vuota che
  // suggerisca l'assenza di dati in tutta la Società.
  if (
    hubQuery.error instanceof StructureAccessError &&
    hubQuery.error.code === "STRUCTURE_NOT_AUTHORIZED"
  ) {
    // Non è un guasto: niente pastiglia di errore e niente "Riprova", che qui
    // non risolverebbe nulla. Il fallback è la Dashboard autorizzata.
    return shell(
      <DashboardGlobalEmpty
        copy={{
          actionLabel: "Torna alla Dashboard",
          body: STRUCTURE_COPY.notAvailableBody,
          icon: "lock-closed-outline",
          title: STRUCTURE_COPY.notAvailableTitle,
        }}
        onAction={() => router.replace("/(tabs)/dashboard")}
      />,
    );
  }

  if (hubQuery.isLoading && !structure) {
    return shell(<DashboardSkeleton />);
  }

  if (!structure) {
    // §21: offline **senza** dati utilizzabili è uno stato proprio, non
    // l'errore generale.
    if (connection === "offline") {
      return shell(
        <DashboardGlobalOffline
          body={STRUCTURE_COPY.offlineBody}
          onRetry={() => void refresh()}
        />,
      );
    }

    return shell(
      <DashboardGlobalError
        body={STRUCTURE_COPY.globalErrorBody}
        onRetry={() => void refresh()}
        title={STRUCTURE_COPY.globalErrorTitle}
      />,
    );
  }

  const isScoped = !!structure.scopeLabel;
  const visibleDomains = STRUCTURE_DOMAINS.filter((domain) =>
    isDomainVisible(domain, structure),
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {navBar}

      {connection === "offline" ? <DashboardOfflineNotice /> : null}

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            onRefresh={() => void refresh()}
            refreshing={hubQuery.isRefetching}
            tintColor={colors.textNeutralMuted}
          />
        }
        testID="structure-scroll"
      >
        {/* §6: identità compatta, senza un nuovo selector di squadre o ruoli. */}
        <View style={styles.identity} testID="structure-identity">
          <Avatar
            name={structure.name}
            size="md"
            square
            tone="ink"
            uri={structure.logoUrl ?? undefined}
          />

          <View style={styles.identityBody}>
            <View style={styles.identityNameRow}>
              <AppText
                color="neutral"
                numberOfLines={2}
                style={styles.identityName}
                variant="titleMd"
              >
                {structure.name}
              </AppText>

              {/* §4: il check compare solo per una verifica reale. */}
              {structure.isVerified ? (
                <VerifiedCheck />
              ) : null}
            </View>

            <AppText color="neutralMuted" variant="meta">
              Società
            </AppText>
          </View>
        </View>

        {/* §7: lo scope è informazione, non un controllo. */}
        {structure.scopeLabel ? (
          <AppText
            color="neutralMuted"
            style={styles.scope}
            testID="structure-scope"
            variant="meta"
          >
            {`Ambito: ${structure.scopeLabel}`}
          </AppText>
        ) : null}

        <StructureActionable onOpen={openSignal} signals={structure.signals} />

        {visibleDomains.map((domain) => {
          const rows = domainRows(domain, structure);
          const title = DOMAIN_TITLES[domain];

          return (
            <StructureSection
              key={domain}
              summary={domainSummary({
                adminInvites: structure.adminInvitesPendingCount,
                admins: structure.adminsCount,
                domain,
                isScoped,
                network: networkQuery.data,
                teams: teamsQuery.data?.totalCount ?? null,
              })}
              title={title}
            >
              {/* Riepilogo in caricamento o fallito: riguarda il numero, non
                  l'accesso. Le righe restano sempre utilizzabili (§18). */}
              {domain === "teams" && canViewTeams && !teamsQuery.data ? (
                teamsQuery.isError ? (
                  <StructureSummaryError
                    domainTitle={title}
                    isRetrying={teamsQuery.isFetching}
                    message={STRUCTURE_COPY.summaryError}
                    onRetry={() => {
                      trackStructureEvent("company_structure_summary_retry", {
                        domain: "teams",
                      });
                      void teamsQuery.refetch();
                    }}
                    testID="structure-teams-error"
                  />
                ) : (
                  <StructureSummarySkeleton />
                )
              ) : null}

              {domain === "network" &&
              (canViewNetwork || canViewRequests) &&
              !networkQuery.data ? (
                networkQuery.isError ? (
                  <StructureSummaryError
                    domainTitle={title}
                    isRetrying={networkQuery.isFetching}
                    message={STRUCTURE_COPY.summaryError}
                    onRetry={() => {
                      trackStructureEvent("company_structure_summary_retry", {
                        domain: "network",
                      });
                      void networkQuery.refetch();
                    }}
                    testID="structure-network-error"
                  />
                ) : (
                  <StructureSummarySkeleton />
                )
              ) : null}

              {/* §12: la sola sezione con dati identificativi master. */}
              {domain === "company" ? (
                <View style={styles.company} testID="structure-company">
                  <Avatar
                    name={structure.name}
                    size="md"
                    square
                    tone="ink"
                    uri={structure.logoUrl ?? undefined}
                  />

                  <View style={styles.companyBody}>
                    <AppText color="neutral" variant="titleMd">
                      {structure.name}
                    </AppText>

                    {/* Un campo assente viene omesso, non inventato (§12). */}
                    {structure.city ? (
                      <AppText color="neutralMuted" variant="meta">
                        {structure.city}
                      </AppText>
                    ) : null}
                  </View>
                </View>
              ) : null}

              {rows.map((row, index) => (
                <StructureRow
                  icon={row.icon}
                  key={row.id}
                  onPress={() => openRow(row.id, row.href)}
                  showDivider={index > 0}
                  testID={`structure-row-${row.id}`}
                  title={row.title}
                />
              ))}
            </StructureSection>
          );
        })}
      </ScrollView>
    </View>
  );
}

type NetworkCounts = {
  activeRelationshipCount: number | null;
  requestsReceivedCount: number | null;
  requestsSentCount: number | null;
};

/**
 * Il riepilogo del dominio, o `null` quando non c'è niente di leggibile.
 *
 * "Dati della società" non ne ha: §6 vuole il summary «quando leggibile e
 * disponibile», e il nome del club è già il contenuto di quel blocco.
 */
function domainSummary(input: {
  adminInvites: number | null;
  admins: number | null;
  domain: (typeof STRUCTURE_DOMAINS)[number];
  isScoped: boolean;
  network: NetworkCounts | undefined;
  teams: number | null;
}): string | null {
  switch (input.domain) {
    case "teams":
      return teamsSummary(input.teams, input.isScoped);
    case "network":
      return networkSummary(
        input.network?.activeRelationshipCount ?? null,
        pendingRequests(input.network),
      );
    case "admins":
      return adminsSummary(input.admins, input.adminInvites);
    default:
      return null;
  }
}

/**
 * Richieste in attesa leggibili (§10).
 *
 * Ricevute e inviate sono due numeri distinti nel dominio e una sola frase
 * nell'hub. Se l'insieme non è leggibile restano `null` entrambi, e §10
 * vieta di sommarli a zero: «il totale riguarda soltanto l'insieme
 * effettivamente autorizzato».
 */
function pendingRequests(header: NetworkCounts | undefined): number | null {
  if (!header) {
    return null;
  }

  const { requestsReceivedCount: received, requestsSentCount: sent } = header;

  if (received === null && sent === null) {
    return null;
  }

  return (received ?? 0) + (sent ?? 0);
}

/** Check di verifica: accento funzionale, non decorazione (§4). */
function VerifiedCheck() {
  return (
    <Ionicons
      accessibilityLabel="Società verificata"
      color={colors.accent}
      name="checkmark-circle"
      size={16}
    />
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  content: {
    // §6: la separazione fra due domini è maggiore di quella fra righe dello
    // stesso dominio, che è un divider da 1px.
    gap: spacing[24],
    paddingBottom: spacing[32],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[8],
  },
  identity: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
  identityBody: {
    flex: 1,
    gap: spacing[4],
  },
  identityNameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  identityName: {
    flexShrink: 1,
  },
  scope: {
    // Appartiene all'identità, non al primo dominio: lo spazio sopra è il
    // minimo e quello sotto resta il gap della colonna.
    marginTop: -spacing[16],
  },
  company: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
  },
  companyBody: {
    flex: 1,
    gap: spacing[4],
  },
});
