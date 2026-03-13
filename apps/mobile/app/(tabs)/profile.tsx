import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  Text,
  View,
} from "react-native";

import { Screen } from "../../src/components/ui/screen";
import { SelectField } from "../../src/components/ui/select-field";
import { useSession } from "../../src/features/auth/use-session";
import { BioSection } from "../../src/features/profiles/bio-section";
import { ContactSection } from "../../src/features/profiles/contact-section";
import { PersonalInfoSection } from "../../src/features/profiles/personal-info-section";
import {
  PlayerCharacteristicsSection,
  PlayerExperiencesSection,
} from "../../src/features/profiles/player-sports-section";
import {
  ProfileField as Field,
  ProfileHeader,
  ProfileSection as Section,
} from "../../src/features/profiles/profile-screen-components";
import {
  DEFAULT_PLAYER_PRIMARY_POSITION,
  getLatestPlayerExperience,
  getPlayerPositionLabel,
  parsePlayerExperienceForms,
  sortPlayerExperiencesBySeason,
  toPlayerExperienceForm,
  type PlayerExperienceForm,
  type PlayerPosition,
  type PreferredFoot,
} from "../../src/features/profiles/player-sports";
import {
  NATIONALITY_OPTIONS,
  REGION_OPTIONS,
  calculateAge,
  ensureOption,
  formatBirthDate,
  formatBirthDateInputValue,
  formatLocationSummary,
  formatListSummary,
  isEmailValid,
  isPhoneNumberValid,
  formatOptionalSummary,
  formatProfileDisplayName,
  getRegionFromCity,
  getOptionLabel,
  isRegionConsistentWithCity,
  normalizeContactEmail,
  normalizeBirthDateInput,
  normalizeFacebookInput,
  normalizeProfileBioInput,
  normalizeInstagramInput,
  normalizePhoneInput,
  searchItalianCities,
  validateProfileBio,
  validateBirthDateInput,
} from "../../src/features/profiles/profile-form-utils";
import {
  getCompleteProfessionalProfile,
  updateCompleteProfessionalProfile,
  type CompleteProfessionalProfile,
  type PlayerCareerEntryInput,
  searchTeams,
} from "../../src/features/profiles/profile-service";
import {
  type AppRole,
  type StaffSpecialization,
} from "../../src/features/onboarding/create-initial-profile";
import { colors, spacing, typography } from "../../src/theme/tokens";
import { Button } from "../../src/ui";

type ProfileFormState = {
  avatarUrl: string;
  bio: string;
  birthDate: string;
  careerEntries: PlayerExperienceForm[];
  certifications: string;
  contactEmail: string;
  contactFacebook: string;
  contactInstagram: string;
  contactPhone: string;
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
  showContactEmail: boolean;
  showContactFacebook: boolean;
  showContactInstagram: boolean;
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

const specializationOptions: { label: string; value: StaffSpecialization }[] = [
  { label: "Preparatore atletico", value: "fitness_coach" },
  { label: "Preparatore portieri", value: "goalkeeper_coach" },
  { label: "Fisioterapista", value: "physiotherapist" },
  { label: "Match analyst", value: "match_analyst" },
  { label: "Team manager", value: "team_manager" },
  { label: "Altro", value: "other" },
];

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
    birthDate: formatBirthDateInputValue(data.profile.birth_date),
    careerEntries:
      data.playerCareerEntries.length > 0
        ? sortPlayerExperiencesBySeason(
            data.playerCareerEntries.map((entry) => toPlayerExperienceForm(entry)),
          )
        : [],
    certifications: toDelimitedString(staffProfile?.certifications),
    city: data.profile.city ?? "",
    contactEmail: data.userContacts.email,
    contactFacebook: data.userContacts.facebook,
    contactInstagram: data.userContacts.instagram,
    contactPhone: data.userContacts.phone,
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
    primaryPosition: playerProfile?.primary_position ?? DEFAULT_PLAYER_PRIMARY_POSITION,
    region: data.profile.region ?? "",
    showContactEmail: data.userContacts.showEmail,
    showContactFacebook: data.userContacts.showFacebook,
    showContactInstagram: data.userContacts.showInstagram,
    secondaryPosition: playerProfile?.secondary_position ?? "",
    specialization: staffProfile?.specialization ?? "fitness_coach",
    technicalVideoUrl: coachProfile?.technical_video_url ?? "",
    transferRegions: toDelimitedString(playerProfile?.transfer_regions),
    weightKg: playerProfile?.weight_kg ? String(playerProfile.weight_kg) : "",
    willingToChangeClub: playerProfile?.willing_to_change_club ?? false,
  };
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

