/**
 * Dettaglio canonico di un evento di selezione (DAS-REV-29 §7, §9, §14–§20,
 * §23, §25; screen 01, 08–15).
 *
 * **Una route, due viste dello stesso evento.** Il server restituisce tre
 * proiezioni separate (pubblica, personale, gestionale); la schermata sceglie
 * la vista dall'identità della Dashboard (§13: «Se l'actor sta operando come
 * Società/Media, non inviare l'iscrizione come quella identity e non
 * cambiare contesto silenziosamente»):
 *
 *   · Società nello scope → screen 01: Condividi / Copia link / Modifica, e
 *     sotto i contenuti la preview «Richieste da valutare» (§17);
 *   · persona → screen 08, 11–15: stato personale e azioni autorizzate.
 *
 * Nessuna schermata di successo separata (§5): l'esito di un comando è lo
 * stato che il server restituisce, nello stesso dettaglio. Nessun optimistic
 * update (§23: «Non confermare posti optimistic senza commit affidabile»).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import { useToast } from "../../../../ui/Toast/ToastProvider";
import { useSession } from "../../../auth/use-session";
import { DashboardGlobalError, DashboardSkeleton } from "../../components/DashboardStates";
import { useDashboardIdentity } from "../../identity/use-dashboard-identity";
import { createSessionNonce, operationKeyOf } from "../../positions/compose/compose-operation-key";
import { SELECTION_EVENTS_QK, SELECTION_EVENTS_QK_PREFIXES } from "../events-keys";
import { SELECTION_EVENTS_HREFS } from "../events-routes";
import { SelectionEventsError } from "../events-service";
import {
  EventClubBar,
  EventFlyerImage,
  EventInfoRow,
  EventNoticeCard,
  EventTextSection,
  EventUnavailableState,
} from "./components/EventDetailParts";
import { RegisterSheet, WithdrawSheet } from "./components/EventSheets";
import { PendingRequestsPreview } from "./components/PendingRequestsPreview";
import {
  DETAIL_COPY,
  capacityLine,
  commandErrorCopy,
  eventSubtitle,
  eventYearsLabel,
  personMeta,
  personalView,
  registerSheetModel,
  societyActions,
  venueLines,
  whenInline,
  whenLines,
  withdrawSheetCopy,
} from "./event-detail-presentation";
import {
  fetchPendingRequestsPreview,
  fetchSelectionEventDetail,
  registerForSelectionEvent,
  signFlyerUrl,
  withdrawSelectionEventParticipation,
} from "./event-detail-service";
import type { SelectionEventDetail } from "./event-detail-types";
import { buildEventUrl, copyEventLink, shareEventLink } from "./event-link";

/** §23: un confine temporale vicino aggiorna la disponibilità da solo. */
const MAX_BOUNDARY_TIMER_MS = 6 * 60 * 60 * 1000;

