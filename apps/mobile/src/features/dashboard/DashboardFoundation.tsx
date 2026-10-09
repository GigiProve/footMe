import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Screen } from "../../components/ui/screen";
import { useSession } from "../auth/use-session";
import { getPlayerPositionLabel } from "../profiles/player-sports";
import { APPLICATION_STATUS_LABELS } from "../recruiting/recruiting-service";
import { spacing } from "../../theme/tokens";
import { AppText, useToast } from "../../ui";

import {
  fetchPersonalDashboard,
  isPersonalDashboardData,
  type PersonalDashboardData,
} from "./adapters/personal-adapter";
import {
  fetchSocietyPositions,
  type SocietyPositionPreview,
} from "./adapters/positions-adapter";
import {
  fetchSocietyOverview,
  isSocietyOverview,
  type SocietyOverview,
} from "./adapters/society-adapter";
import {
  DashboardAreaRows,
  type AreaRowItem,
} from "./components/DashboardAreaRow";
import { DashboardEntityRow } from "./components/DashboardEntityRow";
import { DashboardIdentityRow } from "./components/DashboardIdentityRow";
import { DashboardIdentitySheet } from "./components/DashboardIdentitySheet";
import {
  DashboardPriority,
  PRIORITY_ICONS,
  type DashboardPriorityItem,
} from "./components/DashboardPriority";
import {
  DashboardQuickActions,
  type QuickAction,
} from "./components/DashboardQuickActions";
import {
  DashboardModuleError,
  DashboardSection,
} from "./components/DashboardSection";
import {
  DashboardSummary,
  type SummaryMetric,
} from "./components/DashboardSummary";
import {
  DashboardGlobalEmpty,
  DashboardGlobalError,
  DashboardGlobalOffline,
  DashboardModuleEmpty,
  DashboardNoIdentity,
  DashboardOfflineNotice,
  DashboardSkeleton,
  type DashboardEmptyCopy,
} from "./components/DashboardStates";
import {
  trackDashboardCacheUnusable,
  trackDashboardEmpty,
  trackDashboardFirstUsefulRender,
  trackDashboardLoadFailed,
  trackDashboardModuleError,
  trackDashboardOffline,
  trackDashboardOpened,
  trackDashboardRefresh,
  trackIdentitySwitchRequested,
  trackModuleAction,
  trackModulePromotion,
  trackPriorityImpression,
  trackPriorityTap,
  trackSelectorOpened,
} from "./dashboard-analytics";
import { DASHBOARD_QK } from "./dashboard-keys";
import { useDashboardCache } from "./cache/use-dashboard-cache";
import { STALE_MS } from "./cache/freshness-policy";
import { useDashboardIdentity } from "./identity/use-dashboard-identity";
import { composeDashboard, type QuickActionId } from "./modules/composition";
import type { DashboardModuleId } from "./modules/module-registry";
import { applyPromotion } from "./priority/module-order";
import { rankPriorities } from "./priority/priority-ranking";
import type { PrioritySignal } from "./priority/priority-types";
import { useDashboardOrder } from "./priority/use-dashboard-order";
import { derivePageState, isOfflineWithoutData } from "./state/dashboard-state";
import { classifyDashboardError } from "./state/error-classification";
import {
  backoffDelayMs,
  shouldAutoRetry,
  BACKOFF_BASE_MS,
} from "./state/retry-policy";
import { useAccessWindow } from "./state/use-access-window";
import { useDashboardConnection } from "./state/use-dashboard-connection";

/**
 * Unico container della Dashboard PROLINK.
 *
 * DAS-REV-01 ha stabilito **di chi** è la pagina e **di cosa** è fatta;
 * DAS-REV-02 stabilisce **quanto sono affidabili** i dati che mostra. Gli
 * otto master della tavola sono stati di questo stesso componente, non otto
 * Dashboard: non esiste un ramo che renda una pagina diversa, esistono stati
 * derivati da `state/dashboard-state.ts`.
 *
 * Ordine verticale fisso: header → contesto identità → avviso offline →
 * riepilogo → Da gestire → Azioni rapide → moduli. Ogni sezione è opzionale
 * e, quando non eleggibile, le successive risalgono senza lasciare un vuoto.
 */
