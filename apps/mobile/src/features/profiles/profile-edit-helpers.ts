import type {
  AppRole,
  ProfileGender,
  StaffSpecialization,
} from "../onboarding/create-initial-profile";
import { mapStaffRoleToSpecialization } from "../onboarding/onboarding-types";
import type {
  CompleteProfessionalProfile,
  CompleteProfessionalProfileUpdate,
} from "./profile-service";
import type { PlayerExperienceForm, PlayerPosition, PreferredFoot } from "./player-sports";
import { buildPlayerCareerView } from "./career/player-career-model";
import {
  buildCoachCareerView,
  getCurrentCoachExperience,
} from "./career/coach-career-model";
import {
  buildStaffProfileCareer,
  collectStaffRoles,
} from "./career/staff-career-model";
import {
  buildDirectorProfileCareer,
  resolveDirectorPrimaryRole,
} from "./career/director-career-model";
import {
  buildAgentProfileCareer,
  formatAgentOrganizationLabel,
} from "./career/agent-career-model";
import { buildAgentLicenseLabel } from "../onboarding/agent/agent-taxonomy";
import type { ProfileHeroBadge } from "./master/ProfileHeroHeader";
import type { ProfileQuickFact } from "./master/ProfileQuickFacts";
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
  formatProfileDisplayName,
  getNationalityCategory,
  getOptionLabel,
  REGION_OPTIONS,
} from "./profile-form-utils";
import {
  getLatestPlayerExperience,
  getPlayerPositionLabel,
  getPlayerPositionLabels,
  getPreferredFootLabel,
} from "./player-sports";

// ────────────────────────────────
// Role labels
// ────────────────────────────────

export const roleLabels: Record<AppRole, string> = {
  admin: "Amministratore",
  agent: "Procuratore",
  club_admin: "Societa'",
  coach: "Allenatore",
  director: "Dirigente",
  fan: "Tifoso",
  media: "Media",
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
  /** REV-PROF-16: ottavo canale pubblico. */
  contactLinkedIn: string;
  contactPhone: string;
  contactTikTok: string;
  contactWebsite: string;
  contactYouTube: string;
  coverUrl: string;
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
  coachAvailabilityType: string;
  coachAvailableFrom: string;
  coachPreferredProvinces: string;
  coachPrimaryRole: string;
  coachedCategories: string;
  coachedClubs: string;
  fullName: string;
  gamePhilosophy: string;
  gender: ProfileGender | "";
  heightCm: string;
  highlightVideoUrl: string;
  availabilityType: string;
  isOpenToTransfer: boolean;
  legalStatus: string;
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
  residence: string;
  residenceCountry: string;
  showContactEmail: boolean;
  /** REV-PROF-05: visibilità del telefono, che resta un contatto privato. */
  showContactPhone: boolean;
  showContactFacebook: boolean;
  showContactInstagram: boolean;
  showContactLinkedIn: boolean;
  showContactTikTok: boolean;
  showContactWebsite: boolean;
  showContactYouTube: boolean;
  showTransferBadge: boolean;
  showRegionsBadge: boolean;
  secondaryPositions: PlayerPosition[];
  specialization: StaffSpecialization;
  staffPrimaryRole: string;
  staffRoles: string;
  staffAvailabilityType: string;
  staffAvailableFrom: string;
  staffPreferredCategories: string;
  staffPreferredProvinces: string;
  technicalVideoUrl: string;
  transferProvinces: string;
  transferRegions: string;
  currentLocationCity: string;
  currentLocationCountry: string;
  domicile: string;
  useResidenceForDomicile: boolean;
  weightKg: string;
  willingToChangeClub: boolean;
  city: string;
  experienceSummary: string;
  openToTrials: boolean;
  playerObjectives: string;
  contractStatus: string;
  contractExpiry: string;
  currentCondition: string;
};

