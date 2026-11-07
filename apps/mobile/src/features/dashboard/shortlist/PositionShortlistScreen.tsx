/**
 * Vista base del pool di una Position (DAS-REV-24 §14, screen 11).
 *
 * «Il tap su una riga Per posizione apre una route reale della lista
 * corrispondente … La vista base dello screen 11 deve essere realmente
 * raggiungibile; non lasciare il tap del centro verso una pagina vuota in
 * attesa della 25» (§3).
 *
 * Un solo elenco, con dentro chi si è candidato e chi è stato individuato
 * dalla Società. Nessun filtro per origine, nessuna tab, nessuna toolbar:
 * §14 — «Non aggiungere una nuova toolbar di filtri, ordinamento, aggiunta,
 * rimozione o valutazione soltanto per riempire la tavola.» La gestione
 * completa è il pack 25 e non viene anticipata qui.
 *
 * Il tap di riga apre il profilo canonico: §14 — «Il tap di riga riutilizza
 * il dettaglio entry già funzionante; se non esiste, usa l'apertura del
 * profilo canonico autorizzato come vista base. Non creare un nuovo editor
 * di valutazione in questa task. Nessuna route placeholder.»
 */
import { useCallback, useRef } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { STALE_MS } from "../cache/freshness-policy";
import {
  DashboardGlobalEmpty,
  DashboardGlobalError,
  DashboardGlobalOffline,
} from "../components/DashboardStates";
import { SocietyContextHeader } from "../components/SocietyContextHeader";
import { useDashboardIdentity } from "../identity/use-dashboard-identity";
import { useDashboardConnection } from "../state/use-dashboard-connection";
import { ShortlistPoolRowView } from "./components/ShortlistPoolRow";
import { ShortlistSectionSkeleton } from "./components/ShortlistSection";
import { SHORTLIST_QK } from "./shortlist-keys";
import { SHORTLIST_COPY, profilesLabel } from "./shortlist-presentation";
import { fetchShortlistContext, fetchShortlistPool } from "./shortlist-service";
import { ShortlistError } from "./shortlist-types";

const DOUBLE_TAP_MS = 600;

type Props = {
  /** Una delle due: il centro passa la Position, un deep link la lista. */
  positionId?: string;
  shortlistId?: string;
};