export function DashboardFoundation() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";

  const {
    contextToken,
    current,
    error: identitiesError,
    identities,
    isLoading: isIdentityLoading,
    presentation,
    refresh,
    selectIdentity,
  } = useDashboardIdentity();

  const [isSheetOpen, setSheetOpen] = useState(false);
  const [isRefreshing, setRefreshing] = useState(false);
  const [isInteracting, setInteracting] = useState(false);
  // Incrementato a ogni momento sicuro esplicito: refresh completato o
  // ritorno da un'azione confermata (§12).
  const [safePoint, setSafePoint] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const isSociety = current?.kind === "society";
  const isOrganizational = !!current && current.kind !== "person";
  const composition = composeDashboard(current);
  const connection = useDashboardConnection();

  // Lo scroll torna in alto a ogni cambio di contesto. Dipende dal token, non
  // dall'id: riaprire la stessa identità dopo una revoca è un contesto nuovo.
  useEffect(() => {
    scrollRef.current?.scrollTo({ animated: false, y: 0 });
  }, [contextToken]);

  // ── Cache locale ────────────────────────────────────────────────────────
  // Una lettura di cache **non** rinnova `fetchedAt` né la finestra di
  // accesso: `useDashboardCache` scrive solo quando riceve un payload.

  const societyCache = useDashboardCache<SocietyOverview>({
    actorId,
    identity: isSociety ? current : null,
    isPayload: isSocietyOverview,
    provider: "operational",
  });

  const personalCache = useDashboardCache<PersonalDashboardData>({
    actorId,
    identity: current && !isSociety ? current : null,
    isPayload: isPersonalDashboardData,
    provider: "operational",
  });

  // ── Richieste ───────────────────────────────────────────────────────────
  // Le query key includono actor e identità: una risposta tardiva di B
  // atterra nella cache di B e non può comparire dentro C (§21).

  const retryOptions = {
    retry: (failureCount: number, error: unknown) =>
      shouldAutoRetry({
        attempt: failureCount,
        category: classifyDashboardError(error),
        elapsedMs: failureCount * BACKOFF_BASE_MS,
      }),
    retryDelay: (attempt: number) => backoffDelayMs(attempt),
  };

  const societyQuery = useQuery({
    enabled: !!actorId && !!current && isSociety,
    queryFn: () =>
      fetchSocietyOverview(current?.id as string, (role) =>
        getPlayerPositionLabel(role, role),
      ),
    queryKey: DASHBOARD_QK.societyOverview(actorId, current?.id ?? "none"),
    staleTime: STALE_MS.operational,
    ...retryOptions,
  });

  const positionsQuery = useQuery({
    enabled: !!actorId && !!current && isSociety,
    queryFn: () => fetchSocietyPositions(current?.id as string),
    queryKey: DASHBOARD_QK.module(
      actorId,
      current?.id ?? "none",
      "society_positions",
    ),
    staleTime: STALE_MS.operational,
    ...retryOptions,
  });

  const personalQuery = useQuery({
    enabled: !!actorId && !!current && !isSociety,
    queryFn: () => fetchPersonalDashboard(actorId),
    queryKey: DASHBOARD_QK.module(actorId, current?.id ?? "none", "personal"),
    staleTime: STALE_MS.operational,
    ...retryOptions,
  });

  // ── Protezione dalle risposte obsolete (§21, §22) ───────────────────────
  // Una revisione più vecchia non sovrascrive una più recente della stessa
  // identità: la query key isola i contesti diversi, questo ref isola le
  // risposte fuori ordine **dentro** lo stesso contesto.

  const lastRevisionRef = useRef(0);

  useEffect(() => {
    lastRevisionRef.current = 0;
  }, [contextToken]);

  useEffect(() => {
    const data = societyQuery.data;

    if (!data || !current) {
      return;
    }

    if (data.dataRevision < lastRevisionRef.current) {
      return;
    }

    lastRevisionRef.current = data.dataRevision;
    connection.reportSuccess();

    const verifiedAt = data.accessVerifiedAt
      ? Date.parse(data.accessVerifiedAt)
      : Date.now();

    societyCache.store(
      data,
      Number.isNaN(verifiedAt) ? Date.now() : verifiedAt,
      data.dataRevision,
    );
    // `societyCache.store` cambia identità a ogni render del provider: usarlo
    // come dipendenza rieseguirebbe la scrittura in continuazione.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, societyQuery.data]);

  useEffect(() => {
    const data = personalQuery.data;

    if (!data || !current) {
      return;
    }

    connection.reportSuccess();
    // Il personale non ha una verifica di scope server-side da conservare:
    // vale la sessione dell'app. L'istante serve solo alla freschezza.
    personalCache.store(data, Date.now(), Date.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, personalQuery.data]);

  const primaryError = isSociety ? societyQuery.error : personalQuery.error;

  useEffect(() => {
    if (!primaryError || !current) {
      return;
    }

    const category = connection.reportFailure(primaryError);

    trackDashboardLoadFailed({
      category,
      hasUsableContent: false,
      identityKind: current.kind,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, primaryError]);

  useEffect(() => {
    if (!positionsQuery.error || !current) {
      return;
    }

    trackDashboardModuleError({
      category: classifyDashboardError(positionsQuery.error),
      moduleId: "society_positions",
    });
  }, [current, positionsQuery.error]);

  // ── Finestra di accesso organizzativa (§15) ─────────────────────────────
  // Alla scadenza i contenuti privati diventano inaccessibili **anche nella
  // pagina già aperta**: è il tick di `useAccessWindow` a imporlo, non un
  // nuovo caricamento.

  const accessWindow = useAccessWindow({
    accessVerifiedAt: societyCache.accessVerifiedAt,
    isOrganizational,
  });

  const societyData = accessWindow.isValid
    ? (societyQuery.data ?? societyCache.payload)
    : null;
  const personalData = personalQuery.data ?? personalCache.payload;
  const positionsData: SocietyPositionPreview[] | null = accessWindow.isValid
    ? (positionsQuery.data ?? null)
    : null;

  useEffect(() => {
    if (isOrganizational && !accessWindow.isValid && societyCache.payload) {
      trackDashboardCacheUnusable({
        identityKind: "society",
        reason: "access_window_expired",
      });
    }
  }, [accessWindow.isValid, isOrganizational, societyCache.payload]);

  // ── Stato di pagina (§13) ───────────────────────────────────────────────
  // Calcolato **prima** dei return anticipati, così gli eventi che dipendono
  // da esso possono vivere in un effetto invece che nel corpo del render.

  const rows = moduleRowCounts({
    personal: personalData,
    positions: positionsData,
    positionsFailed: positionsQuery.isError,
    society: societyData,
  });

  // Solo i moduli che portano contenuto operativo dimostrano un caricamento
  // riuscito: "Aree di gestione" è navigazione, non attività (§13).
  const contentModules = composition.modules.filter(
    (module) => module.countsAsContent,
  );

  const pageState = derivePageState({
    access: "valid",
    allModulesEmpty: contentModules.every((module) => rows[module.id] === 0),
    allModulesSettled: contentModules.every(
      (module) => rows[module.id] !== null,
    ),
    // Senza identità non esiste una composizione interpretabile: lo stato
    // resta `initial` e i rami successivi non si attivano.
    compositionKnown: !!current,
    connection: connection.connection,
    data: isSociety && !accessWindow.isValid ? "unusable" : "fresh",
    hasEligibleModules: composition.modules.length > 0,
    hasUsableContent: contentModules.some((module) => (rows[module.id] ?? 0) > 0),
  });

  // ── Priorità ────────────────────────────────────────────────────────────

  const signals: PrioritySignal[] = isSociety
    ? (societyData?.prioritySignals ?? [])
    : buildPersonalSignals(actorId, personalData);

  const signalsKey = signals
    .map((signal) => `${signal.aggregationKey}:${signal.count}`)
    .join(",");

  // Istante congelato: a parità di input e di istante il ranking deve dare
  // sempre lo stesso risultato (§8, QA-07). Leggere `Date.now()` dentro il
  // comparatore lo renderebbe dipendente dal momento del render.
  const rankedAt = useMemo(
    () => Date.now(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contextToken, safePoint, signalsKey],
  );

  const ranking = useMemo(
    () =>
      rankPriorities({
        eligibleModuleIds: composition.modules.map((module) => module.id),
        identity: current,
        now: rankedAt,
        signals,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current, rankedAt, signalsKey],
  );

  // ── Ordine dei moduli ───────────────────────────────────────────────────

  const proposedModules = applyPromotion(
    composition.modules,
    ranking.promotedModuleId,
  );

  const order = useDashboardOrder({
    isInteracting,
    proposed: proposedModules,
    safePointToken: `${contextToken}:${safePoint}`,
  });

  useEffect(() => {
    if (!ranking.promotedModuleId || !ranking.promotionReasonKey) {
      return;
    }

    const promoter = ranking.visible.find(
      (priority) => priority.key === ranking.promotionReasonKey,
    );

    if (promoter) {
      trackModulePromotion({
        moduleId: ranking.promotedModuleId,
        typeId: promoter.definition.id,
      });
    }
  }, [ranking]);

  // ── Impression delle priorità (§33) ─────────────────────────────────────
  // Una impression richiede visibilità effettiva e non si duplica a ogni
  // re-render o aggiornamento del conteggio: le chiavi già annunciate restano
  // in un set, azzerato al cambio di contesto.

  const announcedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    announcedRef.current = new Set();
  }, [contextToken]);

  useEffect(() => {
    if (!current) {
      return;
    }

    ranking.visible.forEach((priority, index) => {
      if (announcedRef.current.has(priority.key)) {
        return;
      }

      announcedRef.current.add(priority.key);

      trackPriorityImpression({
        identityKind: current.kind,
        position: index,
        typeId: priority.definition.id,
      });
    });
  }, [current, ranking.visible]);

  // ── Primo rendering utile e offline (§33) ───────────────────────────────
  // Un caricamento che ha mostrato soltanto lo skeleton non è un successo:
  // l'evento scatta quando esiste davvero un payload da disegnare, e una sola
  // volta per contesto.

  const openedAtRef = useRef(Date.now());
  const firstRenderReportedRef = useRef(false);
  const offlineReportedRef = useRef(false);
  const emptyReportedRef = useRef(false);

  useEffect(() => {
    openedAtRef.current = Date.now();
    firstRenderReportedRef.current = false;
    offlineReportedRef.current = false;
    emptyReportedRef.current = false;
  }, [contextToken]);

  const hasPayload = isSociety ? !!societyData : !!personalData;

  useEffect(() => {
    if (!current || !hasPayload || firstRenderReportedRef.current) {
      return;
    }

    firstRenderReportedRef.current = true;

    trackDashboardFirstUsefulRender({
      durationMs: Date.now() - openedAtRef.current,
      identityKind: current.kind,
      moduleCount: composition.modules.length,
      // Se la query non ha ancora restituito nulla, ciò che si vede viene
      // dalla cache: distinguerlo è il senso dell'evento.
      origin: (isSociety ? societyQuery.data : personalQuery.data)
        ? "network"
        : "cache",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, hasPayload]);

  useEffect(() => {
    if (!current || pageState !== "empty" || emptyReportedRef.current) {
      return;
    }

    emptyReportedRef.current = true;

    trackDashboardEmpty({
      hasAction: !!emptyAction(composition.quickActions, () => undefined),
      identityKind: current.kind,
      interaction: "shown",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, pageState]);

  useEffect(() => {
    if (!current || connection.connection !== "offline") {
      return;
    }

    // Una sola segnalazione per contesto: §33 vieta di duplicare l'evento a
    // ogni render o a ogni tentativo fallito.
    if (offlineReportedRef.current) {
      return;
    }

    offlineReportedRef.current = true;

    trackDashboardOffline({
      hasUsableData: hasPayload,
      identityKind: current.kind,
    });
  }, [connection.connection, current, hasPayload]);

  useEffect(() => {
    if (!current) {
      return;
    }

    trackDashboardOpened({
      identityKind: current.kind,
      moduleCount: composition.modules.length,
      source: "bottom_nav",
    });
    // L'impression si registra al cambio di contesto, non a ogni render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextToken]);

  // ── Refresh (§17) ───────────────────────────────────────────────────────

  const handleRefresh = useCallback(async () => {
    if (!current) {
      return;
    }

    setRefreshing(true);
    trackDashboardRefresh({ identityKind: current.kind, outcome: "started" });

    try {
      // Rivaluta accesso, capability e composizione, non solo i contatori: un
      // refresh può aggiungere o rimuovere moduli e cambiare l'ordine.
      await refresh();

      const results = await Promise.all(
        isSociety
          ? [societyQuery.refetch(), positionsQuery.refetch()]
          : [personalQuery.refetch()],
      );

      // Il completamento non richiede che ogni dominio abbia avuto successo,
      // ma i fallimenti residui vanno riportati. Il fallimento del provider
      // primario è l'unico che rende "non aggiornata" l'intera Dashboard:
      // quello delle Posizioni resta un errore locale del suo modulo.
      const primary = results[0];

      if (primary.error) {
        const category = connection.reportFailure(primary.error);

        trackDashboardRefresh({
          category,
          identityKind: current.kind,
          outcome: "failed",
        });

        // Snackbar unica: l'`id` impedisce che tentativi ripetuti ne
        // accodino una seconda (§17).
        showToast({
          action: { label: "Riprova", onPress: () => void handleRefresh() },
          icon: "information-circle-outline",
          id: "dashboard-refresh-failed",
          message: "Impossibile aggiornare la Dashboard.",
        });

        return;
      }

      trackDashboardRefresh({
        identityKind: current.kind,
        outcome: "succeeded",
      });

      // Il refresh esplicito è un momento sicuro: l'ordine aggiornato può
      // essere applicato, se nel frattempo l'utente non ha ripreso a
      // interagire (§12).
      setSafePoint((value) => value + 1);
    } finally {
      setRefreshing(false);
    }
  }, [
    connection,
    current,
    isSociety,
    personalQuery,
    positionsQuery,
    refresh,
    showToast,
    societyQuery,
  ]);

  function openSelector() {
    trackSelectorOpened(identities.length);
    setSheetOpen(true);
  }

  function handleSelect(identityId: string) {
    const target = identities.find((identity) => identity.id === identityId);

    if (target) {
      trackIdentitySwitchRequested(target.kind);
    }

    selectIdentity(identityId);
  }

  function go(moduleId: string, href: string) {
    if (current) {
      trackModuleAction({
        action: "cta",
        identityKind: current.kind,
        moduleId,
      });
    }

    router.push(href as never);
  }

  // ── Stato di pagina ─────────────────────────────────────────────────────

  const header = (
    <AppText accessibilityRole="header" variant="screenTitle">
      Dashboard
    </AppText>
  );

  const isHydrated = isSociety ? societyCache.isHydrated : personalCache.isHydrated;

  // Il primo caricamento mostra subito shell, identità nota e skeleton: la
  // composizione non è nota finché l'elenco identità non è risolto.
  if (isIdentityLoading || !isHydrated) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.content}>
          {header}
          <DashboardSkeleton />
        </ScrollView>
      </Screen>
    );
  }

  if (identitiesError) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.content}>
          {header}
          {connection.connection === "offline" ? (
            <DashboardGlobalOffline onRetry={() => void handleRefresh()} />
          ) : (
            <DashboardGlobalError onRetry={() => void handleRefresh()} />
          )}
        </ScrollView>
      </Screen>
    );
  }

  if (!current) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.content}>
          {header}
          <DashboardNoIdentity />
        </ScrollView>
      </Screen>
    );
  }

  if (pageState === "unavailable") {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.content}>
          {header}

          {presentation !== "hidden" ? (
            <DashboardIdentityRow
              identity={current}
              onPress={openSelector}
              selectable={presentation === "selectable"}
            />
          ) : null}

          {isOfflineWithoutData({
            connection: connection.connection,
            pageState,
          }) ? (
            <DashboardGlobalOffline onRetry={() => void handleRefresh()} />
          ) : (
            <DashboardGlobalError onRetry={() => void handleRefresh()} />
          )}
        </ScrollView>
      </Screen>
    );
  }

  if (pageState === "empty") {
    const copy = emptyCopy(composition.quickActions, isSociety);
    const action = emptyAction(composition.quickActions, go);

    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.content}>
          {header}

          {presentation !== "hidden" ? (
            <DashboardIdentityRow
              identity={current}
              onPress={openSelector}
              selectable={presentation === "selectable"}
            />
          ) : null}

          <DashboardGlobalEmpty
            copy={copy}
            onAction={
              action
                ? () => {
                    trackDashboardEmpty({
                      hasAction: true,
                      identityKind: current.kind,
                      interaction: "cta",
                    });
                    action();
                  }
                : null
            }
          />
        </ScrollView>

        <DashboardIdentitySheet
          currentId={current.id}
          identities={identities}
          onClose={() => setSheetOpen(false)}
          onSelect={handleSelect}
          visible={isSheetOpen}
        />
      </Screen>
    );
  }

  const summary = isSociety
    ? buildSocietySummary(societyData ?? undefined)
    : buildPersonalSummary(personalData ?? undefined);

  const priorities = ranking.visible.map((priority, index) => ({
    accessibilityLabel: [
      priority.actionLabel,
      priority.title,
      priority.contextLabel,
    ]
      .filter(Boolean)
      .join(", "),
    actionLabel: priority.actionLabel,
    description: priority.contextLabel,
    icon: PRIORITY_ICONS[priority.definition.id],
    id: priority.key,
    onPress: () => {
      trackPriorityTap({
        identityKind: current.kind,
        position: index,
        typeId: priority.definition.id,
      });

      // Aprire la destinazione canonica **non** risolve la priorità: la
      // risoluzione arriva dal dominio (§10, QA-05).
      router.push(priority.href as never);
    },
    title: priority.title,
  })) satisfies DashboardPriorityItem[];

  const quickActions = buildQuickActions(composition.quickActions, go);

  // Offline con dati ancora utilizzabili: indicatore compatto, nessun
  // overlay disabilitante (master 05).
  const showOfflineNotice =
    connection.connection === "offline" && pageState === "ready";

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        onScrollBeginDrag={() => setInteracting(true)}
        onMomentumScrollEnd={() => setInteracting(false)}
        onScrollEndDrag={() => setInteracting(false)}
        ref={scrollRef}
        refreshControl={
          <RefreshControl
            onRefresh={() => void handleRefresh()}
            refreshing={isRefreshing}
          />
        }
      >
        {header}

        {presentation !== "hidden" ? (
          <DashboardIdentityRow
            identity={current}
            onPress={openSelector}
            selectable={presentation === "selectable"}
          />
        ) : null}

        {showOfflineNotice ? <DashboardOfflineNotice /> : null}

        {summary.length > 0 ? <DashboardSummary metrics={summary} /> : null}

        <DashboardPriority items={priorities} />

        <DashboardQuickActions actions={quickActions} />

        {order.modules.map((module) => (
          <ModuleRenderer
            key={module.id}
            moduleId={module.id}
            onNavigate={go}
            onRetryPositions={() => void positionsQuery.refetch()}
            personal={personalData}
            personalError={!!personalQuery.error}
            positions={positionsData}
            positionsError={!!positionsQuery.error}
            positionsRetrying={positionsQuery.isFetching}
            society={societyData}
            societyError={!!societyQuery.error}
            title={module.title}
          />
        ))}
      </ScrollView>

      <DashboardIdentitySheet
        currentId={current.id}
        identities={identities}
        onClose={() => setSheetOpen(false)}
        onSelect={handleSelect}
        visible={isSheetOpen}
      />
    </Screen>
  );
}

