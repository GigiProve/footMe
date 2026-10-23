import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { KeyboardAwareForm } from "../../src/components/ui/keyboard-aware-form";
import { Screen } from "../../src/components/ui/screen";
import { useSession } from "../../src/features/auth/use-session";
import { openDirectConversation } from "../../src/features/messaging/messaging-service";
import {
  applyToRecruitingAd,
  getClubApplications,
  getClubAds,
  getPublishedAds,
  toggleSavedAd,
  updateApplicationStatus,
  type ApplicationStatus,
  type ClubApplicationSummary,
  type DiscoverableRecruitingAd,
  type RecruitingAdSummary,
} from "../../src/features/recruiting/recruiting-service";
import { JobCard } from "../../src/features/recruiting/components/JobCard";
import {
  fetchClubTeams,
  type ClubTeam,
} from "../../src/features/clubs/team-service";
import { spacing } from "../../src/theme/tokens";
import {
  AppText,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  ScreenHeader,
} from "../../src/ui";

const roleLabels: Record<string, string> = {
  defender: "Difensore",
  forward: "Attaccante",
  goalkeeper: "Portiere",
  midfielder: "Centrocampista",
};

const applicationStatusLabels: Record<string, string> = {
  accepted: "Accettata",
  rejected: "Rifiutata",
  reviewing: "In lettura",
  shortlisted: "Shortlist",
  submitted: "Inviata",
  withdrawn: "Ritirata",
};

function formatRoleLabel(role: string) {
  return roleLabels[role] ?? role;
}

function formatApplicationStatus(status: string) {
  return applicationStatusLabels[status] ?? status;
}

