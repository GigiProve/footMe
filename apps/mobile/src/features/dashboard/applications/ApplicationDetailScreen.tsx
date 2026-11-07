/**
 * Dettaglio condiviso della candidatura (screen 05-10, 16).
 *
 * **Un solo container**, raggiunto da tutti gli ingressi e adattivo sulle
 * quattro tipologie professionali: §15 — «Usa un solo container e un solo
 * modello di dettaglio, con contenuti professionali adattivi. Non creare
 * quattro schermate indipendenti per ruolo o copie per i due ingressi.»
 *
 * Due letture indipendenti, non una:
 *
 *   · la candidatura — contesto storico dell'invio, stato, capacità;
 *   · il profilo canonico della persona — identico a quello che apre il
 *     Master Profile.
 *
 * §16 impone la seconda («Recupera identità, foto, ruolo corrente, società
 * attuale, qualifiche, carriera e statistiche dai profili canonici») e §27 la
 * rende utile: «Errore di un singolo blocco della carriera: mostra il resto
 * autorizzato, un errore locale discreto e un retry mirato.» Un unico payload
 * avrebbe reso impossibile quel comportamento.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Avatar, useToast } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { openDirectConversation } from "../../messaging/messaging-service";
import { getCompleteProfessionalProfile } from "../../profiles/profile-service";
import { STALE_MS } from "../cache/freshness-policy";
import {
  DashboardGlobalEmpty,
  DashboardGlobalError,
  DashboardSkeleton,
} from "../components/DashboardStates";
import { SocietyContextHeader } from "../components/SocietyContextHeader";
import { useDashboardIdentity } from "../identity/use-dashboard-identity";
import { useAccessWindow } from "../state/use-access-window";
import { trackApplicationsEvent } from "./applications-analytics";
import {
  APPLICATIONS_CROSS_PREFIXES,
  APPLICATIONS_QK,
  APPLICATIONS_QK_PREFIXES,
} from "./applications-keys";
import { ApplicationStatusBlock } from "../../applications/lifecycle/components/ApplicationStatusBlock";
import { societyLifecycleStatus } from "../../applications/lifecycle/lifecycle-presentation";
import {
  APPLICATIONS_COPY,
  identityLine,
  positionLine,
  profileTypeLabel,
  receivedLine,
} from "./applications-presentation";
import { APPLICATIONS_HREFS, CANDIDATE_HREFS } from "./applications-routes";
import {
  ApplicationsAccessError,
  addApplicationToShortlist,
  fetchApplicationDetail,
  markApplicationRead,
} from "./applications-service";
import { buildCandidateInsight } from "./candidate-insight";
import { ApplicationActionBar } from "./components/ApplicationActionBar";
import {
  CandidateBlockError,
  CandidateExperienceRow,
  CandidateFactLines,
  CandidateLink,
  CandidateSection,
  CandidateStats,
} from "./components/CandidateBlocks";

export function ApplicationDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();

  const params = useLocalSearchParams<{
    adId?: string;
    applicationId?: string;
    from?: string;
  }>();
  const applicationId =
    typeof params.applicationId === "string" ? params.applicationId : "";

  const detailQuery = useQuery({
    enabled: !!applicationId && !!actorId,
    queryFn: () => fetchApplicationDetail(applicationId),
    queryKey: APPLICATIONS_QK.detail(actorId, applicationId),
    retry: (failureCount, error) =>
      !(error instanceof ApplicationsAccessError) && failureCount < 1,
    staleTime: STALE_MS.operational,
  });

  const loaded = detailQuery.data ?? null;

  const accessWindow = useAccessWindow({
    accessVerifiedAt: loaded?.accessVerifiedAt ?? null,
    isOrganizational: true,
  });

  const detail = accessWindow.isValid ? loaded : null;

  useEffect(() => {
    if (!accessWindow.isValid && loaded && !detailQuery.isFetching) {
      void detailQuery.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessWindow.isValid]);

  // ── Profilo canonico del candidato ────────────────────────────────────────

  const personId = detail?.personId ?? null;

  const profileQuery = useQuery({
    enabled: !!personId && !!actorId,
    queryFn: () => getCompleteProfessionalProfile(personId as string),
    queryKey: APPLICATIONS_QK.candidateProfile(actorId, personId ?? ""),
    retry: 1,
    staleTime: STALE_MS.operational,
  });

  const insight = useMemo(
    () =>
      profileQuery.data
        ? buildCandidateInsight({
            profile: profileQuery.data,
            role: detail?.personRole ?? null,
          })
        : null,
    [detail?.personRole, profileQuery.data],
  );

  // ── Lettura della submission (§8) ─────────────────────────────────────────

  /**
   * §8: «Marca la submission consultata solo quando il dettaglio autorizzato
   * è stato effettivamente aperto e il suo contenuto principale è
   * disponibile. Un errore che mostra esclusivamente skeleton/indisponibilità
   * non è una lettura riuscita.»
   *
   * Il contenuto principale è il **dettaglio della candidatura**, non il
   * profilo: la candidatura è leggibile e comprensibile anche se il blocco
   * carriera fallisce, e §27 lo prevede esplicitamente.
   *
   * Il ref evita la seconda chiamata quando il componente ri-renderizza per
   * altri motivi; l'idempotenza vera resta sul server (§8 — «Più aperture
   * della stessa submission non generano contatori negativi o eventi
   * duplicati»).
   *
   * La chiave comprende la **revisione**, non solo la candidatura: §24 —
   * «Una ricandidatura valida … torna non letta». Con il dettaglio aperto e
   * una ricandidatura in arrivo, una chiave sulla sola candidatura
   * cortocircuiterebbe la seconda lettura e la nuova revisione resterebbe
   * non letta fino allo smontaggio della schermata.
   */
  const markedRef = useRef<string | null>(null);

  const markRead = useMutation({
    mutationFn: markApplicationRead,
    onSuccess: (result) => {
      trackApplicationsEvent("application_read_result", {
        outcome: result.marked ? "marked" : "stale_revision",
      });

      /* §28: «Dopo una lettura aggiorna coerentemente Nuove e Tutte …
         widget/count Dashboard, count/lista/dettaglio Position, lista
         contestuale, read state del dettaglio.» */
      for (const prefix of [
        ...APPLICATIONS_QK_PREFIXES,
        ...APPLICATIONS_CROSS_PREFIXES,
      ]) {
        void queryClient.invalidateQueries({ queryKey: [prefix] });
      }

      queryClient.setQueryData(
        APPLICATIONS_QK.detail(actorId, applicationId),
        (previous: typeof loaded) =>
          previous ? { ...previous, isNew: result.isNew } : previous,
      );
    },
  });

  useEffect(() => {
    if (!detail) {
      return;
    }

    const marker = `${applicationId}:${detail.submissionRevision}`;

    if (markedRef.current === marker) {
      return;
    }

    markedRef.current = marker;
    markRead.mutate({
      applicationId,
      /* §8: «Invia al comando di lettura la revisione della submission
         realmente visualizzata.» Quella del payload appena reso, non una
         riletta al momento dell'invio. */
      submissionRevision: detail.submissionRevision,
    });
    // `markRead` cambia identità a ogni render della mutation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId, detail]);

  // ── Azioni ────────────────────────────────────────────────────────────────

  const shortlist = useMutation({
    mutationFn: () => addApplicationToShortlist(applicationId),
    onError: () => {
      trackApplicationsEvent("application_shortlist_result", { outcome: "error" });
      /* §20: «Nessun falso stato In shortlist.» Il pulsante resta
         riutilizzabile e lo stato non cambia. */
      showToast({
        icon: "alert-circle-outline",
        id: "application-shortlist-error",
        message: APPLICATIONS_COPY.shortlistError,
      });
    },
    onSuccess: (result) => {
      trackApplicationsEvent("application_shortlist_result", {
        outcome: result.already ? "already" : "added",
      });

      queryClient.setQueryData(
        APPLICATIONS_QK.detail(actorId, applicationId),
        (previous: typeof loaded) =>
          previous ? { ...previous, inShortlist: true } : previous,
      );

      /* §28: «Dopo shortlist aggiorna dettaglio, dominio Shortlist e
         relativi aggregati reali. Non modificare il count candidature.» */
      void queryClient.invalidateQueries({ queryKey: ["shortlists"] });
      void queryClient.invalidateQueries({ queryKey: ["shortlist-memberships"] });
    },
  });

  const message = useMutation({
    mutationFn: () => openDirectConversation(detail?.personId ?? "", applicationId),
    onError: () => {
      trackApplicationsEvent("application_message_failed");
      /* §22: «Errori di apertura/get-or-create non modificano Application o
         Shortlist.» */
      showToast({
        icon: "alert-circle-outline",
        id: "application-message-error",
        message: APPLICATIONS_COPY.messageError,
      });
    },
    onSuccess: (conversationId) => {
      trackApplicationsEvent("application_message_opened");
      /* §22: «Il tap apre la chat; non equivale a messaggio inviato.» */
      router.push(`/messages/${conversationId}` as never);
    },
  });

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();

      return;
    }

    /* §29: «Per deep link senza stack ricostruisci un fallback autorizzato:
       dettaglio → lista appropriata → Dashboard.» */
    const adId = typeof params.adId === "string" ? params.adId : null;

    router.replace(
      (adId
        ? APPLICATIONS_HREFS.position(adId)
        : APPLICATIONS_HREFS.center()) as never,
    );
  }, [params.adId, router]);

  /**
   * §18: «Le righe con chevron possono aprire la carriera canonica con
   * l'esperienza evidenziata, se il routing supporta l'anchor; altrimenti
   * aprono direttamente la tab Carriera.» Qui vale il secondo caso, quindi
   * la riga dell'esperienza e il link in fondo hanno la stessa
   * destinazione — ed entrambe restano distinte dal profilo completo (§21).
   */
  const openCareer = useCallback(
    (source: "experience" | "link") => {
      if (!detail) {
        return;
      }

      trackApplicationsEvent("application_career_opened", { source });
      router.push(CANDIDATE_HREFS.career(detail.personId) as never);
    },
    [detail, router],
  );

  const openProfile = useCallback(() => {
    if (!detail) {
      return;
    }

    trackApplicationsEvent("application_profile_opened");
    router.push(CANDIDATE_HREFS.profile(detail.personId) as never);
  }, [detail, router]);

  // ── Render ────────────────────────────────────────────────────────────────

  const clubName =
    detail?.clubName ?? (current?.kind === "society" ? current.name : "");

  const shell = (body: React.ReactNode, title?: string | null) => (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <SocietyContextHeader
        isVerified={detail?.clubIsVerified ?? false}
        logoUrl={detail?.clubLogoUrl ?? null}
        name={clubName}
        onBack={goBack}
        title={title ?? null}
      />
      {body}
    </View>
  );

  /**
   * §25, screen 16. Lo stesso stato per «non autorizzato» e «non più
   * disponibile»: «Non rivelare se l'ID appartenga a un'altra Society o
   * quale permesso manchi.» E niente candidato, avatar, Team, Position,
   * date, insight o count sotto di esso.
   */
  if (
    detailQuery.error instanceof ApplicationsAccessError &&
    (detailQuery.error.code === "APPLICATION_NOT_AVAILABLE" ||
      detailQuery.error.code === "APPLICATIONS_NOT_AUTHORIZED")
  ) {
    trackApplicationsEvent("applications_access_unavailable");

    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <SocietyContextHeader
          isVerified={false}
          logoUrl={null}
          name="Dashboard"
          onBack={() => router.replace("/(tabs)/dashboard" as never)}
          title={null}
        />
        <DashboardGlobalEmpty
          copy={{
            actionLabel: APPLICATIONS_COPY.backToDashboard,
            body: APPLICATIONS_COPY.unavailableBody,
            icon: "lock-closed-outline",
            title: APPLICATIONS_COPY.unavailableTitle,
          }}
          onAction={() => router.replace("/(tabs)/dashboard" as never)}
        />
      </View>
    );
  }

  if (detailQuery.isLoading && !detail) {
    return shell(
      <View style={styles.content}>
        <DashboardSkeleton />
      </View>,
      APPLICATIONS_COPY.detailTitle,
    );
  }

  if (!detail) {
    return shell(
      <DashboardGlobalError
        body={APPLICATIONS_COPY.listErrorBody}
        onRetry={() => {
          trackApplicationsEvent("application_detail_retry");
          void detailQuery.refetch();
        }}
        title={APPLICATIONS_COPY.detailErrorTitle}
      />,
      APPLICATIONS_COPY.detailTitle,
    );
  }

  const received = receivedLine(detail.latestSubmittedAt);

  const lifecycleStatus = societyLifecycleStatus({
    adStatus: detail.adStatus,
    receivingClosed: detail.receivingClosed,
    state: detail.state,
    withdrawnAt: detail.withdrawnAt,
  });

  return shell(
    <>
      <ScrollView
        contentContainerStyle={styles.scroll}
        testID="application-detail-scroll"
      >
        {/* §15: «titolo Candidatura e identità del candidato», con il
            contesto dell'invio **vicino all'identità**, «così è comprensibile
            anche entrando da un deep link». */}
        <AppText accessibilityRole="header" color="neutral" variant="screenTitle">
          {APPLICATIONS_COPY.detailTitle}
        </AppText>

        <View style={styles.identity}>
          <Avatar
            name={detail.personName}
            size="lg"
            uri={detail.personAvatarUrl ?? undefined}
          />

          <View style={styles.identityBody}>
            <AppText color="neutral" variant="heroName">
              {detail.personName}
            </AppText>

            <AppText color="neutralMuted" variant="bodySm">
              {identityLine(
                profileTypeLabel(detail.personRole),
                insight?.professionalLines[0] ?? null,
              )}
            </AppText>

            {detail.personSituation ? (
              <AppText color="neutralMuted" variant="bodySm">
                {detail.personSituation}
              </AppText>
            ) : null}
          </View>
        </View>

        {/* §19: il contesto storico della ricerca. Position, ruolo e ambito
            originari, data della submission pertinente, e il ritiro come
            fatto separato quando c'è. */}
        <CandidateSection title={APPLICATIONS_COPY.appliedFor}>
          <AppText color="neutral" variant="bodyLg">
            {positionLine(detail)}
          </AppText>

          {received ? (
            <AppText color="neutralMuted" variant="bodySm">
              {received}
            </AppText>
          ) : null}

          {detail.seasonLabel ? (
            <AppText color="neutralMuted" variant="bodySm">
              {detail.seasonLabel}
            </AppText>
          ) : null}
        </CandidateSection>

        {/*
          DAS-REV-23 §17, §14, §15 — screen 06-09.

          Ritiro, termine scaduto e chiusura erano tre righe grigie sciolte
          sotto il contesto. Il PNG 23 le mostra come un **riquadro di stato**
          con la propria spiegazione: «Candidatura ritirata / Ritirata il …»,
          «Termine candidature scaduto / Le candidature ricevute restano
          valutabili.», «Posizione chiusa / Le candidature ricevute restano
          valutabili.»

          È lo stesso componente della pagina personale: §29 dà ai tre stati
          lo stesso trattamento neutro, e due copie divergerebbero proprio sul
          colore. §17: «Se ritiro e Position CLOSED coesistono, conserva
          entrambi i fatti» — e infatti il riquadro le porta entrambe.
        */}
        {lifecycleStatus ? (
          <View style={styles.statusBlock}>
            <ApplicationStatusBlock
              status={lifecycleStatus}
              testID="application-lifecycle-status"
            />
          </View>
        ) : null}

        {/* §16, §27: i blocchi professionali hanno la loro disponibilità. Un
            loro errore non toglie la candidatura, e non diventa «nessuna
            esperienza». */}
        {profileQuery.isError ? (
          <CandidateSection title={APPLICATIONS_COPY.professionalProfile}>
            <CandidateBlockError onRetry={() => void profileQuery.refetch()} />
          </CandidateSection>
        ) : !insight ? (
          <View style={styles.blockSkeleton}>
            <DashboardSkeleton />
          </View>
        ) : (
          <>
            {insight.professionalLines.length > 0 ? (
              <CandidateSection title={insight.professionalEyebrow}>
                <CandidateFactLines lines={insight.professionalLines} />
              </CandidateSection>
            ) : null}

            {insight.careerSummary || insight.stats ? (
              <CandidateSection title={APPLICATIONS_COPY.careerSummary}>
                {insight.careerSummary ? (
                  <AppText color="neutral" variant="bodyLg">
                    {insight.careerSummary}
                  </AppText>
                ) : null}

                {insight.stats ? <CandidateStats stats={insight.stats} /> : null}
              </CandidateSection>
            ) : null}

            {insight.experiences.length > 0 ? (
              <CandidateSection title={APPLICATIONS_COPY.recentExperiences}>
                {insight.experiences.map((experience, index) => (
                  <CandidateExperienceRow
                    experience={experience}
                    key={experience.id}
                    onPress={() => openCareer("experience")}
                    showDivider={index > 0}
                  />
                ))}
              </CandidateSection>
            ) : null}

            <View style={styles.links}>
              <CandidateLink
                label={APPLICATIONS_COPY.openCareer}
                onPress={() => openCareer("link")}
                testID="application-open-career"
              />
              <CandidateLink
                label={APPLICATIONS_COPY.openProfile}
                onPress={openProfile}
                testID="application-open-profile"
              />
            </View>
          </>
        )}
      </ScrollView>

      <ApplicationActionBar
        bottomInset={insets.bottom}
        canAddShortlist={detail.canAddShortlist}
        canMessage={detail.canMessage}
        inShortlist={detail.inShortlist}
        messageBusy={message.isPending}
        onAddShortlist={() => {
          trackApplicationsEvent("application_shortlist_attempt");
          shortlist.mutate();
        }}
        onMessage={() => message.mutate()}
        shortlistBusy={shortlist.isPending}
      />
    </>,
    null,
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[20],
  },
  scroll: {
    paddingBottom: spacing[24],
    paddingHorizontal: spacing[20],
  },
  identity: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    paddingBottom: spacing[16],
    paddingTop: spacing[12],
  },
  identityBody: {
    flex: 1,
    gap: spacing[4],
  },
  blockSkeleton: {
    paddingTop: spacing[16],
  },
  statusBlock: {
    paddingTop: spacing[12],
  },
  links: {
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing[8],
  },
});
