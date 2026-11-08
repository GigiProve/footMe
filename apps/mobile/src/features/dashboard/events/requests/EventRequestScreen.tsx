/**
 * Dettaglio della singola richiesta di partecipazione (DAS-REV-29 §17, §18;
 * screen 16, 17).
 *
 * «Implementa una sola route canonica della richiesta, riusabile dalla
 * futura gestione partecipanti.» Identità pubblicabile, contesto evento,
 * stato, data e capienza; «Visualizza profilo» apre il profilo canonico,
 * che applica privacy e blocking. Nessuna valutazione, stella Shortlist o
 * contatto privato.
 *
 * Le azioni sono capability del server (§17): «Conferma partecipazione» è
 * disabilitata a capienza piena con il motivo, «Non accettare» resta
 * disponibile. Dopo una decisione si torna al dettaglio dell'evento, dove la
 * preview mostra le richieste successive (§17).
 */
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../../theme/tokens";
import { AppText, Avatar, Button } from "../../../../ui";
import { useToast } from "../../../../ui/Toast/ToastProvider";
import { useSession } from "../../../auth/use-session";
import { DashboardGlobalError, DashboardSkeleton } from "../../components/DashboardStates";
import { createSessionNonce, operationKeyOf } from "../../positions/compose/compose-operation-key";
import { EventUnavailableState } from "../detail/components/EventDetailParts";
import {
  DETAIL_COPY,
  REQUEST_STATUS_LABELS,
  commandErrorCopy,
  normalizeDecisionMessage,
  personMeta,
  requestCapacityLine,
  whenInline,
} from "../detail/event-detail-presentation";
import {
  confirmEventParticipation,
  fetchEventRequest,
  rejectEventParticipation,
} from "../detail/event-detail-service";
import { SELECTION_EVENTS_QK, SELECTION_EVENTS_QK_PREFIXES } from "../events-keys";
import { SELECTION_EVENTS_HREFS } from "../events-routes";
import { SelectionEventsError } from "../events-service";
import { RejectRequestSheet } from "./RejectRequestSheet";

const DECISION_MESSAGE_LIMIT = 500;

