import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  ScrollView,
  Text,
  View,
} from "react-native";

import { DatePickerField } from "../../src/components/ui/date-picker-field";
import { Screen } from "../../src/components/ui/screen";
import { SelectField } from "../../src/components/ui/select-field";
import { useSession } from "../../src/features/auth/use-session";
import {
  NATIONALITY_OPTIONS,
  REGION_OPTIONS,
  ensureOption,
  formatBirthDate,
  formatListSummary,
  formatOptionalSummary,
  getOptionLabel,
  isSeasonLabelValid,
  normalizeSeasonLabelInput,
} from "../../src/features/profiles/profile-form-utils";
import { withDefaultProfileAvatar } from "../../src/features/profiles/profile-avatar";
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
import { colors, radius, spacing, typography } from "../../src/theme/tokens";
import { Button, Card, Input } from "../../src/ui";

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
            seasonLabel: normalizeSeasonLabelInput(entry.season_label),
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
    <Card style={{ gap: spacing[14] }}>
      <View style={{ gap: spacing[6] }}>
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: typography.fontSize[20],
            fontWeight: typography.fontWeight.heavy,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: colors.textSecondary, lineHeight: typography.lineHeight[22] }}>{subtitle}</Text>
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
    <View style={{ gap: spacing[8] }}>
      <Text
        style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.bold }}
      >
        {label}
      </Text>
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
    <View style={{ gap: spacing[8] }}>
      <Text style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.bold }}>{label}</Text>
      <View style={{ flexDirection: "row", gap: spacing[10] }}>
        {[
          { active: true, label: trueLabel },
          { active: false, label: falseLabel },
        ].map((option) => {
          const isActive = value === option.active;

          return (
            <Button
              key={option.label}
              label={option.label}
              onPress={() => onChange(option.active)}
              selected={isActive}
              size="sm"
              variant="chipAction"
            />
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
    <View style={{ gap: spacing[8] }}>
      <Text style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.bold }}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[8] }}>
        {options.map((option) => {
          const isActive = option.value === value;

          return (
            <Button
              key={option.value}
              label={option.label}
              onPress={() => onChange(option.value)}
              selected={isActive}
              size="sm"
              variant="chipAction"
            />
          );
        })}
      </View>
    </View>
  );
}

function BirthDateField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <DatePickerField
      label={label}
      onChange={onChange}
      placeholder="Apri il calendario e scegli la data"
      value={value}
    />
  );
}

