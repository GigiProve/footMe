/**
 * Il link pubblico aperto dentro l'app (DAS-REV-29 §12; QA-041/042/046/047).
 *
 * Universal/App Links e schema `footme://event/<id>` arrivano qui, sullo
 * stesso percorso dell'URL HTTPS.
 *
 *   · Con sessione: si risolve l'identificatore con il dettaglio autenticato e
 *     si sostituisce questa schermata con il dettaglio canonico, dentro la tab
 *     Dashboard (§4: «un link esterno deve risolvere verso il contesto nativo
 *     previsto»). Nessuna iscrizione automatica (§3.9).
 *   · Senza sessione: la proiezione pubblica — la stessa lettura anonima della
 *     landing — e «Accedi per continuare». Prima di mandare all'accesso si
 *     mette da parte l'identificatore (§12: «Non conservarla solo nello stato
 *     volatile dello screen»); le tab lo riprendono dopo login, signup e
 *     onboarding, e il dettaglio rivalida tutto.
 *
 * Un identificatore malformato non diventa mai una navigazione: stato
 * generico (QA-040). Errore di rete e indisponibilità restano distinti
 * (QA-137).
 */
import { useEffect, type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import { useSession } from "../../../auth/use-session";
import { DashboardGlobalError, DashboardSkeleton } from "../../components/DashboardStates";
import { SELECTION_EVENTS_QK } from "../events-keys";
import { SELECTION_EVENTS_HREFS } from "../events-routes";
import { SelectionEventsError } from "../events-service";
import {
  EventClubBar,
  EventInfoRow,
  EventNoticeCard,
  EventUnavailableState,
} from "../detail/components/EventDetailParts";
import {
  DETAIL_COPY,
  eventSubtitle,
  venueLines,
  whenLines,
} from "../detail/event-detail-presentation";
import { fetchPublicSelectionEvent, fetchSelectionEventDetail } from "../detail/event-detail-service";
import type { EventPublicProjection } from "../detail/event-detail-types";
import { isValidPublicId, pendingEventLink } from "../detail/event-link";

export function EventLinkScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isLoading: sessionLoading, profile, session } = useSession();
  const params = useLocalSearchParams<{ publicId?: string }>();
  const publicId = isValidPublicId(params.publicId) ? params.publicId : null;
  const actorId = profile?.id ?? "";
  const authenticated = !sessionLoading && !!session && !!actorId;

  const resolved = useQuery({
    enabled: authenticated && !!publicId,
    queryFn: () => fetchSelectionEventDetail({ publicId }),
    queryKey: SELECTION_EVENTS_QK.detailByPublicId(actorId, publicId ?? ""),
    retry: (count, error) =>
      !(error instanceof SelectionEventsError && error.isAuthorization) && count < 1,
    staleTime: 0,
  });

  const anonymous = useQuery({
    enabled: !sessionLoading && !authenticated && !!publicId,
    queryFn: () => fetchPublicSelectionEvent(publicId ?? ""),
    queryKey: SELECTION_EVENTS_QK.publicEvent(publicId ?? ""),
    staleTime: 0,
  });

  const eventId = resolved.data?.eventId ?? null;

  useEffect(() => {
    if (eventId) {
      router.replace(SELECTION_EVENTS_HREFS.detail(eventId) as never);
    }
  }, [eventId, router]);

  const continueToLogin = async () => {
    if (publicId) {
      await pendingEventLink.store(publicId);
    }

    /* L'indice instrada da solo verso accesso o onboarding mancante. */
    router.replace("/" as never);
  };

  const shell = (body: ReactNode) => (
    <View style={[styles.root, { paddingTop: insets.top + spacing[8] }]}>{body}</View>
  );

  if (!publicId) {
    return shell(<EventUnavailableState body={DETAIL_COPY.unavailableBody} title={DETAIL_COPY.unavailableTitle} />);
  }

  const query = authenticated ? resolved : anonymous;
  const unavailable =
    (query.error instanceof SelectionEventsError && query.error.isAuthorization) ||
    (!authenticated && anonymous.isSuccess && anonymous.data === null);

  if (unavailable) {
    return shell(<EventUnavailableState body={DETAIL_COPY.unavailableBody} title={DETAIL_COPY.unavailableTitle} />);
  }

  if (query.isError) {
    return shell(
      <DashboardGlobalError body={DETAIL_COPY.loadError} onRetry={() => void query.refetch()} title={DETAIL_COPY.retry} />,
    );
  }

  if (authenticated || sessionLoading || !anonymous.data) {
    return shell(
      <View style={styles.content}>
        <DashboardSkeleton />
      </View>,
    );
  }

  return shell(<PublicEventPreview event={anonymous.data} onContinue={() => void continueToLogin()} />);
}

/**
 * Vista pubblica minima in app per chi non ha sessione: stessi dati della
 * landing, nessun dato personale. La CTA porta all'accesso, non a
 * un'iscrizione.
 */
function PublicEventPreview({
  event,
  onContinue,
}: {
  event: EventPublicProjection;
  onContinue: () => void;
}) {
  const insets = useSafeAreaInsets();
  const capacity =
    event.maxParticipants !== null && event.confirmedCount !== null
      ? `${event.confirmedCount} / ${event.maxParticipants} ${DETAIL_COPY.confirmedSuffix}`
      : null;
  const state = event.availability.publicState;
  const notice =
    state === "cancelled"
      ? { icon: "alert-circle-outline" as const, lines: [DETAIL_COPY.cancelledBody], title: DETAIL_COPY.cancelledTitle, tone: "neutral" as const }
      : state === "completed"
        ? { icon: "flag-outline" as const, lines: [DETAIL_COPY.completedBody], title: DETAIL_COPY.completedTitle, tone: "neutral" as const }
        : state === "closed"
          ? { icon: "lock-closed-outline" as const, lines: [DETAIL_COPY.closedBody], title: DETAIL_COPY.closedTitle, tone: "neutral" as const }
          : state === "full"
            ? { icon: "people-outline" as const, lines: [DETAIL_COPY.fullAutomaticBody], title: DETAIL_COPY.fullTitle, tone: "neutral" as const }
            : state === "open_full_manual"
              ? { icon: "warning-outline" as const, lines: [DETAIL_COPY.fullManualBody], title: DETAIL_COPY.fullTitle, tone: "neutral" as const }
              : null;

  return (
    <ScrollView
      contentContainerStyle={[styles.content, styles.scroll, { paddingBottom: spacing[32] + insets.bottom }]}
      testID="event-link-public"
    >
      <EventClubBar isVerified={event.club.isVerified} logoUrl={event.club.logoUrl} name={event.club.name} />
      <View style={styles.titleBlock}>
        <AppText accessibilityRole="header" color="neutral" variant="headingMd">
          {event.title ?? ""}
        </AppText>
        <AppText color="neutralMuted" variant="bodySm">
          {eventSubtitle(event)}
        </AppText>
      </View>
      <EventInfoRow icon="calendar-outline" lines={whenLines(event)} />
      <EventInfoRow icon="location-outline" lines={venueLines(event)} />
      {capacity ? <EventInfoRow icon="people-outline" lines={[capacity]} /> : null}
      {notice ? <EventNoticeCard notice={notice} /> : null}
      <Button
        fullWidth
        label={DETAIL_COPY.loginToContinue}
        onPress={onContinue}
        size="lg"
        testID="event-link-continue"
        variant="primary"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing[20],
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  scroll: {
    gap: spacing[16],
  },
  titleBlock: {
    gap: spacing[4],
  },
});