// ── Stato offline e analytics ─────────────────────────────────────────────

/** Plurale corretto: "1 Programmato", "2 Programmati". */
function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/**
 * Righe utili per modulo.
 *
 * `null` significa **non ancora noto**: in errore o in caricamento. È la
 * distinzione che impedisce di convertire un fallimento in una lista vuota
 * (§13) — uno 0 dichiara che il modulo ha risposto e non ha nulla.
 */
function moduleRowCounts(input: {
  personal: PersonalDashboardData | null | undefined;
  positions: SocietyPositionPreview[] | null;
  positionsFailed: boolean;
  society: SocietyOverview | null | undefined;
}): Partial<Record<DashboardModuleId, number | null>> {
  const society = input.society;
  const personal = input.personal;

  return {
    personal_applications: personal ? personal.applications.length : null,
    personal_saved_positions: personal ? personal.savedPositions.length : null,
    society_applications: society
      ? (society.applicationsPreview?.length ?? 0)
      : null,
    society_areas: society ? 1 : null,
    society_drafts: society ? (society.draftsPreview?.length ?? 0) : null,
    society_positions: input.positionsFailed
      ? null
      : (input.positions?.length ?? null),
    society_recent_content: society
      ? (society.recentContentPreview?.length ?? 0)
      : null,
  };
}

