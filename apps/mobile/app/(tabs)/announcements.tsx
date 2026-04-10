import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { KeyboardAwareForm } from "../../src/components/ui/keyboard-aware-form";
import { Screen } from "../../src/components/ui/screen";
import { useSession } from "../../src/features/auth/use-session";
import {
  applyToRecruitingAd,
  createRecruitingAd,
  getClubApplications,
  getClubAds,
  getPublishedAds,
  toggleSavedAd,
  type ClubApplicationSummary,
  type DiscoverableRecruitingAd,
  type RecruitingAdForm,
  type RecruitingAdSummary,
} from "../../src/features/recruiting/recruiting-service";
import { JobCard } from "../../src/features/recruiting/components/JobCard";
import { sizes, spacing } from "../../src/theme/tokens";
import {
  AppText,
  Badge,
  Button,
  Card,
  ChipGroup,
  EmptyState,
  Input,
  ScreenHeader,
} from "../../src/ui";

const positions: readonly {
  label: string;
  value: RecruitingAdForm["roleRequired"];
}[] = [
  { label: "Portiere", value: "goalkeeper" },
  { label: "Difensore", value: "defender" },
  { label: "Centrocampista", value: "midfielder" },
  { label: "Attaccante", value: "forward" },
];

const roleLabels: Record<string, string> = {
  defender: "Difensore",
  forward: "Attaccante",
  goalkeeper: "Portiere",
  midfielder: "Centrocampista",
};

const applicationStatusLabels: Record<string, string> = {
  rejected: "Rifiutata",
  reviewing: "In revisione",
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
  const { profile, session } = useSession();
  const userId = session?.user?.id;
  const [ads, setAds] = useState<RecruitingAdSummary[]>([]);
  const [publicAds, setPublicAds] = useState<DiscoverableRecruitingAd[]>([]);
  const [applications, setApplications] = useState<ClubApplicationSummary[]>(
    [],
  );
  const [clubName, setClubName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
  const [selectedAdId, setSelectedAdId] = useState<string | null>(null);
  const [coverMessage, setCoverMessage] = useState("");
  const [form, setForm] = useState<RecruitingAdForm>({
    ageMax: "",
    ageMin: "",
    category: "",
    compensationSummary: "",
    description: "",
    region: "",
    roleRequired: "forward",
    title: "",
  });

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

  function patchForm<Key extends keyof RecruitingAdForm>(
    key: Key,
    value: RecruitingAdForm[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleCreateAd() {
    if (!session?.user) {
      return;
    }

    if (!form.title.trim() || !form.description.trim()) {
      Alert.alert("Campi mancanti", "Titolo e descrizione sono obbligatori.");
      return;
    }

    try {
      setIsSubmitting(true);
      const club = await createRecruitingAd(session.user.id, form);
      setClubName(club.name);
      setForm({
        ageMax: "",
        ageMin: "",
        category: "",
        compensationSummary: "",
        description: "",
        region: "",
        roleRequired: "forward",
        title: "",
      });
      await loadClubDashboard();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore durante la creazione dell'annuncio.";
      Alert.alert("Creazione annuncio non riuscita", message);
    } finally {
      setIsSubmitting(false);
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

  return (
    <Screen>
      <KeyboardAwareForm contentContainerStyle={styles.scrollContent}>
        <ScreenHeader
          title="Annunci societa'"
          subtitle={
            clubName
              ? `Stai pubblicando per ${clubName}.`
              : "Completa l'onboarding societa' per pubblicare annunci."
          }
        />

        <Card>
          <AppText variant="headingSm">Nuovo annuncio</AppText>
          <Input
            onChangeText={(value) => patchForm("title", value)}
            placeholder="Titolo annuncio"
            value={form.title}
          />
          <ChipGroup
            onChange={(value) => { if (value !== null) patchForm("roleRequired", value); }}
            options={positions}
            value={form.roleRequired}
          />
          <View style={styles.ageRow}>
            <Input
              keyboardType="number-pad"
              onChangeText={(value) => patchForm("ageMin", value)}
              placeholder="Eta' min"
              style={styles.flex1}
              value={form.ageMin}
            />
            <Input
              keyboardType="number-pad"
              onChangeText={(value) => patchForm("ageMax", value)}
              placeholder="Eta' max"
              style={styles.flex1}
              value={form.ageMax}
            />
          </View>
          <Input
            onChangeText={(value) => patchForm("category", value)}
            placeholder="Categoria"
            value={form.category}
          />
          <Input
            onChangeText={(value) => patchForm("region", value)}
            placeholder="Regione"
            value={form.region}
          />
          <Input
            onChangeText={(value) => patchForm("compensationSummary", value)}
            placeholder="Rimborso o benefit"
            value={form.compensationSummary}
          />
          <Input
            multiline
            onChangeText={(value) => patchForm("description", value)}
            placeholder="Descrizione annuncio"
            style={{ minHeight: sizes.recruitingDescriptionMinHeight }}
            value={form.description}
          />
          <Button
            disabled={isSubmitting || isLoading}
            label={isSubmitting ? "Pubblicazione..." : "Pubblica annuncio"}
            onPress={handleCreateAd}
          />
        </Card>

        <View style={styles.sectionGap}>
          <AppText variant="headingSm">Annunci pubblicati</AppText>
          {ads.length === 0 && !isLoading ? (
            <EmptyState
              icon="megaphone-outline"
              title="Nessun annuncio"
              description="Nessun annuncio pubblicato finora."
            />
          ) : null}
          {ads.map((ad) => (
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

        <View style={styles.sectionGap}>
          <AppText variant="headingSm">Candidature ricevute</AppText>
          {applications.length === 0 && !isLoading ? (
            <EmptyState
              icon="people-outline"
              title="Nessuna candidatura"
              description="Nessuna candidatura ricevuta finora."
            />
          ) : null}
          {applications.map((application) => (
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
});
