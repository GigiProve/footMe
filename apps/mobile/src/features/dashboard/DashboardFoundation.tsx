import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Screen } from "../../components/ui/screen";
import { useSession } from "../auth/use-session";
import { getPlayerPositionLabel } from "../profiles/player-sports";
import { APPLICATION_STATUS_LABELS } from "../recruiting/recruiting-service";
import {
  applicationStatusLabel,
  POSITION_CLOSED_A11Y,
  POSITION_CLOSED_NOTE,
  SELECTION_COMPLETED_LABEL,
} from "../applications/application-presentation";
import { colors, sizes, spacing } from "../../theme/tokens";
import { AppText, useToast } from "../../ui";

import {
  fetchPersonalApplications,
  fetchPersonalDashboard,
  fetchPersonalSavedPositions,
  isPersonalApplicationsData,
  isPersonalDashboardData,
  isPersonalSavedPositionsData,
  type PersonalApplicationsData,
  type PersonalDashboardData,
  type PersonalSavedPositionsData,
  type PersonalUpdate,
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
import { DashboardFirstRun } from "./components/DashboardFirstRun";
import { DashboardIdentityRow } from "./components/DashboardIdentityRow";
import { DashboardInvitesRow } from "./components/DashboardInvitesRow";
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
import { DashboardSuggestion } from "./components/DashboardSuggestion";
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
import type { DashboardIdentity } from "./dashboard-types";
import { DASHBOARD_QK } from "./dashboard-keys";
import { useDashboardCache } from "./cache/use-dashboard-cache";
import { STALE_MS } from "./cache/freshness-policy";
import { useDashboardIdentity } from "./identity/use-dashboard-identity";
import { composeDashboard, type QuickActionId } from "./modules/composition";
import type { DashboardModuleId } from "./modules/module-registry";
import {
  aggregateRequirements,
  formatDeadlineRowLabel,
  formatUpdateLabel,
  hasSignificantUpdate,
  recentUpdatesBudget,
  selectApplicationPreviews,
  SUGGESTION_COPY,
} from "./personal/personal-presentation";
import {
  aggregatedUpdateLabel,
  buildSavedUpdateRows,
  formatSavedAtLabel,
  SAVED_AVAILABLE_HREF,
  SAVED_UNAVAILABLE_HREF,
  selectSavedPreviews,
  SINGLE_UPDATE_NOTE,
  type SavedUpdateRow,
} from "./personal/saved-positions-presentation";
import { useToggleDashboardSavedAd } from "./personal/use-toggle-saved-ad";
import {
  buildManagementAreas,
  societyApplicationStatusLabel,
  societyFirstRunProposals,
  societyInviteLines,
  SOCIETY_HREFS,
  teamContextLabel,
} from "./society/society-presentation";
import { applyPromotion } from "./priority/module-order";
import { rankPriorities } from "./priority/priority-ranking";
import type {
  PrioritySignal,
  ResolvedPriority,
} from "./priority/priority-types";
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
  const toggleSaved = useToggleDashboardSavedAd({
    actorId,
    identityId: current?.id ?? "none",
  });

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

  // Record separato per le candidature: DAS-REV-04 §17 chiede che il loro
  // errore resti locale al modulo mentre il riepilogo resta visibile (screen
  // 06), e senza uno `scope` distinto i payload si sovrascriverebbero.
  const applicationsCache = useDashboardCache<PersonalApplicationsData>({
    actorId,
    identity: current && !isSociety ? current : null,
    isPayload: isPersonalApplicationsData,
    provider: "operational",
    scope: "applications",
  });

  // Terzo record per la stessa identità: le Posizioni salvate hanno un
  // provider proprio perché §22 chiede che il loro errore resti locale, e
  // senza uno `scope` distinto il secondo payload sovrascriverebbe il primo.
  const savedPositionsCache = useDashboardCache<PersonalSavedPositionsData>({
    actorId,
    identity: current && !isSociety ? current : null,
    isPayload: isPersonalSavedPositionsData,
    provider: "operational",
    scope: "saved_positions",
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
    queryFn: () => fetchPersonalDashboard(),
    queryKey: DASHBOARD_QK.module(actorId, current?.id ?? "none", "personal"),
    staleTime: STALE_MS.operational,
    ...retryOptions,
  });

  const applicationsQuery = useQuery({
    enabled: !!actorId && !!current && !isSociety,
    queryFn: () => fetchPersonalApplications(),
    queryKey: DASHBOARD_QK.module(
      actorId,
      current?.id ?? "none",
      "personal_applications",
    ),
    staleTime: STALE_MS.operational,
    ...retryOptions,
  });

  const savedPositionsQuery = useQuery({
    enabled: !!actorId && !!current && !isSociety,
    queryFn: () => fetchPersonalSavedPositions(),
    queryKey: DASHBOARD_QK.module(
      actorId,
      current?.id ?? "none",
      "personal_saved_positions",
    ),
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

  useEffect(() => {
    const data = applicationsQuery.data;

    if (!data || !current) {
      return;
    }

    applicationsCache.store(data, Date.now(), Date.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, applicationsQuery.data]);

  useEffect(() => {
    const data = savedPositionsQuery.data;

    if (!data || !current) {
      return;
    }

    savedPositionsCache.store(data, Date.now(), Date.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, savedPositionsQuery.data]);

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

  useEffect(() => {
    if (!applicationsQuery.error || !current) {
      return;
    }

    // §25: l'errore locale del modulo è un evento diagnostico proprio, non
    // un fallimento della Dashboard. Nessun identificativo di risorsa.
    trackDashboardModuleError({
      category: classifyDashboardError(applicationsQuery.error),
      moduleId: "personal_applications",
    });
  }, [current, applicationsQuery.error]);

  useEffect(() => {
    if (!savedPositionsQuery.error || !current) {
      return;
    }

    trackDashboardModuleError({
      category: classifyDashboardError(savedPositionsQuery.error),
      moduleId: "personal_saved_positions",
    });
  }, [current, savedPositionsQuery.error]);

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
  const applicationsData: PersonalApplicationsData | null | undefined =
    applicationsQuery.data ?? applicationsCache.payload;
  const savedPositionsData: PersonalSavedPositionsData | null | undefined =
    savedPositionsQuery.data ?? savedPositionsCache.payload;
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
    applications: applicationsData,
    applicationsFailed: applicationsQuery.isError,
    personal: personalData,
    positions: positionsData,
    positionsFailed: positionsQuery.isError,
    saved: savedPositionsData,
    savedFailed: savedPositionsQuery.isError,
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

  // I segnali personali arrivano già normalizzati dalla fonte autorevole:
  // §15 vieta che il client decida eligibility o confronti il cutoff con
  // l'orologio del dispositivo.
  const signals: PrioritySignal[] = isSociety
    ? (societyData?.prioritySignals ?? [])
    : (personalData?.prioritySignals ?? []);

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
          : [
              personalQuery.refetch(),
              applicationsQuery.refetch(),
              savedPositionsQuery.refetch(),
            ],
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
    applicationsQuery,
    connection,
    current,
    isSociety,
    personalQuery,
    positionsQuery,
    refresh,
    savedPositionsQuery,
    showToast,
    societyQuery,
  ]);

  // ── Riconciliazione al ritorno dai flussi (§22) ─────────────────────────
  //
  // La Dashboard manda l'actor dentro flussi che **mutano** il dominio: una
  // Posizione pubblicata o chiusa, una candidatura valutata, un invito
  // accettato. Tornare indietro su totali, priorità e preview della
  // schermata precedente mostrerebbe un lavoro che non esiste più.
  //
  // Non è un ricaricamento incondizionato: §22 chiede di «verificare
  // freshness e accesso» e vieta di «forzare un caricamento completo se la
  // cache è ancora utilizzabile». Si aggiorna solo ciò che è davvero stale,
  // e il primo focus — che è il montaggio — non aggiorna niente.

  const hasFocusedRef = useRef(false);

  useEffect(() => {
    hasFocusedRef.current = false;
  }, [contextToken]);

  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedRef.current) {
        hasFocusedRef.current = true;
        return;
      }

      const now = Date.now();
      const refetchIfStale = (query: {
        dataUpdatedAt: number;
        refetch: () => unknown;
      }) => {
        if (now - query.dataUpdatedAt >= STALE_MS.operational) {
          query.refetch();
        }
      };

      if (isSociety) {
        refetchIfStale(societyQuery);
        refetchIfStale(positionsQuery);
      } else {
        refetchIfStale(personalQuery);
        refetchIfStale(applicationsQuery);
        refetchIfStale(savedPositionsQuery);
      }

      // Il ritorno da un'azione è un momento sicuro: l'ordine proposto può
      // essere applicato senza spostare la pagina sotto le dita (§7).
      setSafePoint((value) => value + 1);
    }, [
      applicationsQuery,
      isSociety,
      personalQuery,
      positionsQuery,
      savedPositionsQuery,
      societyQuery,
    ]),
  );

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

  // Il personale ha due provider: la shell resta in skeleton finché
  // entrambi i record di cache sono stati letti, altrimenti il modulo
  // Salvati comparirebbe dopo gli altri anche quando ha dati in cache.
  const isHydrated = isSociety
    ? societyCache.isHydrated
    : personalCache.isHydrated &&
      applicationsCache.isHydrated &&
      savedPositionsCache.isHydrated;

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
    /**
     * §18, master 04: una Società appena attivata non riceve il Global Empty
     * generico ma "Inizia da qui" con al massimo due proposte autorizzate.
     *
     * Le proposte **sono** le azioni rapide di questo stato: §11 vieta di
     * duplicarle in una sezione "Azioni rapide" accanto, e §18 vieta il
     * riepilogo pieno di zeri sopra di esse.
     */
    const firstRun = isSociety
      ? societyFirstRunProposals(composition.quickActions)
      : [];

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

          {firstRun.length > 0 ? (
            <DashboardFirstRun
              proposals={firstRun.map((proposal) => ({
                actionLabel: proposal.actionLabel,
                body: proposal.body,
                icon: proposal.icon,
                id: proposal.id,
                onPress: () => {
                  trackDashboardEmpty({
                    hasAction: true,
                    identityKind: current.kind,
                    interaction: "cta",
                  });
                  go(`society_first_run_${proposal.id}`, proposal.href);
                },
                title: proposal.title,
              }))}
            />
          ) : (
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
          )}
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
    ? buildSocietySummary(societyData ?? undefined, go)
    : buildPersonalSummary(personalData ?? undefined, go);

  const priorities = ranking.visible.map((priority, index) => {
    const description = isSociety
      ? priority.contextLabel
      : describePersonalPriority(priority);

    return {
      // §25: lo screen reader annuncia la scadenza **e** la destinazione.
      accessibilityLabel: [priority.title, description, priority.actionLabel]
        .filter(Boolean)
        .join(". "),
      actionLabel: priority.actionLabel,
      description,
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
      presentation: priority.definition.presentation,
      title: priority.title,
    };
  }) satisfies DashboardPriorityItem[];

  /**
   * §16: con più elementi eleggibili delle due preview mostrate, un accesso
   * contestuale alla lista pertinente. La destinazione è l'area canonica dei
   * Salvati — §16 vieta di creare una pagina "Tutte le scadenze", e il
   * contesto "ordinamento per scadenza" non esiste in quella lista.
   *
   * DAS-REV-05 §15 riallinea quel link: la lista canonica delle posizioni
   * salvate è CER → Posizioni aperte → Salvate, sul filtro Disponibili, che
   * è anche il perimetro delle scadenze promosse.
   */
  const deadlineOverflow =
    !isSociety && (personalData?.deadlinesTotalCount ?? 0) > 2
      ? {
          label: "Vedi tutte le opportunità salvate",
          onPress: () => go("personal_deadlines", SAVED_AVAILABLE_HREF),
        }
      : null;

  const quickActions = buildQuickActions(composition.quickActions, go);

  /**
   * §7 e §12: quando le candidature da gestire promuovono il proprio modulo a
   * principale, le Posizioni non ripetono anche un'anteprima completa e si
   * riducono all'accesso compatto con conteggio dei master 01 e 05.
   *
   * Dipende dalla promozione, non da una variante di schermata: è lo stesso
   * container in una condizione diversa.
   */
  const isPositionsCompact =
    isSociety && order.modules.some((module) => module.id === "society_positions")
      ? ranking.promotedModuleId === "society_applications"
      : false;

  /**
   * Deduplicazione della presentazione (§12).
   *
   * Due regole, entrambe su riferimenti canonici e non su titoli: una
   * scadenza promossa non si ripete nella preview dei Salvati, e un
   * aggiornamento recente non si ripete nella preview delle candidature.
   *
   * Non tocca i conteggi, i bookmark, le candidature o le liste complete: è
   * una regola di presentazione.
   */
  const promotedAdIds = new Set(
    ranking.visible
      .filter((priority) => priority.definition.id === "saved_deadline")
      .map((priority) => priority.signal.targetId),
  );

  const updatesLimit = recentUpdatesBudget(ranking.visible.length);
  const visibleUpdates = (applicationsData?.recentUpdates ?? []).slice(
    0,
    updatesLimit,
  );
  const updatedApplicationIds = new Set(
    visibleUpdates.map((update) => update.applicationId),
  );

  /**
   * DAS-REV-05 §13: gli aggiornamenti di indisponibilità condividono il
   * budget di DAS-REV-03, non ne aprono uno secondo.
   *
   * Gli aggiornamenti delle candidature vengono prima perché riguardano un
   * percorso professionale in corso; i Salvati usano i posti residui. Con
   * più posizioni diventate indisponibili la funzione restituisce una sola
   * row aggregata, quindi un posto basta: §13 vieta di moltiplicare gli
   * alert.
   */
  const savedUpdateRows = buildSavedUpdateRows(
    savedPositionsData?.recentUpdates ?? [],
    updatesLimit - visibleUpdates.length,
  );

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

        <DashboardPriority
          items={priorities}
          overflowAction={deadlineOverflow}
        />

        <DashboardQuickActions actions={quickActions} />

        {order.modules.map((module) => (
          <ModuleRenderer
            key={module.id}
            identity={current}
            isPositionsCompact={isPositionsCompact}
            moduleId={module.id}
            now={rankedAt}
            onNavigate={go}
            applications={applicationsData}
            applicationsError={!!applicationsQuery.error}
            applicationsRetrying={applicationsQuery.isFetching}
            onRetryApplications={() => void applicationsQuery.refetch()}
            onRetryPositions={() => void positionsQuery.refetch()}
            onRetrySaved={() => void savedPositionsQuery.refetch()}
            onToggleSaved={(adId) =>
              toggleSaved.mutate({ adId, isSaved: true })
            }
            personal={personalData}
            personalError={!!personalQuery.error}
            positions={positionsData}
            positionsError={!!positionsQuery.error}
            positionsRetrying={positionsQuery.isFetching}
            promotedAdIds={promotedAdIds}
            saved={savedPositionsData}
            savedError={!!savedPositionsQuery.error}
            savedRetrying={savedPositionsQuery.isFetching}
            savedUpdates={savedUpdateRows}
            society={societyData}
            societyError={!!societyQuery.error}
            title={module.title}
            updatedApplicationIds={updatedApplicationIds}
            updates={visibleUpdates}
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
 * Riga di contesto "Società · Squadra · Categoria" (§9, §10).
 *
 * La categoria entra solo quando **aggiunge** qualcosa: nel dominio il nome
 * della squadra coincide spesso con la categoria ("Primavera", "Under 17"), e
 * ripeterla produrrebbe "Varese Calcio · Primavera · Primavera". §9 chiede la
 * categoria «quando utile e disponibile», non sempre.
 */
function metaLine(
  clubName: string | null,
  teamName: string | null,
  category: string | null,
): string {
  const normalized = (value: string | null) =>
    value?.trim().toLocaleLowerCase("it-IT") ?? "";

  const parts = [clubName, teamName];

  if (category && normalized(category) !== normalized(teamName)) {
    parts.push(category);
  }

  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" · ");
}

/**
 * Righe utili per modulo.
 *
 * `null` significa **non ancora noto**: in errore o in caricamento. È la
 * distinzione che impedisce di convertire un fallimento in una lista vuota
 * (§13) — uno 0 dichiara che il modulo ha risposto e non ha nulla.
 */
function moduleRowCounts(input: {
  applications: PersonalApplicationsData | null | undefined;
  applicationsFailed: boolean;
  personal: PersonalDashboardData | null | undefined;
  positions: SocietyPositionPreview[] | null;
  positionsFailed: boolean;
  saved: PersonalSavedPositionsData | null | undefined;
  savedFailed: boolean;
  society: SocietyOverview | null | undefined;
}): Partial<Record<DashboardModuleId, number | null>> {
  const society = input.society;
  const personal = input.personal;
  // Provider separato: un fallimento resta `null` (non noto) e non diventa
  // una lista vuota, altrimenti l'errore dello screen 06 si travestirebbe da
  // "nessuna candidatura" (DAS-REV-04 §17).
  const applications = input.applicationsFailed ? null : input.applications;

  // DAS-REV-05 §13: aggregati in una row sola, quindi il modulo "esiste" o
  // non esiste. Il budget effettivo è un'altra cosa e vive nel render, dove
  // si conosce il numero di priorità già visibili.
  const savedUpdates =
    !input.savedFailed && (input.saved?.recentUpdates.length ?? 0) > 0 ? 1 : 0;

  return {
    // DAS-REV-04 §16: zero attive **con storico** non è "nessuna attività".
    // Il modulo mostra comunque un blocco reale con l'accesso alle Concluse,
    // e il Global Empty lo renderebbe irraggiungibile: «uno storico esistente
    // deve restare raggiungibile».
    personal_applications: applications
      ? applications.applications.length ||
        (applications.hasCompleted ? 1 : 0)
      : null,
    personal_profile_suggestion: personal
      ? personal.optionalSuggestion
        ? 1
        : 0
      : null,
    // DAS-REV-05 §13: il modulo esiste anche quando l'unica informazione
    // recente riguarda i Salvati. Un aggiornamento di indisponibilità è una
    // row informativa come le altre e occupa lo stesso budget.
    personal_recent_updates: applications
      ? applications.recentUpdates.length + savedUpdates
      : input.savedFailed
        ? null
        : savedUpdates || null,
    // Provider separato: un fallimento resta `null` (non noto) e non diventa
    // una lista vuota, altrimenti un errore si travestirebbe da "nessuna
    // posizione salvata" (§22).
    // DAS-REV-05 §20: zero disponibili **con storico** non è "nessun
    // salvataggio". Il modulo resta a schermo con l'accesso compatto allo
    // storico, quindi conta come riga utile.
    personal_saved_positions: input.savedFailed
      ? null
      : input.saved
        ? input.saved.preview.length ||
          (input.saved.unavailableCount > 0 ? 1 : 0)
        : null,
    society_applications: society
      ? (society.applicationsPreview?.length ?? 0)
      : null,
    society_areas: society ? 1 : null,
    society_drafts: society ? (society.draftsPreview?.length ?? 0) : null,
    // DAS-REV-07 §14: il modulo esiste quando almeno un aggregato è
    // consultabile. Un aggregato `null` non è uno zero da disegnare.
    society_invites: society ? societyInviteLines(society).length : null,
    society_positions: input.positionsFailed
      ? null
      : (input.positions?.length ?? null),
    society_recent_content: society
      ? (society.recentContentPreview?.length ?? 0)
      : null,
    society_teams: society ? (society.teamsPreview?.length ?? 0) : null,
  };
}

/**
 * Contesto e descrizione di una priorità personale (§13, §16).
 *
 * Il backend manda i pezzi, non la frase: qui si compone con le stesse
 * tabelle di localizzazione usate altrove. Una scadenza illeggibile non
 * produce una frase inventata — resta senza descrizione, e la promozione era
 * comunque già stata decisa server-side.
 */
function describePersonalPriority(priority: ResolvedPriority): string | null {
  const { payload } = priority.signal;

  if (priority.definition.id === "saved_deadline") {
    return priority.signal.deadlineAt
      ? formatDeadlineRowLabel(priority.signal.deadlineAt, {
          actionType: "apply",
          timeZone: payload?.deadlineTimezone ?? null,
        })
      : null;
  }

  if (priority.definition.id === "profile_requirements_missing") {
    return (
      aggregateRequirements(
        payload?.requirements ?? [],
        payload?.hubHref ?? null,
      )?.description ?? null
    );
  }

  return priority.contextLabel;
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
    // DAS-REV-07 §18: «Con soli permessi di consultazione usare un empty
    // state informativo senza azioni non consentite.» Con le azioni invece
    // disponibili non si arriva qui: lo stato è "Inizia da qui" (master 04).
    if (quickActions.length === 0) {
      return {
        actionLabel: "",
        body: "Qui compariranno posizioni, candidature e attività del club.",
        icon: "business-outline",
        title: "Nessuna attività da mostrare",
      };
    }

    return {
      actionLabel: "Nuova posizione",
      body: "Pubblica una posizione per iniziare a ricevere candidature.",
      icon: "briefcase-outline",
      title: "Non hai ancora posizioni aperte",
    };
  }

  if (quickActions.includes("personal_search_positions")) {
    // Copy letterale di §23 (master 06). Una sola CTA: §8 vieta di ripeterla
    // anche in Azioni rapide quando il Global Empty la porta già.
    return {
      actionLabel: "Cerca posizioni",
      body: "Esplora le posizioni aperte e candidati con il tuo profilo.",
      icon: "search-outline",
      title: "Trova la tua prossima opportunità",
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
    return () => go("society_empty_cta", SOCIETY_HREFS.positions());
  }

  if (quickActions.includes("personal_search_positions")) {
    return () => go("personal_empty_cta", "/search/positions");
  }

  return null;
}

/**
 * Riepilogo personale: **due** metriche (§7).
 *
 * Niente follower, visite, like, notifiche, messaggi, compatibilità o
 * completezza; nessun KPI fisso "Aggiornamenti" o "In scadenza".
 *
 * Entrambe sono tappabili perché entrambe hanno una destinazione con lo
 * stesso perimetro del conteggio: le candidature attive aprono Le mie
 * candidature sul filtro attive, le Salvate disponibili aprono CER →
 * Posizioni aperte → Salvate sul filtro Disponibili — che è esattamente ciò
 * che il numero conta.
 *
 * DAS-REV-05 §8 rinomina la seconda metrica: "Salvate disponibili", non
 * "Posizioni salvate". La label dichiara il perimetro, e il perimetro è
 * quello: le non più disponibili restano consultabili nell'altro filtro
 * senza entrare nel conteggio e senza diventare un terzo KPI.
 */
function buildPersonalSummary(
  data: PersonalDashboardData | undefined,
  go: (moduleId: string, href: string) => void,
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
      onPress: () => go("personal_summary", "/applications?filter=active"),
      value: data.activeApplicationsCount,
    },
    {
      accessibilityLabel: `${data.savedPositionsCount} ${plural(
        data.savedPositionsCount,
        "posizione salvata disponibile",
        "posizioni salvate disponibili",
      )}`,
      id: "saved_positions",
      label: plural(
        data.savedPositionsCount,
        "Salvata disponibile",
        "Salvate disponibili",
      ),
      onPress: () => go("personal_summary", SAVED_AVAILABLE_HREF),
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
  // Nessuna destinazione con lo stesso perimetro dei conteggi Società oggi:
  // il parametro esiste per simmetria con il riepilogo personale e per non
  // costringere a cambiare firma quando quelle destinazioni arriveranno.
  _go: (moduleId: string, href: string) => void,
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
        // §20: «Cerca posizioni → CER-04». La home di Cerca è un'altra
        // destinazione: costringerebbe a un passaggio in più proprio
        // nell'unica azione rapida personale.
        return {
          icon: "search-outline" as const,
          id,
          label: "Cerca posizioni",
          onPress: () => go(id, "/search/positions"),
        };
      case "society_new_position":
        return {
          icon: "add-outline" as const,
          id,
          label: "Nuova posizione",
          onPress: () => go(id, SOCIETY_HREFS.positions()),
        };
      case "society_invite_person":
        return {
          icon: "person-add-outline" as const,
          id,
          label: "Invita persona",
          onPress: () => go(id, SOCIETY_HREFS.invites),
        };
      case "society_new_article":
        return {
          icon: "document-text-outline" as const,
          id,
          label: "Nuovo articolo",
          onPress: () => go(id, SOCIETY_HREFS.contentComposer),
        };
      case "society_new_post":
      default:
        // §17 chiede "Nuovo post" e "Nuovo articolo" con capability proprie.
        // Il dominio editoriale della Società ha un composer solo e nessuna
        // distinzione POST/ARTICLE (`club_media_posts.kind` è highlights,
        // interview, market, …), quindi la label resta quella onesta finché
        // HOM-06.1/06.2 non introducono le due tipologie.
        return {
          icon: "create-outline" as const,
          id,
          label: "Nuovo contenuto",
          onPress: () => go(id, SOCIETY_HREFS.contentComposer),
        };
    }
  });
}

