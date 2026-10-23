/**
 * Dettaglio gestionale di una Position (§18).
 *
 * «Il dettaglio gestionale non deve aprire per errore la pagina visitor con
 * CTA Candidati dell'amministratore alla propria posizione. Se il prodotto ha
 * un renderer comune owner/visitor, usa la variante autorizzata corretta.»
 *
 * Qui il renderer **non** è comune: `PositionDetailScreen` del dominio Cerca
 * risolve la candidabilità del visitatore e mostra "Candidati". Questa
 * schermata risolve invece il perimetro dell'amministratore sullo stesso
 * Position ID, senza copiare l'oggetto e senza creare un dominio gestionale
 * parallelo (§18 — «Conserva Position ID attraverso Dashboard, Cerca,
 * profilo Society, dettaglio, candidature e storico»).
 *
 * Perimetro di questa task: la **destinazione** delle tre righe, con i dati
 * autorizzati e i collegamenti ai flussi che già esistono. Le azioni di
 * scrittura — Modifica posizione, Completa posizione, Pubblica posizione,
 * Chiudi posizione — appartengono a DAS-REV-17 e DAS-REV-18 e qui compaiono
 * solo nella misura in cui un flusso reale esiste già: §18 vieta «un pulsante
 * senza handler o un mock che permette di certificare falsamente la
 * navigazione».
 */
import { useCallback } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { formatDeadlineDetailLabel } from "../personal/personal-presentation";
import { STALE_MS } from "../cache/freshness-policy";
import {
  DashboardGlobalEmpty,
  DashboardGlobalError,
  DashboardGlobalOffline,
  DashboardSkeleton,
} from "../components/DashboardStates";
import { useDashboardConnection } from "../state/use-dashboard-connection";
import { PositionsCenterHeader } from "./components/PositionsCenterHeader";
import { POSITIONS_QK } from "./positions-keys";
import {
  POSITIONS_COPY,
  applicationsLabel,
  formatClosedLabel,
  formatDraftUpdatedLabel,
  positionContextLine,
  positionTitle,
} from "./positions-presentation";
import { POSITIONS_HREFS } from "./positions-routes";
import {
  PositionsAccessError,
  fetchSocietyPositionDetail,
} from "./positions-service";

const GROUP_LABEL = {
  active: "Attiva",
  closed: "Chiusa",
  drafts: "Bozza",
} as const;