export default function AnnouncementsScreen() {
  const router = useRouter();
  const { profile, session } = useSession();
  const userId = session?.user?.id;
  /**
   * Contesto di apertura dalla Dashboard Società (DAS-REV-07 §20).
   *
   * Questo schermo è il centro Posizioni **e** il centro Candidature: senza
   * un riferimento, "Valuta candidature" e "Vedi tutte" aprirebbero la stessa
   * pagina indistinta, e §13 vieta di «aprire una lista vuota o estranea al
   * gruppo mostrato».
   *
   * `adId` è un riferimento strutturato, mai un titolo o un indice di riga.
   * Quando è assente o non corrisponde a nulla, la pagina resta quella di
   * sempre: il filtro non può far sparire il contenuto che l'actor ha già.
   */
  const { adId, focus, teamId: teamIdParam } = useLocalSearchParams<{
    adId?: string;
    focus?: string;
    teamId?: string;
  }>();
  /**
   * Filtro squadra proveniente dal dettaglio operativo (DAS-REV-09 §18).
   *
   * «Gli accessi a Posizioni e Candidature mantengono il filtro Team.» È un
   * riferimento canonico: il centro rilegge posizioni e candidature dal
   * proprio dominio e vi applica il perimetro, non riceve copie dei
   * conteggi già mostrati altrove.
   *
   * Restringe, non amplia: un actor con scope limitato non guadagna nulla
   * passando o togliendo il parametro, perché i dati sono già quelli che il
   * suo club gli espone.
   */
  const scopedTeamId =
    typeof teamIdParam === "string" && teamIdParam.length > 0
      ? teamIdParam
      : null;
  const focusedAdId = typeof adId === "string" && adId.length > 0 ? adId : null;
  const isApplicationsFocus = focus === "applications";
  const [ads, setAds] = useState<RecruitingAdSummary[]>([]);
  const [publicAds, setPublicAds] = useState<DiscoverableRecruitingAd[]>([]);
  const [applications, setApplications] = useState<ClubApplicationSummary[]>(
    [],
  );
  const [clubName, setClubName] = useState<string | null>(null);
  const [clubTeams, setClubTeams] = useState<ClubTeam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
  const [contactingApplicationId, setContactingApplicationId] = useState<
    string | null
  >(null);
  const [selectedAdId, setSelectedAdId] = useState<string | null>(null);
  const [coverMessage, setCoverMessage] = useState("");

  const loadClubDashboard = useCallback(async () => {
    if (!userId) {
      return;
    }

    try {
      setIsLoading(true);
      const [result, nextApplications] = await Promise.all([
        getClubAds(userId),
        getClubApplications(userId),
      ]);
      setAds(result.ads);
      setClubName(result.club?.name ?? null);
      setApplications(nextApplications);
      if (result.club?.id) {
        setClubTeams(await fetchClubTeams(result.club.id));
      } else {
        setClubTeams([]);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore nel caricamento annunci.";
      Alert.alert("Caricamento non riuscito", message);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const loadPublicAnnouncements = useCallback(async () => {
    if (!userId) {
      return;
    }

    try {
      setIsLoading(true);
      const result = await getPublishedAds(userId);
      setPublicAds(result);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore nel caricamento del marketplace recruiting.";
      Alert.alert("Caricamento non riuscito", message);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    if (profile?.role === "club_admin") {
      loadClubDashboard();
      return;
    }

    loadPublicAnnouncements();
  }, [loadClubDashboard, loadPublicAnnouncements, profile?.role, userId]);

  async function handleUpdateApplicationStatus(
    application: ClubApplicationSummary,
    status: ApplicationStatus,
  ) {
    if (!application.applicant?.id) {
      return;
    }
    try {
      setIsActionLoading(application.id);
      await updateApplicationStatus({
        adTitle: application.ad.title,
        applicantProfileId: application.applicant.id,
        applicationId: application.id,
        status,
      });
      await loadClubDashboard();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore durante l'aggiornamento della candidatura.";
      Alert.alert("Aggiornamento non riuscito", message);
    } finally {
      setIsActionLoading(null);
    }
  }

  async function handleContactApplicant(application: ClubApplicationSummary) {
    if (!application.applicant?.id) {
      return;
    }

    try {
      setContactingApplicationId(application.id);
      const conversationId = await openDirectConversation(
        application.applicant.id,
        application.id,
      );
      router.push({
        pathname: "/messages/[conversationId]",
        params: {
          conversationId,
          otherName: application.applicant.full_name,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore durante l'apertura della conversazione.";
      Alert.alert("Chat non disponibile", message);
    } finally {
      setContactingApplicationId(null);
    }
  }


  async function handleToggleSavedAd(adId: string, shouldSave: boolean) {
    if (!session?.user) {
      return;
    }

    try {
      setIsActionLoading(adId);
      await toggleSavedAd(session.user.id, adId, shouldSave);
      setPublicAds((current) =>
        current.map((ad) =>
          ad.id === adId ? { ...ad, is_saved: shouldSave } : ad,
        ),
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore nel salvataggio dell'annuncio.";
      Alert.alert("Operazione non riuscita", message);
    } finally {
      setIsActionLoading(null);
    }
  }

  async function handleApplyToAd(adId: string) {
    if (!session?.user) {
      return;
    }

    try {
      setIsActionLoading(adId);
      await applyToRecruitingAd(session.user.id, adId, coverMessage);
      setCoverMessage("");
      setSelectedAdId(null);
      await loadPublicAnnouncements();
      Alert.alert(
        "Candidatura inviata",
        "Il tuo profilo e' stato inviato alla societa' insieme al messaggio di presentazione.",
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore durante l'invio della candidatura.";
      const duplicateMessage =
        message.includes("duplicate") || message.includes("unique");

      Alert.alert(
        "Candidatura non inviata",
        duplicateMessage
          ? "Hai gia' inviato una candidatura per questo annuncio."
          : message,
      );
    } finally {
      setIsActionLoading(null);
    }
  }

  if (profile?.role !== "club_admin") {
    return (
      <Screen>
        <KeyboardAwareForm contentContainerStyle={styles.scrollContent}>
          <ScreenHeader
            title="Opportunita'"
            subtitle="Consulta le opportunita' attive, salva e candidati"
          />

          {profile?.role !== "player" ? (
            <Card variant="muted">
              <AppText variant="bodyLg">
                In questa fase la candidatura e' disponibile per i profili
                giocatore. Gli altri ruoli possono comunque esplorare il
                mercato.
              </AppText>
            </Card>
          ) : null}

          {publicAds.length === 0 && !isLoading ? (
            <EmptyState
              icon="megaphone-outline"
              title="Nessun annuncio"
              description="Nessun annuncio pubblicato al momento."
            />
          ) : null}

          {publicAds.map((ad) => {
            const isSelected = selectedAdId === ad.id;
            const isSubmittingAd = isActionLoading === ad.id;
            const regionLabel =
              ad.region ?? ad.club?.region ?? "Regione da definire";
            const categoryLabel =
              ad.age_min || ad.age_max
                ? `Eta' ${ad.age_min ?? "?"}-${ad.age_max ?? "?"}`
                : formatRoleLabel(ad.role_required);

            return (
              <View key={ad.id} style={styles.adItem}>
                <JobCard
                  category={categoryLabel}
                  club={ad.club?.name ?? "Societa' non disponibile"}
                  description={ad.description}
                  onApply={() =>
                    setSelectedAdId((current) =>
                      current === ad.id ? null : ad.id,
                    )
                  }
                  onDetails={() => {}}
                  onToggleSave={() => handleToggleSavedAd(ad.id, !ad.is_saved)}
                  postedAt=""
                  region={regionLabel}
                  saved={ad.is_saved}
                  title={ad.title}
                />

                {ad.application_status ? (
                  <Badge
                    label={`Candidatura: ${formatApplicationStatus(ad.application_status)}`}
                  />
                ) : null}

                {isSelected ? (
                  <Card>
                    <AppText variant="titleSm">
                      Messaggio di presentazione
                    </AppText>
                    <Input
                      multiline
                      onChangeText={setCoverMessage}
                      placeholder="Scrivi in poche righe il tuo profilo e perche' sei adatto all'annuncio"
                      value={coverMessage}
                    />
                    <View style={styles.actionRow}>
                      <Button
                        disabled={isSubmittingAd}
                        label="Annulla"
                        onPress={() => {
                          setSelectedAdId(null);
                          setCoverMessage("");
                        }}
                        size="sm"
                        variant="secondary"
                      />
                      <Button
                        disabled={isSubmittingAd}
                        label={
                          isSubmittingAd ? "Invio..." : "Invia candidatura"
                        }
                        onPress={() => handleApplyToAd(ad.id)}
                        size="sm"
                      />
                    </View>
                  </Card>
                ) : null}
              </View>
            );
          })}
        </KeyboardAwareForm>
      </Screen>
    );
  }

  // Il riferimento arriva per id, mai per titolo o indice (§20). Un `adId`
  // che non corrisponde a nessun annuncio di questa Società non filtra nulla:
  // il centro resta quello completo invece di mostrarsi vuoto.
  const scopedAds = scopedTeamId
    ? ads.filter((ad) => ad.team_id === scopedTeamId)
    : ads;
  const scopedApplications = scopedTeamId
    ? applications.filter(
        (application) => application.ad.team_id === scopedTeamId,
      )
    : applications;

  const focusedAd = focusedAdId
    ? (scopedAds.find((ad) => ad.id === focusedAdId) ?? null)
    : null;
  const visibleApplications = focusedAd
    ? scopedApplications.filter(
        (application) => application.ad.id === focusedAd.id,
      )
    : scopedApplications;
  const scopedTeamName = scopedTeamId
    ? (clubTeams.find((team) => team.id === scopedTeamId)?.name ?? null)
    : null;

  return (
    <Screen>
      <KeyboardAwareForm contentContainerStyle={styles.scrollContent}>
        <ScreenHeader
          title={isApplicationsFocus ? "Candidature ricevute" : "Annunci societa'"}
          subtitle={
            clubName
              ? scopedTeamName
                ? isApplicationsFocus
                  ? `Candidature di ${scopedTeamName}.`
                  : `Posizioni di ${scopedTeamName}.`
                : isApplicationsFocus
                  ? `Candidature ricevute da ${clubName}.`
                  : `Stai pubblicando per ${clubName}.`
              : "Completa l'onboarding societa' per pubblicare annunci."
          }
        />

        {/*
          §20: aperto come **centro Candidature**, lo schermo mostra quel
          gruppo e non il composer di una nuova posizione. È lo stesso centro
          di sempre, non una seconda schermata: senza il parametro tutto resta
          dov'era, e "Mostra tutte le candidature" riporta alla vista piena.
        */}
        {!isApplicationsFocus ? (
          <>
        {/*
          DAS-REV-16 §3, §42.2: la creazione di una Position vive in **un**
          posto solo — il composer a tre fasi di `app/position-compose/`.
          Qui c'era un secondo form che pubblicava con un insert diretto,
          senza bozze, ambito, schema per profilo né capability di
          pubblicazione: due percorsi di creazione sono esattamente i «due
          ecosistemi paralleli» che §35 vieta. Resta l'ingresso, non il
          form.
        */}
        <Card>
          <AppText variant="headingSm">Nuova posizione</AppText>
          <AppText color="secondary" variant="bodySm">
            Scegli profilo, ruolo e squadra, prepara i dettagli e pubblica
            quando vuoi.
          </AppText>
          <Button
            disabled={isLoading}
            label="Crea una posizione"
            onPress={() => router.push("/position-compose" as never)}
          />
        </Card>

        <View style={styles.sectionGap}>
          <AppText variant="headingSm">Annunci pubblicati</AppText>
          {scopedAds.length === 0 && !isLoading ? (
            <EmptyState
              icon="megaphone-outline"
              title="Nessun annuncio"
              description="Nessun annuncio pubblicato finora."
            />
          ) : null}
          {scopedAds.map((ad) => (
            <Card key={ad.id} variant="muted">
              <AppText variant="titleSm">{ad.title}</AppText>
              <AppText variant="bodySm" color="secondary">
                {formatRoleLabel(ad.role_required)} ·{" "}
                {ad.region ?? "Regione non definita"}
              </AppText>
              <AppText variant="bodySm" color="secondary">
                Stato: {ad.status}
              </AppText>
            </Card>
          ))}
        </View>
          </>
        ) : null}

        <View style={styles.sectionGap}>
          <AppText variant="headingSm">
            {focusedAd
              ? `Candidature · ${focusedAd.title}`
              : "Candidature ricevute"}
          </AppText>

          {focusedAd ? (
            <Pressable
              accessibilityLabel="Mostra tutte le candidature ricevute"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.setParams({ adId: undefined })}
            >
              <AppText color="accent" variant="actionLabel">
                Mostra tutte le candidature
              </AppText>
            </Pressable>
          ) : null}

          {visibleApplications.length === 0 && !isLoading ? (
            <EmptyState
              icon="people-outline"
              title="Nessuna candidatura"
              description={
                focusedAd
                  ? "Nessuna candidatura per questa posizione."
                  : "Nessuna candidatura ricevuta finora."
              }
            />
          ) : null}
          {visibleApplications.map((application) => (
            <Card key={application.id}>
              <AppText variant="titleSm">
                {application.applicant?.full_name ?? "Profilo candidato"}
              </AppText>
              <AppText variant="bodySm" color="secondary">
                Annuncio: {application.ad.title}
              </AppText>
              <AppText variant="bodySm" color="secondary">
                Ricerca: {formatRoleLabel(application.ad.role_required)} · Stato{" "}
                {formatApplicationStatus(application.status)}
              </AppText>
              {application.cover_message ? (
                <AppText variant="bodyLg">{application.cover_message}</AppText>
              ) : (
                <AppText variant="bodySm" color="muted">
                  Nessun messaggio allegato.
                </AppText>
              )}
              <View style={styles.candidateActions}>
                {application.applicant ? (
                  <Button
                    disabled={contactingApplicationId === application.id}
                    label={
                      contactingApplicationId === application.id
                        ? "Apertura chat..."
                        : "Contatta"
                    }
                    onPress={() => handleContactApplicant(application)}
                    size="sm"
                    variant="secondary"
                  />
                ) : null}
                <Button
                  disabled={
                    isActionLoading === application.id ||
                    application.status === "reviewing"
                  }
                  label="Letta"
                  onPress={() =>
                    handleUpdateApplicationStatus(application, "reviewing")
                  }
                  size="sm"
                  variant="outline"
                />
                <Button
                  disabled={
                    isActionLoading === application.id ||
                    application.status === "shortlisted"
                  }
                  label="Shortlist"
                  onPress={() =>
                    handleUpdateApplicationStatus(application, "shortlisted")
                  }
                  size="sm"
                  variant="outline"
                />
                <Button
                  disabled={
                    isActionLoading === application.id ||
                    application.status === "accepted"
                  }
                  label="Accetta"
                  onPress={() =>
                    handleUpdateApplicationStatus(application, "accepted")
                  }
                  size="sm"
                />
                <Button
                  disabled={
                    isActionLoading === application.id ||
                    application.status === "rejected"
                  }
                  label="Rifiuta"
                  onPress={() =>
                    handleUpdateApplicationStatus(application, "rejected")
                  }
                  size="sm"
                  variant="danger"
                />
              </View>
            </Card>
          ))}
        </View>
      </KeyboardAwareForm>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    gap: spacing[16],
    paddingBottom: spacing[24],
  },
  adItem: {
    gap: spacing[8],
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing[10],
  },
  ageRow: {
    flexDirection: "row",
    gap: spacing[12],
  },
  flex1: {
    flex: 1,
  },
  sectionGap: {
    gap: spacing[12],
  },
  teamPicker: {
    gap: spacing[8],
  },
  candidateActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
});