export function buildInitialState(
  data: CompleteProfessionalProfile,
): ProfileFormState {
  const playerProfile = data.playerProfile;
  const coachProfile = data.coachProfile;
  const staffProfile = data.staffProfile;
  const club = data.club;
  const residence = data.profile.residence ?? data.profile.city ?? "";
  const domicile = data.profile.domicile ?? "";

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
    contactLinkedIn: data.userContacts.linkedin ?? "",
    contactPhone: data.userContacts.phone,
    contactTikTok: data.userContacts.tiktok ?? "",
    contactWebsite: data.userContacts.website ?? "",
    contactYouTube: data.userContacts.youtube ?? "",
    coverUrl: data.profile.cover_url ?? "",
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
    coachAvailabilityType: coachProfile?.availability_type ?? "ITALY",
    coachAvailableFrom: coachProfile?.available_from ?? "",
    coachPreferredProvinces: toDelimitedString(coachProfile?.preferred_provinces),
    coachPrimaryRole: coachProfile?.primary_role ?? "",
    coachedCategories: toDelimitedString(coachProfile?.coached_categories),
    coachedClubs: toDelimitedString(coachProfile?.coached_clubs),
    currentLocationCity:
      data.profile.current_location_city ?? data.profile.city ?? "",
    currentLocationCountry: data.profile.current_location_country ?? "",
    domicile,
    experienceSummary: staffProfile?.experience_summary ?? "",
    fullName: data.profile.full_name,
    gamePhilosophy: coachProfile?.game_philosophy ?? "",
    gender: data.profile.gender ?? "",
    heightCm: playerProfile?.height_cm ? String(playerProfile.height_cm) : "",
    highlightVideoUrl: playerProfile?.highlight_video_url ?? "",
    availabilityType: playerProfile?.availability_type ?? "ITALY",
    isOpenToTransfer: data.profile.is_open_to_transfer,
    legalStatus: data.profile.legal_status ?? "",
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
    residence,
    residenceCountry: data.profile.residence_country ?? "",
    showContactEmail: data.userContacts.showEmail,
    showContactPhone: data.userContacts.showPhone ?? false,
    showContactFacebook: data.userContacts.showFacebook,
    showContactInstagram: data.userContacts.showInstagram,
    showContactLinkedIn: data.userContacts.showLinkedIn ?? false,
    showContactTikTok: data.userContacts.showTikTok ?? false,
    showContactWebsite: data.userContacts.showWebsite ?? false,
    showContactYouTube: data.userContacts.showYouTube ?? false,
    showTransferBadge: playerProfile?.show_transfer_badge ?? false,
    showRegionsBadge: playerProfile?.show_regions_badge ?? false,
    secondaryPositions: playerProfile?.secondary_positions ?? [],
    specialization: staffProfile?.specialization ?? "fitness_coach",
    staffPrimaryRole: staffProfile?.primary_staff_role ?? "",
    staffRoles: toDelimitedString(staffProfile?.staff_roles),
    staffAvailabilityType: staffProfile?.availability_type ?? "ITALY",
    staffAvailableFrom: staffProfile?.available_from ?? "",
    staffPreferredCategories: toDelimitedString(staffProfile?.preferred_categories),
    staffPreferredProvinces: toDelimitedString(staffProfile?.preferred_provinces),
    technicalVideoUrl: coachProfile?.technical_video_url ?? "",
    transferProvinces: toDelimitedString(playerProfile?.transfer_provinces),
    transferRegions: toDelimitedString(playerProfile?.transfer_regions),
    useResidenceForDomicile:
      domicile.trim().length === 0 || domicile.trim() === residence.trim(),
    weightKg: playerProfile?.weight_kg ? String(playerProfile.weight_kg) : "",
    willingToChangeClub: playerProfile?.willing_to_change_club ?? false,
    openToTrials: playerProfile?.open_to_trials ?? false,
    playerObjectives: (playerProfile?.player_objectives ?? []).join(", "),
    contractStatus: playerProfile?.contract_status ?? "",
    contractExpiry: playerProfile?.contract_expiry ?? "",
    currentCondition: playerProfile?.current_condition ?? "",
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
  const nationalityCategory = getNationalityCategory(formState.nationality);
  const normalizedResidence = parseOptionalText(formState.residence);
  const normalizedCurrentLocationCity = parseOptionalText(
    formState.currentLocationCity,
  );
  const resolvedCity =
    parseOptionalText(formState.city) ??
    (nationalityCategory === "italy"
      ? normalizedResidence
      : normalizedCurrentLocationCity);
  const resolvedDomicile =
    nationalityCategory === "italy"
      ? parseOptionalText(
          formState.useResidenceForDomicile
            ? formState.residence
            : formState.domicile,
        )
      : null;
  const resolvedStaffRoles = fromDelimitedString(formState.staffRoles);
  const resolvedStaffPrimaryRole =
    parseOptionalText(formState.staffPrimaryRole) ?? resolvedStaffRoles[0] ?? null;
  const resolvedStaffSpecialization = mapStaffRoleToSpecialization(
    resolvedStaffPrimaryRole ?? formState.specialization,
  );
  const normalizedGender =
    formState.gender === "male" ||
    formState.gender === "female" ||
    formState.gender === "non_binary" ||
    formState.gender === "prefer_not_to_say"
      ? formState.gender
      : null;

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
            availability_type: formState.coachAvailabilityType || null,
            available_from: formState.openToNewRole
              ? parseOptionalText(formState.coachAvailableFrom)
              : null,
            coached_categories: fromDelimitedString(
              formState.coachedCategories,
            ),
            coached_clubs: fromDelimitedString(formState.coachedClubs),
            contract_end: data.coachProfile?.contract_end ?? null,
            current_club: data.coachProfile?.current_club ?? null,
            game_philosophy: parseOptionalText(formState.gamePhilosophy),
            licenses: fromDelimitedString(formState.licenses),
            media_items: data.coachProfile?.media_items ?? [],
            open_to_new_role: formState.openToNewRole,
            play_styles: data.coachProfile?.play_styles ?? [],
            preferred_categories: data.coachProfile?.preferred_categories ?? [],
            preferred_formation: data.coachProfile?.preferred_formation ?? null,
            preferred_provinces: fromDelimitedString(
              formState.coachPreferredProvinces,
            ),
            preferred_regions: fromDelimitedString(
              formState.preferredRegions,
            ),
            primary_role: parseOptionalText(formState.coachPrimaryRole),
            secondary_formations: data.coachProfile?.secondary_formations ?? [],
            technical_video_url: parseOptionalText(
              formState.technicalVideoUrl,
            ),
          }
        : null,
    coachCareerEntries:
      data.profile.role === "coach" ? data.coachCareerEntries : [],
    coachDirectorCareerEntries:
      data.profile.role === "coach" ? data.coachDirectorCareerEntries : [],
    coachPlayerCareerEntries:
      data.profile.role === "coach" ? data.coachPlayerCareerEntries : [],
    /*
      Le tre carriere dello Staff tecnico vanno ripassate anche quando non è
      questa la sezione che si sta salvando: save_staff_career_details cancella
      tutto ciò che non trova nel payload, quindi ometterle azzererebbe la
      carriera a ogni salvataggio di un'altra sezione (REV-PROF-07).
    */
    staffCareerEntries:
      data.profile.role === "staff" ? data.staffCareerEntries : [],
    staffCoachCareerEntries:
      data.profile.role === "staff" ? data.staffCoachCareerEntries : [],
    staffPlayerCareerEntries:
      data.profile.role === "staff" ? data.staffPlayerCareerEntries : [],
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
            media_items: data.playerProfile?.media_items ?? [],
            media_urls: data.playerProfile?.media_urls ?? [],
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
            show_transfer_badge: formState.showTransferBadge,
            show_regions_badge: formState.showRegionsBadge,
            open_to_trials: formState.openToTrials,
            player_objectives: formState.playerObjectives
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            contract_status: formState.contractStatus || null,
            contract_expiry: formState.contractExpiry || null,
            current_condition: formState.currentCondition || null,
          }
        : null,
    profile: {
      avatar_url: parseOptionalText(formState.avatarUrl),
      bio: parseOptionalText(formState.bio),
      birth_date: null, // Must be set by the calling modal after validation
      city: resolvedCity,
      cover_url: parseOptionalText(formState.coverUrl),
      current_location_city:
        nationalityCategory === "italy" ? null : normalizedCurrentLocationCity,
      current_location_country:
        nationalityCategory === "italy"
          ? null
          : parseOptionalText(formState.currentLocationCountry),
      domicile: resolvedDomicile,
      full_name: formState.fullName.trim(),
      gender: normalizedGender,
      is_open_to_transfer: formState.isOpenToTransfer,
      legal_status:
        nationalityCategory === "non_eu"
          ? parseOptionalText(formState.legalStatus)
          : null,
      languages: fromDelimitedString(formState.languages),
      nationality: parseOptionalText(formState.nationality),
      region: parseOptionalText(formState.region),
      residence: nationalityCategory === "italy" ? normalizedResidence : null,
      residence_country:
        nationalityCategory === "italy"
          ? null
          : parseOptionalText(formState.residenceCountry),
    },
    profileId: data.profile.id,
    role: data.profile.role,
    staffProfile:
      data.profile.role === "staff"
        ? {
            availability_type: formState.staffAvailabilityType || null,
            available_from: parseOptionalText(formState.staffAvailableFrom),
            certifications: fromDelimitedString(formState.certifications),
            experience_entries: data.staffProfile?.experience_entries ?? [],
            experience_summary: parseOptionalText(
              formState.experienceSummary,
            ),
            open_to_work: formState.openToWork,
            primary_staff_role: resolvedStaffPrimaryRole,
            preferred_categories: fromDelimitedString(
              formState.staffPreferredCategories,
            ),
            preferred_provinces: fromDelimitedString(
              formState.staffPreferredProvinces,
            ),
            preferred_regions: fromDelimitedString(
              formState.preferredRegions,
            ),
            specialization: resolvedStaffSpecialization,
            staff_roles: resolvedStaffRoles,
          }
        : null,
    /*
      Tutti e sei i canali, non tre: updateCompleteProfessionalProfile riscrive
      l intera riga di profile_contacts, quindi un canale assente qui non resta
      com era — viene azzerato insieme al suo flag di visibilita.
    */
    userContacts: {
      email: formState.contactEmail.trim().toLowerCase(),
      facebook: formState.contactFacebook.trim(),
      instagram: formState.contactInstagram.trim(),
      linkedin: formState.contactLinkedIn.trim(),
      phone: formState.contactPhone.trim(),
      tiktok: formState.contactTikTok.trim(),
      website: formState.contactWebsite.trim(),
      youtube: formState.contactYouTube.trim(),
      showEmail: formState.showContactEmail,
      showPhone: formState.showContactPhone,
      showFacebook: formState.showContactFacebook,
      showInstagram: formState.showContactInstagram,
      showLinkedIn: formState.showContactLinkedIn,
      showTikTok: formState.showContactTikTok,
      showWebsite: formState.showContactWebsite,
      showYouTube: formState.showContactYouTube,
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
    data.profile.city ?? data.profile.residence ?? data.profile.current_location_city,
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
        data.staffProfile?.open_to_work ? "Disponibile" : "Profilo attivo",
      ],
      fullName,
      primaryMeta,
      secondaryMeta: `${data.staffProfile?.primary_staff_role ?? formatSpecialization(data.staffProfile?.specialization ?? null)} · ${
        data.staffProfile?.preferred_regions?.[0] ?? "Area da definire"
      }`,
    };
  }

  if (data.profile.role === "director") {
    const primaryRole =
      data.directorProfile?.primary_role?.trim() ||
      data.directorProfile?.director_roles?.[0]?.trim() ||
      "Dirigente";
    const focus = data.directorProfile?.main_focus?.trim();

    return {
      badges: [roleBadge],
      fullName,
      primaryMeta,
      secondaryMeta: focus ? `${primaryRole} - ${focus}` : primaryRole,
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

export type PlayerProfileHeaderDetails = {
  /** Riga discreta di disponibilità dell'header (REV-PROF-01 §7). */
  availabilityLabel?: string;
  bio: string | null;
  clubLabel?: string;
  fullName: string;
  locationLabel?: string;
  primaryRole: string;
  /** Età, Altezza, Peso, Piede — senza icone, con unità separata (§9). */
  quickFacts: ProfileQuickFact[];
  secondaryRole?: string;
};

/**
 * Informazioni rapide del Calciatore (§9).
 *
 * Un dato mancante non diventa zero e non diventa un "Non specificato" grande:
 * mostra un trattino e lascia la riga in equilibrio.
 */
function buildPlayerQuickFacts(
  data: CompleteProfessionalProfile,
  age: number | null,
): ProfileQuickFact[] {
  const heightCm = data.playerProfile?.height_cm ?? null;
  const weightKg = data.playerProfile?.weight_kg ?? null;
  const foot = data.playerProfile?.preferred_foot ?? null;
  const footLabel = foot ? getPreferredFootLabel(foot) : null;

  return [
    {
      accessibilityLabel: age ? `Età, ${age} anni` : "Età non indicata",
      key: "age",
      label: "Età",
      value: age ? String(age) : "—",
    },
    {
      accessibilityLabel: heightCm
        ? `Altezza, ${heightCm} centimetri`
        : "Altezza non indicata",
      key: "height",
      label: "Altezza",
      ...(heightCm ? { unit: "cm" } : {}),
      value: heightCm ? String(heightCm) : "—",
    },
    {
      accessibilityLabel: weightKg
        ? `Peso, ${weightKg} chilogrammi`
        : "Peso non indicato",
      key: "weight",
      label: "Peso",
      ...(weightKg ? { unit: "kg" } : {}),
      value: weightKg ? String(weightKg) : "—",
    },
    {
      accessibilityLabel: footLabel
        ? `Piede, ${footLabel.toLowerCase()}`
        : "Piede non indicato",
      key: "foot",
      label: "Piede",
      value: footLabel ?? "—",
    },
  ];
}

/**
 * Dati dell'header del Master Profile Allenatore (REV-PROF-03).
 *
 * Stessa forma dei dati del Calciatore: identita, una riga societa/categoria,
 * una riga localita, la disponibilita e quattro informazioni rapide. Patentino
 * e disponibilita compaiono qui una volta sola e non vengono ripetuti in
 * Dettagli sotto altro nome.
 */
export type CoachProfileHeaderDetails = {
  availabilityLabel?: string;
  /** "Torino FC · Prima Squadra", dall'incarico in corso. */
  clubLabel?: string;
  fullName: string;
  isVerified: boolean;
  locationLabel?: string;
  primaryRole: string;
  quickFacts: ProfileQuickFact[];
};

/**
 * Header del Master Profile Procuratore (REV-PROF-13, Screen 1).
 *
 * Stessa forma di `StaffProfileHeaderDetails`, perché l'header è lo stesso
 * componente condiviso: cambia solo da dove arrivano ruolo, organizzazione
 * attuale e disponibilità. In più c'è la pill della licenza, che gli altri
 * ruoli non hanno.
 */
export type AgentProfileHeaderDetails = StaffProfileHeaderDetails & {
  /** Pill "Licenza FIGC (Italia)", costruita dai dati o assente. */
  badges: ProfileHeroBadge[];
};

export function buildPlayerProfileHeaderDetails(
  data: CompleteProfessionalProfile,
): PlayerProfileHeaderDetails | null {
  if (data.profile.role !== "player") {
    return null;
  }

  const age = data.profile.age ?? calculateAge(data.profile.birth_date);
  const primaryRole = getPlayerPositionLabel(
    data.playerProfile?.primary_position ?? DEFAULT_PLAYER_PRIMARY_POSITION,
  );
  const secondaryRole = getPlayerPositionLabels(
    data.playerProfile?.secondary_positions,
  ).find((label) => label !== primaryRole);
  // Squadra e categoria attuali vengono dall'esperienza che copre la stagione
  // in corso, non dall'ultima riga salvata: se nessuna è in corso la riga non
  // compare, invece di indovinare una società (§7).
  const currentExperience = buildPlayerCareerView(
    data.playerCareerEntries.map((entry) => toPlayerExperienceForm(entry)),
  ).experiences.find((experience) => experience.isCurrent);
  const clubLabel = [
    currentExperience?.clubName.trim(),
    currentExperience?.seasons[0]?.category.trim(),
  ]
    .filter(Boolean)
    .join(" · ");
  const locationLabel = formatLocationSummary(
    data.profile.city ?? data.profile.residence ?? data.profile.current_location_city,
    data.profile.region,
  );
  const isAvailable = Boolean(
    data.profile.is_open_to_transfer ||
      data.playerProfile?.willing_to_change_club,
  );
  // Lo stato contrattuale è un dato del profilo, non qualcosa da dedurre
  // dall'ultima esperienza salvata (§7, §28).
  const contractStatus =
    data.playerProfile?.contract_status === "tesserato"
      ? "Sotto contratto"
      : data.playerProfile?.contract_status === "svincolato"
        ? "Svincolato"
        : null;
  const availabilityLabel =
    [isAvailable ? "Disponibile al trasferimento" : null, contractStatus]
      .filter(Boolean)
      .join(" · ") || undefined;

  return {
    availabilityLabel,
    bio: data.profile.bio?.trim() || null,
    clubLabel: clubLabel || undefined,
    fullName: formatProfileDisplayName(data.profile.full_name, null),
    locationLabel: locationLabel === "Da completare" ? undefined : locationLabel,
    primaryRole,
    quickFacts: buildPlayerQuickFacts(data, age),
    secondaryRole,
  };
}

export function buildCoachProfileHeaderDetails(
  data: CompleteProfessionalProfile,
): CoachProfileHeaderDetails | null {
  if (data.profile.role !== "coach") {
    return null;
  }

  const roleTypeLabel = roleLabels.coach;
  // Societa, ruolo e categoria vengono dall'incarico in corso, non da un
  // secondo set di campi e non dall'ultima riga salvata: se nessun incarico e
  // in corso la riga non compare, invece di indovinare una societa.
  const careerView = buildCoachCareerView(data.coachCareerEntries ?? []);
  const currentExperience = getCurrentCoachExperience(careerView);

  const locationSummary = formatLocationSummary(
    data.profile.city ??
      data.profile.residence ??
      data.profile.current_location_city ??
      data.profile.domicile,
    data.profile.region,
  );
  const locationLabel =
    locationSummary === "Da completare" ? undefined : locationSummary;

  const primaryRole =
    currentExperience?.role?.trim() ||
    data.coachProfile?.primary_role?.trim() ||
    roleTypeLabel;
  const clubLabel =
    [currentExperience?.clubName.trim(), currentExperience?.category.trim()]
      .filter(Boolean)
      .join(" · ") || undefined;

  const age = data.profile.age ?? calculateAge(data.profile.birth_date);
  const licenseLabel = data.coachProfile?.licenses?.[0]?.trim() || null;
  const formation = data.coachProfile?.preferred_formation?.trim() || null;

  return {
    availabilityLabel: data.coachProfile?.open_to_new_role
      ? "Disponibile per una nuova squadra"
      : undefined,
    clubLabel,
    fullName: formatProfileDisplayName(data.profile.full_name, null),
    /*
      Il prodotto non ha ancora una verifica per i profili personali: nessuna
      colonna la esprime, quindi il badge non viene mai acceso. Il giorno in cui
      il dato esiste, questa e l'unica riga da cambiare.
    */
    isVerified: false,
    locationLabel,
    primaryRole,
    quickFacts: buildCoachQuickFacts({
      age,
      licenseLabel,
      formation,
      seasonCount: careerView.seasonCount,
    }),
  };
}

/**
 * Quattro colonne, sempre le stesse e sempre quattro: Eta, Patentino, Stagioni
 * e Modulo (REV-PROF-03). Un dato mancante mostra un trattino e lascia la riga
 * in equilibrio, invece di far collassare la colonna.
 */
function buildCoachQuickFacts({
  age,
  formation,
  licenseLabel,
  seasonCount,
}: {
  age: number | null;
  formation: string | null;
  licenseLabel: string | null;
  seasonCount: number;
}): ProfileQuickFact[] {
  return [
    {
      accessibilityLabel: age ? `Eta, ${age} anni` : "Eta non indicata",
      key: "age",
      label: "Eta",
      value: age ? String(age) : "—",
    },
    {
      accessibilityLabel: licenseLabel
        ? `Patentino, ${licenseLabel}`
        : "Patentino non indicato",
      key: "license",
      label: "Patentino",
      value: licenseLabel ?? "—",
    },
    {
      accessibilityLabel:
        seasonCount > 0
          ? `Stagioni, ${seasonCount}`
          : "Stagioni non disponibili",
      key: "seasons",
      label: "Stagioni",
      value: seasonCount > 0 ? String(seasonCount) : "—",
    },
    {
      accessibilityLabel: formation
        ? `Modulo, ${formation}`
        : "Modulo non indicato",
      key: "formation",
      label: "Modulo",
      value: formation ?? "—",
    },
  ];
}

/**
 * Header del Master Profile Procuratore (REV-PROF-13, Screen 1).
 *
 * Agenzia e ruolo non vengono più da `agent_profiles.agency_name` /
 * `agency_role`: vengono dall'incarico in corso della carriera, la stessa
 * fonte che alimenta "Situazione attuale" nei Dettagli. Se nessun incarico è
 * in corso la riga non compare, invece di promuovere l'ultima esperienza
 * salvata a situazione di oggi.
 */
export function buildAgentProfileHeaderDetails(
  data: CompleteProfessionalProfile,
  /**
   * Assistiti pubblici già contati dalla proiezione pubblica del portfolio.
   * È un parametro e non una derivazione locale perché il numero deve
   * coincidere con l'elenco mostrato, che arriva dal backend.
   */
  publicAssistitiCount: number | null = null,
): AgentProfileHeaderDetails | null {
  if (data.profile.role !== "agent") {
    return null;
  }

  const career = buildAgentProfileCareer({
    agentCareerEntries: data.agentCareerEntries,
    agentProfile: data.agentProfile,
  });

  const locationSummary = formatLocationSummary(
    data.profile.city ??
      data.profile.residence ??
      data.profile.current_location_city ??
      data.profile.domicile,
    data.profile.region,
  );
  const locationLabel =
    locationSummary === "Da completare" ? undefined : locationSummary;

  /*
    La riga che per Allenatore e Dirigente porta la società qui porta
    l'organizzazione: è lo stesso fatto — dove lavora oggi questa persona — e
    un indipendente la riempie con la propria modalità di lavoro, non con un
    nome vuoto.
  */
  const clubLabel = career.currentExperience
    ? [
        formatAgentOrganizationLabel(career.currentExperience),
        career.currentExperience.role,
      ]
        .filter(Boolean)
        .join(" · ")
    : undefined;

  const licenseLabel = buildAgentLicenseLabel({
    federation: data.agentProfile?.federation,
    isLicensed: data.agentProfile?.is_federation_licensed,
    showFederation: data.agentProfile?.show_federation,
  });

  /*
    Una sola disponibilità nell'header, per priorità (§"Disponibilità"):
    prima le richieste di rappresentanza, poi la collaborazione con i club. Il
    dettaglio completo resta nei Dettagli, dove c'è spazio per entrambe.
  */
  const availabilityLabel = data.agentProfile?.open_to_players
    ? "Aperto a nuove rappresentanze"
    : data.agentProfile?.open_to_clubs
      ? "Disponibile a collaborare con club"
      : undefined;

  return {
    availabilityLabel,
    badges: licenseLabel
      ? [
          {
            icon: "shield-checkmark-outline" as const,
            key: "license",
            label: licenseLabel,
          },
        ]
      : [],
    clubLabel,
    fullName: formatProfileDisplayName(data.profile.full_name, null),
    /*
      Il prodotto non ha ancora una verifica per i profili personali, e una
      licenza non è una verifica d'identità: il badge resta spento finché una
      colonna non lo accende davvero.
    */
    isVerified: false,
    locationLabel,
    /** Denominazione approvata, indipendente dall'enum `agent` del modello. */
    primaryRole: "Procuratore sportivo",
    quickFacts: buildAgentQuickFacts({
      activityYears: career.activityYears,
      age: data.profile.age ?? calculateAge(data.profile.birth_date),
      assistitiCount: publicAssistitiCount,
      marketCount: career.marketCount,
    }),
  };
}

/**
 * Età, Assistiti, Mercati e Anni (REV-PROF-13 §"Informazioni rapide").
 *
 * Come per il Dirigente un dato che non c'è non diventa un trattino: la
 * colonna sparisce e le altre si ridistribuiscono. Un'età non pubblica e un
 * portfolio vuoto non devono raccontare la stessa cosa di uno zero.
 */
function buildAgentQuickFacts({
  activityYears,
  age,
  assistitiCount,
  marketCount,
}: {
  activityYears: number | null;
  age: number | null;
  assistitiCount: number | null;
  marketCount: number;
}): ProfileQuickFact[] {
  return [
    age
      ? {
          accessibilityLabel: `Eta, ${age} anni`,
          key: "age",
          label: "Eta",
          value: String(age),
        }
      : null,
    assistitiCount !== null && assistitiCount > 0
      ? {
          accessibilityLabel:
            assistitiCount === 1 ? "1 assistito" : `${assistitiCount} assistiti`,
          key: "assistiti",
          label: "Assistiti",
          value: String(assistitiCount),
        }
      : null,
    marketCount > 0
      ? {
          accessibilityLabel:
            marketCount === 1 ? "1 mercato" : `${marketCount} mercati`,
          key: "markets",
          label: "Mercati",
          value: String(marketCount),
        }
      : null,
    activityYears !== null
      ? {
          accessibilityLabel:
            activityYears === 1
              ? "1 anno di attivita"
              : `${activityYears} anni di attivita`,
          key: "years",
          label: "Anni",
          value: String(activityYears),
        }
      : null,
  ].filter((fact): fact is ProfileQuickFact => fact !== null);
}

/**
 * Header del Master Profile Staff tecnico (REV-PROF-06, Screen 1).
 *
 * Stessa forma di `CoachProfileHeaderDetails`, perché l'header è lo stesso.
 */
export type StaffProfileHeaderDetails = {
  availabilityLabel?: string;
  /** "AC Milan · Serie A", dall'incarico in corso. */
  clubLabel?: string;
  fullName: string;
  isVerified: boolean;
  locationLabel?: string;
  primaryRole: string;
  quickFacts: ProfileQuickFact[];
};

export function buildStaffProfileHeaderDetails(
  data: CompleteProfessionalProfile,
): StaffProfileHeaderDetails | null {
  if (data.profile.role !== "staff") {
    return null;
  }

  // Societa e categoria vengono dall'incarico in corso, non da un secondo set
  // di campi e non dall'ultima riga salvata: se nessun incarico e in corso la
  // riga non compare, invece di indovinare una societa.
  const career = buildStaffProfileCareer({
    coachEntries: data.staffCoachCareerEntries,
    playerEntries: data.staffPlayerCareerEntries,
    staffEntries: data.staffCareerEntries,
  });

  const locationSummary = formatLocationSummary(
    data.profile.city ??
      data.profile.residence ??
      data.profile.current_location_city ??
      data.profile.domicile,
    data.profile.region,
  );
  const locationLabel =
    locationSummary === "Da completare" ? undefined : locationSummary;

  /*
    Il ruolo principale e quello dichiarato dall'utente: e il suo
    posizionamento professionale, non l'ultimo incarico ricoperto. Un'esperienza
    piu recente con un altro ruolo non lo sostituisce mai.
  */
  const primaryRole =
    data.staffProfile?.primary_staff_role?.trim() ||
    formatSpecialization(data.staffProfile?.specialization ?? null) ||
    "Staff tecnico";

  const clubLabel =
    [
      career.currentExperience?.clubName.trim(),
      career.currentExperience?.category.trim(),
    ]
      .filter(Boolean)
      .join(" · ") || undefined;

  return {
    // Disponibilita spenta: la riga sparisce del tutto, non diventa uno stato
    // negativo e non si porta dietro zone o date.
    availabilityLabel: data.staffProfile?.open_to_work
      ? "Disponibile per nuove collaborazioni"
      : undefined,
    clubLabel,
    fullName: formatProfileDisplayName(data.profile.full_name, null),
    /*
      Il prodotto non ha ancora una verifica per i profili personali: nessuna
      colonna la esprime, quindi il badge non viene mai acceso. Il giorno in cui
      il dato esiste, questa e l'unica riga da cambiare.
    */
    isVerified: false,
    locationLabel,
    primaryRole,
    quickFacts: buildStaffQuickFacts({
      age: data.profile.age ?? calculateAge(data.profile.birth_date),
      clubCount: career.clubCount,
      roleCount: collectStaffRoles(
        data.staffProfile?.primary_staff_role,
        data.staffProfile?.staff_roles,
      ).length,
      seasonCount: career.staff.seasonCount,
    }),
  };
}

/**
 * Quattro colonne, sempre le stesse e sempre quattro: Eta, Ruoli, Stagioni e
 * Club (REV-PROF-06 §"Info rapide"). Nessun valore e memorizzato: ognuno viene
 * ricalcolato dai record canonici a ogni render del profilo.
 */
function buildStaffQuickFacts({
  age,
  clubCount,
  roleCount,
  seasonCount,
}: {
  age: number | null;
  clubCount: number;
  roleCount: number;
  seasonCount: number;
}): ProfileQuickFact[] {
  return [
    {
      accessibilityLabel: age ? `Eta, ${age} anni` : "Eta non indicata",
      key: "age",
      label: "Eta",
      value: age ? String(age) : "—",
    },
    {
      accessibilityLabel:
        roleCount === 1 ? "1 ruolo tecnico" : `${roleCount} ruoli tecnici`,
      key: "roles",
      label: "Ruoli",
      value: String(roleCount),
    },
    {
      accessibilityLabel:
        seasonCount === 1 ? "1 stagione" : `${seasonCount} stagioni`,
      key: "seasons",
      label: "Stagioni",
      value: String(seasonCount),
    },
    {
      accessibilityLabel:
        clubCount === 1 ? "1 societa" : `${clubCount} societa`,
      key: "clubs",
      label: "Club",
      value: String(clubCount),
    },
  ];
}

/**
 * Header del Master Profile Dirigente (REV-PROF-09, Screen 1).
 *
 * Stessa forma di `StaffProfileHeaderDetails`, perche l'header e lo stesso
 * componente condiviso: cambia solo da dove arrivano ruolo, societa attuale e
 * disponibilita.
 */
export type DirectorProfileHeaderDetails = StaffProfileHeaderDetails;

export function buildDirectorProfileHeaderDetails(
  data: CompleteProfessionalProfile,
): DirectorProfileHeaderDetails | null {
  if (data.profile.role !== "director") {
    return null;
  }

  // Societa e categoria vengono dall'incarico in corso, non da un secondo set
  // di campi e non dall'ultima riga salvata: se nessun incarico e in corso la
  // riga non compare, invece di indovinare una societa.
  const career = buildDirectorProfileCareer({
    directorProfile: data.directorProfile,
  });

  const locationSummary = formatLocationSummary(
    data.profile.city ??
      data.profile.residence ??
      data.profile.current_location_city ??
      data.profile.domicile,
    data.profile.region,
  );
  const locationLabel =
    locationSummary === "Da completare" ? undefined : locationSummary;

  const clubLabel =
    [
      career.currentExperience?.clubName.trim(),
      career.currentExperience?.category.trim(),
    ]
      .filter(Boolean)
      .join(" · ") || undefined;

  /*
    Due condizioni, non una (REV-PROF-11): l'interruttore di disponibilita e
    almeno un destinatario. Spegnere l'interruttore non cancella i destinatari
    — si ritrovano riaccendendolo — quindi da solo il secondo dato non basta
    piu a dire se il profilo e disponibile. I destinatari restano nei
    Dettagli: l'header dice che c'e disponibilita, non per chi.
  */
  const isOpenToOpportunities = Boolean(
    data.directorProfile?.open_to_work &&
      (data.directorProfile?.open_to_clubs ||
        data.directorProfile?.open_to_staff ||
        data.directorProfile?.open_to_players ||
        data.directorProfile?.open_to_others),
  );

  return {
    availabilityLabel: isOpenToOpportunities
      ? "Disponibile per nuove opportunita"
      : undefined,
    clubLabel,
    fullName: formatProfileDisplayName(data.profile.full_name, null),
    /*
      Il prodotto non ha ancora una verifica per i profili personali: nessuna
      colonna la esprime, quindi il badge non viene mai acceso. Il giorno in cui
      il dato esiste, questa e l'unica riga da cambiare.
    */
    isVerified: false,
    locationLabel,
    primaryRole: resolveDirectorPrimaryRole(data.directorProfile),
    quickFacts: buildDirectorQuickFacts({
      age: data.profile.age ?? calculateAge(data.profile.birth_date),
      clubCount: career.clubCount,
      roleCount: career.roleCount,
      seasonCount: career.director.seasonCount,
    }),
  };
}

/**
 * Eta, Ruoli, Stagioni e Club (REV-PROF-09 §"Informazioni rapide").
 *
 * A differenza degli altri Master Profile un dato che non c'e non diventa un
 * trattino: la colonna sparisce e le altre si ridistribuiscono, perche un "—"
 * al posto di un'eta non pubblica racconterebbe un dato mancante invece di un
 * dato riservato. Nessun valore e memorizzato: ognuno viene ricalcolato dai
 * record canonici a ogni render del profilo.
 */
function buildDirectorQuickFacts({
  age,
  clubCount,
  roleCount,
  seasonCount,
}: {
  age: number | null;
  clubCount: number;
  roleCount: number;
  seasonCount: number;
}): ProfileQuickFact[] {
  return [
    age
      ? {
          accessibilityLabel: `Eta, ${age} anni`,
          key: "age",
          label: "Eta",
          value: String(age),
        }
      : null,
    roleCount > 0
      ? {
          accessibilityLabel:
            roleCount === 1
              ? "1 ruolo dirigenziale"
              : `${roleCount} ruoli dirigenziali`,
          key: "roles",
          label: "Ruoli",
          value: String(roleCount),
        }
      : null,
    seasonCount > 0
      ? {
          accessibilityLabel:
            seasonCount === 1 ? "1 stagione" : `${seasonCount} stagioni`,
          key: "seasons",
          label: "Stagioni",
          value: String(seasonCount),
        }
      : null,
    clubCount > 0
      ? {
          accessibilityLabel:
            clubCount === 1 ? "1 societa" : `${clubCount} societa`,
          key: "clubs",
          label: "Club",
          value: String(clubCount),
        }
      : null,
  ].filter((fact): fact is ProfileQuickFact => fact !== null);
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