/**
 * Segnali di priorità dell'identità personale.
 *
 * La condizione è di **stato** e non di evento: l'actor si è dichiarato
 * disponibile al trasferimento senza indicare dove. Non esiste un istante da
 * usare come recency, e inventarne uno (per esempio `Date.now()`) la
 * porterebbe sistematicamente in cima: resta l'epoch, cioè l'ultimo posto a
 * parità di tutto il resto.
 */
function buildPersonalSignals(
  actorId: string,
  data: PersonalDashboardData | null | undefined,
): PrioritySignal[] {
  if (!data?.needsAvailability || !actorId) {
    return [];
  }

  return [
    {
      aggregationKey: `availability_required:${actorId}`,
      contextLabel: "Indica le aree in cui cerchi squadra.",
      count: 1,
      deadlineAt: null,
      impact: null,
      occurredAt: new Date(0).toISOString(),
      revision: 0,
      targetId: actorId,
      targetKind: "profile_section",
      typeId: "availability_required",
    },
  ];
}

/**
 * Copy dell'empty globale (§20).
 *
 * Non si impone il testo "candidature e posizioni salvate" a un'identità la
 * cui composizione non le contiene: la scelta guarda le azioni rapide
 * effettivamente autorizzate, non il nome del ruolo.
 */
function emptyCopy(
  quickActions: QuickActionId[],
  isSociety: boolean,
): DashboardEmptyCopy {
  if (isSociety) {
    return {
      actionLabel: "Nuova posizione",
      body: "Pubblica una posizione per iniziare a ricevere candidature.",
      icon: "briefcase-outline",
      title: "Non hai ancora posizioni aperte",
    };
  }

  if (quickActions.includes("personal_search_positions")) {
    return {
      actionLabel: "Cerca posizioni",
      body: "Non hai ancora candidature o posizioni salvate. Cerca nuove opportunità su PROLINK.",
      icon: "search-outline",
      title: "Inizia da qui",
    };
  }

  return {
    actionLabel: "",
    body: "Qui compariranno le attività da gestire.",
    icon: "sparkles-outline",
    title: "Non hai attività da gestire",
  };
}

