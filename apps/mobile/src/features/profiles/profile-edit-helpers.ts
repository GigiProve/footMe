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
  fan: "Appassionato",
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
  showContactFacebook: boolean;
  showContactInstagram: boolean;
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
    showContactFacebook: data.userContacts.showFacebook,
    showContactInstagram: data.userContacts.showInstagram,
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
  ageLabel: string;
  availabilityBadges: string[];
  bio: string | null;
  clubLabel?: string;
  fullName: string;
  heightLabel: string;
  locationLabel?: string;
  preferredFootLabel: string;
  primaryRole: string;
  regionBadges: string[];
  secondaryRole?: string;
  statusBadge?: string;
  weightLabel: string;
};

export type CoachProfileHeaderDetails = {
  availabilityBadges: string[];
  bio: string | null;
  categoryLabel?: string;
  fullName: string;
  licenseBadges: string[];
  locationLabel?: string;
  primaryRole: string;
  statusBadge?: string;
  teamLabel?: string;
};

export type AgentProfileHeaderDetails = {
  agencyLabel?: string;
  bio: string | null;
  fullName: string;
  locationLabel?: string;
  primaryRole: string;
  statusBadge?: string;
};

export function buildPlayerProfileHeaderDetails(
  data: CompleteProfessionalProfile,
): PlayerProfileHeaderDetails | null {
  if (data.profile.role !== "player") {
    return null;
  }

  const age = data.profile.age ?? calculateAge(data.profile.birth_date);
  const latestEntry = getLatestPlayerExperience(
    data.playerCareerEntries.map((entry) => toPlayerExperienceForm(entry)),
  );
  const primaryRole = getPlayerPositionLabel(
    data.playerProfile?.primary_position ?? DEFAULT_PLAYER_PRIMARY_POSITION,
  );
  const secondaryRole = getPlayerPositionLabels(
    data.playerProfile?.secondary_positions,
  ).find((label) => label !== primaryRole);
  const clubLabel = [latestEntry?.clubName?.trim(), latestEntry?.category?.trim()]
    .filter(Boolean)
    .join(" · ");
  const locationLabel = formatLocationSummary(
    data.profile.city ?? data.profile.residence ?? data.profile.current_location_city,
    data.profile.region,
  );
  const isAvailable =
    data.profile.is_open_to_transfer ||
    data.playerProfile?.willing_to_change_club;
  const availabilityBadges = [
    latestEntry?.clubName?.trim() ? "Sotto contratto" : "Svincolato",
    isAvailable ? "Disponibile al trasferimento" : "In valutazione",
  ];

  return {
    ageLabel: age ? `${age} anni` : "Da definire",
    availabilityBadges,
    bio: data.profile.bio?.trim() || null,
    clubLabel: clubLabel || undefined,
    fullName: formatProfileDisplayName(data.profile.full_name, null),
    heightLabel: data.playerProfile?.height_cm
      ? `${data.playerProfile.height_cm} cm`
      : "Da definire",
    locationLabel: locationLabel === "Da completare" ? undefined : locationLabel,
    preferredFootLabel: getPreferredFootLabel(
      data.playerProfile?.preferred_foot,
      "Da definire",
    ),
    primaryRole,
    regionBadges: data.playerProfile?.show_regions_badge
      ? (data.playerProfile?.transfer_regions?.filter(Boolean) ?? [])
      : [],
    secondaryRole,
    statusBadge:
      data.playerProfile?.show_transfer_badge && isAvailable
        ? "Disponibile al trasferimento"
        : undefined,
    weightLabel: data.playerProfile?.weight_kg
      ? `${data.playerProfile.weight_kg} kg`
      : "Da definire",
  };
}

export function buildCoachProfileHeaderDetails(
  data: CompleteProfessionalProfile,
): CoachProfileHeaderDetails | null {
  if (data.profile.role !== "coach") {
    return null;
  }

  const latestEntry = data.coachCareerEntries[0];
  const locationLabel = formatLocationSummary(
    data.profile.city,
    data.profile.region,
  );
  const availabilityBadges =
    data.coachProfile?.availability_type === "REGIONS"
      ? data.coachProfile.preferred_regions
      : data.coachProfile?.availability_type === "PROVINCES"
        ? data.coachProfile.preferred_provinces
        : data.coachProfile?.open_to_new_role
          ? ["Tutta Italia"]
          : [];

  return {
    availabilityBadges,
    bio: data.profile.bio?.trim() || null,
    categoryLabel: latestEntry?.category ?? data.coachProfile?.coached_categories?.[0] ?? undefined,
    fullName: formatProfileDisplayName(data.profile.full_name, null),
    licenseBadges: data.coachProfile?.licenses ?? [],
    locationLabel: locationLabel === "Da completare" ? undefined : locationLabel,
    primaryRole:
      latestEntry?.role?.trim() ||
      data.coachProfile?.primary_role?.trim() ||
      "Allenatore",
    statusBadge: data.coachProfile?.open_to_new_role
      ? "Disponibile per nuove panchine"
      : undefined,
    teamLabel: latestEntry?.team_name?.trim() || data.coachProfile?.coached_clubs?.[0] || undefined,
  };
}

export function buildAgentProfileHeaderDetails(
  data: CompleteProfessionalProfile,
): AgentProfileHeaderDetails | null {
  if (data.profile.role !== "agent") {
    return null;
  }

  const locationLabel = formatLocationSummary(
    data.profile.city ?? data.profile.residence ?? data.profile.current_location_city,
    data.profile.region,
  );
  const federation = data.agentProfile?.federation?.trim();

  return {
    agencyLabel: data.agentProfile?.agency_name?.trim() || undefined,
    bio: data.profile.bio?.trim() || null,
    fullName: formatProfileDisplayName(data.profile.full_name, null),
    locationLabel: locationLabel === "Da completare" ? undefined : locationLabel,
    primaryRole: data.agentProfile?.agency_role?.trim() || "Agente sportivo",
    statusBadge: data.agentProfile?.is_federation_licensed
      ? federation
        ? `Licenza ${federation}`
        : "Agente verificato"
      : undefined,
  };
}

export type StaffProfileHeaderDetails = {
  availabilityBadges: string[];
  bio: string | null;
  fullName: string;
  locationLabel?: string;
  primaryRole: string;
  statusBadge?: string;
};

export function buildStaffProfileHeaderDetails(
  data: CompleteProfessionalProfile,
): StaffProfileHeaderDetails | null {
  if (data.profile.role !== "staff") {
    return null;
  }

  const locationLabel = formatLocationSummary(
    data.profile.city ?? data.profile.residence ?? data.profile.current_location_city,
    data.profile.region,
  );
  const availabilityBadges =
    data.staffProfile?.availability_type === "REGIONS"
      ? data.staffProfile.preferred_regions
      : data.staffProfile?.availability_type === "PROVINCES"
        ? data.staffProfile.preferred_provinces ?? []
        : data.staffProfile?.open_to_work
          ? ["Tutta Italia"]
          : [];

  return {
    availabilityBadges,
    bio: data.profile.bio?.trim() || null,
    fullName: formatProfileDisplayName(data.profile.full_name, null),
    locationLabel: locationLabel === "Da completare" ? undefined : locationLabel,
    primaryRole:
      data.staffProfile?.primary_staff_role?.trim() ||
      formatSpecialization(data.staffProfile?.specialization ?? null) ||
      "Staff tecnico",
    statusBadge: data.staffProfile?.open_to_work ? "Disponibile" : undefined,
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
