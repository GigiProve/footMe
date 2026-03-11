import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { Screen } from "../../src/components/ui/screen";
import { useSession } from "../../src/features/auth/use-session";
import {
  getCompleteProfessionalProfile,
  updateCompleteProfessionalProfile,
  type CompleteProfessionalProfile,
  type PlayerCareerEntryInput,
  type PreferredFoot,
} from "../../src/features/profiles/profile-service";
import {
  type AppRole,
  type PlayerPosition,
  type StaffSpecialization,
} from "../../src/features/onboarding/create-initial-profile";
import { colors, radius, typography } from "../../src/theme/tokens";
import { Card, Input } from "../../src/ui";

type CareerEntryForm = {
  appearances: string;
  assists: string;
  awards: string;
  clubName: string;
  competitionName: string;
  goals: string;
  id?: string;
  minutesPlayed: string;
  seasonLabel: string;
};

type ProfileFormState = {
  avatarUrl: string;
  bio: string;
  birthDate: string;
  careerEntries: CareerEntryForm[];
  certifications: string;
  clubCategory: string;
  clubCity: string;
  clubDescription: string;
  clubGalleryUrls: string;
  clubId: string | null;
  clubLeague: string;
  clubLogoUrl: string;
  clubName: string;
  clubRegion: string;
  coachedCategories: string;
  coachedClubs: string;
  fullName: string;
  gamePhilosophy: string;
  heightCm: string;
  highlightVideoUrl: string;
  isAvailable: boolean;
  isOpenToTransfer: boolean;
  licenses: string;
  nationality: string;
  openToNewRole: boolean;
  openToWork: boolean;
  preferredCategories: string;
  preferredFoot: PreferredFoot | "";
  preferredRegions: string;
  primaryPosition: PlayerPosition;
  region: string;
  secondaryPosition: PlayerPosition | "";
  specialization: StaffSpecialization;
  technicalVideoUrl: string;
  transferRegions: string;
  weightKg: string;
  willingToChangeClub: boolean;
  city: string;
  experienceSummary: string;
};

const roleLabels: Record<AppRole, string> = {
  club_admin: "Societa'",
  coach: "Allenatore",
  player: "Calciatore",
  staff: "Staff tecnico",
};

const positionOptions: { label: string; value: PlayerPosition }[] = [
  { label: "Portiere", value: "goalkeeper" },
  { label: "Difensore", value: "defender" },
  { label: "Centrocampista", value: "midfielder" },
  { label: "Attaccante", value: "forward" },
];

const preferredFootOptions: { label: string; value: PreferredFoot }[] = [
  { label: "Destro", value: "right" },
  { label: "Sinistro", value: "left" },
  { label: "Ambidestro", value: "both" },
];

const specializationOptions: { label: string; value: StaffSpecialization }[] = [
  { label: "Preparatore atletico", value: "fitness_coach" },
  { label: "Preparatore portieri", value: "goalkeeper_coach" },
  { label: "Fisioterapista", value: "physiotherapist" },
  { label: "Match analyst", value: "match_analyst" },
  { label: "Team manager", value: "team_manager" },
  { label: "Altro", value: "other" },
];

function createEmptyCareerEntry(): CareerEntryForm {
  return {
    appearances: "",
    assists: "",
    awards: "",
    clubName: "",
    competitionName: "",
    goals: "",
    minutesPlayed: "",
    seasonLabel: "",
  };
}

function toDelimitedString(values: string[] | null | undefined) {
  return (values ?? []).join(", ");
}

function fromDelimitedString(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseOptionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);

  if (Number.isNaN(parsed)) {
    throw new Error("Inserisci solo numeri validi nei campi statistici.");
  }

  return parsed;
}

function formatPosition(value: PlayerPosition | null) {
  if (!value) {
    return "Non definita";
  }

  return positionOptions.find((option) => option.value === value)?.label ?? value;
}

function formatPreferredFoot(value: PreferredFoot | null) {
  if (!value) {
    return "Da completare";
  }

  return (
    preferredFootOptions.find((option) => option.value === value)?.label ?? value
  );
}

function formatSpecialization(value: StaffSpecialization | null) {
  if (!value) {
    return "Da definire";
  }

  return (
    specializationOptions.find((option) => option.value === value)?.label ?? value
  );
}