export function SelectionEventDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const params = useLocalSearchParams<{ eventId?: string }>();
  const eventId = typeof params.eventId === "string" ? params.eventId : "";

  const detailQuery = useQuery({
    enabled: !!actorId && !!eventId,
    queryFn: () => fetchSelectionEventDetail({ eventId }),
    queryKey: SELECTION_EVENTS_QK.detail(actorId, eventId),
    /* Un diniego non si ritenta; un errore tecnico una volta (§25). */
    retry: (count, error) =>
      !(error instanceof SelectionEventsError && error.isAuthorization) && count < 1,
    staleTime: 0,
  });

  const detail = detailQuery.data ?? null;
  const refetchDetail = detailQuery.refetch;

  /* §23: «Refresh di una tab pubblica aperta o ritorno in foreground deve
     aggiornare disponibilità; evita timer aggressivi.» */
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refetchDetail();
      }
    });

    return () => subscription.remove();
  }, [refetchDetail]);

  const nextTransitionAt = detail?.availability.nextTransitionAt ?? null;

  useEffect(() => {
    if (!nextTransitionAt) {
      return undefined;
    }

    const delay = new Date(nextTransitionAt).getTime() - Date.now() + 1000;

    if (!(delay > 0) || delay > MAX_BOUNDARY_TIMER_MS) {
      return undefined;
    }

    const timer = setTimeout(() => void refetchDetail(), delay);

    return () => clearTimeout(timer);
  }, [nextTransitionAt, refetchDetail]);

  /* §13: la vista Società solo quando la Dashboard opera come quella Società
     e il server ha restituito la proiezione gestionale. */
  const societyView =
    !!detail?.management && current?.kind === "society" && current.id === detail.clubId;

  const flyerPath = detail?.flyer?.path ?? null;
  const [flyerFailed, setFlyerFailed] = useState(false);
  const flyerQuery = useQuery({
    enabled: !!flyerPath && !!actorId,
    queryFn: () => signFlyerUrl(flyerPath ?? ""),
    queryKey: SELECTION_EVENTS_QK.flyerUrl(actorId, flyerPath ?? ""),
    staleTime: 30 * 60 * 1000,
  });

  const canSeePending =
    societyView && !!detail?.management?.canDecide && (detail.management.pendingRequestsCount ?? 0) > 0;
  const pendingQuery = useQuery({
    enabled: canSeePending,
    queryFn: () => fetchPendingRequestsPreview(eventId),
    queryKey: SELECTION_EVENTS_QK.pendingRequests(actorId, eventId),
    staleTime: 0,
  });

  const invalidate = useCallback(() => {
    for (const prefix of SELECTION_EVENTS_QK_PREFIXES) {
      void queryClient.invalidateQueries({ queryKey: [prefix] });
    }
  }, [queryClient]);

  // ── Comandi della persona ────────────────────────────────────────────────
  const [nonce] = useState(createSessionNonce);
  const [sheet, setSheet] = useState<"none" | "register" | "withdraw">("none");
  const [busy, setBusy] = useState(false);
  /**
   * §21: la chiave nasce con l'intenzione (apertura del sheet) e sopravvive ai
   * retry finché l'esito è incerto. Una reiscrizione dopo un ritiro è un
   * intento nuovo: la versione della partecipazione entra nell'impronta.
   */
  const keyRef = useRef<string | null>(null);

  const openSheet = (kind: "register" | "withdraw", signature: string) => {
    keyRef.current = operationKeyOf(nonce, `${signature}|${Date.now()}`);
    setSheet(kind);
  };

  const closeSheet = () => {
    if (!busy) {
      keyRef.current = null;
    }

    setSheet("none");
  };

  const runCommand = async (kind: "register" | "withdraw", run: (key: string) => Promise<unknown>) => {
    const key = keyRef.current ?? operationKeyOf(nonce, `${kind}|${Date.now()}`);

    keyRef.current = key;
    setBusy(true);

    try {
      await run(key);
      keyRef.current = null;
      setSheet("none");
      invalidate();
      await refetchDetail();
    } catch (error) {
      const copy = commandErrorCopy(error, kind);

      if (!copy.uncertain) {
        keyRef.current = null;
        setSheet("none");
      }

      showToast({ icon: "alert-circle-outline", id: `event-${kind}-error`, message: copy.message });

      if (copy.refresh) {
        invalidate();
        void refetchDetail();
      }
    } finally {
      setBusy(false);
    }
  };

  const confirmRegister = () =>
    void runCommand("register", (key) => registerForSelectionEvent({ eventId, idempotencyKey: key }));

  const participation = detail?.personal.participation ?? null;

  const confirmWithdraw = () =>
    participation
      ? void runCommand("withdraw", (key) =>
          withdrawSelectionEventParticipation({
            expectedVersion: participation.version,
            idempotencyKey: key,
            participationId: participation.id,
          }),
        )
      : undefined;

  // ── Condivisione (§9) ─────────────────────────────────────────────────────
  const url = detail?.publicId && detail.landingVisible ? buildEventUrl(detail.publicId) : null;

  const share = async (event: SelectionEventDetail) => {
    if (!url) {
      return;
    }

    const outcome = await shareEventLink({
      message: societyActions(event, url).shareMessage(event.club.name),
      title: event.title ?? "",
      url,
    });

    if (outcome === "unavailable") {
      showToast({ icon: "alert-circle-outline", id: "event-share-error", message: DETAIL_COPY.shareUnavailable });
    }
  };

  const copy = async () => {
    if (!url) {
      return;
    }

    const ok = await copyEventLink(url);

    showToast({
      icon: ok ? "checkmark-circle-outline" : "alert-circle-outline",
      id: "event-copy-link",
      message: ok ? DETAIL_COPY.linkCopied : DETAIL_COPY.copyFailed,
    });
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(SELECTION_EVENTS_HREFS.center() as never);
    }
  };

  // ── Stati di caricamento ─────────────────────────────────────────────────
  if (!detail) {
    const unavailable =
      detailQuery.error instanceof SelectionEventsError && detailQuery.error.isAuthorization;

    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.content}>
          <EventClubBar isVerified={false} logoUrl={null} name="" onBack={goBack} />
        </View>
        {detailQuery.isLoading || (!detailQuery.error && !detail) ? (
          <View style={styles.content}>
            <DashboardSkeleton />
          </View>
        ) : unavailable ? (
          /* §25: «Lo screen 20 … non rivela titolo, Società, bozza o solo
             invito». Anche una revoca arriva qui: nessun dato precedente
             resta a schermo (§23). */
          <EventUnavailableState body={DETAIL_COPY.unavailableBody} title={DETAIL_COPY.unavailableTitle} />
        ) : (
          /* Un errore di rete è un'altra cosa e offre Riprova (QA-137). */
          <DashboardGlobalError
            body={DETAIL_COPY.loadError}
            onRetry={() => void refetchDetail()}
            title={DETAIL_COPY.retry}
          />
        )}
      </View>
    );
  }

  const view = personalView(detail, { canActPersonally: !current || current.kind === "person" });
  const actions = societyActions(detail, url);
  const years = eventYearsLabel(detail.birthYearFrom, detail.birthYearTo);
  const capacity = capacityLine(detail);
  const title = detail.title ?? "";
  const withdrawCopy = participation ? withdrawSheetCopy(participation.status) : null;
  const flyerUri = flyerFailed ? null : (flyerQuery.data ?? null);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        <EventClubBar
          isVerified={detail.club.isVerified}
          logoUrl={detail.club.logoUrl}
          name={detail.club.name}
          onBack={goBack}
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, styles.scroll, { paddingBottom: spacing[32] + insets.bottom }]}
        refreshControl={
          <RefreshControl
            onRefresh={() => void refetchDetail()}
            refreshing={detailQuery.isRefetching}
            tintColor={colors.textNeutralMuted}
          />
        }
        testID="event-detail-scroll"
      >
        <EventFlyerImage
          height={detail.flyer?.height ?? null}
          onError={() => setFlyerFailed(true)}
          title={title}
          uri={flyerUri}
          width={detail.flyer?.width ?? null}
        />

        <View style={styles.titleBlock}>
          <AppText accessibilityRole="header" color="neutral" variant="headingMd">
            {title}
          </AppText>
          <AppText color="neutralMuted" variant="bodySm">
            {eventSubtitle(detail)}
          </AppText>
        </View>

        <View style={styles.info}>
          <EventInfoRow icon="calendar-outline" lines={whenLines(detail)} testID="event-detail-when" />
          <EventInfoRow icon="location-outline" lines={venueLines(detail)} testID="event-detail-venue" />
          {capacity ? (
            <EventInfoRow icon="people-outline" lines={[capacity]} testID="event-detail-capacity" />
          ) : null}
        </View>

        {societyView ? (
          <>
            {/* §9: azioni dirette, impilate senza ridurre il font. */}
            <View style={styles.actions}>
              {actions.canShare ? (
                <Button
                  fullWidth
                  label={DETAIL_COPY.share}
                  onPress={() => void share(detail)}
                  size="lg"
                  testID="event-share"
                  variant="primary"
                />
              ) : null}
              {actions.canCopy ? (
                <Button
                  fullWidth
                  label={DETAIL_COPY.copyLink}
                  onPress={() => void copy()}
                  size="lg"
                  testID="event-copy-link"
                  variant="secondary"
                />
              ) : null}
              {actions.canEdit ? (
                <Button
                  fullWidth
                  label={DETAIL_COPY.edit}
                  onPress={() => router.push(SELECTION_EVENTS_HREFS.edit(detail.eventId) as never)}
                  size="lg"
                  testID="event-edit"
                  variant="outline"
                />
              ) : null}
            </View>

            <EventContent detail={detail} years={years} />

            {canSeePending && pendingQuery.data && pendingQuery.data.items.length > 0 ? (
              <PendingRequestsPreview
                items={pendingQuery.data.items}
                onOpen={(participationId) =>
                  router.push(SELECTION_EVENTS_HREFS.request(participationId) as never)
                }
              />
            ) : null}
          </>
        ) : (
          <>
            {/* §20: lo stato personale prima dei contenuti, la CTA generica
                dopo (screen 08 vs 11–15). */}
            {view.status ? <EventNoticeCard notice={view.status} testID="event-personal-status" /> : null}

            {view.message ? (
              <View style={styles.message} testID="event-club-message">
                <AppText color="neutral" variant="metaStrong">
                  {view.message.title}
                </AppText>
                <AppText color="neutralMuted" selectable variant="bodySm">
                  {view.message.body}
                </AppText>
              </View>
            ) : null}

            {view.status && view.action ? (
              <PersonalActionButton
                kind={view.action.kind}
                label={view.action.label}
                onPress={() =>
                  view.action?.kind === "register_again"
                    ? openSheet("register", `again|${participation?.version ?? 0}`)
                    : openSheet("withdraw", `withdraw|${participation?.version ?? 0}`)
                }
              />
            ) : null}

            {view.status ? null : <EventContent detail={detail} years={years} />}

            {view.eventNotice ? (
              <EventNoticeCard notice={view.eventNotice} testID="event-availability-notice" />
            ) : null}

            {view.modeLine ? (
              <View style={styles.mode}>
                <EventInfoRow
                  icon="checkmark-circle-outline"
                  lines={[view.modeLine.label, ...(view.modeLine.helper ? [view.modeLine.helper] : [])]}
                  testID="event-mode-line"
                />
              </View>
            ) : null}

            {!view.status && view.action ? (
              <PersonalActionButton
                kind={view.action.kind}
                label={view.action.label}
                onPress={() => openSheet("register", "register")}
              />
            ) : null}

            {view.status ? <EventContent detail={detail} years={years} /> : null}
          </>
        )}
      </ScrollView>

      <RegisterSheet
        busy={busy}
        club={detail.club}
        model={registerSheetModel(detail)}
        onCancel={closeSheet}
        onConfirm={confirmRegister}
        person={{
          avatarUrl: profile?.avatar_url ?? null,
          meta: personMeta(profile?.role ?? null, detail.personal.birthYear),
          name: profile?.full_name ?? "",
        }}
        title={title}
        venue={detail.venueName}
        visible={sheet === "register"}
        when={whenInline(detail)}
      />

      {withdrawCopy ? (
        <WithdrawSheet
          body={withdrawCopy.body}
          busy={busy}
          confirmLabel={withdrawCopy.confirm}
          onCancel={closeSheet}
          onConfirm={confirmWithdraw}
          title={withdrawCopy.title}
          visible={sheet === "withdraw"}
        />
      ) : null}
    </View>
  );
}