// ── Moduli ────────────────────────────────────────────────────────────────

type ModuleRendererProps = {
  applications: PersonalApplicationsData | null | undefined;
  applicationsError: boolean;
  applicationsRetrying: boolean;
  /**
   * Identità corrente: serve alle righe di "Aree di gestione", che §16 vuole
   * filtrate una per una. Il renderer non ricava permessi dai dati — un
   * elenco non è una prova di autorizzazione.
   */
  identity: DashboardIdentity | null;
  /** §12: le Posizioni si riducono all'accesso compatto dei master 01 e 05. */
  isPositionsCompact: boolean;
  moduleId: DashboardModuleId;
  /** Istante congelato del render, per le etichette relative (§28). */
  now: number;
  onNavigate: (moduleId: string, href: string) => void;
  onRetryApplications: () => void;
  onRetryPositions: () => void;
  onRetrySaved: () => void;
  onToggleSaved: (adId: string) => void;
  personal: PersonalDashboardData | null | undefined;
  personalError: boolean;
  positions: SocietyPositionPreview[] | null;
  positionsError: boolean;
  positionsRetrying: boolean;
  /** Ad già mostrati come scadenza promossa in "Da gestire" (§12). */
  promotedAdIds: ReadonlySet<string>;
  saved: PersonalSavedPositionsData | null | undefined;
  savedError: boolean;
  savedRetrying: boolean;
  /** Row informative dei Salvati, già aggregate e dentro il budget (§13). */
  savedUpdates: SavedUpdateRow[];
  society: SocietyOverview | null | undefined;
  societyError: boolean;
  title: string;
  /** Candidature già mostrate in "Aggiornamenti recenti" (§12). */
  updatedApplicationIds: ReadonlySet<string>;
  updates: PersonalUpdate[];
};

