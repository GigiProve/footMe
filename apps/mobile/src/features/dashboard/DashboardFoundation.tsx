import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import {
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";

import { Screen } from "../../components/ui/screen";
import { useSession } from "../auth/use-session";
import { getPlayerPositionLabel } from "../profiles/player-sports";
import { APPLICATION_STATUS_LABELS } from "../recruiting/recruiting-service";
import { spacing } from "../../theme/tokens";
import { AppText } from "../../ui";

import {
  fetchPersonalDashboard,
  type PersonalDashboardData,
} from "./adapters/personal-adapter";
import {
  DashboardAreaRows,
  type AreaRowItem,
} from "./components/DashboardAreaRow";
import { DashboardEntityRow } from "./components/DashboardEntityRow";
import { DashboardIdentityRow } from "./components/DashboardIdentityRow";
import { DashboardIdentitySheet } from "./components/DashboardIdentitySheet";
import {
  DashboardPriority,
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
  DashboardGlobalError,
  DashboardModuleEmpty,
  DashboardNoIdentity,
  DashboardSkeleton,
} from "./components/DashboardStates";
import {
  trackDashboardOpened,
  trackIdentitySwitchRequested,
  trackModuleAction,
  trackSelectorOpened,
} from "./dashboard-analytics";
import { DASHBOARD_QK } from "./dashboard-keys";
import { useDashboardIdentity } from "./identity/use-dashboard-identity";
import {
  fetchSocietyOverview,
  type SocietyOverview,
} from "./identity/identity-service";
import {
  composeDashboard,
  type QuickActionId,
} from "./modules/composition";
import type { DashboardModuleId } from "./modules/module-registry";

/**
 * Unico container della Dashboard PROLINK (DAS-REV-01).
 *
 * Sostituisce il bivio `role === 'club_admin' ? ClubDashboard :
 * PersonalDashboard`: non esistono più due schermate per due ruoli, ma una
 * composizione guidata da identità e capability.
 *
 * Ordine verticale fisso (§6): header → contesto identità → riepilogo →
 * Da gestire → Azioni rapide → moduli. Ogni sezione è opzionale e, quando
 * non eleggibile, le successive risalgono senza lasciare un vuoto.
 */
export function DashboardFoundation() {
  const router = useRouter();
  const queryClient = useQueryClient();
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
  const scrollRef = useRef<ScrollView>(null);

  const isSociety = current?.kind === "society";
  const composition = composeDashboard(current);

  // Lo scroll torna in alto a ogni cambio di contesto (§12.5). Dipende dal
  // token, non dall'id: anche riaprire la stessa identità dopo una revoca è
  // un contesto nuovo.
  useEffect(() => {
    scrollRef.current?.scrollTo({ animated: false, y: 0 });
  }, [contextToken]);

  useEffect(() => {
    if (!current) {
      return;
    }

    trackDashboardOpened({
      identityKind: current.kind,
      moduleCount: composition.modules.length,
      source: "bottom_nav",
    });
    // L'impression si registra al cambio di contesto, non a ogni render:
    // includere `composition` farebbe scattare l'evento a ogni rerender.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextToken]);

  // ── Dati ────────────────────────────────────────────────────────────────
  // Le query key includono actor e identità: una risposta tardiva di B
  // atterra nella cache di B e non può comparire dentro C.

  const personalQuery = useQuery({
    enabled: !!actorId && !!current && !isSociety,
    queryFn: () => fetchPersonalDashboard(actorId),
    queryKey: DASHBOARD_QK.module(actorId, current?.id ?? "none", "personal"),
  });

  const societyQuery = useQuery({
    enabled: !!actorId && !!current && isSociety,
    queryFn: () => fetchSocietyOverview(current?.id as string),
    queryKey: DASHBOARD_QK.societyOverview(actorId, current?.id ?? "none"),
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);

    try {
      // Rivaluta accesso e capability, non solo i contatori (§21).
      await refresh();
      await queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("dashboard-"),
      });
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, refresh]);

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

  // ── Stati di pagina ─────────────────────────────────────────────────────

  const header = (
    <AppText accessibilityRole="header" variant="screenTitle">
      Dashboard
    </AppText>
  );

  if (isIdentityLoading) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.content}>
          {header}
          <DashboardSkeleton />
        </ScrollView>
      </Screen>
    );
  }

  // Global error solo se non c'è una Dashboard affidabile da mostrare:
  // l'elenco identità è la condizione minima, senza di esso non si sa
  // nemmeno di chi sarebbe la pagina.
  if (identitiesError) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.content}>
          {header}
          <DashboardGlobalError onRetry={() => void handleRefresh()} />
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

  const summary = isSociety
    ? buildSocietySummary(societyQuery.data)
    : buildPersonalSummary(personalQuery.data);

  const priorities = isSociety
    ? buildSocietyPriorities(societyQuery.data, (href) =>
        go("society_priority", href),
      )
    : buildPersonalPriorities(personalQuery.data, () =>
        go("personal_priority", "/profile/edit/opportunities"),
      );

  const quickActions = buildQuickActions(composition.quickActions, go);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
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

        {summary.length > 0 ? (
          <DashboardSummaryBlock metrics={summary} />
        ) : null}

        <DashboardPriority items={priorities} />

        <DashboardQuickActions actions={quickActions} />

        {composition.modules.map((module) => (
          <ModuleRenderer
            key={module.id}
            moduleId={module.id}
            onNavigate={go}
            personal={personalQuery}
            society={societyQuery}
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

// ── Composizione delle sezioni ────────────────────────────────────────────

function DashboardSummaryBlock({ metrics }: { metrics: SummaryMetric[] }) {
  return <DashboardSummary metrics={metrics} />;
}

/** Plurale corretto: "1 Programmato", "2 Programmati" (§18). */
function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
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

  // `scheduledCount` resta null finché il dominio editoriale non conosce lo
  // stato "programmato": la metrica del master 03 non viene simulata.
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

  // §9 del Common Contract: due–quattro indicatori, non una lista.
  return metrics.slice(0, 4);
}

function buildPersonalPriorities(
  data: PersonalDashboardData | undefined,
  onPress: () => void,
): DashboardPriorityItem[] {
  if (!data?.needsAvailability) {
    return [];
  }

  return [
    {
      actionLabel: "Imposta aree",
      description: "Indica le aree in cui cerchi squadra.",
      icon: "location-outline",
      id: "availability",
      onPress,
      title: "Completa la disponibilità",
      tone: "neutral",
    },
  ];
}

function buildSocietyPriorities(
  data: SocietyOverview | undefined,
  onPress: (href: string) => void,
): DashboardPriorityItem[] {
  if (!data?.priorityAdId || !data.priorityNewApplications) {
    return [];
  }

  const count = data.priorityNewApplications;

  return [
    {
      actionLabel: "Valuta candidature",
      // La descrizione nomina la Posizione: il numero si riferisce a quella,
      // non al totale della Società (§17).
      description: data.priorityAdTitle ?? "Posizione aperta",
      icon: "people-outline",
      id: `applications_${data.priorityAdId}`,
      onPress: () => onPress(`/position/${data.priorityAdId}`),
      title: `${count} ${plural(
        count,
        "nuova candidatura",
        "nuove candidature",
      )}`,
      tone: "neutral",
    },
  ];
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
  personal: UseQueryResult<PersonalDashboardData>;
  society: UseQueryResult<SocietyOverview>;
  title: string;
};

/**
 * Un modulo sconosciuto non arriva mai qui: la composizione lavora sul
 * registry, quindi ogni id ha per costruzione un renderer. Il `default`
 * esiste per il caso in cui il registry cresca senza il renderer
 * corrispondente — e in quel caso il modulo sparisce invece di rompere la
 * pagina (§15).
 */
function ModuleRenderer({
  moduleId,
  onNavigate,
  personal,
  society,
  title,
}: ModuleRendererProps) {
  switch (moduleId) {
    case "personal_applications":
      return (
        <QueryModule
          action={{
            label: "Vedi tutte",
            onPress: () => onNavigate(moduleId, "/(tabs)/announcements"),
          }}
          emptyMessage="Non hai candidature attive."
          errorMessage="Non siamo riusciti a caricare le candidature."
          hideWhenEmpty
          isEmpty={(personal.data?.applications ?? []).length === 0}
          query={personal}
          title={title}
        >
          {(personal.data?.applications ?? []).map((item, index) => (
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
        </QueryModule>
      );

    case "personal_saved_positions":
      return (
        <QueryModule
          action={{
            label: "Vedi tutte",
            onPress: () => onNavigate(moduleId, "/saved"),
          }}
          emptyMessage="Non hai posizioni salvate."
          errorMessage="Non siamo riusciti a caricare le posizioni."
          hideWhenEmpty
          isEmpty={(personal.data?.savedPositions ?? []).length === 0}
          query={personal}
          title={title}
        >
          {(personal.data?.savedPositions ?? []).map((item, index) => (
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
        </QueryModule>
      );

    case "society_applications":
      return (
        <QueryModule
          action={{
            label: "Vedi tutte",
            onPress: () => onNavigate(moduleId, "/(tabs)/announcements"),
          }}
          emptyMessage="Nessuna candidatura ricevuta."
          errorMessage="Non siamo riusciti a caricare le candidature."
          isEmpty={(society.data?.applicationsPreview ?? []).length === 0}
          query={society}
          title={title}
        >
          {(society.data?.applicationsPreview ?? []).map((item, index) => (
            <DashboardEntityRow
              avatarName={item.name}
              avatarUrl={item.avatarUrl}
              key={item.id}
              meta={`${getPlayerPositionLabel(item.role, item.role)} · ${
                item.adTitle
              }`}
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
        </QueryModule>
      );

    case "society_drafts":
      return (
        <QueryModule
          action={{
            label: "Vedi tutti",
            onPress: () =>
              onNavigate(moduleId, "/(tabs)/profile?compose=club"),
          }}
          emptyMessage="Nessuna bozza."
          errorMessage="Non siamo riusciti a caricare le bozze."
          hideWhenEmpty
          isEmpty={(society.data?.draftsPreview ?? []).length === 0}
          query={society}
          title={title}
        >
          {(society.data?.draftsPreview ?? []).map((item, index) => (
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
        </QueryModule>
      );

    case "society_recent_content":
      return (
        <QueryModule
          action={{
            label: "Vedi tutti",
            onPress: () => onNavigate(moduleId, "/(tabs)/profile"),
          }}
          emptyMessage="Nessun contenuto pubblicato."
          errorMessage="Non siamo riusciti a caricare i contenuti."
          hideWhenEmpty
          isEmpty={(society.data?.recentContentPreview ?? []).length === 0}
          query={society}
          title={title}
        >
          {(society.data?.recentContentPreview ?? []).map((item, index) => (
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
        </QueryModule>
      );

    case "society_areas": {
      const data = society.data;

      if (!data) {
        return null;
      }

      const items: AreaRowItem[] = [];

      if (data.positionsOpenCount !== null) {
        items.push({
          count: data.positionsOpenCount,
          icon: "briefcase-outline",
          id: "positions",
          onPress: () => onNavigate(moduleId, "/(tabs)/announcements"),
          title: "Posizioni aperte",
        });
      }

      if (data.teamsCount !== null) {
        items.push({
          count: data.teamsCount,
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

type QueryModuleProps = {
  action?: { label: string; onPress: () => void };
  children: React.ReactNode;
  emptyMessage: string;
  errorMessage: string;
  hideWhenEmpty?: boolean;
  isEmpty: boolean;
  query: UseQueryResult<unknown>;
  title: string;
};

/**
 * Guscio comune ai moduli che dipendono da una query.
 *
 * Tiene separati i tre stati che la Dashboard precedente confondeva:
 * in caricamento, in errore (con retry locale, gli altri moduli restano
 * utilizzabili) ed empty da risposta valida.
 */
function QueryModule({
  action,
  children,
  emptyMessage,
  errorMessage,
  hideWhenEmpty = false,
  isEmpty,
  query,
  title,
}: QueryModuleProps) {
  if (query.isPending) {
    return null;
  }

  if (query.isError) {
    return (
      <DashboardSection title={title}>
        <DashboardModuleError
          message={errorMessage}
          onRetry={() => void query.refetch()}
        />
      </DashboardSection>
    );
  }

  if (isEmpty) {
    // La policy del registry decide: un empty si mostra o il modulo sparisce.
    // In nessun caso resta uno spazio vuoto.
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
