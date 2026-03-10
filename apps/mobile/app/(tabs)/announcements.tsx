import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

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
import { colors } from "../../src/theme/tokens";

const positions: Array<{
  label: string;
  value: RecruitingAdForm["roleRequired"];
}> = [
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

  useEffect(() => {
    if (!session?.user) {
      setIsLoading(false);
      return;
    }

    if (profile?.role === "club_admin") {
      loadClubDashboard();
      return;
    }

    loadPublicAnnouncements();
  }, [profile?.role, session?.user?.id]);

  async function loadClubDashboard() {
    if (!session?.user) {
      return;
    }

    try {
      setIsLoading(true);
      const [result, nextApplications] = await Promise.all([
        getClubAds(session.user.id),
        getClubApplications(session.user.id),
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
  }

  async function loadPublicAnnouncements() {
    if (!session?.user) {
      return;
    }

    try {
      setIsLoading(true);
      const result = await getPublishedAds(session.user.id);
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
  }

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
        <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
          <View
            style={{
              gap: 10,
              padding: 22,
              borderRadius: 26,
              backgroundColor: colors.textPrimary,
            }}
          >
            <Text
              style={{
                color: colors.heroSoft,
                fontSize: 12,
                fontWeight: "800",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Recruiting Market
            </Text>
            <Text
              style={{
                fontSize: 30,
                lineHeight: 34,
                fontWeight: "800",
                color: colors.inkInvert,
              }}
            >
              Annunci aperti delle societa'
            </Text>
            <Text
              style={{
                fontSize: 16,
                lineHeight: 24,
                color: "rgba(255,253,252,0.78)",
              }}
            >
              Da qui un giocatore puo' consultare le opportunita' attive,
              salvare quelle rilevanti e candidarsi con un messaggio mirato.
            </Text>
          </View>

          {profile?.role !== "player" ? (
            <View
              style={{
                padding: 16,
                borderRadius: 18,
                backgroundColor: colors.surfaceMuted,
              }}
            >
              <Text style={{ color: colors.textPrimary, lineHeight: 22 }}>
                In questa fase la candidatura e' disponibile per i profili
                giocatore. Gli altri ruoli possono comunque esplorare il
                mercato.
              </Text>
            </View>
          ) : null}

          {publicAds.length === 0 && !isLoading ? (
            <View
              style={{
                padding: 18,
                borderRadius: 20,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.textSecondary }}>
                Nessun annuncio pubblicato al momento.
              </Text>
            </View>
          ) : null}

          {publicAds.map((ad) => {
            const isSelected = selectedAdId === ad.id;
            const isSubmittingAd = isActionLoading === ad.id;

            return (
              <View
                key={ad.id}
                style={{
                  gap: 12,
                  padding: 18,
                  borderRadius: 22,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View style={{ gap: 6 }}>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "800",
                      color: colors.textPrimary,
                    }}
                  >
                    {ad.title}
                  </Text>
                  <Text style={{ color: colors.textSecondary, lineHeight: 22 }}>
                    {ad.club?.name ?? "Societa' non disponibile"} ·{" "}
                    {formatRoleLabel(ad.role_required)}
                  </Text>
                  <Text style={{ color: colors.textSecondary, lineHeight: 22 }}>
                    {ad.region ?? ad.club?.region ?? "Regione da definire"}
                    {ad.age_min || ad.age_max
                      ? ` · Eta' ${ad.age_min ?? "?"}-${ad.age_max ?? "?"}`
                      : ""}
                  </Text>
                </View>

                <Text style={{ color: colors.textPrimary, lineHeight: 22 }}>
                  {ad.description}
                </Text>

                {ad.compensation_summary ? (
                  <View
                    style={{
                      alignSelf: "flex-start",
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: colors.accentSoft,
                    }}
                  >
                    <Text
                      style={{ color: colors.accentStrong, fontWeight: "700" }}
                    >
                      {ad.compensation_summary}
                    </Text>
                  </View>
                ) : null}

                {ad.application_status ? (
                  <View
                    style={{
                      alignSelf: "flex-start",
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: colors.surfaceMuted,
                    }}
                  >
                    <Text
                      style={{ color: colors.textPrimary, fontWeight: "700" }}
                    >
                      Candidatura:{" "}
                      {formatApplicationStatus(ad.application_status)}
                    </Text>
                  </View>
                ) : null}

                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable
                    disabled={isSubmittingAd}
                    onPress={() => handleToggleSavedAd(ad.id, !ad.is_saved)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderRadius: 14,
                      backgroundColor: ad.is_saved
                        ? colors.surfaceMuted
                        : colors.background,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text
                      style={{ color: colors.textPrimary, fontWeight: "700" }}
                    >
                      {ad.is_saved ? "Salvato" : "Salva"}
                    </Text>
                  </Pressable>

                  {profile?.role === "player" ? (
                    <Pressable
                      disabled={isSubmittingAd || !!ad.application_status}
                      onPress={() =>
                        setSelectedAdId((current) =>
                          current === ad.id ? null : ad.id,
                        )
                      }
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderRadius: 14,
                        backgroundColor: ad.application_status
                          ? colors.borderStrong
                          : colors.hero,
                      }}
                    >
                      <Text
                        style={{ color: colors.inkInvert, fontWeight: "700" }}
                      >
                        {ad.application_status ? "Gia' candidato" : "Candidati"}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>

                {isSelected ? (
                  <View
                    style={{
                      gap: 10,
                      paddingTop: 6,
                    }}
                  >
                    <Text
                      style={{ color: colors.textPrimary, fontWeight: "700" }}
                    >
                      Messaggio di presentazione
                    </Text>
                    <TextInput
                      multiline
                      onChangeText={setCoverMessage}
                      placeholder="Scrivi in poche righe il tuo profilo e perche' sei adatto all'annuncio"
                      placeholderTextColor={colors.textMuted}
                      style={{
                        minHeight: 110,
                        textAlignVertical: "top",
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 16,
                        backgroundColor: colors.background,
                      }}
                      value={coverMessage}
                    />
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <Pressable
                        disabled={isSubmittingAd}
                        onPress={() => {
                          setSelectedAdId(null);
                          setCoverMessage("");
                        }}
                        style={{
                          paddingHorizontal: 16,
                          paddingVertical: 12,
                          borderRadius: 14,
                          backgroundColor: colors.background,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.textPrimary,
                            fontWeight: "700",
                          }}
                        >
                          Annulla
                        </Text>
                      </Pressable>
                      <Pressable
                        disabled={isSubmittingAd}
                        onPress={() => handleApplyToAd(ad.id)}
                        style={{
                          paddingHorizontal: 16,
                          paddingVertical: 12,
                          borderRadius: 14,
                          backgroundColor: colors.accent,
                        }}
                      >
                        <Text
                          style={{ color: colors.inkInvert, fontWeight: "700" }}
                        >
                          {isSubmittingAd ? "Invio..." : "Invia candidatura"}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
        <View style={{ gap: 8 }}>
          <Text
            style={{
              fontSize: 28,
              fontWeight: "700",
              color: colors.textPrimary,
            }}
          >
            Annunci societa'
          </Text>
          <Text
            style={{
              fontSize: 16,
              lineHeight: 24,
              color: colors.textSecondary,
            }}
          >
            {clubName
              ? `Stai pubblicando per ${clubName}.`
              : "Completa l'onboarding societa' per pubblicare annunci."}
          </Text>
        </View>

        <View
          style={{
            gap: 12,
            padding: 16,
            borderRadius: 16,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: colors.textPrimary,
            }}
          >
            Nuovo annuncio
          </Text>
          <TextInput
            onChangeText={(value) => patchForm("title", value)}
            placeholder="Titolo annuncio"
            placeholderTextColor={colors.textSecondary}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              backgroundColor: colors.background,
            }}
            value={form.title}
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {positions.map((entry) => {
              const isActive = form.roleRequired === entry.value;

              return (
                <Pressable
                  key={entry.value}
                  onPress={() => patchForm("roleRequired", entry.value)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 999,
                    backgroundColor: isActive
                      ? colors.accent
                      : colors.background,
                    borderWidth: 1,
                    borderColor: isActive ? colors.accent : colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: isActive ? "#FFFFFF" : colors.textPrimary,
                      fontWeight: "600",
                    }}
                  >
                    {entry.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <TextInput
              keyboardType="number-pad"
              onChangeText={(value) => patchForm("ageMin", value)}
              placeholder="Eta' min"
              placeholderTextColor={colors.textSecondary}
              style={{
                flex: 1,
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                backgroundColor: colors.background,
              }}
              value={form.ageMin}
            />
            <TextInput
              keyboardType="number-pad"
              onChangeText={(value) => patchForm("ageMax", value)}
              placeholder="Eta' max"
              placeholderTextColor={colors.textSecondary}
              style={{
                flex: 1,
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                backgroundColor: colors.background,
              }}
              value={form.ageMax}
            />
          </View>
          <TextInput
            onChangeText={(value) => patchForm("category", value)}
            placeholder="Categoria"
            placeholderTextColor={colors.textSecondary}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              backgroundColor: colors.background,
            }}
            value={form.category}
          />
          <TextInput
            onChangeText={(value) => patchForm("region", value)}
            placeholder="Regione"
            placeholderTextColor={colors.textSecondary}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              backgroundColor: colors.background,
            }}
            value={form.region}
          />
          <TextInput
            onChangeText={(value) => patchForm("compensationSummary", value)}
            placeholder="Rimborso o benefit"
            placeholderTextColor={colors.textSecondary}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              backgroundColor: colors.background,
            }}
            value={form.compensationSummary}
          />
          <TextInput
            multiline
            onChangeText={(value) => patchForm("description", value)}
            placeholder="Descrizione annuncio"
            placeholderTextColor={colors.textSecondary}
            style={{
              minHeight: 120,
              textAlignVertical: "top",
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              backgroundColor: colors.background,
            }}
            value={form.description}
          />
          <Pressable
            disabled={isSubmitting || isLoading}
            onPress={handleCreateAd}
            style={{
              paddingVertical: 14,
              borderRadius: 14,
              alignItems: "center",
              backgroundColor: isSubmitting ? "#73B48E" : colors.accent,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>
              {isSubmitting ? "Pubblicazione..." : "Pubblica annuncio"}
            </Text>
          </Pressable>
        </View>

        <View style={{ gap: 12 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: colors.textPrimary,
            }}
          >
            Annunci pubblicati
          </Text>
          {ads.length === 0 && !isLoading ? (
            <View
              style={{
                padding: 16,
                borderRadius: 16,
                backgroundColor: colors.surface,
              }}
            >
              <Text style={{ color: colors.textSecondary }}>
                Nessun annuncio pubblicato finora.
              </Text>
            </View>
          ) : null}
          {ads.map((ad) => (
            <View
              key={ad.id}
              style={{
                gap: 6,
                padding: 16,
                borderRadius: 16,
                backgroundColor: colors.surface,
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: colors.textPrimary,
                }}
              >
                {ad.title}
              </Text>
              <Text style={{ color: colors.textSecondary }}>
                {formatRoleLabel(ad.role_required)} ·{" "}
                {ad.region ?? "Regione non definita"}
              </Text>
              <Text style={{ color: colors.textSecondary }}>
                Stato: {ad.status}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ gap: 12 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: colors.textPrimary,
            }}
          >
            Candidature ricevute
          </Text>
          {applications.length === 0 && !isLoading ? (
            <View
              style={{
                padding: 16,
                borderRadius: 16,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.textSecondary }}>
                Nessuna candidatura ricevuta finora.
              </Text>
            </View>
          ) : null}
          {applications.map((application) => (
            <View
              key={application.id}
              style={{
                gap: 8,
                padding: 16,
                borderRadius: 16,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: colors.textPrimary,
                }}
              >
                {application.applicant?.full_name ?? "Profilo candidato"}
              </Text>
              <Text style={{ color: colors.textSecondary }}>
                Annuncio: {application.ad.title}
              </Text>
              <Text style={{ color: colors.textSecondary }}>
                Ricerca: {formatRoleLabel(application.ad.role_required)} · Stato{" "}
                {formatApplicationStatus(application.status)}
              </Text>
              {application.cover_message ? (
                <Text style={{ color: colors.textPrimary, lineHeight: 22 }}>
                  {application.cover_message}
                </Text>
              ) : (
                <Text style={{ color: colors.textMuted }}>
                  Nessun messaggio allegato.
                </Text>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
