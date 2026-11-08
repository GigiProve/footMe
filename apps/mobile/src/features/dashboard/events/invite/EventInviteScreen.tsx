/**
 * Invita profili / Invita a evento (DAS-REV-30 §13–§17; screen 02-06, 20, 24).
 *
 * Un flusso focalizzato, fuori dalle tab (§5), con due ingressi:
 *
 *   · `?eventId=` dal dettaglio → selezione destinatari (02, 03) → conferma
 *     (04) → esito; l'evento non si sceglie di nuovo (§13);
 *   · `?personId=` dal profilo → scelta evento (06, 24) → la **stessa**
 *     conferma con quella persona (§17).
 *
 * Passi come stato interno, non route: Indietro dalla conferma conserva
 * selezione e messaggio senza inviare (§15). La Società è quella attiva
 * nella Dashboard al momento dell'apertura: se l'identità cambia, il flusso
 * smette di valere e il server rifiuta comunque un invio con il contesto
 * vecchio (§12, QA-005).
 *
 * Nessun optimistic update e nessuna bozza (§15). La chiave idempotente
 * nasce dall'intento (evento + persone + messaggio) e sopravvive ai retry
 * con esito incerto: un doppio tap o un timeout non spediscono due volte
 * (§16, QA-043/044/050).
 */
import { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText, Button, ConfirmModal, EmptyState, SearchField } from "../../../../ui";
import { useToast } from "../../../../ui/Toast/ToastProvider";
import { useSession } from "../../../auth/use-session";
import { DashboardSkeleton } from "../../components/DashboardStates";
import { useDashboardIdentity } from "../../identity/use-dashboard-identity";
import { createSessionNonce, operationKeyOf } from "../../positions/compose/compose-operation-key";
import { EventClubBar, EventUnavailableState } from "../detail/components/EventDetailParts";
import { DETAIL_COPY, eventSubtitle, venueLines, whenLines } from "../detail/event-detail-presentation";
import { fetchSelectionEventDetail } from "../detail/event-detail-service";
import { SELECTION_EVENTS_QK, SELECTION_EVENTS_QK_PREFIXES } from "../events-keys";
import { SELECTION_EVENTS_HREFS } from "../events-routes";
import { SelectionEventsError } from "../events-service";
import { CandidateRow, SourceControl, SourceSheet } from "./components/InviteSelection";
import { ConfirmStep, OutcomeStep, PickStep, type EventSummaryModel } from "./components/InviteSteps";
import {
  EMPTY_SELECTION,
  INVITE_COPY,
  invitableEventLines,
  invitableEventSubtitle,
  normalizeInviteMessage,
  outcomeView,
  reconcileSelection,
  selectedCountLabel,
  sendErrorCopy,
  sourceChangeDecision,
  sourceKey,
  toggleCandidate,
  type OutcomeView,
  type Selection,
} from "./invite-presentation";
import {
  fetchInvitableEvents,
  fetchInvitePerson,
  fetchInviteSources,
  searchInviteCandidates,
  sendEventInvitations,
} from "./invite-service";
import type { InviteSource } from "./invite-types";

/** `invitationMessage` di `selection_event_limits` (limite della 29). */
const MESSAGE_LIMIT = 500;
const SEARCH_DEBOUNCE_MS = 300;

type Step = "pick" | "select" | "confirm" | "outcome";