/**
 * Azione dell'empty globale, oppure `null`.
 *
 * `null` non è un ripiego: §20 vieta il pulsante disabled che pubblicizza un
 * permesso mancante, e uno stato senza CTA è valido.
 */
function emptyAction(
  quickActions: QuickActionId[],
  go: (moduleId: string, href: string) => void,
): (() => void) | null {
  if (quickActions.includes("society_new_position")) {
    return () => go("society_empty_cta", "/(tabs)/announcements");
  }

  if (quickActions.includes("personal_search_positions")) {
    return () => go("personal_empty_cta", "/(tabs)/cerca");
  }

  return null;
}

function buildPersonalSummary(
  data: PersonalDashboardData | undefined,
): SummaryMetric[] {
  if (!data) {
    return [];
  }

  return [
    {
      accessibilityLabel: `${data.activeApplicationsCount} ${plural(
        data.activeApplicationsCount,
        "candidatura attiva",
        "candidature attive",
      )}`,
      id: "active_applications",
      label: plural(
        data.activeApplicationsCount,
        "Candidatura attiva",
        "Candidature attive",
      ),
      value: data.activeApplicationsCount,
    },
    {
      accessibilityLabel: `${data.savedPositionsCount} ${plural(
        data.savedPositionsCount,
        "posizione salvata",
        "posizioni salvate",
      )}`,
      id: "saved_positions",
      label: plural(
        data.savedPositionsCount,
        "Posizione salvata",
        "Posizioni salvate",
      ),
      value: data.savedPositionsCount,
    },
  ];
}