/** Anni, descrizione e requisiti: sezioni facoltative omesse se vuote (§7). */
function EventContent({ detail, years }: { detail: SelectionEventDetail; years: string | null }) {
  return (
    <View style={styles.sections}>
      <EventTextSection body={years} testID="event-detail-years" title={DETAIL_COPY.yearsTitle} />
      <EventTextSection
        body={detail.description}
        strongTitle
        testID="event-detail-description"
        title={DETAIL_COPY.descriptionTitle}
      />
      <EventTextSection
        body={detail.requirements}
        strongTitle
        testID="event-detail-requirements"
        title={DETAIL_COPY.requirementsTitle}
      />
    </View>
  );
}

/**
 * Iscriviti / Iscriviti di nuovo sono primarie; Ritira richiesta e Annulla
 * partecipazione sono secondarie outlined (screen 11, 12, 14).
 */
function PersonalActionButton({
  kind,
  label,
  onPress,
}: {
  kind: "register" | "register_again" | "withdraw_request" | "cancel_participation";
  label: string;
  onPress: () => void;
}) {
  const primary = kind === "register" || kind === "register_again";

  return (
    <Button
      fullWidth
      label={label}
      onPress={onPress}
      size="lg"
      testID={`event-action-${kind}`}
      variant={primary ? "primary" : "secondary"}
    />
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing[12],
  },
  content: {
    paddingHorizontal: spacing[20],
  },
  info: {
    gap: spacing[12],
  },
  message: {
    gap: spacing[4],
  },
  mode: {
    paddingTop: spacing[4],
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  scroll: {
    gap: spacing[16],
    paddingTop: spacing[12],
  },
  sections: {
    gap: spacing[12],
  },
  titleBlock: {
    gap: spacing[4],
  },
});