export function EventInviteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const params = useLocalSearchParams<{ eventId?: string; personId?: string }>();
  const fromProfile = typeof params.personId === "string" && params.personId.length > 0;
  const personId = fromProfile ? (params.personId as string) : "";
  const society = current?.kind === "society" ? current : null;

  /* §12: il contesto dell'apertura. Un cambio di Società lo invalida. */
  const [openedClubId] = useState(() => society?.id ?? "");
  const clubId = society?.id ?? "";
  const contextChanged = !!openedClubId && clubId !== openedClubId;

  const [step, setStep] = useState<Step>(fromProfile ? "pick" : "select");
  const [eventId, setEventId] = useState(() => (typeof params.eventId === "string" ? params.eventId : ""));
  const [pickedId, setPickedId] = useState<string | null>(null);

  const close = () => {
    if (router.canGoBack()) {
      router.back();
    } else if (eventId && !fromProfile) {
      router.replace(SELECTION_EVENTS_HREFS.detail(eventId) as never);
    } else {
      router.replace("/(tabs)/dashboard" as never);
    }
  };

  // ── Dati ──────────────────────────────────────────────────────────────────
  const detailQuery = useQuery({
    enabled: !!actorId && !!eventId && !fromProfile,
    queryFn: () => fetchSelectionEventDetail({ eventId }),
    queryKey: SELECTION_EVENTS_QK.detail(actorId, eventId),
    retry: (count, error) => !(error instanceof SelectionEventsError && error.isAuthorization) && count < 1,
  });
  const detail = detailQuery.data ?? null;

  const eventsQuery = useQuery({
    enabled: !!actorId && fromProfile && !!clubId,
    queryFn: () => fetchInvitableEvents(clubId, personId),
    queryKey: SELECTION_EVENTS_QK.invitableEvents(actorId, clubId, personId),
    retry: (count, error) => !(error instanceof SelectionEventsError && error.isAuthorization) && count < 1,
  });
  const personQuery = useQuery({
    enabled: fromProfile && !!personId,
    queryFn: () => fetchInvitePerson(personId),
    queryKey: SELECTION_EVENTS_QK.invitePerson(actorId, personId),
  });

  const sourcesQuery = useQuery({
    enabled: !!actorId && !!eventId && !fromProfile && !!clubId,
    queryFn: () => fetchInviteSources(eventId),
    queryKey: SELECTION_EVENTS_QK.inviteSources(actorId, clubId, eventId),
  });

  // ── Selezione (§13–§15) ───────────────────────────────────────────────────
  const [source, setSource] = useState<InviteSource>(null);
  const [pendingSource, setPendingSource] = useState<InviteSource | undefined>(undefined);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  const candidatesQuery = useInfiniteQuery({
    enabled: !!actorId && !!eventId && !fromProfile && !!clubId && !contextChanged,
    getNextPageParam: (last: { nextCursor: string | null }) => last.nextCursor ?? undefined,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      try {
        return await searchInviteCandidates({
          cursor: pageParam,
          eventId,
          query: debounced,
          shortlistId: source?.shortlistId ?? null,
        });
      } catch (error) {
        /* §14, QA-036: ACL della lista revocata durante il selector → via i
           dati e le selezioni derivate, ritorno a una sorgente valida,
           feedback. Nessun ripiego silenzioso sulla ricerca globale. */
        if (error instanceof SelectionEventsError && error.code === "SHORTLIST_SOURCE_NOT_AVAILABLE") {
          setSource(null);
          setSelection(EMPTY_SELECTION);
          showToast({ icon: "alert-circle-outline", id: "invite-source-revoked", message: INVITE_COPY.sourceRevoked });
          void queryClient.invalidateQueries({ queryKey: ["selection-event-invite-sources"] });
        }

        throw error;
      }
    },
    queryKey: SELECTION_EVENTS_QK.candidates(actorId, clubId, eventId, sourceKey(source), debounced),
    retry: (count, error) =>
      !(error instanceof SelectionEventsError && (error.isAuthorization || error.code === "SHORTLIST_SOURCE_NOT_AVAILABLE")) &&
      count < 1,
  });
  const candidates = (candidatesQuery.data?.pages ?? []).flatMap((page) => page.items);
  /* Una persona selezionata che il server ora mostra come non selezionabile
     esce dal contatore: niente promesse di invii che verrebbero saltati.
     Derivata in render, non copiata in uno stato. */
  const effectiveSelection = reconcileSelection(selection, candidates);
  const sourceRevoked =
    candidatesQuery.error instanceof SelectionEventsError &&
    candidatesQuery.error.code === "SHORTLIST_SOURCE_NOT_AVAILABLE";

  const chooseSource = (next: InviteSource) => {
    setSourceOpen(false);

    const decision = sourceChangeDecision(source, next, effectiveSelection.size);

    if (decision === "immediate") {
      setSource(next);
    } else if (decision === "confirm") {
      setPendingSource(next);
    }
  };

  // ── Invio (§16) ───────────────────────────────────────────────────────────
  const [nonce] = useState(createSessionNonce);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Exclude<OutcomeView, { kind: "success" }> | null>(null);
  const keyRef = useRef<string | null>(null);

  const people = fromProfile
    ? personQuery.data
      ? [{ ...personQuery.data, primaryPosition: null }]
      : []
    : [...effectiveSelection.values()];

  const send = async () => {
    if (!clubId || contextChanged || people.length === 0 || !eventId) {
      return;
    }

    const ids = people.map((person) => person.personId).sort();
    const text = normalizeInviteMessage(message);
    const key = keyRef.current ?? operationKeyOf(nonce, `invite|${eventId}|${ids.join(",")}|${text ?? ""}`);

    keyRef.current = key;
    setBusy(true);

    try {
      const result = await sendEventInvitations({
        clubId,
        eventId,
        idempotencyKey: key,
        message: text,
        personIds: ids,
      });
      const view = outcomeView(result);

      keyRef.current = null;
      for (const prefix of SELECTION_EVENTS_QK_PREFIXES) {
        void queryClient.invalidateQueries({ queryKey: [prefix] });
      }

      if (view.kind === "success") {
        showToast({ icon: "checkmark-circle-outline", id: "invite-sent", message: view.message });
        close();
      } else {
        setOutcome(view);
        setStep("outcome");
      }
    } catch (error) {
      const copy = sendErrorCopy(error);

      /* §27: «Retry dopo esito di rete sconosciuto riconcilia prima di
         ripetere»: la stessa chiave fa restituire al server la ricevuta. */
      if (!copy.uncertain) {
        keyRef.current = null;
      }

      showToast({ icon: "alert-circle-outline", id: "invite-send-error", message: copy.message });
    } finally {
      setBusy(false);
    }
  };

  // ── Modello evento per conferma ed esito ─────────────────────────────────
  const picked = (eventsQuery.data ?? []).find((event) => event.eventId === pickedId) ?? null;
  const eventModel: EventSummaryModel | null = fromProfile
    ? picked && society
      ? {
          clubLogoUrl: society.avatarUrl,
          clubName: society.name,
          lines: invitableEventLines(picked),
          subtitle: invitableEventSubtitle(picked),
          title: picked.title,
        }
      : null
    : detail
      ? {
          clubLogoUrl: detail.club.logoUrl,
          clubName: detail.club.name,
          lines: [whenLines(detail).join(" · "), ...venueLines(detail).slice(0, 1)].filter(Boolean),
          subtitle: eventSubtitle(detail),
          title: detail.title ?? "",
        }
      : null;

  // ── Render ────────────────────────────────────────────────────────────────
  const bar = (
    <View style={styles.bar}>
      <EventClubBar
        isVerified={society?.isVerified ?? false}
        logoUrl={society?.avatarUrl ?? null}
        name={society && !contextChanged ? society.name : ""}
        onBack={
          step === "confirm" && !busy
            ? () => setStep(fromProfile ? "pick" : "select")
            : step === "outcome"
              ? undefined
              : close
        }
      />
      {step !== "outcome" ? (
        <Pressable
          accessibilityLabel={INVITE_COPY.close}
          accessibilityRole="button"
          hitSlop={8}
          onPress={close}
          style={styles.close}
          testID="invite-close"
        >
          <Ionicons color={colors.textNeutral} name="close" size={24} />
        </Pressable>
      ) : null}
    </View>
  );

  const authError =
    !society ||
    contextChanged ||
    (detailQuery.error instanceof SelectionEventsError && detailQuery.error.isAuthorization) ||
    (eventsQuery.error instanceof SelectionEventsError && eventsQuery.error.isAuthorization) ||
    (candidatesQuery.error instanceof SelectionEventsError && candidatesQuery.error.isAuthorization) ||
    (!!detail && (detail.clubId !== clubId || !detail.management?.canInvite) && step === "select");

  if (authError) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {bar}
        <EventUnavailableState body={DETAIL_COPY.unavailableBody} title={DETAIL_COPY.unavailableTitle} />
      </View>
    );
  }

  if (step === "pick") {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {bar}
        {eventsQuery.isError ? (
          <View style={styles.state}>
            <EmptyState icon="alert-circle-outline" title={INVITE_COPY.pickError} variant="error" />
            <Button fullWidth label={INVITE_COPY.retry} onPress={() => void eventsQuery.refetch()} size="lg" variant="primary" />
          </View>
        ) : !eventsQuery.data ? (
          <View style={styles.pad}>
            <DashboardSkeleton />
          </View>
        ) : (
          <PickStep
            bottomInset={insets.bottom}
            clubName={society?.name ?? ""}
            events={eventsQuery.data}
            onClose={close}
            onContinue={() => {
              if (pickedId) {
                setEventId(pickedId);
                keyRef.current = null;
                setStep("confirm");
              }
            }}
            onSelect={setPickedId}
            selectedId={pickedId}
          />
        )}
      </View>
    );
  }

  if ((step === "confirm" || step === "outcome") && eventModel) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {bar}
        {step === "confirm" ? (
          <ConfirmStep
            bottomInset={insets.bottom}
            busy={busy}
            event={eventModel}
            limit={MESSAGE_LIMIT}
            message={message}
            onBack={() => setStep(fromProfile ? "pick" : "select")}
            onChangeMessage={(value) => {
              /* Un testo diverso è un intento diverso: nuova chiave. */
              keyRef.current = null;
              setMessage(value);
            }}
            onSend={() => void send()}
            people={people}
          />
        ) : outcome ? (
          <OutcomeStep
            bottomInset={insets.bottom}
            doneLabel={fromProfile ? INVITE_COPY.close : INVITE_COPY.backToEvent}
            event={eventModel}
            onBackToSelection={
              /* §16: zero successi → ritorno alla selezione; mai un reinvio
                 implicito dei successi. */
              outcome.kind === "none" && !fromProfile
                ? () => {
                    setSelection(EMPTY_SELECTION);
                    setOutcome(null);
                    setStep("select");
                  }
                : null
            }
            onDone={close}
            view={outcome}
          />
        ) : null}
      </View>
    );
  }

  // step === "select"
  const loading = !candidatesQuery.data && !candidatesQuery.isError;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {bar}
      <FlatList
        contentContainerStyle={styles.pad}
        data={candidates}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(row) => row.personId}
        ListEmptyComponent={
          candidatesQuery.isError && !sourceRevoked ? (
            <View style={styles.state} testID="invite-candidates-error">
              <EmptyState icon="alert-circle-outline" title={INVITE_COPY.loadError} variant="error" />
              <Button fullWidth label={INVITE_COPY.retry} onPress={() => void candidatesQuery.refetch()} size="lg" variant="primary" />
            </View>
          ) : loading ? (
            <DashboardSkeleton />
          ) : (
            <View style={styles.state} testID="invite-candidates-empty">
              <EmptyState
                description={source ? INVITE_COPY.emptyListBody : INVITE_COPY.emptyAllBody}
                icon="people-outline"
                title={source && !debounced ? INVITE_COPY.emptyList : INVITE_COPY.emptyAll}
              />
            </View>
          )
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <AppText accessibilityRole="header" color="neutral" variant="screenTitle">
              {INVITE_COPY.title}
            </AppText>
            <SearchField
              onChangeText={setQuery}
              onClear={() => setQuery("")}
              placeholder={INVITE_COPY.search}
              testID="invite-search"
              value={query}
            />
            <SourceControl onPress={() => setSourceOpen(true)} source={source} />
          </View>
        }
        onEndReached={() => {
          if (candidatesQuery.hasNextPage && !candidatesQuery.isFetchingNextPage) {
            void candidatesQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        renderItem={({ index, item }) => (
          <CandidateRow
            checked={effectiveSelection.has(item.personId)}
            first={index === 0}
            onToggle={() => setSelection((prev) => toggleCandidate(prev, item))}
            row={item}
          />
        )}
        testID="invite-candidates"
      />

      {/* §15: «N selezionati» e Continua solo con almeno una persona; il
          contatore include le selezioni fuori dalla pagina visibile. */}
      <View style={[styles.footer, { paddingBottom: spacing[12] + insets.bottom }]}>
        <AppText accessibilityLiveRegion="polite" color="neutral" testID="invite-selected-count" variant="metaStrong">
          {selectedCountLabel(effectiveSelection.size)}
        </AppText>
        <Button
          disabled={effectiveSelection.size === 0}
          fullWidth
          label={INVITE_COPY.continue}
          onPress={() => {
            keyRef.current = null;
            setStep("confirm");
          }}
          size="lg"
          testID="invite-continue"
          variant="primary"
        />
      </View>

      <SourceSheet
        current={source}
        onClose={() => setSourceOpen(false)}
        onSelect={chooseSource}
        sources={sourcesQuery.data ?? null}
        visible={sourceOpen}
      />

      <ConfirmModal
        cancelLabel={INVITE_COPY.cancel}
        confirmLabel={INVITE_COPY.changeSourceConfirm}
        message={INVITE_COPY.changeSourceBody}
        onCancel={() => setPendingSource(undefined)}
        onConfirm={() => {
          setSelection(EMPTY_SELECTION);
          setSource(pendingSource ?? null);
          setPendingSource(undefined);
        }}
        title={INVITE_COPY.changeSourceTitle}
        visible={pendingSource !== undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: spacing[20],
  },
  close: {
    alignItems: "center",
    height: sizes.touchTarget,
    justifyContent: "center",
    marginLeft: "auto",
    marginRight: -spacing[12],
    width: sizes.touchTarget,
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing[8],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  header: {
    gap: spacing[12],
    paddingBottom: spacing[8],
    paddingTop: spacing[12],
  },
  pad: {
    paddingHorizontal: spacing[20],
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  state: {
    gap: spacing[16],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[24],
  },
});