/**
 * Una metrica `null` non diventa zero: significa "non autorizzato" e la
 * metrica sparisce. Il riepilogo di una Società senza capability sportive
 * mostra solo le metriche editoriali, e viceversa.
 *
 * Il riepilogo mostra il **totale** delle candidature (27 del master), non
 * quelle da gestire (5): §11 vieta di ripetere lo stesso messaggio numerico
 * su riepilogo, priorità e preview.
 */
function buildSocietySummary(
  data: SocietyOverview | undefined,
): SummaryMetric[] {
  if (!data) {
    return [];
  }

  const metrics: SummaryMetric[] = [];

  if (data.positionsOpenCount !== null) {
    metrics.push({
      accessibilityLabel: `${data.positionsOpenCount} ${plural(
        data.positionsOpenCount,
        "posizione aperta",
        "posizioni aperte",
      )}`,
      id: "positions_open",
      label: plural(
        data.positionsOpenCount,
        "Posizione aperta",
        "Posizioni aperte",
      ),
      value: data.positionsOpenCount,
    });
  }

  if (data.applicationsCount !== null) {
    metrics.push({
      accessibilityLabel: `${data.applicationsCount} ${plural(
        data.applicationsCount,
        "candidatura",
        "candidature",
      )}`,
      id: "applications",
      label: plural(data.applicationsCount, "Candidatura", "Candidature"),
      value: data.applicationsCount,
    });
  }

  if (data.draftsCount !== null) {
    metrics.push({
      accessibilityLabel: `${data.draftsCount} ${plural(
        data.draftsCount,
        "bozza",
        "bozze",
      )}`,
      id: "drafts",
      label: plural(data.draftsCount, "Bozza", "Bozze"),
      value: data.draftsCount,
    });
  }

  if (data.scheduledCount !== null) {
    metrics.push({
      accessibilityLabel: `${data.scheduledCount} ${plural(
        data.scheduledCount,
        "contenuto programmato",
        "contenuti programmati",
      )}`,
      id: "scheduled",
      label: plural(data.scheduledCount, "Programmato", "Programmati"),
      value: data.scheduledCount,
    });
  }

  return metrics.slice(0, 4);
}