/**
 * Un modulo sconosciuto non arriva mai qui: la composizione lavora sul
 * registry, quindi ogni id ha per costruzione un renderer. Il `default`
 * esiste per il caso in cui il registry cresca senza il renderer
 * corrispondente — e in quel caso il modulo sparisce invece di rompere la
 * pagina.
 */
function ModuleRenderer({
  applications,
  applicationsError,
  applicationsRetrying,
  identity,
  isPositionsCompact,
  moduleId,
  now,
  onNavigate,
  onRetryApplications,
  onRetryPositions,
  onRetrySaved,
  onToggleSaved,
  personal,
  personalError,
  positions,
  positionsError,
  positionsRetrying,
  promotedAdIds,
  saved,
  savedError,
  savedRetrying,
  savedUpdates,
  society,
  societyError,
  title,
  updatedApplicationIds,
  updates,
}: ModuleRendererProps) {
  switch (moduleId) {
    /**
     * §11: presentazione informativa, distinta dalle azioni obbligatorie.
     * Nessuna CTA di sezione: aprire la row porta già al dettaglio della
     * candidatura, e una "Vedi tutti" qui duplicherebbe quella del modulo
     * Candidature verso la stessa lista.
     */
    case "personal_recent_updates":
      return (
        <DataModule
          emptyMessage=""
          errorMessage="Non siamo riusciti a caricare gli aggiornamenti."
          // DAS-REV-05 §13: la presentazione è condivisa, i provider no. Il
          // modulo ha qualcosa da dire anche quando risponde solo quello dei
          // Salvati, e l'errore dell'altro resta locale al suo modulo.
          hasData={!!applications || savedUpdates.length > 0}
          hideWhenEmpty
          isEmpty={updates.length === 0 && savedUpdates.length === 0}
          isError={applicationsError && savedUpdates.length === 0}
          title={title}
        >
          {updates.map((item, index) => (
            <DashboardEntityRow
              avatarName={item.clubName}
              avatarUrl={item.clubLogoUrl}
              key={item.applicationId}
              meta={[item.clubName, item.teamName].filter(Boolean).join(" · ")}
              // DAS-REV-04 §15: una conclusione porta allo storico, dove la
              // candidatura è ora reperibile; una candidatura ancora
              // operativa porta al proprio dettaglio. Il focus permette alla
              // lista di evidenziare la row giusta e di consultarne l'evento.
              noteAccessibilityLabel={
                item.isCompleted
                  ? "Apri le candidature concluse."
                  : null
              }
              onPress={() =>
                onNavigate(
                  moduleId,
                  item.isCompleted
                    ? `/applications?filter=completed&focus=${item.applicationId}`
                    : `/applications/${item.applicationId}`,
                )
              }
              showDivider={index > 0}
              // Stato corrente e data dell'evento restano due informazioni
              // separate (§11): "Aggiornata" non è uno stato. Per una
              // selezione conclusa senza esito per candidato vale il generico
              // di §7, mai un esito inventato.
              status={
                item.eventKind === "selection_completed"
                  ? SELECTION_COMPLETED_LABEL
                  : applicationStatusLabel(item.status)
              }
              statusPlacement="trailing"
              title={getPlayerPositionLabel(item.role, item.role)}
              trailingMeta={
                item.isCompleted ? null : formatUpdateLabel(item.occurredAt, now)
              }
            />
          ))}

          {savedUpdates.map((row, index) =>
            row.kind === "single" ? (
              <DashboardEntityRow
                avatarName={row.update.clubName}
                avatarUrl={row.update.clubLogoUrl}
                key={row.key}
                meta={metaLine(
                  row.update.clubName,
                  row.update.teamName,
                  row.update.category,
                )}
                // §13: informazione, non azione. Nessun "Vedi posizione",
                // nessun "Gestisci salvati", nessun "Trova alternative".
                note={SINGLE_UPDATE_NOTE}
                // §13, §23: apre Salvate → Non più disponibili con il focus
                // sulla risorsa. Il bookmark non viene toccato.
                onPress={() =>
                  onNavigate(
                    moduleId,
                    `${SAVED_UNAVAILABLE_HREF}&focus=${row.update.adId}`,
                  )
                }
                showDivider={updates.length > 0 || index > 0}
                title={getPlayerPositionLabel(row.update.role, row.update.role)}
                trailingMeta={formatUpdateLabel(row.update.occurredAt, now)}
              />
            ) : (
              <DashboardEntityRow
                icon="bookmark-outline"
                key={row.key}
                // §13: l'aggregazione conta le transizioni pertinenti del
                // gruppo e apre lo stesso filtro canonico. Nessun elenco di
                // club, nessuna serie di alert equivalenti.
                onPress={() => onNavigate(moduleId, SAVED_UNAVAILABLE_HREF)}
                showDivider={updates.length > 0 || index > 0}
                title={aggregatedUpdateLabel(row.count)}
              />
            ),
          )}
        </DataModule>
      );

    case "personal_applications": {
      // §10: la deduplicazione toglie dalla preview ciò che è già promosso in
      // "Aggiornamenti recenti". La fonte ne manda tre proprio perché la
      // terza possa prendere il posto della row tolta (§8).
      const preview = selectApplicationPreviews(
        applications?.applications ?? [],
        (item) => item.id,
        updatedApplicationIds,
      );
      const visible = preview.items;
      // §16: zero attive con storico non è "nessuna candidatura". Il modulo
      // lo dice e porta alle Concluse, e quel link **sostituisce** la "Vedi
      // tutte" dell'intestazione: una sola azione verso la lista pertinente.
      const hasHistoryOnly =
        visible.length === 0 && !preview.collapsed && !!applications?.hasCompleted;

      return (
        <DataModule
          action={
            hasHistoryOnly
              ? undefined
              : {
                  label: "Vedi tutte",
                  onPress: () =>
                    onNavigate(moduleId, "/applications?filter=active"),
                }
          }
          // §10: tutte le preview già mostrate in alto non producono un falso
          // "Nessuna candidatura" — il modulo si riduce al solo accesso alla
          // lista completa.
          collapsedToAction={preview.collapsed}
          // §16: nessuna candidatura mai inviata. La CTA "Cerca posizioni"
          // non si ripete qui: è già fra le azioni rapide.
          emptyMessage="Nessuna candidatura ancora"
          emptyContent={
            hasHistoryOnly ? (
              <ApplicationsHistoryEmpty
                onPress={() =>
                  onNavigate(moduleId, "/applications?filter=completed")
                }
              />
            ) : undefined
          }
          errorMessage="Non siamo riusciti a caricare le candidature."
          hasData={!!applications}
          isEmpty={visible.length === 0}
          isError={applicationsError}
          isRetrying={applicationsRetrying}
          onRetry={onRetryApplications}
          title={title}
        >
          {visible.map((item, index) => (
            <DashboardEntityRow
              avatarName={item.clubName}
              avatarUrl={item.clubLogoUrl}
              key={item.id}
              // §9: ruolo come titolo, poi società e squadra, categoria
              // «se aggiunge un'informazione utile» — e non la aggiunge
              // quando ripete il nome della squadra, che nel dominio è spesso
              // la categoria stessa ("Primavera", "Under 17").
              meta={metaLine(item.clubName, item.teamName, item.category)}
              // §7: metadato secondario, su riga propria e libero di andare a
              // capo. Non sposta la candidatura fra le Concluse e non
              // sostituisce lo stato reale.
              note={item.positionAccepting ? null : POSITION_CLOSED_NOTE}
              noteAccessibilityLabel={
                item.positionAccepting ? null : POSITION_CLOSED_A11Y
              }
              // §9: la row apre il **dettaglio della candidatura** tramite il
              // suo ID. Aprire la posizione mostrerebbe l'annuncio, non lo
              // stato e il percorso della candidatura.
              onPress={() => onNavigate(moduleId, `/applications/${item.id}`)}
              showDivider={index > 0}
              status={applicationStatusLabel(item.status)}
              statusPlacement="trailing"
              title={getPlayerPositionLabel(item.role, item.role)}
              // §11: l'aggiornamento è un metadato dell'evento, non uno
              // stato, e compare solo se l'evento è reale e successivo
              // all'invio.
              trailingMeta={
                hasSignificantUpdate(item) && item.lastEventAt
                  ? formatUpdateLabel(item.lastEventAt, now)
                  : null
              }
            />
          ))}
        </DataModule>
      );
    }

    /**
     * Posizioni salvate (DAS-REV-05 §9, §20).
     *
     * Il widget mostra le sole posizioni **disponibili**: una chiusa resta
     * nei Salvati — §6 vieta l'automatismo "indisponibile → unsave" — ma
     * vive nel filtro storico della lista CER, non in una preview che
     * promette un'opportunità ormai chiusa.
     */
    case "personal_saved_positions": {
      const preview = selectSavedPreviews(saved?.preview ?? [], promotedAdIds);
      const hasHistory = (saved?.unavailableCount ?? 0) > 0;

      // §20: zero disponibili **con storico** è un empty di dominio, non il
      // generico "non c'è nulla" e non un Global Empty: porta la propria
      // spiegazione e un solo accesso, che sostituisce "Vedi tutte".
      const historyEmpty =
        preview.items.length === 0 && !preview.collapsed && hasHistory;

      return (
        <DataModule
          action={
            historyEmpty
              ? undefined
              : {
                  label: "Vedi tutte",
                  // §23: la lista completa è dentro Cerca, sul filtro
                  // Disponibili. Nessuna pagina Dashboard parallela.
                  onPress: () => onNavigate(moduleId, SAVED_AVAILABLE_HREF),
                }
          }
          collapsedToAction={preview.collapsed}
          emptyContent={
            historyEmpty ? (
              <SavedHistoryEmpty
                onPress={() => onNavigate(moduleId, SAVED_UNAVAILABLE_HREF)}
              />
            ) : undefined
          }
          emptyMessage="Non hai posizioni salvate."
          errorMessage="Non siamo riusciti a caricare le posizioni salvate."
          hasData={!!saved}
          hideWhenEmpty
          isEmpty={preview.items.length === 0}
          isError={savedError}
          isRetrying={savedRetrying}
          onRetry={onRetrySaved}
          title={title}
        >
          {preview.items.map((item, index) => (
            <DashboardEntityRow
              avatarName={item.clubName}
              avatarUrl={item.clubLogoUrl}
              // §10: bookmark come azione distinta, già nello stato salvato.
              // Il suo tap rimuove il salvataggio e **non** apre il
              // dettaglio. Nessuna conferma, nessun menu, nessun pulsante
              // "Rimuovi dai salvati" grande quanto la row.
              bookmark={{
                isSaved: true,
                onToggle: () => onToggleSaved(item.adId),
              }}
              key={item.adId}
              meta={metaLine(item.clubName, item.teamName, item.category)}
              // §10: località pubblica pertinente, terza riga come nel
              // master. Niente indirizzi: città e regione canoniche della
              // posizione, mai dedotte dal nome del club (§3).
              note={item.location}
              onPress={() => onNavigate(moduleId, `/position/${item.adId}`)}
              showDivider={index > 0}
              title={getPlayerPositionLabel(item.role, item.role)}
            />
          ))}
        </DataModule>
      );
    }

    /**
     * §19: suggerimento facoltativo, sotto i moduli operativi. Non ha un
     * titolo di sezione proprio: lo porta la superficie, perché un header
     * "Migliora la tua visibilità" sopra una card con lo stesso testo
     * raddoppierebbe il messaggio.
     */
    case "personal_profile_suggestion": {
      const suggestion = personal?.optionalSuggestion;

      if (!suggestion) {
        return null;
      }

      /*
        DAS-REV-06 §8: la copy è del client, la classificazione è del
        backend. La chiave stabile — oggi solo `availability_areas` — sceglie
        il testo; il backend decide *se* e *dove*, non *come si chiama*. È lo
        stesso contratto dei requisiti: lì la descrizione arriva dal dominio
        perché cambia per ruolo, qui è una sola frase per tutti.
      */
      const copy = SUGGESTION_COPY[suggestion.key] ?? null;

      if (!copy) {
        return null;
      }

      return (
        <DashboardSuggestion
          actionLabel={copy.actionLabel}
          body={copy.body}
          description={copy.description}
          icon={copy.icon}
          onPress={() => onNavigate(moduleId, suggestion.href)}
          title={title}
        />
      );
    }

    case "society_positions":
      /**
       * DAS-REV-07 §12: nei master 01 e 05 le Posizioni sono rappresentate
       * «dal solo accesso compatto Posizioni aperte · {numero} ›», senza
       * ripetere anche un'anteprima completa — e §16 vieta di anteporvi
       * l'intestazione "Aree di gestione".
       *
       * La condizione non è il ruolo né una variante di schermata: è la
       * promozione di DAS-REV-02. Quando le candidature da gestire diventano
       * il modulo principale, le Posizioni si riducono all'accesso.
       */
      if (isPositionsCompact) {
        if (!society || society.positionsOpenCount === null) {
          return null;
        }

        return (
          <DashboardAreaRows
            items={[
              {
                count: society.positionsOpenCount,
                icon: "briefcase-outline",
                id: "positions",
                onPress: () =>
                  onNavigate(moduleId, SOCIETY_HREFS.positions()),
                title: "Posizioni aperte",
              },
            ]}
          />
        );
      }

      return (
        <DataModule
          action={{
            label: "Gestisci",
            onPress: () => onNavigate(moduleId, SOCIETY_HREFS.positions()),
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
              icon="briefcase-outline"
              key={item.id}
              meta={[item.teamName, item.category].filter(Boolean).join(" · ")}
              // §12: il dettaglio **gestionale** della Position. `/position/[id]`
              // è la scheda pubblica con la CTA "Candidati": aprirla da qui
              // offrirebbe al club di candidarsi alla propria posizione.
              onPress={() =>
                onNavigate(moduleId, SOCIETY_HREFS.positions(item.id))
              }
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
            onPress: () => onNavigate(moduleId, SOCIETY_HREFS.applications()),
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
              // §13: il contesto identifica **la posizione e la squadra
              // oggetto della candidatura**, non un ruolo personale del
              // candidato.
              meta={[
                getPlayerPositionLabel(item.role, item.role),
                item.teamName,
              ]
                .filter(Boolean)
                .join(" · ")}
              // §13: il tap apre la candidatura nel suo gruppo, non il profilo
              // pubblico della persona. Due candidature della stessa persona
              // restano due righe con contesti distinti.
              onPress={() =>
                onNavigate(moduleId, SOCIETY_HREFS.applications(item.adId))
              }
              showDivider={index > 0}
              // §10: lo stesso lifecycle letto dal lato Società — "Nuova" al
              // posto di "Inviata". Non è uno stato in più: è chi guarda che
              // cambia.
              status={societyApplicationStatusLabel(item.status)}
              title={item.name}
            />
          ))}
        </DataModule>
      );

    case "society_invites": {
      if (!society) {
        return null;
      }

      const lines = societyInviteLines(society);

      if (lines.length === 0) {
        return null;
      }

      return (
        <DashboardSection
          action={{
            label: "Gestisci",
            onPress: () => onNavigate(moduleId, SOCIETY_HREFS.invites),
          }}
          title={title}
        >
          <DashboardInvitesRow
            lines={lines}
            onPress={() => onNavigate(moduleId, SOCIETY_HREFS.invites)}
          />
        </DashboardSection>
      );
    }

    case "society_teams":
      return (
        <DataModule
          action={{
            label: "Vedi tutte",
            onPress: () => onNavigate(moduleId, SOCIETY_HREFS.teams),
          }}
          emptyMessage="Nessuna squadra."
          errorMessage="Non siamo riusciti a caricare le squadre."
          hasData={!!society}
          hideWhenEmpty
          isEmpty={(society?.teamsPreview ?? []).length === 0}
          isError={societyError}
          // §15: il conteggio è quello del centro di destinazione, non le tre
          // righe della preview. Una squadra privata resta visibile a chi la
          // amministra, quindi può differire dal totale del profilo pubblico.
          titleMeta={
            society?.teamsCount !== null && society?.teamsCount !== undefined
              ? `${society.teamsCount} ${plural(
                  society.teamsCount,
                  "squadra",
                  "squadre",
                )}`
              : null
          }
          title={title}
        >
          {(society?.teamsPreview ?? []).map((item, index) => (
            <DashboardEntityRow
              icon="shield-outline"
              key={item.id}
              meta={teamContextLabel(item.name, item.category)}
              // §15 vieta di sostituire la destinazione gestionale con il
              // profilo pubblico del Team. Il dettaglio operativo non esiste
              // ancora (`society_team_detail` è bloccata), quindi la riga
              // apre il centro Squadre invece di un percorso sbagliato.
              onPress={() => onNavigate(moduleId, SOCIETY_HREFS.teams)}
              showDivider={index > 0}
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
      /**
       * DAS-REV-07 §16: accessi gestionali, non un riepilogo bis.
       *
       * Niente conteggi su queste righe: Posizioni e Squadre hanno moduli
       * propri, e §7 vieta che lo stesso dominio compaia due volte nella
       * stessa composizione.
       */
      if (!identity) {
        return null;
      }

      const items: AreaRowItem[] = buildManagementAreas(identity).map(
        (area) => ({
          count: null,
          icon: area.icon,
          id: area.id,
          onPress: () => onNavigate(moduleId, area.href),
          title: area.title,
        }),
      );

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
  /**
   * Tutte le preview erano già mostrate più in alto (§12).
   *
   * Non è "vuoto": il modulo si riduce a un accesso compatto alla lista
   * completa, perché §12 vieta sia il falso "Nessuna candidatura" sia la
   * sparizione della risorsa.
   */
  collapsedToAction?: boolean;
  emptyMessage: string;
  /**
   * Empty di dominio con un contenuto proprio (DAS-REV-04 §16).
   *
   * «Zero attive, storico esistente» non è il generico "non c'è nulla": porta
   * una spiegazione e un accesso alle Concluse, e quel link **sostituisce**
   * l'azione dell'intestazione invece di affiancarla.
   */
  emptyContent?: ReactNode;
  errorMessage: string;
  /** Esiste un payload utilizzabile — da rete o da cache. */
  hasData: boolean;
  hideWhenEmpty?: boolean;
  isEmpty: boolean;
  isError: boolean;
  isRetrying?: boolean;
  onRetry?: () => void;
  title: string;
  /**
   * Conteggio reale accanto al titolo (§15: «Mostrare titolo, conteggio reale
   * e Vedi tutte»). Non è il numero di righe della preview.
   */
  titleMeta?: string | null;
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
  collapsedToAction = false,
  emptyMessage,
  emptyContent,
  errorMessage,
  hasData,
  hideWhenEmpty = false,
  isEmpty,
  isError,
  isRetrying = false,
  onRetry,
  title,
  titleMeta = null,
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
    // §12: la deduplicazione ha svuotato la preview, non il dato. Resta il
    // solo accesso alla lista completa, e **non** un empty che mentirebbe.
    if (collapsedToAction && action) {
      return <DashboardSection action={action} title={title} />;
    }

    if (emptyContent) {
      return <DashboardSection title={title}>{emptyContent}</DashboardSection>;
    }

    return hideWhenEmpty ? null : (
      <DashboardSection title={title}>
        <DashboardModuleEmpty message={emptyMessage} />
      </DashboardSection>
    );
  }

  return (
    <DashboardSection action={action} meta={titleMeta} title={title}>
      <View>{children}</View>
    </DashboardSection>
  );
}

/**
 * Empty del modulo Candidature con storico esistente (DAS-REV-04 §16).
 *
 * «Zero attive, storico esistente» non è il generico "non c'è nulla": §16
 * chiede di dirlo, di spiegare che le concluse restano consultabili e di
 * offrire **un solo** accesso — "Vedi concluse →" sostituisce la "Vedi tutte"
 * dell'intestazione invece di affiancarla.
 *
 * Non è un errore e non è un Global Empty: la Dashboard resta utilizzabile e
 * le Posizioni salvate restano al loro posto.
 */
function ApplicationsHistoryEmpty({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.historyEmpty}>
      <AppText variant="titleMd">Nessuna candidatura attiva</AppText>

      <AppText color="secondary" variant="bodySm">
        Le candidature concluse restano consultabili.
      </AppText>

      <Pressable
        accessibilityLabel="Vedi le candidature concluse"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onPress}
        style={({ pressed }) => [
          styles.historyLink,
          pressed ? styles.historyLinkPressed : null,
        ]}
      >
        <AppText color="accent" variant="actionLabel">
          Vedi concluse
        </AppText>
        <Ionicons color={colors.accent} name="arrow-forward" size={14} />
      </Pressable>
    </View>
  );
}

/**
 * Empty del modulo Posizioni salvate con storico esistente (DAS-REV-05 §20).
 *
 * «Zero disponibili, salvataggi non più disponibili presenti» non è il
 * generico "non c'è nulla": §20 chiede di dirlo, di spiegare che le posizioni
 * chiuse restano nei salvati e di offrire **un solo** accesso — "Vedi non più
 * disponibili →" sostituisce la "Vedi tutte" dell'intestazione.
 *
 * Il widget resta compatto e la Dashboard non diventa Global Empty: le
 * candidature e l'azione rapida restano al loro posto.
 */
function SavedHistoryEmpty({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.historyEmpty}>
      <AppText variant="titleMd">Nessuna posizione disponibile</AppText>

      <AppText color="secondary" variant="bodySm">
        Le posizioni non più disponibili restano nei tuoi salvati.
      </AppText>

      <Pressable
        accessibilityLabel="Vedi le posizioni non più disponibili"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onPress}
        style={({ pressed }) => [
          styles.historyLink,
          pressed ? styles.historyLinkPressed : null,
        ]}
      >
        <AppText color="accent" variant="actionLabel">
          Vedi non più disponibili
        </AppText>
        <Ionicons color={colors.accent} name="arrow-forward" size={14} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[20],
    paddingBottom: spacing[40],
  },
  historyEmpty: {
    gap: spacing[6],
  },
  historyLink: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: spacing[6],
    minHeight: sizes.touchTarget - spacing[14],
  },
  historyLinkPressed: {
    opacity: 0.6,
  },
});
