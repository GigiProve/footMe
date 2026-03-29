import type { AppRole, StaffSpecialization } from "../onboarding/create-initial-profile";
import type {
  CompleteProfessionalProfile,
  CompleteProfessionalProfileUpdate,
} from "./profile-service";
import type { PlayerExperienceForm, PlayerPosition, PreferredFoot } from "./player-sports";
import type { ClubSeasonForm } from "./club-season-section";
import { formToInput, recordToForm } from "./club-season-section";
import {
  DEFAULT_PLAYER_PRIMARY_POSITION,
  parsePlayerExperienceForms,
  sortPlayerExperiencesBySeason,
  toPlayerExperienceForm,
} from "./player-sports";
import {
  formatBirthDateInputValue,
  formatLocationSummary,
  calculateAge,
  formatOptionalSummary,
  getOptionLabel,
  REGION_OPTIONS,
} from "./profile-form-utils";
import { getLatestPlayerExperience, getPlayerPositionLabel } from "./player-sports";

// ────────────────────────────────
// Role labels
// ────────────────────────────────

export const roleLabels: Record<AppRole, string> = {
  admin: "Amministratore",
  agent: "Procuratore",
  club_admin: "Societa'",
  coach: "Allenatore",
  director: "Dirigente",
  player: "Calciatore",
  staff: "Staff tecnico",
};

export const specializationOptions: { label: string; value: StaffSpecialization }[] = [
  { label: "Preparatore atletico", value: "fitness_coach" },
  { label: "Preparatore portieri", value: "goalkeeper_coach" },
  { label: "Fisioterapista", value: "physiotherapist" },
  { label: "Match analyst", value: "match_analyst" },
  { label: "Team manager", value: "team_manager" },
  { label: "Altro", value: "other" },
];

export function formatSpecialization(value: StaffSpecialization | null) {
  if (!value) {
    return "Da definire";
  }

  return (
    specializationOptions.find((option) => option.value === value)?.label ??
    value
  );
}

// ────────────────────────────────
// String utilities
// ────────────────────────────────

export function toDelimitedString(values: string[] | null | undefined) {
  return (values ?? []).join(", ");
}