function buildQuickActions(
  ids: QuickActionId[],
  go: (moduleId: string, href: string) => void,
): QuickAction[] {
  return ids.map((id) => {
    switch (id) {
      case "personal_search_positions":
        return {
          icon: "search-outline" as const,
          id,
          label: "Cerca posizioni",
          onPress: () => go(id, "/(tabs)/cerca"),
        };
      case "society_new_position":
        return {
          icon: "add-outline" as const,
          id,
          label: "Nuova posizione",
          onPress: () => go(id, "/(tabs)/announcements"),
        };
      case "society_invite_person":
        return {
          icon: "person-add-outline" as const,
          id,
          label: "Invita persona",
          onPress: () => go(id, "/club-admin/invites"),
        };
      case "society_new_post":
      case "society_new_article":
      default:
        return {
          icon: "create-outline" as const,
          id,
          label: "Nuovo contenuto",
          onPress: () => go(id, "/(tabs)/profile?compose=club"),
        };
    }
  });
}

// ── Moduli ────────────────────────────────────────────────────────────────

type ModuleRendererProps = {
  moduleId: DashboardModuleId;
  onNavigate: (moduleId: string, href: string) => void;
  onRetryPositions: () => void;
  personal: PersonalDashboardData | null | undefined;
  personalError: boolean;
  positions: SocietyPositionPreview[] | null;
  positionsError: boolean;
  positionsRetrying: boolean;
  society: SocietyOverview | null | undefined;
  societyError: boolean;
  title: string;
};

/**
 * Un modulo sconosciuto non arriva mai qui: la composizione lavora sul
 * registry, quindi ogni id ha per costruzione un renderer. Il `default`
 * esiste per il caso in cui il registry cresca senza il renderer
 * corrispondente — e in quel caso il modulo sparisce invece di rompere la
 * pagina.
 */
function ModuleRenderer({
  moduleId,
  onNavigate,
  onRetryPositions,
  personal,
  personalError,
  positions,
  positionsError,
  positionsRetrying,
  society,
  societyError,
  title,
}: ModuleRendererProps) {
  switch (moduleId) {
    case "personal_applications":
      return (
        <DataModule
          action={{
            label: "Vedi tutte",
            onPress: () => onNavigate(moduleId, "/(tabs)/announcements"),
          }}
          emptyMessage="Non hai candidature attive."
          errorMessage="Non siamo riusciti a caricare le candidature."
          hasData={!!personal}
          hideWhenEmpty
          isEmpty={(personal?.applications ?? []).length === 0}
          isError={personalError}
          title={title}
        >
          {(personal?.applications ?? []).map((item, index) => (
            <DashboardEntityRow
              avatarName={item.clubName}
              avatarUrl={item.clubLogoUrl}
              key={item.id}
              meta={item.clubName}
              onPress={() => onNavigate(moduleId, `/position/${item.adId}`)}
              showDivider={index > 0}
              status={
                APPLICATION_STATUS_LABELS[
                  item.status as keyof typeof APPLICATION_STATUS_LABELS
                ] ?? null
              }
              title={getPlayerPositionLabel(item.role, item.role)}
            />
          ))}
        </DataModule>
      );

    case "personal_saved_positions":
      return (
        <DataModule
          action={{
            label: "Vedi tutte",
            onPress: () => onNavigate(moduleId, "/saved"),
          }}
          emptyMessage="Non hai posizioni salvate."
          errorMessage="Non siamo riusciti a caricare le posizioni."
          hasData={!!personal}
          hideWhenEmpty
          isEmpty={(personal?.savedPositions ?? []).length === 0}
          isError={personalError}
          title={title}
        >
          {(personal?.savedPositions ?? []).map((item, index) => (
            <DashboardEntityRow
              avatarName={item.clubName}
              avatarUrl={item.clubLogoUrl}
              key={item.adId}
              meta={item.clubName}
              onPress={() => onNavigate(moduleId, `/position/${item.adId}`)}
              showDivider={index > 0}
              title={getPlayerPositionLabel(item.role, item.role)}
            />
          ))}
        </DataModule>
      );

    case "society_positions":
      return (
        <DataModule
          action={{
            label: "Gestisci",
            onPress: () => onNavigate(moduleId, "/(tabs)/announcements"),
          }}
          emptyMessage="Nessuna posizione aperta."
          // Copy specifica richiesta da §18 per questo modulo.
          errorMessage="Non siamo riusciti a caricare le posizioni."
          hasData={!!positions}
          isEmpty={(positions ?? []).length === 0}
          isError={positionsError}
          isRetrying={positionsRetrying}
          onRetry={onRetryPositions}
          title={title}
        >
          {(positions ?? []).map((item, index) => (
            <DashboardEntityRow
              icon="shirt-outline"
              key={item.id}
              meta={[item.teamName, item.category].filter(Boolean).join(" · ")}
              onPress={() => onNavigate(moduleId, `/position/${item.id}`)}
              showDivider={index > 0}
              title={getPlayerPositionLabel(item.role, item.role)}
            />
          ))}
        </DataModule>
      );

    case "society_applications":
      return (
        <DataModule
          action={{
            label: "Vedi tutte",
            onPress: () => onNavigate(moduleId, "/(tabs)/announcements"),
          }}
          emptyMessage="Nessuna candidatura ricevuta."
          errorMessage="Non siamo riusciti a caricare le candidature."
          hasData={!!society}
          isEmpty={(society?.applicationsPreview ?? []).length === 0}
          isError={societyError}
          title={title}
        >
          {(society?.applicationsPreview ?? []).map((item, index) => (
            <DashboardEntityRow
              avatarName={item.name}
              avatarUrl={item.avatarUrl}
              key={item.id}
              meta={[
                getPlayerPositionLabel(item.role, item.role),
                item.teamName,
              ]
                .filter(Boolean)
                .join(" · ")}
              onPress={() => onNavigate(moduleId, `/position/${item.adId}`)}
              showDivider={index > 0}
              status={
                APPLICATION_STATUS_LABELS[
                  item.status as keyof typeof APPLICATION_STATUS_LABELS
                ] ?? null
              }
              title={item.name}
            />
          ))}
        </DataModule>
      );

    case "society_drafts":
      return (
        <DataModule
          action={{
            label: "Vedi tutti",
            onPress: () => onNavigate(moduleId, "/(tabs)/profile?compose=club"),
          }}
          emptyMessage="Nessuna bozza."
          errorMessage="Non siamo riusciti a caricare le bozze."
          hasData={!!society}
          hideWhenEmpty
          isEmpty={(society?.draftsPreview ?? []).length === 0}
          isError={societyError}
          title={title}
        >
          {(society?.draftsPreview ?? []).map((item, index) => (
            <DashboardEntityRow
              key={item.id}
              meta="Bozza"
              onPress={() =>
                onNavigate(moduleId, `/content/club_media/${item.id}`)
              }
              showDivider={index > 0}
              thumbnailUrl={item.thumbnailUrl}
              title={item.title}
            />
          ))}
        </DataModule>
      );

    case "society_recent_content":
      return (
        <DataModule
          action={{
            label: "Vedi tutti",
            onPress: () => onNavigate(moduleId, "/(tabs)/profile"),
          }}
          emptyMessage="Nessun contenuto pubblicato."
          errorMessage="Non siamo riusciti a caricare i contenuti."
          hasData={!!society}
          hideWhenEmpty
          isEmpty={(society?.recentContentPreview ?? []).length === 0}
          isError={societyError}
          title={title}
        >
          {(society?.recentContentPreview ?? []).map((item, index) => (
            <DashboardEntityRow
              key={item.id}
              meta="Pubblicato"
              onPress={() =>
                onNavigate(moduleId, `/content/club_media/${item.id}`)
              }
              showDivider={index > 0}
              thumbnailUrl={item.thumbnailUrl}
              title={item.title}
            />
          ))}
        </DataModule>
      );

    case "society_areas": {
      if (!society) {
        return null;
      }

      const items: AreaRowItem[] = [];

      if (society.positionsOpenCount !== null) {
        items.push({
          count: society.positionsOpenCount,
          icon: "briefcase-outline",
          id: "positions",
          onPress: () => onNavigate(moduleId, "/(tabs)/announcements"),
          title: "Posizioni aperte",
        });
      }

      if (society.teamsCount !== null) {
        items.push({
          count: society.teamsCount,
          icon: "people-circle-outline",
          id: "teams",
          onPress: () => onNavigate(moduleId, "/club-admin/teams"),
          title: "Squadre del club",
        });
      }

      if (items.length === 0) {
        return null;
      }

      return (
        <DashboardSection title={title}>
          <DashboardAreaRows items={items} />
        </DashboardSection>
      );
    }

    default:
      return null;
  }
}