function buildInitialState(data: CompleteProfessionalProfile): ProfileFormState {
  const playerProfile = data.playerProfile;
  const coachProfile = data.coachProfile;
  const staffProfile = data.staffProfile;
  const club = data.club;

  return {
    avatarUrl: data.profile.avatar_url ?? "",
    bio: data.profile.bio ?? "",
    birthDate: data.profile.birth_date ?? "",
    careerEntries:
      data.playerCareerEntries.length > 0
        ? data.playerCareerEntries.map((entry) => ({
            appearances: String(entry.appearances),
            assists: String(entry.assists),
            awards: entry.awards ?? "",
            clubName: entry.club_name,
            competitionName: entry.competition_name ?? "",
            goals: String(entry.goals),
            id: entry.id,
            minutesPlayed: String(entry.minutes_played),
            seasonLabel: entry.season_label,
          }))
        : [createEmptyCareerEntry()],
    certifications: toDelimitedString(staffProfile?.certifications),
    city: data.profile.city ?? "",
    clubCategory: club?.category ?? "",
    clubCity: club?.city ?? "",
    clubDescription: club?.description ?? "",
    clubGalleryUrls: toDelimitedString(club?.gallery_urls),
    clubId: club?.id ?? null,
    clubLeague: club?.league ?? "",
    clubLogoUrl: club?.logo_url ?? "",
    clubName: club?.name ?? "",
    clubRegion: club?.region ?? "",
    coachedCategories: toDelimitedString(coachProfile?.coached_categories),
    coachedClubs: toDelimitedString(coachProfile?.coached_clubs),
    experienceSummary: staffProfile?.experience_summary ?? "",
    fullName: data.profile.full_name,
    gamePhilosophy: coachProfile?.game_philosophy ?? "",
    heightCm: playerProfile?.height_cm ? String(playerProfile.height_cm) : "",
    highlightVideoUrl: playerProfile?.highlight_video_url ?? "",
    isAvailable: data.profile.is_available,
    isOpenToTransfer: data.profile.is_open_to_transfer,
    licenses: toDelimitedString(coachProfile?.licenses),
    nationality: data.profile.nationality ?? "",
    openToNewRole: coachProfile?.open_to_new_role ?? false,
    openToWork: staffProfile?.open_to_work ?? false,
    preferredCategories: toDelimitedString(playerProfile?.preferred_categories),
    preferredFoot: playerProfile?.preferred_foot ?? "",
    preferredRegions: toDelimitedString(
      coachProfile?.preferred_regions ?? staffProfile?.preferred_regions,
    ),
    primaryPosition: playerProfile?.primary_position ?? "midfielder",
    region: data.profile.region ?? "",
    secondaryPosition: playerProfile?.secondary_position ?? "",
    specialization: staffProfile?.specialization ?? "fitness_coach",
    technicalVideoUrl: coachProfile?.technical_video_url ?? "",
    transferRegions: toDelimitedString(playerProfile?.transfer_regions),
    weightKg: playerProfile?.weight_kg ? String(playerProfile.weight_kg) : "",
    willingToChangeClub: playerProfile?.willing_to_change_club ?? false,
  };
}

function Section({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  subtitle?: string;
  title: string;
}) {
  return (
    <Card style={{ gap: 14 }}>
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "800" }}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: colors.textSecondary, lineHeight: 22 }}>{subtitle}</Text>
        ) : null}
      </View>
      {children}
    </Card>
  );
}

function Field({
  label,
  multiline,
  onChangeText,
  placeholder,
  value,
}: {
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{label}</Text>
      <Input
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        value={value}
      />
    </View>
  );
}