export function EventRequestScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const params = useLocalSearchParams<{ participationId?: string }>();
  const participationId = typeof params.participationId === "string" ? params.participationId : "";

  const query = useQuery({
    enabled: !!actorId && !!participationId,
    queryFn: () => fetchEventRequest(participationId),
    queryKey: SELECTION_EVENTS_QK.request(actorId, participationId),
    retry: (count, error) =>
      !(error instanceof SelectionEventsError && error.isAuthorization) && count < 1,
    staleTime: 0,
  });

  const request = query.data ?? null;
  const [nonce] = useState(createSessionNonce);
  const [busy, setBusy] = useState<"confirm" | "reject" | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  /* §18: il testo resta qui anche se il salvataggio fallisce. */
  const [message, setMessage] = useState("");
  const keyRef = useRef<string | null>(null);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else if (request) {
      router.replace(SELECTION_EVENTS_HREFS.detail(request.event.id) as never);
    } else {
      router.replace(SELECTION_EVENTS_HREFS.center() as never);
    }
  };

  const invalidate = () => {
    for (const prefix of SELECTION_EVENTS_QK_PREFIXES) {
      void queryClient.invalidateQueries({ queryKey: [prefix] });
    }
  };

  const decide = async (kind: "confirm" | "reject") => {
    if (!request) {
      return;
    }

    /* §21: stessa chiave per i retry della stessa decisione sulla stessa
       versione; il messaggio entra nell'impronta. */
    const key =
      keyRef.current ??
      operationKeyOf(nonce, `${kind}|${request.participationId}|${request.version}|${message.trim()}`);

    keyRef.current = key;
    setBusy(kind);

    try {
      if (kind === "confirm") {
        await confirmEventParticipation({
          expectedVersion: request.version,
          idempotencyKey: key,
          participationId: request.participationId,
        });
      } else {
        await rejectEventParticipation({
          expectedVersion: request.version,
          idempotencyKey: key,
          message: normalizeDecisionMessage(message),
          participationId: request.participationId,
        });
      }

      keyRef.current = null;
      setRejectOpen(false);
      setMessage("");
      invalidate();
      goBack();
    } catch (error) {
      const copy = commandErrorCopy(error, "decision");

      if (!copy.uncertain) {
        keyRef.current = null;
      }

      showToast({ icon: "alert-circle-outline", id: "event-request-error", message: copy.message });

      if (copy.refresh) {
        invalidate();
        void query.refetch();
      }
    } finally {
      setBusy(null);
    }
  };

  const header = (
    <View style={styles.bar}>
      <Pressable
        accessibilityLabel="Indietro"
        accessibilityRole="button"
        hitSlop={8}
        onPress={goBack}
        style={styles.back}
        testID="event-request-back"
      >
        <Ionicons color={colors.textNeutral} name="chevron-back" size={24} />
      </Pressable>
      <AppText accessibilityRole="header" color="neutral" numberOfLines={1} variant="titleMd">
        {DETAIL_COPY.requestTitle}
      </AppText>
    </View>
  );

  if (!request) {
    const unavailable = query.error instanceof SelectionEventsError && query.error.isAuthorization;

    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.content}>{header}</View>
        {query.isLoading || !query.error ? (
          <View style={styles.content}>
            <DashboardSkeleton />
          </View>
        ) : unavailable ? (
          <EventUnavailableState body={DETAIL_COPY.unavailableBody} title={DETAIL_COPY.unavailableTitle} />
        ) : (
          <DashboardGlobalError body={DETAIL_COPY.loadError} onRetry={() => void query.refetch()} title={DETAIL_COPY.retry} />
        )}
      </View>
    );
  }

  const pending = request.status === "pending";
  const showConfirm = pending && (request.capabilities.confirm || request.capabilities.confirmBlockedReason === "full");

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.content}>{header}</View>

      <ScrollView
        contentContainerStyle={[styles.content, styles.scroll, { paddingBottom: spacing[32] + insets.bottom }]}
        testID="event-request-scroll"
      >
        <View style={styles.person}>
          <Avatar name={request.person.fullName} size="lg" uri={request.person.avatarUrl ?? undefined} />
          <View style={styles.flex}>
            <AppText color="neutral" variant="titleMd">
              {request.person.fullName}
            </AppText>
            <AppText color="neutralMuted" variant="bodySm">
              {personMeta(request.person.role, request.person.birthYear)}
            </AppText>
          </View>
        </View>

        <View style={styles.facts}>
          <Fact label={DETAIL_COPY.requestEvent} lines={[request.event.title ?? "", whenInline(request.event) ?? ""]} />
          <View style={styles.fact}>
            <AppText color="neutralMuted" variant="meta">
              {DETAIL_COPY.requestStatus}
            </AppText>
            <View style={[styles.statusPill, pending ? styles.statusPending : null]}>
              <AppText color="neutral" variant="metaStrong">
                {REQUEST_STATUS_LABELS[request.status]}
              </AppText>
            </View>
          </View>
          <Fact label={DETAIL_COPY.requestConfirmed} lines={[requestCapacityLine(request)]} />
        </View>

        {request.person.id ? (
          <Button
            fullWidth
            label={DETAIL_COPY.viewProfile}
            onPress={() => router.push(`/profile/${request.person.id}` as never)}
            size="md"
            testID="event-request-profile"
            variant="secondary"
          />
        ) : null}

        {showConfirm ? (
          <View style={styles.decision}>
            <Button
              disabled={!request.capabilities.confirm || busy !== null}
              fullWidth
              label={DETAIL_COPY.confirmParticipation}
              loading={busy === "confirm"}
              onPress={() => void decide("confirm")}
              size="lg"
              testID="event-request-confirm"
              variant="primary"
            />
            {/* §30 della 28 / §27 qui: una CTA disabilitata dice perché. */}
            {request.capabilities.confirmBlockedReason === "full" ? (
              <AppText color="neutralMuted" style={styles.reason} variant="bodySm">
                {DETAIL_COPY.noSeats}
              </AppText>
            ) : null}
          </View>
        ) : null}

        {pending && request.capabilities.reject ? (
          <Button
            disabled={busy !== null}
            fullWidth
            label={DETAIL_COPY.reject}
            onPress={() => {
              keyRef.current = null;
              setRejectOpen(true);
            }}
            size="lg"
            testID="event-request-reject"
            variant="secondary"
          />
        ) : null}
      </ScrollView>

      <RejectRequestSheet
        busy={busy === "reject"}
        limit={DECISION_MESSAGE_LIMIT}
        message={message}
        onCancel={() => {
          if (busy !== "reject") {
            setRejectOpen(false);
          }
        }}
        onChangeMessage={(value) => {
          /* Un testo diverso è una richiesta diversa: nuova chiave. */
          keyRef.current = null;
          setMessage(value);
        }}
        onConfirm={() => void decide("reject")}
        personName={request.person.fullName}
        visible={rejectOpen}
      />
    </View>
  );
}

function Fact({ label, lines }: { label: string; lines: string[] }) {
  return (
    <View style={styles.fact}>
      <AppText color="neutralMuted" variant="meta">
        {label}
      </AppText>
      {lines.filter(Boolean).map((line) => (
        <AppText color="neutral" key={line} variant="bodySm">
          {line}
        </AppText>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    alignItems: "center",
    height: sizes.touchTarget,
    justifyContent: "center",
    marginLeft: -spacing[12],
    width: sizes.touchTarget,
  },
  bar: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
    minHeight: sizes.touchTarget,
  },
  content: {
    paddingHorizontal: spacing[20],
  },
  decision: {
    gap: spacing[8],
  },
  fact: {
    alignItems: "flex-start",
    gap: spacing[4],
  },
  facts: {
    gap: spacing[16],
  },
  flex: {
    flex: 1,
    gap: spacing[4],
  },
  person: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
  reason: {
    textAlign: "center",
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  scroll: {
    gap: spacing[16],
    paddingTop: spacing[16],
  },
  statusPending: {
    backgroundColor: colors.noticeWarnSurface,
  },
  statusPill: {
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius.full,
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[4],
  },
});