type DataModuleProps = {
  action?: { label: string; onPress: () => void };
  children: React.ReactNode;
  emptyMessage: string;
  errorMessage: string;
  /** Esiste un payload utilizzabile — da rete o da cache. */
  hasData: boolean;
  hideWhenEmpty?: boolean;
  isEmpty: boolean;
  isError: boolean;
  isRetrying?: boolean;
  onRetry?: () => void;
  title: string;
};

/**
 * Guscio comune ai moduli che dipendono da un provider.
 *
 * Tiene separati i tre stati che la Dashboard precedente confondeva: in
 * caricamento, in errore (con retry locale, gli altri moduli restano
 * utilizzabili) ed empty da risposta valida.
 *
 * L'ordine dei rami è il requisito: **prima i dati**. Un modulo che possiede
 * già una lista utilizzabile la conserva anche se l'ultimo tentativo è
 * fallito (§18) — il pannello di errore è per chi non ha nulla da mostrare,
 * che è esattamente il caso del master 04.
 */
function DataModule({
  action,
  children,
  emptyMessage,
  errorMessage,
  hasData,
  hideWhenEmpty = false,
  isEmpty,
  isError,
  isRetrying = false,
  onRetry,
  title,
}: DataModuleProps) {
  if (!hasData && isError) {
    return (
      <DashboardSection title={title}>
        <DashboardModuleError
          isRetrying={isRetrying}
          message={errorMessage}
          onRetry={onRetry ?? (() => undefined)}
        />
      </DashboardSection>
    );
  }

  // Ancora in caricamento: il modulo non occupa spazio finché non ha qualcosa
  // da dire. Lo skeleton globale copre il primo caricamento, e §16 chiede di
  // mostrare un modulo pronto senza aspettare quello più lento.
  if (!hasData) {
    return null;
  }

  if (isEmpty) {
    return hideWhenEmpty ? null : (
      <DashboardSection title={title}>
        <DashboardModuleEmpty message={emptyMessage} />
      </DashboardSection>
    );
  }

  return (
    <DashboardSection action={action} title={title}>
      <View>{children}</View>
    </DashboardSection>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[20],
    paddingBottom: spacing[40],
  },
});