type SummarySection = {
  items: { label: string; value: string }[];
  subtitle?: string;
  title: string;
};

function buildHeaderDetails(
  data: CompleteProfessionalProfile,
  overrides?: {
    birthDate?: string;
    city?: string;
    fullName?: string;
    region?: string;
  },
) {
  const roleBadge = roleLabels[data.profile.role];
  const availabilityBadge = data.profile.is_available ? "Disponibile" : "Non disponibile";
  const age =
    calculateAge(overrides?.birthDate ?? undefined) ??
    data.profile.age ??
    calculateAge(data.profile.birth_date);
  const fullName = formatProfileDisplayName(
    overrides?.fullName ?? data.profile.full_name,
    age,
  );
  const primaryMeta = formatLocationSummary(
    overrides?.city ?? data.profile.city,
    overrides?.region ?? data.profile.region,
  );

  if (data.profile.role === "player") {
    const latestEntry = getLatestPlayerExperience(
      data.playerCareerEntries.map((entry) => toPlayerExperienceForm(entry)),
    );

    return {
      badges: [roleBadge, availabilityBadge],
      fullName,
      primaryMeta,
      secondaryMeta: `${getPlayerPositionLabel(
        data.playerProfile?.primary_position ?? null,
        "Non definita",
      )} · ${latestEntry?.clubName ?? "Squadra da completare"} · ${
        latestEntry?.category.trim() || "Categoria da definire"
      }`,
    };
  }

  if (data.profile.role === "coach") {
    return {
      badges: [roleBadge, data.coachProfile?.open_to_new_role ? "Aperto a nuove panchine" : "Profilo attivo"],
      fullName,
      primaryMeta,
      secondaryMeta: `${data.coachProfile?.coached_clubs?.[0] ?? "Squadra da completare"} · ${
        data.coachProfile?.coached_categories?.[0] ?? "Categoria da definire"
      }`,
    };
  }

  if (data.profile.role === "staff") {
    return {
      badges: [roleBadge, data.staffProfile?.open_to_work ? "Open to work" : "Profilo attivo"],
      fullName,
      primaryMeta,
      secondaryMeta: `${formatSpecialization(data.staffProfile?.specialization ?? null)} · ${
        data.staffProfile?.preferred_regions?.[0] ?? "Area da definire"
      }`,
    };
  }

  return {
    badges: [roleBadge],
    fullName,
    primaryMeta,
    secondaryMeta: `${data.club?.name ?? "Società da completare"} · ${
      data.club?.category ?? "Categoria da definire"
    }`,
  };
}