function BooleanField({
  falseLabel,
  label,
  onChange,
  trueLabel,
  value,
}: {
  falseLabel: string;
  label: string;
  onChange: (value: boolean) => void;
  trueLabel: string;
  value: boolean;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{label}</Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {[
          { active: true, label: trueLabel },
          { active: false, label: falseLabel },
        ].map((option) => {
          const isActive = value === option.active;

          return (
            <Pressable
              key={option.label}
              onPress={() => onChange(option.active)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: radius.full,
                backgroundColor: isActive ? colors.textPrimary : colors.background,
                borderWidth: 1,
                borderColor: isActive ? colors.textPrimary : colors.border,
              }}
            >
              <Text
                  style={{
                    color: isActive ? colors.inkInvert : colors.textPrimary,
                    fontWeight: typography.fontWeight.bold,
                  }}
                >
                  {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function PillSelector<T extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: T) => void;
  options: { label: string; value: T }[];
  value: T;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((option) => {
          const isActive = option.value === value;

          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: radius.full,
                backgroundColor: isActive ? colors.accentStrong : colors.background,
                borderWidth: 1,
                borderColor: isActive ? colors.accentStrong : colors.border,
              }}
            >
              <Text
                  style={{
                    color: isActive ? colors.inkInvert : colors.textPrimary,
                    fontWeight: typography.fontWeight.bold,
                  }}
                >
                  {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const { profile, refreshProfile, session } = useSession();
  const userId = session?.user.id ?? null;
  const [completeProfile, setCompleteProfile] =
    useState<CompleteProfessionalProfile | null>(null);
  const [formState, setFormState] = useState<ProfileFormState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setCompleteProfile(null);
      setFormState(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const data = await getCompleteProfessionalProfile(userId);
      setCompleteProfile(data);
      setFormState(buildInitialState(data));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore durante il caricamento del profilo.";
      Alert.alert("Profilo non disponibile", message);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const profileHighlights = useMemo(() => {
    if (!completeProfile) {
      return [];
    }

    if (completeProfile.profile.role === "player") {
      return [
        {
          label: "Ruolo",
          value: formatPosition(completeProfile.playerProfile?.primary_position ?? null),
        },
        {
          label: "Piede",
          value: formatPreferredFoot(completeProfile.playerProfile?.preferred_foot ?? null),
        },
        {
          label: "Stagioni",
          value: String(completeProfile.playerCareerEntries.length),
        },
      ];
    }

    if (completeProfile.profile.role === "coach") {
      return [
        {
          label: "Licenze",
          value: String(completeProfile.coachProfile?.licenses.length ?? 0),
        },
        {
          label: "Squadre",
          value: String(completeProfile.coachProfile?.coached_clubs.length ?? 0),
        },
        {
          label: "Nuove panchine",
          value: completeProfile.coachProfile?.open_to_new_role ? "Si" : "No",
        },
      ];
    }

    if (completeProfile.profile.role === "staff") {
      return [
        {
          label: "Specializzazione",
          value: formatSpecialization(completeProfile.staffProfile?.specialization ?? null),
        },
        {
          label: "Certificazioni",
          value: String(completeProfile.staffProfile?.certifications.length ?? 0),
        },
        {
          label: "Disponibile",
          value: completeProfile.staffProfile?.open_to_work ? "Si" : "No",
        },
      ];
    }

    return [
      {
        label: "Club",
        value: completeProfile.club?.name ?? "Da completare",
      },
      {
        label: "Categoria",
        value: completeProfile.club?.category ?? "Da definire",
      },
      {
        label: "Campionato",
        value: completeProfile.club?.league ?? "Da definire",
      },
    ];
  }, [completeProfile]);

  if (!userId || !profile) {
    return null;
  }

  async function handleSave() {
    if (!userId || !completeProfile || !formState) {
      return;
    }

    try {
      setIsSaving(true);

      const trimmedFullName = formState.fullName.trim();

      if (!trimmedFullName) {
        throw new Error("Nome e cognome sono obbligatori.");
      }

      const parsedCareerEntries = formState.careerEntries
        .map<PlayerCareerEntryInput | null>((entry, index) => {
          const seasonLabel = entry.seasonLabel.trim();
          const clubName = entry.clubName.trim();

          if (!seasonLabel && !clubName) {
            return null;
          }

          if (!seasonLabel || !clubName) {
            throw new Error(
              "Ogni riga carriera deve includere almeno stagione e club.",
            );
          }

          return {
            appearances: parseOptionalNumber(entry.appearances) ?? 0,
            assists: parseOptionalNumber(entry.assists) ?? 0,
            awards: parseOptionalText(entry.awards),
            club_name: clubName,
            competition_name: parseOptionalText(entry.competitionName),
            goals: parseOptionalNumber(entry.goals) ?? 0,
            id: entry.id,
            minutes_played: parseOptionalNumber(entry.minutesPlayed) ?? 0,
            season_label: seasonLabel,
            sort_order: index,
          };
        })
        .filter((entry): entry is PlayerCareerEntryInput => entry !== null);

      if (completeProfile.profile.role === "club_admin") {
        const clubName = formState.clubName.trim();
        const clubCity = formState.clubCity.trim();
        const clubRegion = formState.clubRegion.trim();

        if (!clubName || !clubCity || !clubRegion) {
          throw new Error(
            "Per la pagina societa' servono nome club, citta' e regione.",
          );
        }
      }

      await updateCompleteProfessionalProfile({
        club:
          completeProfile.profile.role === "club_admin"
            ? {
                category: parseOptionalText(formState.clubCategory),
                city: formState.clubCity.trim(),
                description: parseOptionalText(formState.clubDescription),
                gallery_urls: fromDelimitedString(formState.clubGalleryUrls),
                id: formState.clubId ?? undefined,
                league: parseOptionalText(formState.clubLeague),
                logo_url: parseOptionalText(formState.clubLogoUrl),
                name: formState.clubName.trim(),
                region: formState.clubRegion.trim(),
              }
            : null,
        coachProfile:
          completeProfile.profile.role === "coach"
            ? {
                coached_categories: fromDelimitedString(formState.coachedCategories),
                coached_clubs: fromDelimitedString(formState.coachedClubs),
                game_philosophy: parseOptionalText(formState.gamePhilosophy),
                licenses: fromDelimitedString(formState.licenses),
                open_to_new_role: formState.openToNewRole,
                preferred_regions: fromDelimitedString(formState.preferredRegions),
                technical_video_url: parseOptionalText(formState.technicalVideoUrl),
              }
            : null,
        playerCareerEntries:
          completeProfile.profile.role === "player" ? parsedCareerEntries : [],
        playerProfile:
          completeProfile.profile.role === "player"
            ? {
                height_cm: parseOptionalNumber(formState.heightCm),
                highlight_video_url: parseOptionalText(formState.highlightVideoUrl),
                preferred_categories: fromDelimitedString(formState.preferredCategories),
                preferred_foot: formState.preferredFoot || null,
                primary_position: formState.primaryPosition,
                secondary_position: formState.secondaryPosition || null,
                transfer_regions: fromDelimitedString(formState.transferRegions),
                weight_kg: parseOptionalNumber(formState.weightKg),
                willing_to_change_club: formState.willingToChangeClub,
              }
            : null,
        profile: {
          avatar_url: parseOptionalText(formState.avatarUrl),
          bio: parseOptionalText(formState.bio),
          birth_date: parseOptionalText(formState.birthDate),
          city: parseOptionalText(formState.city),
          full_name: trimmedFullName,
          is_available: formState.isAvailable,
          is_open_to_transfer: formState.isOpenToTransfer,
          nationality: parseOptionalText(formState.nationality),
          region: parseOptionalText(formState.region),
        },
        profileId: userId,
        role: completeProfile.profile.role,
        staffProfile:
          completeProfile.profile.role === "staff"
            ? {
                certifications: fromDelimitedString(formState.certifications),
                experience_summary: parseOptionalText(formState.experienceSummary),
                open_to_work: formState.openToWork,
                preferred_regions: fromDelimitedString(formState.preferredRegions),
                specialization: formState.specialization,
              }
            : null,
      });

      await Promise.all([loadProfile(), refreshProfile()]);
      Alert.alert("Profilo aggiornato", "Le informazioni professionali sono state salvate.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Errore durante il salvataggio.";
      Alert.alert("Salvataggio non completato", message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 18, paddingBottom: 28 }}>
        <View
          style={{
            gap: 12,
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
              letterSpacing: 1.2,
            }}
          >
            Fase 2 · Identita' professionale
          </Text>
          <Text
            style={{
              fontSize: 30,
              lineHeight: 34,
              fontWeight: "800",
              color: colors.inkInvert,
            }}
          >
            Profilo professionale completo
          </Text>
          <Text
            style={{
              fontSize: 16,
              lineHeight: 24,
              color: colors.textInverseMuted,
            }}
          >
            Completa e aggiorna il tuo profilo pubblico con i dati richiesti dalla
            roadmap MVP: identita', disponibilita', carriera e dettagli di ruolo.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: colors.surfaceOverlay,
              }}
            >
              <Text style={{ color: colors.inkInvert, fontWeight: "700" }}>
                {profile.full_name ?? "Profilo"}
              </Text>
            </View>
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: colors.surfaceOverlay,
              }}
            >
              <Text style={{ color: colors.inkInvert, fontWeight: "700" }}>
                {roleLabels[profile.role as AppRole] ?? "Ruolo"}
              </Text>
            </View>
          </View>
        </View>

        {completeProfile ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {profileHighlights.map((item) => (
              <View
                key={item.label}
                style={{
                  minWidth: "30%",
                  flexGrow: 1,
                  gap: 6,
                  padding: 16,
                  borderRadius: 20,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: 12,
                    fontWeight: "700",
                    textTransform: "uppercase",
                  }}
                >
                  {item.label}
                </Text>
                <Text style={{ color: colors.textPrimary, fontWeight: "800" }}>
                  {item.value}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {isLoading || !formState ? (
          <Section title="Caricamento profilo">
            <Text style={{ color: colors.textSecondary }}>
              Sto recuperando i dati professionali del tuo account...
            </Text>
          </Section>
        ) : (
          <>
            <Section
              subtitle="Dati anagrafici, localita', disponibilita' e presentazione pubblica."
              title="Identita' di base"
            >
              <Field
                label="Nome e cognome"
                onChangeText={(value) =>
                  setFormState((current) => (current ? { ...current, fullName: value } : current))
                }
                value={formState.fullName}
              />
              <Field
                label="Data di nascita"
                onChangeText={(value) =>
                  setFormState((current) => (current ? { ...current, birthDate: value } : current))
                }
                placeholder="YYYY-MM-DD"
                value={formState.birthDate}
              />
              <Field
                label="Nazionalita'"
                onChangeText={(value) =>
                  setFormState((current) =>
                    current ? { ...current, nationality: value } : current,
                  )
                }
                value={formState.nationality}
              />
              <Field
                label="Citta'"
                onChangeText={(value) =>
                  setFormState((current) => (current ? { ...current, city: value } : current))
                }
                value={formState.city}
              />
              <Field
                label="Regione"
                onChangeText={(value) =>
                  setFormState((current) => (current ? { ...current, region: value } : current))
                }
                value={formState.region}
              />
              <Field
                label="Bio"
                multiline
                onChangeText={(value) =>
                  setFormState((current) => (current ? { ...current, bio: value } : current))
                }
                placeholder="Racconta identita', obiettivi e punti di forza."
                value={formState.bio}
              />
              <Field
                label="URL foto profilo"
                onChangeText={(value) =>
                  setFormState((current) =>
                    current ? { ...current, avatarUrl: value } : current,
                  )
                }
                value={formState.avatarUrl}
              />
              <BooleanField
                falseLabel="Non disponibile"
                label="Disponibile a nuove opportunita'"
                onChange={(value) =>
                  setFormState((current) =>
                    current ? { ...current, isAvailable: value } : current,
                  )
                }
                trueLabel="Disponibile"
                value={formState.isAvailable}
              />
              {(profile.role as AppRole) === "player" ? (
                <BooleanField
                  falseLabel="No"
                  label="Aperto al trasferimento"
                  onChange={(value) =>
                    setFormState((current) =>
                      current ? { ...current, isOpenToTransfer: value } : current,
                    )
                  }
                  trueLabel="Si"
                  value={formState.isOpenToTransfer}
                />
              ) : null}
            </Section>

            {(profile.role as AppRole) === "player" ? (
              <>
                <Section
                  subtitle="Dati sportivi e disponibilita' del calciatore."
                  title="Profilo giocatore"
                >
                  <PillSelector
                    label="Posizione principale"
                    onChange={(value) =>
                      setFormState((current) =>
                        current ? { ...current, primaryPosition: value } : current,
                      )
                    }
                    options={positionOptions}
                    value={formState.primaryPosition}
                  />
                  <View style={{ gap: 8 }}>
                    <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>
                      Posizione secondaria
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      <Pressable
                        onPress={() =>
                          setFormState((current) =>
                            current ? { ...current, secondaryPosition: "" } : current,
                          )
                        }
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          borderRadius: 999,
                          backgroundColor:
                            formState.secondaryPosition === ""
                              ? colors.accentStrong
                              : colors.background,
                          borderWidth: 1,
                          borderColor:
                            formState.secondaryPosition === ""
                              ? colors.accentStrong
                              : colors.border,
                        }}
                      >
                        <Text
                          style={{
                            color:
                              formState.secondaryPosition === ""
                                ? colors.inkInvert
                                : colors.textPrimary,
                            fontWeight: "700",
                          }}
                        >
                          Nessuna
                        </Text>
                      </Pressable>
                      {positionOptions.map((option) => {
                        const isActive = option.value === formState.secondaryPosition;

                        return (
                          <Pressable
                            key={option.value}
                            onPress={() =>
                              setFormState((current) =>
                                current
                                  ? { ...current, secondaryPosition: option.value }
                                  : current,
                              )
                            }
                            style={{
                              paddingHorizontal: 14,
                              paddingVertical: 10,
                              borderRadius: 999,
                              backgroundColor: isActive
                                ? colors.accentStrong
                                : colors.background,
                              borderWidth: 1,
                              borderColor: isActive
                                ? colors.accentStrong
                                : colors.border,
                            }}
                          >
                            <Text
                              style={{
                                color: isActive
                                  ? colors.inkInvert
                                  : colors.textPrimary,
                                fontWeight: "700",
                              }}
                            >
                              {option.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                  <PillSelector
                    label="Piede preferito"
                    onChange={(value) =>
                      setFormState((current) =>
                        current ? { ...current, preferredFoot: value } : current,
                      )
                    }
                    options={preferredFootOptions}
                    value={formState.preferredFoot || "right"}
                  />
                  <Field
                    label="Altezza (cm)"
                    onChangeText={(value) =>
                      setFormState((current) =>
                        current ? { ...current, heightCm: value } : current,
                      )
                    }
                    value={formState.heightCm}
                  />
                  <Field
                    label="Peso (kg)"
                    onChangeText={(value) =>
                      setFormState((current) =>
                        current ? { ...current, weightKg: value } : current,
                      )
                    }
                    value={formState.weightKg}
                  />
                  <Field
                    label="Categorie preferite"
                    onChangeText={(value) =>
                      setFormState((current) =>
                        current ? { ...current, preferredCategories: value } : current,
                      )
                    }
                    placeholder="Eccellenza, Promozione, Serie D"
                    value={formState.preferredCategories}
                  />
                  <Field
                    label="Regioni di interesse"
                    onChangeText={(value) =>
                      setFormState((current) =>
                        current ? { ...current, transferRegions: value } : current,
                      )
                    }
                    placeholder="Lombardia, Veneto"
                    value={formState.transferRegions}
                  />
                  <Field
                    label="URL highlights video"
                    onChangeText={(value) =>
                      setFormState((current) =>
                        current ? { ...current, highlightVideoUrl: value } : current,
                      )
                    }
                    value={formState.highlightVideoUrl}
                  />
                  <BooleanField
                    falseLabel="No"
                    label="Disponibile a cambiare squadra"
                    onChange={(value) =>
                      setFormState((current) =>
                        current
                          ? { ...current, willingToChangeClub: value }
                          : current,
                      )
                    }
                    trueLabel="Si"
                    value={formState.willingToChangeClub}
                  />
                </Section>

                <Section
                  subtitle="Cronologia multistagione con club, campionato e numeri chiave."
                  title="Carriera e statistiche"
                >
                  {formState.careerEntries.map((entry, index) => (
                    <View
                      key={entry.id ?? `career-${index}`}
                      style={{
                        gap: 12,
                        padding: 16,
                        borderRadius: 18,
                        backgroundColor: colors.background,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Text style={{ color: colors.textPrimary, fontWeight: "800" }}>
                          Stagione {index + 1}
                        </Text>
                        <Pressable
                          onPress={() =>
                            setFormState((current) =>
                              current
                                ? {
                                    ...current,
                                    careerEntries:
                                      current.careerEntries.length > 1
                                        ? current.careerEntries.filter(
                                            (_, entryIndex) => entryIndex !== index,
                                          )
                                        : [createEmptyCareerEntry()],
                                  }
                                : current,
                            )
                          }
                        >
                          <Text style={{ color: colors.hero, fontWeight: "700" }}>
                            Rimuovi
                          </Text>
                        </Pressable>
                      </View>
                      <Field
                        label="Stagione"
                        onChangeText={(value) =>
                          setFormState((current) =>
                            current
                              ? {
                                  ...current,
                                  careerEntries: current.careerEntries.map(
                                    (currentEntry, entryIndex) =>
                                      entryIndex === index
                                        ? { ...currentEntry, seasonLabel: value }
                                        : currentEntry,
                                  ),
                                }
                              : current,
                          )
                        }
                        placeholder="2024/25"
                        value={entry.seasonLabel}
                      />
                      <Field
                        label="Club"
                        onChangeText={(value) =>
                          setFormState((current) =>
                            current
                              ? {
                                  ...current,
                                  careerEntries: current.careerEntries.map(
                                    (currentEntry, entryIndex) =>
                                      entryIndex === index
                                        ? { ...currentEntry, clubName: value }
                                        : currentEntry,
                                  ),
                                }
                              : current,
                          )
                        }
                        value={entry.clubName}
                      />
                      <Field
                        label="Campionato o categoria"
                        onChangeText={(value) =>
                          setFormState((current) =>
                            current
                              ? {
                                  ...current,
                                  careerEntries: current.careerEntries.map(
                                    (currentEntry, entryIndex) =>
                                      entryIndex === index
                                        ? { ...currentEntry, competitionName: value }
                                        : currentEntry,
                                  ),
                                }
                              : current,
                          )
                        }
                        value={entry.competitionName}
                      />
                      <Field
                        label="Presenze"
                        onChangeText={(value) =>
                          setFormState((current) =>
                            current
                              ? {
                                  ...current,
                                  careerEntries: current.careerEntries.map(
                                    (currentEntry, entryIndex) =>
                                      entryIndex === index
                                        ? { ...currentEntry, appearances: value }
                                        : currentEntry,
                                  ),
                                }
                              : current,
                          )
                        }
                        value={entry.appearances}
                      />
                      <Field
                        label="Gol"
                        onChangeText={(value) =>
                          setFormState((current) =>
                            current
                              ? {
                                  ...current,
                                  careerEntries: current.careerEntries.map(
                                    (currentEntry, entryIndex) =>
                                      entryIndex === index
                                        ? { ...currentEntry, goals: value }
                                        : currentEntry,
                                  ),
                                }
                              : current,
                          )
                        }
                        value={entry.goals}
                      />
                      <Field
                        label="Assist"
                        onChangeText={(value) =>
                          setFormState((current) =>
                            current
                              ? {
                                  ...current,
                                  careerEntries: current.careerEntries.map(
                                    (currentEntry, entryIndex) =>
                                      entryIndex === index
                                        ? { ...currentEntry, assists: value }
                                        : currentEntry,
                                  ),
                                }
                              : current,
                          )
                        }
                        value={entry.assists}
                      />
                      <Field
                        label="Minuti giocati"
                        onChangeText={(value) =>
                          setFormState((current) =>
                            current
                              ? {
                                  ...current,
                                  careerEntries: current.careerEntries.map(
                                    (currentEntry, entryIndex) =>
                                      entryIndex === index
                                        ? { ...currentEntry, minutesPlayed: value }
                                        : currentEntry,
                                  ),
                                }
                              : current,
                          )
                        }
                        value={entry.minutesPlayed}
                      />
                      <Field
                        label="Premi o riconoscimenti"
                        multiline
                        onChangeText={(value) =>
                          setFormState((current) =>
                            current
                              ? {
                                  ...current,
                                  careerEntries: current.careerEntries.map(
                                    (currentEntry, entryIndex) =>
                                      entryIndex === index
                                        ? { ...currentEntry, awards: value }
                                        : currentEntry,
                                  ),
                                }
                              : current,
                          )
                        }
                        value={entry.awards}
                      />
                    </View>
                  ))}
                  <Pressable
                    onPress={() =>
                      setFormState((current) =>
                        current
                          ? {
                              ...current,
                              careerEntries: [
                                ...current.careerEntries,
                                createEmptyCareerEntry(),
                              ],
                            }
                          : current,
                      )
                    }
                    style={{
                      paddingVertical: 13,
                      borderRadius: 16,
                      alignItems: "center",
                      backgroundColor: colors.surfaceMuted,
                    }}
                  >
                    <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>
                      Aggiungi stagione
                    </Text>
                  </Pressable>
                </Section>
              </>
            ) : null}

            {(profile.role as AppRole) === "coach" ? (
              <Section
                subtitle="Licenze, storico squadre e filosofia di gioco per il profilo allenatore."
                title="Profilo allenatore"
              >
                <Field
                  label="Licenze"
                  onChangeText={(value) =>
                    setFormState((current) => (current ? { ...current, licenses: value } : current))
                  }
                  placeholder="UEFA B, UEFA A"
                  value={formState.licenses}
                />
                <Field
                  label="Squadre allenate"
                  onChangeText={(value) =>
                    setFormState((current) =>
                      current ? { ...current, coachedClubs: value } : current,
                    )
                  }
                  value={formState.coachedClubs}
                />
                <Field
                  label="Categorie allenate"
                  onChangeText={(value) =>
                    setFormState((current) =>
                      current ? { ...current, coachedCategories: value } : current,
                    )
                  }
                  value={formState.coachedCategories}
                />
                <Field
                  label="Filosofia di gioco"
                  multiline
                  onChangeText={(value) =>
                    setFormState((current) =>
                      current ? { ...current, gamePhilosophy: value } : current,
                    )
                  }
                  value={formState.gamePhilosophy}
                />
                <Field
                  label="URL video tecnico"
                  onChangeText={(value) =>
                    setFormState((current) =>
                      current ? { ...current, technicalVideoUrl: value } : current,
                    )
                  }
                  value={formState.technicalVideoUrl}
                />
                <Field
                  label="Aree geografiche di interesse"
                  onChangeText={(value) =>
                    setFormState((current) =>
                      current ? { ...current, preferredRegions: value } : current,
                    )
                  }
                  value={formState.preferredRegions}
                />
                <BooleanField
                  falseLabel="No"
                  label="Disponibile per nuove panchine"
                  onChange={(value) =>
                    setFormState((current) =>
                      current ? { ...current, openToNewRole: value } : current,
                    )
                  }
                  trueLabel="Si"
                  value={formState.openToNewRole}
                />
              </Section>
            ) : null}

            {(profile.role as AppRole) === "staff" ? (
              <Section
                subtitle="Specializzazione, certificazioni e disponibilita' lavorativa."
                title="Profilo staff tecnico"
              >
                <PillSelector
                  label="Specializzazione"
                  onChange={(value) =>
                    setFormState((current) =>
                      current ? { ...current, specialization: value } : current,
                    )
                  }
                  options={specializationOptions}
                  value={formState.specialization}
                />
                <Field
                  label="Esperienza"
                  multiline
                  onChangeText={(value) =>
                    setFormState((current) =>
                      current ? { ...current, experienceSummary: value } : current,
                    )
                  }
                  value={formState.experienceSummary}
                />
                <Field
                  label="Certificazioni"
                  onChangeText={(value) =>
                    setFormState((current) =>
                      current ? { ...current, certifications: value } : current,
                    )
                  }
                  value={formState.certifications}
                />
                <Field
                  label="Aree geografiche di interesse"
                  onChangeText={(value) =>
                    setFormState((current) =>
                      current ? { ...current, preferredRegions: value } : current,
                    )
                  }
                  value={formState.preferredRegions}
                />
                <BooleanField
                  falseLabel="No"
                  label="Disponibile a lavorare"
                  onChange={(value) =>
                    setFormState((current) =>
                      current ? { ...current, openToWork: value } : current,
                    )
                  }
                  trueLabel="Si"
                  value={formState.openToWork}
                />
              </Section>
            ) : null}

            {(profile.role as AppRole) === "club_admin" ? (
              <Section
                subtitle="Pagina ufficiale del club con informazioni pubbliche, gallery e contesto competitivo."
                title="Pagina societa'"
              >
                <Field
                  label="Nome club"
                  onChangeText={(value) =>
                    setFormState((current) => (current ? { ...current, clubName: value } : current))
                  }
                  value={formState.clubName}
                />
                <Field
                  label="Citta' club"
                  onChangeText={(value) =>
                    setFormState((current) => (current ? { ...current, clubCity: value } : current))
                  }
                  value={formState.clubCity}
                />
                <Field
                  label="Regione club"
                  onChangeText={(value) =>
                    setFormState((current) =>
                      current ? { ...current, clubRegion: value } : current,
                    )
                  }
                  value={formState.clubRegion}
                />
                <Field
                  label="Categoria"
                  onChangeText={(value) =>
                    setFormState((current) =>
                      current ? { ...current, clubCategory: value } : current,
                    )
                  }
                  value={formState.clubCategory}
                />
                <Field
                  label="Campionato"
                  onChangeText={(value) =>
                    setFormState((current) =>
                      current ? { ...current, clubLeague: value } : current,
                    )
                  }
                  value={formState.clubLeague}
                />
                <Field
                  label="Descrizione club"
                  multiline
                  onChangeText={(value) =>
                    setFormState((current) =>
                      current ? { ...current, clubDescription: value } : current,
                    )
                  }
                  value={formState.clubDescription}
                />
                <Field
                  label="URL logo"
                  onChangeText={(value) =>
                    setFormState((current) =>
                      current ? { ...current, clubLogoUrl: value } : current,
                    )
                  }
                  value={formState.clubLogoUrl}
                />
                <Field
                  label="Gallery media"
                  onChangeText={(value) =>
                    setFormState((current) =>
                      current ? { ...current, clubGalleryUrls: value } : current,
                    )
                  }
                  placeholder="https://..., https://..."
                  value={formState.clubGalleryUrls}
                />
              </Section>
            ) : null}

            <Pressable
              disabled={isSaving}
              onPress={() => void handleSave()}
              style={{
                paddingVertical: 16,
                borderRadius: 18,
                alignItems: "center",
                backgroundColor: isSaving ? colors.borderStrong : colors.hero,
              }}
            >
              <Text style={{ color: colors.inkInvert, fontSize: 16, fontWeight: "800" }}>
                {isSaving ? "Salvataggio in corso..." : "Salva profilo completo"}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