export function SocietyPositionDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { connection } = useDashboardConnection();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const positionId = typeof id === "string" ? id : "";

  const detailQuery = useQuery({
    enabled: !!positionId && !!actorId,
    queryFn: () => fetchSocietyPositionDetail(positionId),
    queryKey: POSITIONS_QK.detail(actorId, positionId),
    retry: (failureCount, error) =>
      !(error instanceof PositionsAccessError) && failureCount < 1,
    staleTime: STALE_MS.operational,
  });

  const detail = detailQuery.data ?? null;

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();

      return;
    }

    router.replace(POSITIONS_HREFS.center() as never);
  }, [router]);

  const shell = (body: React.ReactNode, name = "") => (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.navWrap}>
        <PositionsCenterHeader
          isVerified={detail?.clubIsVerified ?? false}
          logoUrl={detail?.clubLogoUrl ?? null}
          name={detail?.clubName ?? name}
          onBack={goBack}
          title={POSITIONS_COPY.centerTitle}
        />
      </View>
      {body}
    </View>
  );

  /**
   * §18: «Se non esiste più o non è più accessibile, usa copy neutra Questa
   * posizione non è più disponibile.» Un 404 e un rifiuto producono lo
   * stesso messaggio: non si rivela l'esistenza di una Position altrui.
   */
  if (
    detailQuery.error instanceof PositionsAccessError &&
    detailQuery.error.code === "POSITION_NOT_AVAILABLE"
  ) {
    return shell(
      <DashboardGlobalEmpty
        copy={{
          actionLabel: "Torna alle posizioni",
          body: "Torna al Centro per vedere le posizioni ancora disponibili.",
          icon: "alert-circle-outline",
          title: POSITIONS_COPY.notAvailable,
        }}
        onAction={goBack}
      />,
    );
  }

  if (detailQuery.isLoading && !detail) {
    return shell(
      <View style={styles.content}>
        <DashboardSkeleton />
      </View>,
    );
  }

  if (!detail) {
    if (connection === "offline") {
      return shell(
        <DashboardGlobalOffline
          body={POSITIONS_COPY.offlineBody}
          onRetry={() => void detailQuery.refetch()}
        />,
      );
    }

    return shell(
      <DashboardGlobalError
        body={POSITIONS_COPY.retry}
        onRetry={() => void detailQuery.refetch()}
        title={POSITIONS_COPY.listError}
      />,
    );
  }

  const title = positionTitle(detail);
  const context = positionContextLine(detail);
  const counts = applicationsLabel({
    available: detail.countsAvailable,
    group: detail.group,
    newCount: detail.applicationsNew,
    total: detail.applicationsTotal,
  });

  const deadline = detail.deadlineAt
    ? formatDeadlineDetailLabel(detail.deadlineAt, {
        timeZone: detail.deadlineTimezone,
      })
    : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.navWrap}>
        <PositionsCenterHeader
          isVerified={detail.clubIsVerified}
          logoUrl={detail.clubLogoUrl}
          name={detail.clubName}
          onBack={goBack}
          title={POSITIONS_COPY.centerTitle}
        />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: spacing[32] + insets.bottom },
        ]}
        refreshControl={
          <RefreshControl
            onRefresh={() => void detailQuery.refetch()}
            refreshing={detailQuery.isRefetching}
            tintColor={colors.textNeutralMuted}
          />
        }
        testID="society-position-detail"
      >
        <AppText color="neutralMuted" variant="eyebrow">
          {GROUP_LABEL[detail.group]}
        </AppText>

        <AppText color="neutral" style={styles.title} variant="headingMd">
          {title}
        </AppText>

        {context ? (
          <AppText color="neutralMuted" variant="meta">
            {context}
          </AppText>
        ) : null}

        {detail.teamIsInactive ? (
          <AppText color="neutralMuted" variant="meta">
            {POSITIONS_COPY.inactiveTeam}
          </AppText>
        ) : null}

        <View style={styles.block}>
          {counts ? (
            <AppText color="neutral" variant="bodyLg">
              {counts}
            </AppText>
          ) : null}

          {/* §17: la ricezione è distinta dal lifecycle. Una PUBLISHED
              scaduta resta attiva e lo dice senza badge né countdown. */}
          {detail.receivingClosed ? (
            <AppText color="neutralMuted" variant="meta">
              {POSITIONS_COPY.deadlinePassed}
            </AppText>
          ) : null}

          {deadline ? (
            <AppText color="neutralMuted" variant="meta">
              {deadline}
            </AppText>
          ) : null}

          {detail.group === "drafts"
            ? (() => {
                const updated = formatDraftUpdatedLabel(detail.updatedAt);

                return updated ? (
                  <AppText color="neutralMuted" variant="meta">
                    {updated}
                  </AppText>
                ) : null;
              })()
            : null}

          {detail.group === "closed" ? (
            <AppText color="neutralMuted" variant="meta">
              {formatClosedLabel(detail.closedAt)}
            </AppText>
          ) : null}
        </View>

        {detail.description ? (
          <View style={styles.block}>
            <AppText color="neutralMuted" variant="eyebrow">
              Descrizione
            </AppText>

            <AppText color="neutral" variant="bodyLg">
              {detail.description}
            </AppText>
          </View>
        ) : null}

        {detail.compensationSummary ? (
          <View style={styles.block}>
            <AppText color="neutralMuted" variant="eyebrow">
              Condizioni
            </AppText>

            <AppText color="neutral" variant="bodyLg">
              {detail.compensationSummary}
            </AppText>
          </View>
        ) : null}

        {/* §20: «Dal dettaglio Position riutilizza l'accesso canonico alle
            sue candidature, mantenendo Position e Team.» Nessuna
            accettazione, nessun rifiuto, nessun contatto inline. */}
        {detail.countsAvailable ? (
          <Button
            fullWidth
            label="Vedi candidature"
            onPress={() =>
              router.push(
                POSITIONS_HREFS.positionApplications(detail.id) as never,
              )
            }
            size="md"
            style={styles.action}
            testID="position-detail-applications"
            variant="neutralOutline"
          />
        ) : null}

        {/* §12: «Se autorizzato soltanto a leggere, usa la variante in sola
            consultazione dello stesso dettaglio, senza comandi di modifica o
            autosave.» */}
        {!detail.canEdit && !detail.canPublish && !detail.canClose ? (
          <AppText color="neutralMuted" style={styles.action} variant="meta">
            {POSITIONS_COPY.readOnly}
          </AppText>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  navWrap: {
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[8],
  },
  content: {
    gap: spacing[4],
    paddingHorizontal: spacing[20],
  },
  title: {
    paddingTop: spacing[4],
  },
  block: {
    gap: spacing[6],
    paddingTop: spacing[20],
  },
  action: {
    marginTop: spacing[24],
  },
});