export default function ProfileScreen() {
  const { profile, refreshProfile, session } = useSession();
  const userId = session?.user.id ?? null;
  const [completeProfile, setCompleteProfile] =
    useState<CompleteProfessionalProfile | null>(null);
  const [formState, setFormState] = useState<ProfileFormState | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isBioTouched, setIsBioTouched] = useState(false);
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
  const citySuggestions = useMemo(
    () => searchItalianCities(formState?.city ?? ""),
    [formState?.city],
  );
  const headerDetails = useMemo(
    () =>
      completeProfile
        ? buildHeaderDetails(
            completeProfile,
            isEditing && formState
              ? {
                  birthDate: formState.birthDate,
                  city: formState.city,
                  fullName: formState.fullName,
                  region: formState.region,
                }
              : undefined,
          )
        : null,
    [completeProfile, formState, isEditing],
  );
  const playerExperienceCards = useMemo(
    () =>
      sortPlayerExperiencesBySeason(
        (completeProfile?.playerCareerEntries ?? []).map((entry) => toPlayerExperienceForm(entry)),
      ),
    [completeProfile?.playerCareerEntries],
  );
  const birthDateHelperText = useMemo(() => {
    const validation = validateBirthDateInput(formState?.birthDate);

    if (!validation.isValid) {
      return validation.message ?? undefined;
    }

    return formState?.birthDate ? "Formato GG/MM/AAAA" : undefined;
  }, [formState?.birthDate]);
  const cityHelperText = useMemo(() => {
    if (!formState?.city.trim()) {
      return undefined;
    }

    if (getRegionFromCity(formState.city)) {
      return `Regione suggerita: ${getRegionFromCity(formState.city)}`;
    }

    return "Seleziona una città presente nel dataset ISTAT.";
  }, [formState?.city]);
  const bioValidation = useMemo(
    () => validateProfileBio(formState?.bio ?? ""),
    [formState?.bio],
  );
  const bioErrorMessage = useMemo(() => {
    if (!isEditing || !formState) {
      return null;
    }

    if (!isBioTouched && !formState.bio.trim()) {
      return null;
    }

    return bioValidation.message;
  }, [bioValidation.message, formState, isBioTouched, isEditing]);

  const summarySections = useMemo<SummarySection[]>(() => {
    if (!completeProfile) {
      return [];
    }

    const sections: SummarySection[] = [
      {
        title: "Informazioni personali",
        subtitle: "Dati anagrafici e localizzazione visibili a colpo d'occhio.",
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
        ],
      },
      {
        title: "Presentazione",
        subtitle: "Disponibilità e descrizione pubblica del profilo.",
        items: [
          {
            label: "Disponibile a nuove opportunità",
            value: completeProfile.profile.is_available ? "Sì" : "No",
          },
          completeProfile.profile.role === "player"
            ? {
                label: "Aperto al trasferimento",
                value: completeProfile.profile.is_open_to_transfer ? "Sì" : "No",
              }
            : null,
        ].filter((item): item is { label: string; value: string } => item !== null),
      },
    ];

    if (completeProfile.profile.role === "player") {
      sections.push({
        title: "Preferenze sportive",
        subtitle: "Disponibilità, aree di interesse e contenuti extra del profilo giocatore.",
        items: [
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

      sections.push({
        title: "Informazioni fisiche",
        subtitle: "Dati fisici leggibili separati dal resto del profilo.",
        items: [
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
        ],
      });
    }

    if (completeProfile.profile.role === "coach") {
      sections.push({
        title: "Informazioni sportive",
        subtitle: "Licenze, categorie e posizionamento del profilo allenatore.",
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
        title: "Informazioni sportive",
        subtitle: "Specializzazione, esperienza e aree operative del profilo staff.",
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
        title: "Informazioni sportive",
        subtitle: "Dati pubblici del club organizzati come pagina profilo.",
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

    setIsBioTouched(false);
    setIsEditing(true);
  }

  function handleStopEditing() {
    if (completeProfile) {
      setFormState(buildInitialState(completeProfile));
    }

    setIsBioTouched(false);
    setIsEditing(false);
  }

  function handleBioChange(value: string) {
    setIsBioTouched(true);
    setFormState((current) =>
      current
        ? {
            ...current,
            bio: normalizeProfileBioInput(value),
          }
        : current,
    );
  }

  function handleFullNameChange(value: string) {
    setFormState((current) =>
      current
        ? {
            ...current,
            fullName: value.slice(0, 60),
          }
        : current,
    );
  }

  function handleBirthDateChange(value: string) {
    setFormState((current) =>
      current
        ? {
            ...current,
            birthDate: normalizeBirthDateInput(value),
          }
        : current,
    );
  }

  function handleCityChange(value: string) {
    setFormState((current) => (current ? { ...current, city: value } : current));
  }

  function handleCitySuggestionPress(selection: { name: string; region: string }) {
    setFormState((current) =>
      current
        ? {
            ...current,
            city: selection.name,
            region: selection.region,
          }
        : current,
    );
  }

  async function handleSave() {
    if (!userId || !completeProfile || !formState) {
      return;
    }

    try {
      setIsSaving(true);

      const trimmedFullName = formState.fullName.trim();
      const birthDateValidation = validateBirthDateInput(formState.birthDate);
      const trimmedCity = formState.city.trim();
      const inferredRegion = trimmedCity ? getRegionFromCity(trimmedCity) : "";
      const trimmedRegion = (formState.region.trim() || inferredRegion).trim();
      const normalizedInstagram = normalizeInstagramInput(formState.contactInstagram);
      const normalizedFacebook = normalizeFacebookInput(formState.contactFacebook);
      const normalizedEmail = normalizeContactEmail(formState.contactEmail);
      const normalizedPhone = normalizePhoneInput(formState.contactPhone);

      if (!trimmedFullName) {
        throw new Error("Nome e cognome sono obbligatori.");
      }

      if (trimmedFullName.length < 3) {
        throw new Error("Nome e cognome devono contenere almeno 3 caratteri.");
      }

      if (trimmedFullName.length > 60) {
        throw new Error("Nome e cognome non possono superare i 60 caratteri.");
      }

      if (!birthDateValidation.isValid) {
        throw new Error(
          birthDateValidation.message ??
            "Inserisci una data di nascita valida in formato GG/MM/AAAA.",
        );
      }

      if (trimmedCity && !inferredRegion) {
        throw new Error("Seleziona una città italiana valida dai suggerimenti.");
      }

      if (
        trimmedCity &&
        inferredRegion &&
        !isRegionConsistentWithCity(trimmedCity, trimmedRegion)
      ) {
        throw new Error("La regione deve essere coerente con la città selezionata.");
      }

      if (formState.contactInstagram.trim() && !normalizedInstagram) {
        throw new Error(
          "Instagram deve contenere un username valido oppure un link completo al profilo.",
        );
      }

      if (formState.contactFacebook.trim() && !normalizedFacebook) {
        throw new Error(
          "Facebook deve contenere un username valido oppure un link completo al profilo.",
        );
      }

      if (normalizedEmail && !isEmailValid(normalizedEmail)) {
        throw new Error("Inserisci un indirizzo email valido.");
      }

      if (formState.contactPhone.trim() && !isPhoneNumberValid(normalizedPhone)) {
        throw new Error(
          "Inserisci un numero di cellulare valido in formato internazionale, ad esempio +393331234567.",
        );
      }

      if (!bioValidation.isValid) {
        setIsBioTouched(true);
        throw new Error(
          bioValidation.message ?? "Inserisci una descrizione valida del tuo profilo.",
        );
      }

      const parsedCareerEntries: PlayerCareerEntryInput[] = parsePlayerExperienceForms(
        formState.careerEntries,
      );

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
          avatar_url: parseOptionalText(formState.avatarUrl),
          bio: parseOptionalText(formState.bio),
          birth_date: birthDateValidation.isoValue,
          city: parseOptionalText(trimmedCity),
          full_name: trimmedFullName,
          is_available: formState.isAvailable,
          is_open_to_transfer: formState.isOpenToTransfer,
          nationality: parseOptionalText(formState.nationality),
          region: parseOptionalText(trimmedRegion),
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
        userContacts: {
          email: normalizedEmail,
          facebook: normalizedFacebook,
          instagram: normalizedInstagram,
          phone: normalizedPhone,
          showEmail: formState.showContactEmail,
          showFacebook: formState.showContactFacebook,
          showInstagram: formState.showContactInstagram,
        },
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
      <ScrollView
        contentContainerStyle={{ gap: spacing[18], paddingBottom: 28 }}
        keyboardShouldPersistTaps="handled"
      >
        {completeProfile && headerDetails ? (
          <ProfileHeader
            avatarUrl={formState?.avatarUrl ?? completeProfile.profile.avatar_url}
            badges={headerDetails.badges}
            fullName={headerDetails.fullName}
            isEditing={isEditing}
            onEditPress={isEditing ? handleStopEditing : handleStartEditing}
            primaryMeta={headerDetails.primaryMeta}
            secondaryMeta={headerDetails.secondaryMeta}
          />
        ) : null}

        {isLoading || !formState ? (
          <Section title="Caricamento profilo">
            <Text style={{ color: colors.textSecondary }}>
              Sto recuperando i dati professionali del tuo account...
            </Text>
          </Section>
        ) : !isEditing ? (
          <>
            <PersonalInfoSection
              birthDate={formatBirthDateInputValue(completeProfile?.profile.birth_date)}
              city={completeProfile?.profile.city ?? ""}
              citySuggestions={[]}
              fullName={completeProfile?.profile.full_name ?? ""}
              nationality={completeProfile?.profile.nationality ?? ""}
              nationalityOptions={nationalityOptions}
              region={completeProfile?.profile.region ?? ""}
              regionOptions={regionOptions}
            />
            {(profile.role as AppRole) === "player" ? (
              <Section
                description="Squadra, categoria, stagione e numeri chiave del percorso calcistico."
                title="Esperienze calcistiche"
              >
                <PlayerExperiencesSection
                  emptyStateLabel="Nessuna esperienza calcistica salvata."
                  experiences={playerExperienceCards}
                  searchTeams={searchTeams}
                  showHeader={false}
                />
              </Section>
            ) : null}
            <BioSection bio={completeProfile?.profile.bio}>
              {summarySections
                .find((section) => section.title === "Presentazione")
                ?.items.map((item) => (
                  <Field key={`presentation-${item.label}`} label={item.label} value={item.value} />
                ))}
            </BioSection>
            {summarySections.map((section) => (
              section.title === "Presentazione" ||
              section.title === "Informazioni personali" ? null : (
                <Section key={section.title} description={section.subtitle} title={section.title}>
                  {section.items.map((item) => (
                    <Field key={`${section.title}-${item.label}`} label={item.label} value={item.value} />
                  ))}
                </Section>
              )
            ))}

            {(profile.role as AppRole) === "player" ? (
              <Section
                description="Ruolo e piede preferito leggibili rapidamente anche in consultazione."
                title="Profilo sportivo"
              >
                <PlayerCharacteristicsSection
                  preferredFoot={completeProfile?.playerProfile?.preferred_foot ?? ""}
                  primaryPosition={
                    completeProfile?.playerProfile?.primary_position ??
                    DEFAULT_PLAYER_PRIMARY_POSITION
                  }
                  secondaryPosition={completeProfile?.playerProfile?.secondary_position ?? ""}
                />
              </Section>
            ) : null}

            {completeProfile ? <ContactSection contacts={completeProfile.userContacts} /> : null}
          </>
        ) : (
          <>
            <PersonalInfoSection
              birthDate={formState.birthDate}
              birthDateHelperText={birthDateHelperText}
              city={formState.city}
              cityHelperText={cityHelperText}
              citySuggestions={citySuggestions}
              editable
              fullName={formState.fullName}
              nationality={formState.nationality}
              nationalityOptions={nationalityOptions}
              onBirthDateChange={handleBirthDateChange}
              onCityChange={handleCityChange}
              onCitySuggestionPress={handleCitySuggestionPress}
              onFullNameChange={handleFullNameChange}
              onNationalityChange={(value) =>
                setFormState((current) =>
                  current ? { ...current, nationality: value } : current,
                )
              }
              onRegionChange={(value) =>
                setFormState((current) => (current ? { ...current, region: value } : current))
              }
              region={formState.region}
              regionOptions={regionOptions}
            />
            <BioSection
              bio={formState.bio}
              editable
              errorMessage={bioErrorMessage}
              onChangeText={handleBioChange}
            >
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
            </BioSection>

            <ContactSection
              contacts={{
                email: formState.contactEmail,
                facebook: formState.contactFacebook,
                instagram: formState.contactInstagram,
                phone: formState.contactPhone,
                showEmail: formState.showContactEmail,
                showFacebook: formState.showContactFacebook,
                showInstagram: formState.showContactInstagram,
              }}
              editable
              onEmailChange={(value) =>
                setFormState((current) =>
                  current ? { ...current, contactEmail: value } : current,
                )
              }
              onFacebookChange={(value) =>
                setFormState((current) =>
                  current ? { ...current, contactFacebook: value } : current,
                )
              }
              onInstagramChange={(value) =>
                setFormState((current) =>
                  current ? { ...current, contactInstagram: value } : current,
                )
              }
              onPhoneChange={(value) =>
                setFormState((current) =>
                  current ? { ...current, contactPhone: value } : current,
                )
              }
              onShowEmailChange={(value) =>
                setFormState((current) =>
                  current ? { ...current, showContactEmail: value } : current,
                )
              }
              onShowFacebookChange={(value) =>
                setFormState((current) =>
                  current ? { ...current, showContactFacebook: value } : current,
                )
              }
              onShowInstagramChange={(value) =>
                setFormState((current) =>
                  current ? { ...current, showContactInstagram: value } : current,
                )
              }
            />

            {(profile.role as AppRole) === "player" ? (
              <>
                <Section
                  description="Ruolo, piede, preferenze e timeline esperienze del calciatore."
                  title="Informazioni sportive"
                >
                  <PlayerCharacteristicsSection
                    editable
                    onPreferredFootChange={(value) =>
                      setFormState((current) =>
                        current ? { ...current, preferredFoot: value } : current,
                      )
                    }
                    onPrimaryPositionChange={(value) =>
                      setFormState((current) =>
                        current ? { ...current, primaryPosition: value } : current,
                      )
                    }
                    onSecondaryPositionChange={(value) =>
                      setFormState((current) =>
                        current ? { ...current, secondaryPosition: value } : current,
                      )
                    }
                    preferredFoot={formState.preferredFoot}
                    primaryPosition={formState.primaryPosition}
                    secondaryPosition={formState.secondaryPosition}
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
                  <PlayerExperiencesSection
                    addButtonLabel="Aggiungi esperienza calcistica"
                    editable
                    emptyStateLabel="Aggiungi una stagione per completare il profilo."
                    experiences={formState.careerEntries}
                    onChange={(experiences) =>
                      setFormState((current) =>
                        current ? { ...current, careerEntries: experiences } : current,
                      )
                    }
                    searchTeams={searchTeams}
                    showHeader={false}
                  />
                </Section>

                <Section
                  description="Altezza e peso restano separati per una lettura più chiara."
                  title="Informazioni fisiche"
                >
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
                </Section>
              </>
            ) : null}

            {(profile.role as AppRole) === "coach" ? (
              <Section
                description="Licenze, storico squadre e filosofia di gioco per il profilo allenatore."
                title="Informazioni sportive"
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
                description="Specializzazione, certificazioni e disponibilità lavorativa."
                title="Informazioni sportive"
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
                description="Pagina ufficiale del club con informazioni pubbliche, gallery e contesto competitivo."
                title="Informazioni sportive"
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

            <View style={{ flexDirection: "row", gap: spacing[12] }}>
              <Button
                label="Annulla"
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
            </View>

          </>
        )}
      </ScrollView>
    </Screen>
  );
}
