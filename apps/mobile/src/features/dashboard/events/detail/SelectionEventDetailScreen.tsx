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
 * DAS-REV-30 §8 (screen 01): con l'invito disponibile la primaria diventa
 * «Invita profili», copia e condividi restano dirette come secondarie; la
 * preview delle richieste lascia il posto al riepilogo di tre righe verso
 * il centro Partecipanti. §18–§19 (screen 07–10, 21, 22): il destinatario
 * accetta o rifiuta l'invito nello stesso dettaglio.
 *
 * Nessuna schermata di successo separata (§5): l'esito di un comando è lo
 * stato che il server restituisce, nello stesso dettaglio. Nessun optimistic
 * update (§23: «Non confermare posti optimistic senza commit affidabile»).
 *
 * DAS-REV-31 §15–§20 (screen 07–12, 18): menu «Gestisci evento» nella barra
 * con le sole azioni lifecycle concesse dal server, conferme di conclusione
 * e annullamento, pillola di stato sopra il titolo, storico in sola lettura
 * con i count originali, messaggio di annullamento nella vista personale e
 * banner «Informazioni aggiornate» quando si arriva dalla notifica.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  InteractionManager,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, spacing } from "../../../../theme/tokens";
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
  EventStatusPill,
  EventTextSection,
  EventUnavailableState,
} from "./components/EventDetailParts";
import { CancelEventSheet, CompleteEventSheet, ManageEventSheet } from "./components/EventLifecycleSheets";
import { RegisterSheet, WithdrawSheet } from "./components/EventSheets";
import { ParticipantsSummary } from "./components/ParticipantsSummary";
import {
  DETAIL_COPY,
  capacityLine,
  commandErrorCopy,
  eventSubtitle,
  eventYearsLabel,
  personMeta,
  personalView,
  type PersonalAction,
  registerSheetModel,
  societyActions,
  venueLines,
  whenInline,
  whenLines,
  withdrawSheetCopy,
} from "./event-detail-presentation";
import {
  cancelSelectionEvent,
  completeSelectionEvent,
  fetchSelectionEventDetail,
  registerForSelectionEvent,
  respondToEventInvitation,
  signFlyerUrl,
  withdrawSelectionEventParticipation,
} from "./event-detail-service";
import type { SelectionEventDetail } from "./event-detail-types";
import { buildEventUrl, copyEventLink, shareEventLink } from "./event-link";
import {
  LIFECYCLE_COPY,
  type ManageActionKind,
  isTerminal,
  lifecycleErrorCopy,
  lifecycleOutcomeNotice,
  lifecyclePill,
  lifecycleSignature,
  manageMenuActions,
  normalizeCancellationMessage,
  notOperationalCopy,
  parseUpdatedParam,
  showUpdatedBanner,
} from "./event-lifecycle-presentation";

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
  const params = useLocalSearchParams<{ eventId?: string; updated?: string }>();
  const eventId = typeof params.eventId === "string" ? params.eventId : "";
  /* DAS-REV-31 §20, screen 18: aperto dalla notifica di aggiornamento. */
  const fromUpdate = parseUpdatedParam(params.updated);

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

  /* §5: su smartphone compatto le secondarie si impilano, senza ridurre il
     font per farle stare su una riga. */
  const { width } = useWindowDimensions();
  const stackSecondary = width < 360;

  const invalidate = useCallback(() => {
    for (const prefix of SELECTION_EVENTS_QK_PREFIXES) {
      void queryClient.invalidateQueries({ queryKey: [prefix] });
    }
  }, [queryClient]);

  // ── Comandi della persona ────────────────────────────────────────────────
  const [nonce] = useState(createSessionNonce);
  const [sheet, setSheet] = useState<"none" | "register" | "withdraw" | "decline">("none");
  const [busy, setBusy] = useState(false);
  /**
   * §21: la chiave nasce con l'intenzione (apertura del sheet) e sopravvive ai
   * retry finché l'esito è incerto. Una reiscrizione dopo un ritiro è un
   * intento nuovo: la versione della partecipazione entra nell'impronta.
   */
  const keyRef = useRef<string | null>(null);

  const openSheet = (kind: "register" | "withdraw" | "decline", signature: string) => {
    keyRef.current = operationKeyOf(nonce, `${signature}|${Date.now()}`);
    setSheet(kind);
  };

  const closeSheet = () => {
    if (!busy) {
      keyRef.current = null;
    }

    setSheet("none");
  };

  const runCommand = async (
    kind: "register" | "withdraw" | "accept" | "decline",
    run: (key: string) => Promise<unknown>,
  ) => {
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
      const copy = commandErrorCopy(
        error,
        kind === "decline" ? "invitation" : kind,
      );

      if (!copy.uncertain) {
        keyRef.current = null;
        setSheet("none");
      }

      /* DAS-REV-31 §15: il motivo di NOT_OPERATIONAL si legge dallo stato
         reale riletto, non dalla schermata che mostrava ancora la CTA. */
      if (error instanceof SelectionEventsError && error.code === "SELECTION_EVENT_NOT_OPERATIONAL") {
        invalidate();
        const fresh = await refetchDetail();
        showToast({
          icon: "alert-circle-outline",
          id: `event-${kind}-error`,
          message: notOperationalCopy(fresh.data) ?? copy.message,
        });
        return;
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

  /**
   * DAS-REV-30 §18, §20: la chiave nasce dall'invito visto (partecipazione
   * + generazione), così un doppio tap o un retry dopo esito incerto non
   * confermano due volte e un reinvito successivo è un intento nuovo.
   */
  const confirmAccept = () => {
    if (!participation) {
      return;
    }

    keyRef.current =
      keyRef.current ?? operationKeyOf(nonce, `accept|${participation.id}|${participation.invitationGeneration}`);
    void runCommand("accept", (key) =>
      respondToEventInvitation({
        expectedGeneration: participation.invitationGeneration,
        expectedVersion: participation.version,
        idempotencyKey: key,
        participationId: participation.id,
        response: "accept",
      }),
    );
  };

  const confirmDecline = () =>
    participation
      ? void runCommand("decline", (key) =>
          respondToEventInvitation({
            expectedGeneration: participation.invitationGeneration,
            expectedVersion: participation.version,
            idempotencyKey: key,
            participationId: participation.id,
            response: "decline",
          }),
        )
      : undefined;

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

  // ── Lifecycle della Società (DAS-REV-31 §17, §18) ────────────────────────
  const [lifecycleSheet, setLifecycleSheet] = useState<"none" | "manage" | "complete" | "cancel">("none");
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  /* §18: «Il draft resta visibile in caso di errore»: il testo vive qui, non
     nello sheet, e sopravvive a errori e chiusure fino al commit. */
  const [cancelMessage, setCancelMessage] = useState("");
  const pendingSheetRef = useRef<"complete" | "cancel" | null>(null);

  const applyPendingSheet = () => {
    const next = pendingSheetRef.current;

    if (next) {
      pendingSheetRef.current = null;
      setLifecycleSheet(next);
    }
  };

  const selectManageAction = (kind: ManageActionKind) => {
    if (!detail) {
      return;
    }

    if (kind === "edit") {
      setLifecycleSheet("none");
      router.push(SELECTION_EVENTS_HREFS.edit(detail.eventId) as never);

      return;
    }

    /* Un modal alla volta, come AddToShortlistFlow: su iOS la conferma si
       apre quando il menu ha finito di chiudersi (`onDismiss`). */
    pendingSheetRef.current = kind;
    setLifecycleSheet("none");

    if (Platform.OS !== "ios") {
      InteractionManager.runAfterInteractions(applyPendingSheet);
    }
  };

  /**
   * §17, §18, §28: la chiave è l'impronta dell'intento (evento, versione
   * vista, messaggio): un retry dopo esito incerto riusa la stessa, un
   * messaggio cambiato ne genera una nuova. Nessun cambio a schermo prima
   * del commit; dopo, il dettaglio riletto mostra lo stato terminale.
   */
  const runLifecycle = async (kind: "complete" | "cancel") => {
    if (!detail || lifecycleBusy) {
      return;
    }

    const message = kind === "cancel" ? normalizeCancellationMessage(cancelMessage) : null;
    const idempotencyKey = operationKeyOf(
      nonce,
      lifecycleSignature(kind, detail.eventId, detail.version, message),
    );

    setLifecycleBusy(true);

    try {
      const result =
        kind === "complete"
          ? await completeSelectionEvent({ eventId: detail.eventId, idempotencyKey })
          : await cancelSelectionEvent({ eventId: detail.eventId, idempotencyKey, message });
      const notice = lifecycleOutcomeNotice(kind, result);

      setLifecycleSheet("none");
      setCancelMessage("");

      if (notice) {
        showToast({ icon: "information-circle-outline", id: "event-lifecycle-outcome", message: notice });
      }

      invalidate();
      await refetchDetail();
    } catch (error) {
      const copy = lifecycleErrorCopy(error, kind);

      /* Lo stato reale è cambiato: lo sheet si chiude e il dettaglio si
         riconcilia. Altrimenti resta aperto con il testo intatto. */
      if (copy.refresh && !copy.uncertain) {
        setLifecycleSheet("none");
      }

      showToast({ icon: "alert-circle-outline", id: `event-${kind}-error`, message: copy.message });

      if (copy.refresh) {
        invalidate();
        void refetchDetail();
      }
    } finally {
      setLifecycleBusy(false);
    }
  };

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
  /* DAS-REV-31: menu e pillola dipendono dalla vista, non solo dal payload. */
  const manageActions = societyView ? manageMenuActions(detail) : [];
  const pill = lifecyclePill(detail, { society: societyView });
  const terminal = isTerminal(detail.status);
  /* DAS-REV-31 §19, screen 12: per la persona lo stato terminale è il
     primo blocco, a tutta larghezza, prima di ogni dato dell'evento. */
  const personalTerminal = terminal && !societyView;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        <EventClubBar
          isVerified={detail.club.isVerified}
          logoUrl={detail.club.logoUrl}
          menuLabel={LIFECYCLE_COPY.manageTitle}
          name={detail.club.name}
          onBack={goBack}
          onMenu={manageActions.length > 0 ? () => setLifecycleSheet("manage") : undefined}
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
        {/* DAS-REV-31 §20, screen 18: i dati mostrati sono già quelli attuali;
            nessun diff tecnico, nessun nome di campo. */}
        {showUpdatedBanner(detail, fromUpdate) ? (
          <EventNoticeCard
            notice={{ icon: "information-circle-outline", lines: [], title: LIFECYCLE_COPY.updatedBanner, tone: "neutral" }}
            testID="event-updated-banner"
          />
        ) : null}

        {personalTerminal && pill ? (
          <EventNoticeCard
            notice={{ icon: "information-circle-outline", lines: [], title: pill, tone: "neutral" }}
            testID="event-terminal-notice"
          />
        ) : null}

        <EventFlyerImage
          height={detail.flyer?.height ?? null}
          onError={() => setFlyerFailed(true)}
          title={title}
          uri={flyerUri}
          width={detail.flyer?.width ?? null}
        />

        {pill && !personalTerminal ? <EventStatusPill label={pill} testID="event-lifecycle-pill" /> : null}

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
            {/* §9 della 29, §8 della 30: azioni dirette. Con l'invito la
                primaria è «Invita profili» e copia/condividi restano visibili
                come secondarie; senza, torna la gerarchia della 29. */}
            <View style={styles.actions}>
              {actions.canInvite ? (
                <Button
                  fullWidth
                  label={DETAIL_COPY.invite}
                  onPress={() => router.push(SELECTION_EVENTS_HREFS.invite(detail.eventId) as never)}
                  size="lg"
                  testID="event-invite"
                  variant="primary"
                />
              ) : null}
              {actions.inviteFullNotice ? (
                <AppText color="neutralMuted" testID="event-invite-full" variant="bodySm">
                  {actions.inviteFullNotice}
                </AppText>
              ) : null}
              {actions.shareIsPrimary && actions.canShare ? (
                <Button
                  fullWidth
                  label={DETAIL_COPY.share}
                  onPress={() => void share(detail)}
                  size="lg"
                  testID="event-share"
                  variant="primary"
                />
              ) : null}
              {actions.shareIsPrimary && actions.canCopy ? (
                <Button
                  fullWidth
                  label={DETAIL_COPY.copyLink}
                  onPress={() => void copy()}
                  size="lg"
                  testID="event-copy-link"
                  variant="secondary"
                />
              ) : null}
              {!actions.shareIsPrimary && (actions.canCopy || actions.canShare) ? (
                <View style={stackSecondary ? styles.secondaryStack : styles.secondaryRow}>
                  {actions.canCopy ? (
                    <Button
                      fullWidth={stackSecondary}
                      label={DETAIL_COPY.copyLink}
                      onPress={() => void copy()}
                      size="md"
                      style={stackSecondary ? null : styles.secondaryButton}
                      testID="event-copy-link"
                      variant="secondary"
                    />
                  ) : null}
                  {actions.canShare ? (
                    <Button
                      fullWidth={stackSecondary}
                      label={DETAIL_COPY.share}
                      onPress={() => void share(detail)}
                      size="md"
                      style={stackSecondary ? null : styles.secondaryButton}
                      testID="event-share"
                      variant="secondary"
                    />
                  ) : null}
                </View>
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

            {/* §8: count privati solo con la lettura partecipanti. */}
            {detail.management?.participants ? (
              <ParticipantsSummary
                /* DAS-REV-31 §19, screen 10: storico consultabile, nessuna
                   gestione; i tre count restano quelli originali. */
                footnote={terminal ? LIFECYCLE_COPY.historyFootnote : null}
                manageLabel={terminal ? LIFECYCLE_COPY.viewParticipants : undefined}
                onManage={() => router.push(SELECTION_EVENTS_HREFS.participants(detail.eventId) as never)}
                onOpen={(filter) => router.push(SELECTION_EVENTS_HREFS.participants(detail.eventId, filter) as never)}
                summary={detail.management.participants}
              />
            ) : null}

            <EventContent detail={detail} years={years} />
          </>
        ) : (
          <>
            {/* §20: lo stato personale prima dei contenuti, la CTA generica
                dopo (screen 08 vs 11–15). */}
            {view.status ? <EventNoticeCard notice={view.status} testID="event-personal-status" /> : null}

            {view.message ? (
              <View style={styles.message} testID="event-club-message">
                <View style={styles.messageHeader}>
                  <AppText color="neutral" variant="metaStrong">
                    {view.message.title}
                  </AppText>
                </View>
                <AppText color="neutralMuted" selectable style={styles.messageBody} variant="bodySm">
                  {view.message.body}
                </AppText>
              </View>
            ) : null}

            {view.helper ? (
              <AppText color="neutralMuted" testID="event-invite-helper" variant="bodySm">
                {view.helper}
              </AppText>
            ) : null}

            {/* DAS-REV-30 §18, screen 09: posti esauriti sopra Accetta. */}
            {view.status && view.eventNotice && view.action?.kind === "accept_invitation" ? (
              <EventNoticeCard notice={view.eventNotice} testID="event-invite-full-notice" />
            ) : null}

            {view.status && view.action ? (
              <PersonalActionButton
                disabled={view.action.disabled || busy}
                kind={view.action.kind}
                label={view.action.label}
                loading={busy && view.action.kind === "accept_invitation"}
                unavailable={view.action.disabled}
                onPress={() =>
                  view.action?.kind === "accept_invitation"
                    ? confirmAccept()
                    : view.action?.kind === "register_again"
                      ? openSheet("register", `again|${participation?.version ?? 0}`)
                      : openSheet("withdraw", `withdraw|${participation?.version ?? 0}`)
                }
              />
            ) : null}

            {view.secondaryAction ? (
              <PersonalActionButton
                disabled={busy}
                kind={view.secondaryAction.kind}
                label={view.secondaryAction.label}
                onPress={() =>
                  openSheet(
                    "decline",
                    `decline|${participation?.id ?? ""}|${participation?.invitationGeneration ?? 0}`,
                  )
                }
              />
            ) : null}

            {view.status ? null : <EventContent detail={detail} years={years} />}

            {view.eventNotice && view.action?.kind !== "accept_invitation" ? (
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

      {/* DAS-REV-30 §19, screen 10: nessun motivo, nessun campo messaggio. */}
      <WithdrawSheet
        body={DETAIL_COPY.declineBody(detail.club.name)}
        busy={busy}
        confirmLabel={DETAIL_COPY.declineConfirm}
        onCancel={closeSheet}
        onConfirm={confirmDecline}
        title={DETAIL_COPY.declineTitle}
        visible={sheet === "decline"}
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

      {/* DAS-REV-31 screen 07–09, 11: menu e conferme lifecycle. */}
      <ManageEventSheet
        actions={manageActions}
        onClose={() => {
          pendingSheetRef.current = null;
          setLifecycleSheet("none");
        }}
        onDismiss={applyPendingSheet}
        onSelect={selectManageAction}
        visible={societyView && lifecycleSheet === "manage"}
      />

      <CompleteEventSheet
        busy={lifecycleBusy}
        onCancel={() => setLifecycleSheet("none")}
        onConfirm={() => void runLifecycle("complete")}
        visible={societyView && lifecycleSheet === "complete"}
      />

      <CancelEventSheet
        busy={lifecycleBusy}
        message={cancelMessage}
        onCancel={() => setLifecycleSheet("none")}
        onChangeMessage={setCancelMessage}
        onConfirm={() => void runLifecycle("cancel")}
        visible={societyView && lifecycleSheet === "cancel"}
      />
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
  disabled,
  kind,
  label,
  loading,
  onPress,
  unavailable,
}: {
  disabled?: boolean;
  /** L'azione esiste ma il server la nega ora (posti esauriti). */
  unavailable?: boolean;
  kind: PersonalAction;
  label: string;
  loading?: boolean;
  onPress: () => void;
}) {
  /* DAS-REV-30 §18: Accetta invito primaria, Rifiuta secondaria. */
  const primary = kind === "register" || kind === "register_again" || kind === "accept_invitation";

  return (
    <Button
      disabled={disabled}
      fullWidth
      loading={loading}
      label={label}
      onPress={onPress}
      size="lg"
      testID={`event-action-${kind}`}
      /* DAS-REV-30 §5, screen 09: «nessun blu pallido». Una primaria non
         disponibile diventa neutra invece di sbiadire il blu. */
      variant={primary ? (unavailable ? "neutralOutline" : "primary") : "secondary"}
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
  /* Screen 12: card del messaggio della Società, intestazione su fondo
     neutro e corpo bianco; hairline del modulo, radius delle card. */
  message: {
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  messageBody: {
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  messageHeader: {
    backgroundColor: colors.surfaceNeutral,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[10],
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
  secondaryButton: {
    flex: 1,
  },
  secondaryRow: {
    flexDirection: "row",
    gap: spacing[12],
  },
  secondaryStack: {
    gap: spacing[12],
  },
  sections: {
    gap: spacing[12],
  },
  titleBlock: {
    gap: spacing[4],
  },
});