export function PositionShortlistScreen({ positionId, shortlistId }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;
  const { connection } = useDashboardConnection();

  const ref = positionId
    ? ({ positionId } as const)
    : ({ shortlistId: shortlistId ?? "" } as const);
  const refKey = positionId ?? shortlistId ?? "";

  const contextQuery = useQuery({
    enabled: !!actorId && !!refKey,
    queryFn: () => fetchShortlistContext(ref),
    queryKey: SHORTLIST_QK.context(actorId, refKey),
    retry: (failureCount, error) =>
      !(error instanceof ShortlistError && error.kind !== "network") &&
      failureCount < 1,
    staleTime: STALE_MS.operational,
  });

  const context = contextQuery.data ?? null;

  /* §24: «Un count di 60 entry resta 60 mentre il dettaglio carica una
     pagina di 20» (QA097). Il conteggio arriva dal contesto, non dalla
     lunghezza della pagina caricata. */
  const poolQuery = useQuery({
    enabled: !!context?.shortlistId,
    queryFn: () => fetchShortlistPool(context?.shortlistId as string),
    queryKey: SHORTLIST_QK.pool(actorId, context?.shortlistId ?? ""),
    staleTime: STALE_MS.operational,
  });

  const lastPushRef = useRef<{ at: number; href: string } | null>(null);

  const go = useCallback(
    (href: string) => {
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

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: SHORTLIST_QK.context(actorId, refKey),
      }),
      queryClient.invalidateQueries({
        queryKey: SHORTLIST_QK.pool(actorId, context?.shortlistId ?? ""),
      }),
    ]);
  }, [actorId, context?.shortlistId, queryClient, refKey]);

  const shell = (children: React.ReactNode) => (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <SocietyContextHeader
        isVerified={current?.isVerified ?? false}
        logoUrl={current?.avatarUrl ?? null}
        name={current?.name ?? ""}
        onBack={() => router.back()}
        title={SHORTLIST_COPY.title}
      />

      {children}
    </View>
  );

  if (!clubId) {
    return shell(
      <DashboardGlobalEmpty
        copy={{
          actionLabel: SHORTLIST_COPY.backToDashboard,
          body: SHORTLIST_COPY.unavailableBody,
          icon: "lock-closed-outline",
          title: SHORTLIST_COPY.unavailableTitle,
        }}
        onAction={() => router.replace("/(tabs)/dashboard")}
      />,
    );
  }

  if (contextQuery.error instanceof ShortlistError &&
      contextQuery.error.kind !== "network") {
    /* §22: «Non rivelare nome della lista o Society se non più autorizzati.» */
    return shell(
      <DashboardGlobalEmpty
        copy={{
          actionLabel: SHORTLIST_COPY.backToDashboard,
          body: SHORTLIST_COPY.unavailableBody,
          icon: "lock-closed-outline",
          title: SHORTLIST_COPY.unavailableTitle,
        }}
        onAction={() => router.replace("/(tabs)/dashboard")}
      />,
    );
  }

  if (contextQuery.isError) {
    return shell(
      <DashboardGlobalError
        body={SHORTLIST_COPY.errorBody}
        onRetry={() => void refresh()}
        title={SHORTLIST_COPY.errorTitle}
      />,
    );
  }

  if (!context) {
    /* §27: offline senza dati utilizzabili è uno stato proprio. La query
       resta in pausa e non va in errore: senza questo ramo il deep link
       aperto senza rete mostrerebbe uno skeleton che non finisce mai. */
    if (connection === "offline") {
      return shell(
        <DashboardGlobalOffline
          body={SHORTLIST_COPY.offlineBody}
          onRetry={() => void refresh()}
        />,
      );
    }

    return shell(
      <View style={styles.content}>
        <ShortlistSectionSkeleton rows={4} />
      </View>,
    );
  }

  const rows = poolQuery.data ?? [];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <SocietyContextHeader
        isVerified={current?.isVerified ?? false}
        logoUrl={current?.avatarUrl ?? null}
        name={current?.name ?? ""}
        onBack={() => router.back()}
        title={SHORTLIST_COPY.title}
      />

      {/* §14: «Mostra heading Shortlist, titolo/Team della Position e
          conteggio reale.» */}
      <View style={styles.context} testID="shortlist-pool-context">
        <AppText accessibilityRole="header" color="neutral" variant="headingSm">
          {context.scopeLabel
            ? `${context.title} · ${context.scopeLabel}`
            : context.title}
        </AppText>

        <AppText color="neutralMuted" variant="meta">
          {context.isClosed
            ? `${profilesLabel(context.profilesCount)} · ${SHORTLIST_COPY.positionClosed}`
            : profilesLabel(context.profilesCount)}
        </AppText>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            onRefresh={() => void refresh()}
            refreshing={poolQuery.isRefetching}
            tintColor={colors.textNeutralMuted}
          />
        }
        testID="shortlist-pool-scroll"
      >
        {poolQuery.isLoading && rows.length === 0 ? (
          <ShortlistSectionSkeleton rows={3} />
        ) : null}

        {!poolQuery.isLoading && rows.length === 0 ? (
          /* §24: «Il contesto della Position può continuare a mostrare una
             vista vuota» quando l'ultima entry è stata rimossa. */
          <AppText color="neutralMuted" style={styles.empty} variant="bodySm">
            {SHORTLIST_COPY.positionsEmpty}
          </AppText>
        ) : null}

        {rows.map((row, index) => (
          <ShortlistPoolRowView
            canSeeEvaluation={context.canEditStatus || context.canAddNotes}
            key={row.entryId}
            onPress={() => go(`/profile/${encodeURIComponent(row.personId)}`)}
            row={row}
            showDivider={index > 0}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    flex: 1,
    paddingHorizontal: spacing[20],
  },
  context: {
    gap: spacing[4],
    paddingBottom: spacing[8],
  },
  content: {
    paddingBottom: spacing[32],
  },
  empty: {
    paddingVertical: spacing[24],
  },
});