function SummaryCard({
  items,
  subtitle,
  title,
}: {
  items: { label: string; value: string }[];
  subtitle?: string;
  title: string;
}) {
  return (
    <Section subtitle={subtitle} title={title}>
      {items.map((item) => (
        <View
          key={`${title}-${item.label}`}
          style={{
            gap: spacing[4],
            paddingBottom: spacing[10],
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Text
            style={{
              color: colors.textMuted,
              fontSize: typography.fontSize[12],
              fontWeight: typography.fontWeight.bold,
              textTransform: "uppercase",
            }}
          >
            {item.label}
          </Text>
          <Text style={{ color: colors.textPrimary, lineHeight: typography.lineHeight[22] }}>
            {item.value}
          </Text>
        </View>
      ))}
    </Section>
  );
}

export default function ProfileScreen() {
  const { profile, refreshProfile, session } = useSession();
  const userId = session?.user.id ?? null;
  const [completeProfile, setCompleteProfile] =
    useState<CompleteProfessionalProfile | null>(null);
  const [formState, setFormState] = useState<ProfileFormState | null>(null);
  const [isEditing, setIsEditing] = useState(false);
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
          value: completeProfile.coachProfile?.open_to_new_role ? "Sì" : "No",
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
          value: completeProfile.staffProfile?.open_to_work ? "Sì" : "No",
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

  const nationalityOptions = useMemo(
    () => ensureOption(NATIONALITY_OPTIONS, formState?.nationality),
    [formState?.nationality],
  );
  const regionOptions = useMemo(
    () => ensureOption(REGION_OPTIONS, formState?.region),
    [formState?.region],
  );
  const clubRegionOptions = useMemo(
    () => ensureOption(REGION_OPTIONS, formState?.clubRegion),
    [formState?.clubRegion],
  );
  const playerCareerEntries = completeProfile?.playerCareerEntries ?? [];
  const playerCareerSummaryEntries = useMemo(
    () =>
      playerCareerEntries.map((entry) => ({
        entry,
        seasonTitle: normalizeSeasonLabelInput(entry.season_label),
      })),
    [playerCareerEntries],
  );

  const summarySections = useMemo(() => {
    if (!completeProfile) {
      return [];
    }

    const sections: {
      items: { label: string; value: string }[];
      subtitle?: string;
      title: string;
    }[] = [
      {
        title: "Identità di base",
        subtitle: "Riepilogo delle informazioni pubbliche configurate per il profilo.",
        items: [
          { label: "Nome e cognome", value: completeProfile.profile.full_name },
          {
            label: "Data di nascita",
            value: formatBirthDate(completeProfile.profile.birth_date),
          },
          {
            label: "Nazionalità",
            value: getOptionLabel(
              NATIONALITY_OPTIONS,
              completeProfile.profile.nationality,
            ),
          },
          {
            label: "Città",
            value: formatOptionalSummary(completeProfile.profile.city),
          },
          {
            label: "Regione",
            value: getOptionLabel(REGION_OPTIONS, completeProfile.profile.region),
          },
          { label: "Bio", value: formatOptionalSummary(completeProfile.profile.bio) },
          {
            label: "Disponibile a nuove opportunità",
            value: completeProfile.profile.is_available ? "Sì" : "No",
          },
          {
            label: "Aperto al trasferimento",
            value: completeProfile.profile.is_open_to_transfer ? "Sì" : "No",
          },
        ],
      },
    ];

    if (completeProfile.profile.role === "player") {
      sections.push({
        title: "Profilo giocatore",
        subtitle: "Ruolo, caratteristiche e preferenze del calciatore.",
        items: [
          {
            label: "Posizione principale",
            value: formatPosition(completeProfile.playerProfile?.primary_position ?? null),
          },
          {
            label: "Posizione secondaria",
            value: formatPosition(completeProfile.playerProfile?.secondary_position ?? null),
          },
          {
            label: "Piede preferito",
            value: formatPreferredFoot(completeProfile.playerProfile?.preferred_foot ?? null),
          },
          {
            label: "Altezza",
            value: completeProfile.playerProfile?.height_cm
              ? `${completeProfile.playerProfile.height_cm} cm`
              : "Da completare",
          },
          {
            label: "Peso",
            value: completeProfile.playerProfile?.weight_kg
              ? `${completeProfile.playerProfile.weight_kg} kg`
              : "Da completare",
          },
          {
            label: "Categorie preferite",
            value: formatListSummary(completeProfile.playerProfile?.preferred_categories),
          },
          {
            label: "Regioni di interesse",
            value: formatListSummary(completeProfile.playerProfile?.transfer_regions),
          },
          {
            label: "Disponibile a cambiare squadra",
            value: completeProfile.playerProfile?.willing_to_change_club ? "Sì" : "No",
          },
          {
            label: "Video highlights",
            value: formatOptionalSummary(
              completeProfile.playerProfile?.highlight_video_url,
            ),
          },
        ],
      });
    }

    if (completeProfile.profile.role === "coach") {
      sections.push({
        title: "Profilo allenatore",
        subtitle: "Licenze, storia e disponibilità del tecnico.",
        items: [
          {
            label: "Licenze",
            value: formatListSummary(completeProfile.coachProfile?.licenses),
          },
          {
            label: "Squadre allenate",
            value: formatListSummary(completeProfile.coachProfile?.coached_clubs),
          },
          {
            label: "Categorie allenate",
            value: formatListSummary(completeProfile.coachProfile?.coached_categories),
          },
          {
            label: "Filosofia di gioco",
            value: formatOptionalSummary(completeProfile.coachProfile?.game_philosophy),
          },
          {
            label: "Video tecnico",
            value: formatOptionalSummary(completeProfile.coachProfile?.technical_video_url),
          },
          {
            label: "Aree di interesse",
            value: formatListSummary(completeProfile.coachProfile?.preferred_regions),
          },
          {
            label: "Disponibile per nuove panchine",
            value: completeProfile.coachProfile?.open_to_new_role ? "Sì" : "No",
          },
        ],
      });
    }

    if (completeProfile.profile.role === "staff") {
      sections.push({
        title: "Profilo staff tecnico",
        subtitle: "Specializzazione, esperienza e disponibilità lavorativa.",
        items: [
          {
            label: "Specializzazione",
            value: formatSpecialization(completeProfile.staffProfile?.specialization ?? null),
          },
          {
            label: "Esperienza",
            value: formatOptionalSummary(
              completeProfile.staffProfile?.experience_summary,
            ),
          },
          {
            label: "Certificazioni",
            value: formatListSummary(completeProfile.staffProfile?.certifications),
          },
          {
            label: "Aree di interesse",
            value: formatListSummary(completeProfile.staffProfile?.preferred_regions),
          },
          {
            label: "Disponibile a lavorare",
            value: completeProfile.staffProfile?.open_to_work ? "Sì" : "No",
          },
        ],
      });
    }

    if (completeProfile.profile.role === "club_admin") {
      sections.push({
        title: "Pagina società",
        subtitle: "Dati pubblici configurati per il club.",
        items: [
          { label: "Nome club", value: formatOptionalSummary(completeProfile.club?.name) },
          { label: "Città club", value: formatOptionalSummary(completeProfile.club?.city) },
          {
            label: "Regione club",
            value: getOptionLabel(REGION_OPTIONS, completeProfile.club?.region),
          },
          {
            label: "Categoria",
            value: formatOptionalSummary(completeProfile.club?.category),
          },
          {
            label: "Campionato",
            value: formatOptionalSummary(completeProfile.club?.league),
          },
          {
            label: "Descrizione club",
            value: formatOptionalSummary(completeProfile.club?.description),
          },
          {
            label: "Logo",
            value: formatOptionalSummary(completeProfile.club?.logo_url),
          },
          {
            label: "Gallery media",
            value: formatListSummary(completeProfile.club?.gallery_urls),
          },
        ],
      });
    }

    return sections;
  }, [completeProfile]);

  if (!userId || !profile) {
    return null;
  }

  function handleStartEditing() {
    if (completeProfile) {
      setFormState(buildInitialState(completeProfile));
    }

    setIsEditing(true);
  }

  function handleStopEditing() {
    if (completeProfile) {
      setFormState(buildInitialState(completeProfile));
    }

    setIsEditing(false);
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
          const seasonLabel = normalizeSeasonLabelInput(entry.seasonLabel);
          const clubName = entry.clubName.trim();

          if (!seasonLabel && !clubName) {
            return null;
          }

          if (!seasonLabel || !clubName) {
            throw new Error(
              "Ogni riga carriera deve includere almeno stagione e club.",
            );
          }

          if (!isSeasonLabelValid(seasonLabel)) {
            throw new Error(
              "Usa il formato stagione xx/xx, ad esempio 24/25.",
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
            "Per la pagina società servono nome club, città e regione.",
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
          avatar_url: withDefaultProfileAvatar(formState.avatarUrl),
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
      setIsEditing(false);
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
      <ScrollView contentContainerStyle={{ gap: spacing[18], paddingBottom: 28 }}>
        <View
          style={{
            gap: spacing[12],
            padding: 22,
            borderRadius: radius[26],
            backgroundColor: colors.textPrimary,
          }}
        >
          <Text
            style={{
              color: colors.heroSoft,
              fontSize: typography.fontSize[12],
              fontWeight: typography.fontWeight.heavy,
              textTransform: "uppercase",
              letterSpacing: typography.letterSpacing.md,
            }}
          >
            Fase 2 · Identità professionale
          </Text>
          <Text
            style={{
              fontSize: typography.fontSize[30],
              lineHeight: typography.lineHeight[34],
              fontWeight: typography.fontWeight.heavy,
              color: colors.inkInvert,
            }}
          >
            Profilo professionale completo
          </Text>
          <Text
            style={{
              fontSize: typography.fontSize[16],
              lineHeight: typography.lineHeight[24],
              color: colors.textInverseMuted,
            }}
          >
            Completa e aggiorna il tuo profilo pubblico con i dati richiesti dalla
            roadmap MVP: identità, disponibilità, carriera e dettagli di ruolo.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[10] }}>
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: radius.full,
                backgroundColor: colors.surfaceOverlay,
              }}
            >
              <Text style={{ color: colors.inkInvert, fontWeight: typography.fontWeight.bold }}>
                {profile.full_name ?? "Profilo"}
              </Text>
            </View>
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: radius.full,
                backgroundColor: colors.surfaceOverlay,
              }}
            >
              <Text style={{ color: colors.inkInvert, fontWeight: typography.fontWeight.bold }}>
                {roleLabels[profile.role as AppRole] ?? "Ruolo"}
              </Text>
            </View>
          </View>
        </View>

        {completeProfile ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[12] }}>
            {profileHighlights.map((item) => (
              <View
                key={item.label}
                style={{
                  minWidth: "30%",
                  flexGrow: 1,
                  gap: spacing[6],
                  padding: 16,
                  borderRadius: radius[20],
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: typography.fontSize[12],
                    fontWeight: typography.fontWeight.bold,
                    textTransform: "uppercase",
                  }}
                >
                  {item.label}
                </Text>
                <Text style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.heavy }}>
                  {item.value}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {completeProfile && !isLoading ? (
          <View style={{ flexDirection: "row", gap: spacing[12] }}>
            {isEditing ? (
              <>
                <Button
                  label="Annulla modifiche"
                  onPress={handleStopEditing}
                  style={{ flex: 1 }}
                  variant="secondary"
                />
                <Button
                  disabled={isSaving}
                  label={isSaving ? "Salvataggio..." : "Salva profilo"}
                  onPress={() => void handleSave()}
                  style={{ flex: 1 }}
                  variant="primary"
                />
              </>
            ) : (
              <Button
                label="Modifica profilo"
                onPress={handleStartEditing}
                style={{ flex: 1 }}
                variant="primary"
              />
            )}
          </View>
        ) : null}

        {isLoading || !formState ? (
          <Section title="Caricamento profilo">
            <Text style={{ color: colors.textSecondary }}>
              Sto recuperando i dati professionali del tuo account...
            </Text>
          </Section>
        ) : !isEditing ? (
          <>
            {summarySections.map((section) => (
              <SummaryCard
                key={section.title}
                items={section.items}
                subtitle={section.subtitle}
                title={section.title}
              />
            ))}

            {(profile.role as AppRole) === "player" ? (
              <Section
                subtitle="Le stagioni salvate vengono mantenute e riepilogate qui."
                title="Stagioni salvate"
              >
                {playerCareerSummaryEntries.length > 0 ? (
                  playerCareerSummaryEntries.map(({ entry, seasonTitle }) => (
                    <Card key={entry.id} style={{ gap: spacing[10] }} variant="muted">
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontSize: typography.fontSize[18],
                          fontWeight: typography.fontWeight.heavy,
                        }}
                      >
                        {seasonTitle} · {entry.club_name}
                      </Text>
                      <Text style={{ color: colors.textSecondary }}>
                        {entry.competition_name?.trim() || "Competizione da completare"}
                      </Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[8] }}>
                        {[
                          `Presenze ${entry.appearances}`,
                          `Gol ${entry.goals}`,
                          `Assist ${entry.assists}`,
                          `Minuti ${entry.minutes_played}`,
                        ].map((item) => (
                          <View
                            key={item}
                            style={{
                              paddingHorizontal: spacing[12],
                              paddingVertical: spacing[8],
                              borderRadius: radius.full,
                              backgroundColor: colors.background,
                            }}
                          >
                            <Text style={{ color: colors.textPrimary }}>{item}</Text>
                          </View>
                        ))}
                      </View>
                      {entry.awards?.trim() ? (
                        <Text style={{ color: colors.textSecondary }}>{entry.awards}</Text>
                      ) : null}
                    </Card>
                  ))
                ) : (
                  <Text style={{ color: colors.textSecondary }}>
                    Nessuna stagione salvata al momento.
                  </Text>
                )}
              </Section>
            ) : null}
          </>
        ) : (
          <>
            <Section
              subtitle="Dati anagrafici, località, disponibilità e presentazione pubblica."
              title="Identità di base"
            >
              <Field
                label="Nome e cognome"
                onChangeText={(value) =>
                  setFormState((current) => (current ? { ...current, fullName: value } : current))
                }
                value={formState.fullName}
              />
              <BirthDateField
                label="Data di nascita"
                onChange={(value) =>
                  setFormState((current) => (current ? { ...current, birthDate: value } : current))
                }
                value={formState.birthDate}
              />
              <SelectField
                allowClear
                clearLabel="Rimuovi la nazionalità"
                label="Nazionalità"
                onChange={(value) =>
                  setFormState((current) =>
                    current ? { ...current, nationality: value } : current,
                  )
                }
                options={nationalityOptions}
                placeholder="Seleziona la nazionalità"
                value={formState.nationality}
              />
              <Field
                label="Città"
                onChangeText={(value) =>
                  setFormState((current) => (current ? { ...current, city: value } : current))
                }
                value={formState.city}
              />
              <SelectField
                allowClear
                clearLabel="Rimuovi la regione"
                label="Regione"
                onChange={(value) =>
                  setFormState((current) => (current ? { ...current, region: value } : current))
                }
                options={regionOptions}
                placeholder="Seleziona la regione"
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
                label="URL foto profilo (facoltativo)"
                onChangeText={(value) =>
                  setFormState((current) =>
                    current ? { ...current, avatarUrl: value } : current,
                  )
                }
                placeholder="Lascia vuoto per usare l'immagine blank di default"
                value={formState.avatarUrl}
              />
              <BooleanField
                falseLabel="Non disponibile"
                label="Disponibile a nuove opportunità"
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
                  trueLabel="Sì"
                  value={formState.isOpenToTransfer}
                />
              ) : null}
            </Section>

            {(profile.role as AppRole) === "player" ? (
              <>
                <Section
                  subtitle="Dati sportivi e disponibilità del calciatore."
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
                  <View style={{ gap: spacing[8] }}>
                    <Text style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.bold }}>
                      Posizione secondaria
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[8] }}>
                      <Button
                        label="Nessuna"
                        onPress={() =>
                          setFormState((current) =>
                            current ? { ...current, secondaryPosition: "" } : current,
                          )
                        }
                        selected={formState.secondaryPosition === ""}
                        size="sm"
                        variant="chipAction"
                      />
                      {positionOptions.map((option) => {
                        const isActive = option.value === formState.secondaryPosition;

                        return (
                          <Button
                            key={option.value}
                            label={option.label}
                            onPress={() =>
                              setFormState((current) =>
                                current
                                  ? { ...current, secondaryPosition: option.value }
                                  : current,
                              )
                            }
                            selected={isActive}
                            size="sm"
                            variant="chipAction"
                          />
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
                    trueLabel="Sì"
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
                        gap: spacing[12],
                        padding: 16,
                        borderRadius: radius[18],
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
                        <Text style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.heavy }}>
                          Stagione {index + 1}
                        </Text>
                        <Button
                          destructive
                          label="Rimuovi"
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
                          size="sm"
                          variant="link"
                        />
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
                                        ? {
                                            ...currentEntry,
                                            seasonLabel: normalizeSeasonLabelInput(value),
                                          }
                                        : currentEntry,
                                  ),
                                }
                              : current,
                          )
                        }
                        placeholder="24/25"
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
                  <Button
                    label="Aggiungi stagione"
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
                    variant="secondary"
                  />
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
                  trueLabel="Sì"
                  value={formState.openToNewRole}
                />
              </Section>
            ) : null}

            {(profile.role as AppRole) === "staff" ? (
              <Section
                subtitle="Specializzazione, certificazioni e disponibilità lavorativa."
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
                  trueLabel="Sì"
                  value={formState.openToWork}
                />
              </Section>
            ) : null}

            {(profile.role as AppRole) === "club_admin" ? (
              <Section
                subtitle="Pagina ufficiale del club con informazioni pubbliche, gallery e contesto competitivo."
                title="Pagina società"
              >
                <Field
                  label="Nome club"
                  onChangeText={(value) =>
                    setFormState((current) => (current ? { ...current, clubName: value } : current))
                  }
                  value={formState.clubName}
                />
                <Field
                  label="Città club"
                  onChangeText={(value) =>
                    setFormState((current) => (current ? { ...current, clubCity: value } : current))
                  }
                  value={formState.clubCity}
                />
                <SelectField
                  allowClear
                  clearLabel="Rimuovi la regione del club"
                  label="Regione club"
                  onChange={(value) =>
                    setFormState((current) =>
                      current ? { ...current, clubRegion: value } : current,
                    )
                  }
                  options={clubRegionOptions}
                  placeholder="Seleziona la regione del club"
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

          </>
        )}
      </ScrollView>
    </Screen>
  );
}