export function fromDelimitedString(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseOptionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function parseOptionalNumber(value: string) {
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

export function parseWheelValue(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

// ────────────────────────────────
// Full form state (used only by individual modals now)
// ────────────────────────────────

export type ProfileFormState = {
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
  clubSeasonEntries: ClubSeasonForm[];
  clubColors: string;
  clubCountry: string;
  clubDescription: string;
  clubEmail: string;
  clubFieldAddress: string;
  clubFoundingYear: string;
  clubGalleryUrls: string;
  clubHeadquartersAddress: string;
  clubId: string | null;
  clubLeague: string;
  clubLogoUrl: string;
  clubName: string;
  clubPhone: string;
  clubRegion: string;
  clubWebsite: string;
  coachedCategories: string;
  coachedClubs: string;
  fullName: string;
  gamePhilosophy: string;
  heightCm: string;
  highlightVideoUrl: string;
  availabilityType: string;
  isOpenToTransfer: boolean;
  languages: string;
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
  secondaryPositions: PlayerPosition[];
  specialization: StaffSpecialization;
  technicalVideoUrl: string;
  transferProvinces: string;
  transferRegions: string;
  weightKg: string;
  willingToChangeClub: boolean;
  city: string;
  experienceSummary: string;
};

export function buildInitialState(
  data: CompleteProfessionalProfile,
): ProfileFormState {
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
            data.playerCareerEntries.map((entry) =>
              toPlayerExperienceForm(entry),
            ),
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
    clubSeasonEntries: data.clubSeasonEntries.map(recordToForm),
    clubColors: club?.club_colors ?? "",
    clubCountry: club?.country ?? "IT",
    clubDescription: club?.description ?? "",
    clubEmail: club?.club_email ?? "",
    clubFieldAddress: club?.field_address ?? "",
    clubFoundingYear: club?.founding_year ? String(club.founding_year) : "",
    clubGalleryUrls: toDelimitedString(club?.gallery_urls),
    clubHeadquartersAddress: club?.headquarters_address ?? "",
    clubId: club?.id ?? null,
    clubLeague: club?.league ?? "",
    clubLogoUrl: club?.logo_url ?? "",
    clubName: club?.name ?? "",
    clubPhone: club?.club_phone ?? "",
    clubRegion: club?.region ?? "",
    clubWebsite: club?.website_url ?? "",
    coachedCategories: toDelimitedString(coachProfile?.coached_categories),
    coachedClubs: toDelimitedString(coachProfile?.coached_clubs),
    experienceSummary: staffProfile?.experience_summary ?? "",
    fullName: data.profile.full_name,
    gamePhilosophy: coachProfile?.game_philosophy ?? "",
    heightCm: playerProfile?.height_cm ? String(playerProfile.height_cm) : "",
    highlightVideoUrl: playerProfile?.highlight_video_url ?? "",
    availabilityType: playerProfile?.availability_type ?? "ITALY",
    isOpenToTransfer: data.profile.is_open_to_transfer,
    languages: toDelimitedString(data.profile.languages),
    licenses: toDelimitedString(coachProfile?.licenses),
    nationality: data.profile.nationality ?? "",
    openToNewRole: coachProfile?.open_to_new_role ?? false,
    openToWork: staffProfile?.open_to_work ?? false,
    preferredCategories: toDelimitedString(playerProfile?.preferred_categories),
    preferredFoot: playerProfile?.preferred_foot ?? "",
    preferredRegions: toDelimitedString(
      coachProfile?.preferred_regions ?? staffProfile?.preferred_regions,
    ),
    primaryPosition:
      playerProfile?.primary_position ?? DEFAULT_PLAYER_PRIMARY_POSITION,
    region: data.profile.region ?? "",
    showContactEmail: data.userContacts.showEmail,
    showContactFacebook: data.userContacts.showFacebook,
    showContactInstagram: data.userContacts.showInstagram,
    secondaryPositions: playerProfile?.secondary_positions ?? [],
    specialization: staffProfile?.specialization ?? "fitness_coach",
    technicalVideoUrl: coachProfile?.technical_video_url ?? "",
    transferProvinces: toDelimitedString(playerProfile?.transfer_provinces),
    transferRegions: toDelimitedString(playerProfile?.transfer_regions),
    weightKg: playerProfile?.weight_kg ? String(playerProfile.weight_kg) : "",
    willingToChangeClub: playerProfile?.willing_to_change_club ?? false,
  };
}

/**
 * Build the full update payload from the current complete profile data and form state.
 * This allows individual modals to only change their section while preserving the rest.
 */
export function buildFullUpdatePayload(
  data: CompleteProfessionalProfile,
  formState: ProfileFormState,
): CompleteProfessionalProfileUpdate {
  const parsedCareerEntries = parsePlayerExperienceForms(formState.careerEntries);

  return {
    club:
      data.profile.role === "club_admin"
        ? {
            category: parseOptionalText(formState.clubCategory),
            city: formState.clubCity.trim(),
            club_colors: parseOptionalText(formState.clubColors),
            club_email: formState.clubEmail.trim().toLowerCase() || null,
            club_phone: parseOptionalText(formState.clubPhone),
            country: formState.clubCountry || "IT",
            description: parseOptionalText(formState.clubDescription),
            field_address: parseOptionalText(formState.clubFieldAddress),
            founding_year: parseOptionalNumber(formState.clubFoundingYear),
            gallery_urls: fromDelimitedString(formState.clubGalleryUrls),
            headquarters_address: parseOptionalText(
              formState.clubHeadquartersAddress,
            ),
            id: formState.clubId ?? undefined,
            league: parseOptionalText(formState.clubLeague),
            logo_url: parseOptionalText(formState.clubLogoUrl),
            name: formState.clubName.trim(),
            region: formState.clubRegion.trim(),
            website_url: parseOptionalText(formState.clubWebsite),
          }
        : null,
    clubSeasonEntries:
      data.profile.role === "club_admin"
        ? formState.clubSeasonEntries.map((entry, index) =>
            formToInput(entry, index),
          )
        : [],
    coachProfile:
      data.profile.role === "coach"
        ? {
            coached_categories: fromDelimitedString(
              formState.coachedCategories,
            ),
            coached_clubs: fromDelimitedString(formState.coachedClubs),
            game_philosophy: parseOptionalText(formState.gamePhilosophy),
            licenses: fromDelimitedString(formState.licenses),
            open_to_new_role: formState.openToNewRole,
            preferred_regions: fromDelimitedString(
              formState.preferredRegions,
            ),
            technical_video_url: parseOptionalText(
              formState.technicalVideoUrl,
            ),
          }
        : null,
    playerCareerEntries:
      data.profile.role === "player" ? parsedCareerEntries : [],
    playerProfile:
      data.profile.role === "player"
        ? {
            availability_type: formState.availabilityType,
            height_cm: parseOptionalNumber(formState.heightCm),
            highlight_video_url: parseOptionalText(
              formState.highlightVideoUrl,
            ),
            preferred_categories: fromDelimitedString(
              formState.preferredCategories,
            ),
            preferred_foot: formState.preferredFoot || null,
            primary_position: formState.primaryPosition,
            secondary_positions: formState.secondaryPositions,
            transfer_provinces: fromDelimitedString(
              formState.transferProvinces,
            ),
            transfer_regions: fromDelimitedString(
              formState.transferRegions,
            ),
            weight_kg: parseOptionalNumber(formState.weightKg),
            willing_to_change_club: formState.willingToChangeClub,
          }
        : null,
    profile: {
      avatar_url: parseOptionalText(formState.avatarUrl),
      bio: parseOptionalText(formState.bio),
      birth_date: null, // Must be set by the calling modal after validation
      city: parseOptionalText(formState.city),
      full_name: formState.fullName.trim(),
      is_open_to_transfer: formState.isOpenToTransfer,
      languages: fromDelimitedString(formState.languages),
      nationality: parseOptionalText(formState.nationality),
      region: parseOptionalText(formState.region),
    },
    profileId: data.profile.id,
    role: data.profile.role,
    staffProfile:
      data.profile.role === "staff"
        ? {
            certifications: fromDelimitedString(formState.certifications),
            experience_summary: parseOptionalText(
              formState.experienceSummary,
            ),
            open_to_work: formState.openToWork,
            preferred_regions: fromDelimitedString(
              formState.preferredRegions,
            ),
            specialization: formState.specialization,
          }
        : null,
    userContacts: {
      email: formState.contactEmail.trim().toLowerCase(),
      facebook: formState.contactFacebook.trim(),
      instagram: formState.contactInstagram.trim(),
      phone: formState.contactPhone.trim(),
      showEmail: formState.showContactEmail,
      showFacebook: formState.showContactFacebook,
      showInstagram: formState.showContactInstagram,
    },
  };
}

// ────────────────────────────────
// Header details builder
// ────────────────────────────────

export function buildHeaderDetails(data: CompleteProfessionalProfile) {
  const roleBadge = roleLabels[data.profile.role];
  const age = data.profile.age ?? calculateAge(data.profile.birth_date);
  const fullName = data.profile.full_name + (age ? `, ${age}` : "");
  const primaryMeta = formatLocationSummary(
    data.profile.city,
    data.profile.region,
  );

  if (data.profile.role === "player") {
    const latestEntry = getLatestPlayerExperience(
      data.playerCareerEntries.map((entry) => toPlayerExperienceForm(entry)),
    );

    return {
      badges: [roleBadge],
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
      badges: [
        roleBadge,
        data.coachProfile?.open_to_new_role
          ? "Aperto a nuove panchine"
          : "Profilo attivo",
      ],
      fullName,
      primaryMeta,
      secondaryMeta: `${data.coachProfile?.coached_clubs?.[0] ?? "Squadra da completare"} · ${
        data.coachProfile?.coached_categories?.[0] ?? "Categoria da definire"
      }`,
    };
  }

  if (data.profile.role === "staff") {
    return {
      badges: [
        roleBadge,
        data.staffProfile?.open_to_work ? "Open to work" : "Profilo attivo",
      ],
      fullName,
      primaryMeta,
      secondaryMeta: `${formatSpecialization(data.staffProfile?.specialization ?? null)} · ${
        data.staffProfile?.preferred_regions?.[0] ?? "Area da definire"
      }`,
    };
  }

  if (data.profile.role === "club_admin") {
    const clubName = data.club?.name ?? "Società da completare";
    const clubCity = data.club?.city ?? "";
    const clubRegion = data.club?.region ?? "";
    const clubLocationMeta = formatLocationSummary(clubCity, clubRegion);

    return {
      badges: [roleBadge],
      fullName: clubName,
      primaryMeta: clubLocationMeta,
      secondaryMeta: data.club?.category ?? "Categoria da definire",
    };
  }

  return {
    badges: [roleBadge],
    fullName,
    primaryMeta,
    secondaryMeta: undefined,
  };
}

// ────────────────────────────────
// Summary section builder for readonly
// ────────────────────────────────

export type SummarySection = {
  items: { label: string; value: string }[];
  subtitle?: string;
  title: string;
};

export function buildSummarySections(data: CompleteProfessionalProfile): SummarySection[] {
  const sections: SummarySection[] = [];

  if (data.profile.role === "player") {
    sections.push({
      title: "Preferenze sportive",
      subtitle:
        "Disponibilità, aree di interesse e contenuti extra del profilo giocatore.",
      items: [
        {
          label: "Aperto al trasferimento",
          value: data.profile.is_open_to_transfer ? "Sì" : "No",
        },
        {
          label: "Disponibile a cambiare squadra",
          value: data.playerProfile?.willing_to_change_club ? "Sì" : "No",
        },
      ],
    });

    sections.push({
      title: "Informazioni fisiche",
      subtitle: "Dati fisici leggibili separati dal resto del profilo.",
      items: [
        {
          label: "Altezza",
          value: data.playerProfile?.height_cm
            ? `${data.playerProfile.height_cm} cm`
            : "Da completare",
        },
        {
          label: "Peso",
          value: data.playerProfile?.weight_kg
            ? `${data.playerProfile.weight_kg} kg`
            : "Da completare",
        },
      ],
    });
  }

  if (data.profile.role === "coach") {
    sections.push({
      title: "Informazioni sportive",
      subtitle: "Licenze, categorie e posizionamento del profilo allenatore.",
      items: [
        {
          label: "Licenze",
          value: formatListSummary(data.coachProfile?.licenses),
        },
        {
          label: "Squadre allenate",
          value: formatListSummary(data.coachProfile?.coached_clubs),
        },
        {
          label: "Categorie allenate",
          value: formatListSummary(data.coachProfile?.coached_categories),
        },
        {
          label: "Filosofia di gioco",
          value: formatOptionalSummary(data.coachProfile?.game_philosophy),
        },
        {
          label: "Aree di interesse",
          value: formatListSummary(data.coachProfile?.preferred_regions),
        },
        {
          label: "Disponibile per nuove panchine",
          value: data.coachProfile?.open_to_new_role ? "Sì" : "No",
        },
      ],
    });
  }

  if (data.profile.role === "staff") {
    sections.push({
      title: "Informazioni sportive",
      subtitle:
        "Specializzazione, esperienza e aree operative del profilo staff.",
      items: [
        {
          label: "Specializzazione",
          value: formatSpecialization(
            data.staffProfile?.specialization ?? null,
          ),
        },
        {
          label: "Esperienza",
          value: formatOptionalSummary(data.staffProfile?.experience_summary),
        },
        {
          label: "Certificazioni",
          value: formatListSummary(data.staffProfile?.certifications),
        },
        {
          label: "Aree di interesse",
          value: formatListSummary(data.staffProfile?.preferred_regions),
        },
        {
          label: "Disponibile a lavorare",
          value: data.staffProfile?.open_to_work ? "Sì" : "No",
        },
      ],
    });
  }

  if (data.profile.role === "club_admin") {
    sections.push({
      title: "Informazioni sportive",
      subtitle: "Dati pubblici del club organizzati come pagina profilo.",
      items: [
        {
          label: "Stato verifica",
          value:
            data.club?.verification_status === "verified"
              ? "Verificato"
              : data.club?.verification_status === "pending_review"
                ? "In revisione"
                : "Non verificato",
        },
        {
          label: "Nome club",
          value: formatOptionalSummary(data.club?.name),
        },
        {
          label: "Città club",
          value: formatOptionalSummary(data.club?.city),
        },
        {
          label: "Regione club",
          value: getOptionLabel(REGION_OPTIONS, data.club?.region),
        },
        {
          label: "Categoria",
          value: formatOptionalSummary(data.club?.category),
        },
        {
          label: "Campionato",
          value: formatOptionalSummary(data.club?.league),
        },
        {
          label: "Descrizione club",
          value: formatOptionalSummary(data.club?.description),
        },
      ],
    });
  }

  return sections;
}

function formatListSummary(values: string[] | null | undefined) {
  if (!values || values.length === 0) {
    return "Da completare";
  }

  return values.join(", ");
}
