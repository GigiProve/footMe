import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import { DatePickerField } from "../../src/components/ui/date-picker-field";
import { KeyboardAwareForm } from "../../src/components/ui/keyboard-aware-form";
import { MediaPickerField } from "../../src/components/ui/media-picker-field";
import { NationalityAutocompleteInput } from "../../src/components/ui/nationality-autocomplete-input";
import { PhoneInputWithCountryCode } from "../../src/components/ui/phone-input-with-country-code";
import { ResidenceCityInput } from "../../src/components/ui/residence-city-input";
import { SelectField } from "../../src/components/ui/select-field";
import { useSession } from "../../src/features/auth/use-session";
import {
  createInitialProfile,
  BaseProfileValidationError,
  type AppRole,
  type ProfileGender,
  type CreateInitialProfileInput,
} from "../../src/features/onboarding/create-initial-profile";
import {
  coerceOnboardingStep,
  getEffectiveDomicile,
  getOnboardingFullName,
  getNextOnboardingStep,
  getOnboardingProgress,
  getOnboardingVisibleSteps,
  getPreviousOnboardingStep,
  validateOnboardingStep,
  type LegalStatus,
  type OnboardingStep,
  type OnboardingValidationErrors,
} from "../../src/features/onboarding/onboarding-form";
import {
  OnboardingSectionCard,
} from "../../src/features/onboarding/onboarding-ui";
import {
  getOnboardingCounter,
  InlineError,
  OnboardingCompletion,
  OnboardingHeader,
  PhotoPicker,
  PhotoTips,
  RoleCard,
  SegmentedSelector,
  onboardingLayout,
} from "../../src/features/onboarding/ui";
import {
  isPlayerMasterStep,
  PlayerOnboardingFlow,
  trackPlayerOnboardingEvent,
} from "../../src/features/onboarding/player";
import {
  ClubOnboardingFlow,
  isClubMasterStep,
  normalizeClubChannelValue,
  trackClubOnboardingEvent,
  type ClubStructure,
} from "../../src/features/onboarding/club";
import { ONBOARDING_ROLE_OPTIONS } from "../../src/features/onboarding/onboarding-roles";
import { useOnboardingForm } from "../../src/features/onboarding/onboarding-form-provider";
import { CareerExperienceStep } from "../../src/features/onboarding/career/CareerExperienceStep";
import { AgentAgencyStep } from "../../src/features/onboarding/agent/AgentAgencyStep";
import { AgentAvailabilityStep } from "../../src/features/onboarding/agent/AgentAvailabilityStep";
import { AgentBasicInfoStep } from "../../src/features/onboarding/agent/AgentBasicInfoStep";
import { AgentExtraStep } from "../../src/features/onboarding/agent/AgentExtraStep";
import { AgentFootballExperienceStep } from "../../src/features/onboarding/agent/AgentFootballExperienceStep";
import { AgentPlayersStep } from "../../src/features/onboarding/agent/AgentPlayersStep";
import { AgentPortfolioStep } from "../../src/features/onboarding/agent/AgentPortfolioStep";
import { AgentVerificationStep } from "../../src/features/onboarding/agent/AgentVerificationStep";
import {
  deriveLegacyMainPlayerRoles,
  deriveLegacyManagedPlayersCount,
  deriveLegacyPlayerTypes,
} from "../../src/features/profiles/agent-profile";
import type { CoachCareerEntry } from "../../src/features/onboarding/coach/coach-career-types";
import {
  CoachOnboardingFlow,
  isCoachMasterStep,
} from "../../src/features/onboarding/coach";
import { CoachCareerStep } from "../../src/features/onboarding/coach/CoachCareerStep";
import { PlayerCareerToggleStep } from "../../src/features/onboarding/coach/PlayerCareerToggleStep";
import {
  getNextStaffSubFlowStep,
  isStaffMasterStep,
  readStaffPreviousExperiences,
  StaffOnboardingFlow,
  trackStaffOnboardingEvent,
} from "../../src/features/onboarding/staff";
import {
  mapStaffRoleToSpecialization,
  MEDIA_AFFILIATION_TYPE_OPTIONS,
  MEDIA_CONTENT_TYPE_OPTIONS,
  MEDIA_FOCUS_AREA_OPTIONS,
} from "../../src/features/onboarding/onboarding-types";
import {
  DirectorChipsStep,
  DirectorExtraStep,
  DirectorFootballExperienceStep,
  DirectorRolesStep,
  DirectorSingleSelectStep,
} from "../../src/features/onboarding/director";
import {
  DIRECTOR_CATEGORY_OPTIONS,
  DIRECTOR_CLUB_TYPE_OPTIONS,
  DIRECTOR_FOCUS_OPTIONS,
  DIRECTOR_MARKET_OPTIONS,
  DIRECTOR_RESPONSIBILITY_OPTIONS,
  DIRECTOR_ROLE_OPTIONS,
} from "../../src/features/onboarding/onboarding-types";
import {
  CommunityBasicInfoStep,
  CommunityChipGroup,
  CommunityProfileTypeStep,
  FanInterestsStep,
  MediaChannelsStep,
  MediaCollaborationsStep,
  MediaEntityStep,
} from "../../src/features/onboarding/community";
import {
  DEFAULT_PLAYER_PRIMARY_POSITION,
  parsePlayerExperienceForms,
  type PlayerExperienceForm,
} from "../../src/features/profiles/player-sports";
import {
  composePhoneNumber,
  formatName,
  getCountryByCode,
  getNationalityCategory,
  REGION_OPTIONS,
  normalizeProfileBioInput,
} from "../../src/features/profiles/profile-form-utils";
import { withDefaultProfileAvatar } from "../../src/features/profiles/profile-avatar";
import {
  captureAndUploadPhoto,
  pickAndUploadMedia,
  ProfileMediaUploadError,
  PROFILE_MEDIA_BUCKET,
  type UploadedMediaItem,
} from "../../src/features/profiles/media-upload-service";
import {
  checkDuplicateClubs,
  searchAgentPlayerCandidates,
  searchTeams,
  updateCompleteProfessionalProfile,
  type StaffCareerEntryRecord,
  type StaffPlayerCareerEntryRecord,
} from "../../src/features/profiles/profile-service";
import { supabase } from "../../src/lib/supabase";
import { colors, radius, spacing } from "../../src/theme/tokens";
import { AppText, Button, Input, Toggle } from "../../src/ui";

type CompletionDestination = "feed" | "network" | "profile";


const genderOptions: { label: string; value: ProfileGender }[] = [
  { label: "Uomo", value: "male" },
  { label: "Donna", value: "female" },
];

const LEGAL_STATUS_OPTIONS: { label: string; value: LegalStatus }[] = [
  { label: "Ho il permesso di soggiorno", value: "has_permit" },
  { label: "Non ho il permesso di soggiorno", value: "no_permit" },
  { label: "In fase di richiesta", value: "pending_permit" },
];

/** Le tre modalità di inserimento esperienza usate dai flussi non ancora
 *  migrati al Master (oggi: carriera dirigenziale). */
const EXPERIENCE_TYPE_OPTIONS = [
  {
    type: "MULTI_SEASON" as const,
    title: "Stagioni complete",
    subtitle:
      "Aggiungi più stagioni complete nella stessa squadra con lo stesso ruolo.",
    icon: "layers-outline" as const,
  },
  {
    type: "SINGLE_SEASON" as const,
    title: "Singola stagione",
    subtitle: "Inserisci una sola stagione sportiva.",
    icon: "calendar-outline" as const,
  },
  {
    type: "CUSTOM_PERIOD" as const,
    title: "Periodo personalizzato",
    subtitle:
      "Specifica mese e anno di inizio e fine per incarichi brevi o subentri.",
    icon: "time-outline" as const,
  },
];


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
    throw new Error("Inserisci solo numeri validi nei campi numerici.");
  }

  return parsed;
}

function parseWheelValue(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function fromDelimitedString(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toDelimitedString(values: string[]) {
  return values.join(", ");
}

function mapCoachCareerEntryToStaffRecord(
  profileId: string,
  entry: CoachCareerEntry,
  index: number,
): StaffCareerEntryRecord {
  return {
    category: entry.category || null,
    club_id: entry.clubId ?? null,
    description: entry.description?.trim() || null,
    experience_type: entry.type,
    head_coach_name: null,
    id: entry.id,
    period_end_month: entry.period?.endMonth || null,
    period_end_year: entry.period?.endYear ? Number(entry.period.endYear) : null,
    period_start_month: entry.period?.startMonth || null,
    period_start_year: entry.period?.startYear
      ? Number(entry.period.startYear)
      : null,
    results: [],
    role: entry.role,
    season_details: entry.seasonDetails,
    seasons: entry.seasons,
    sort_order: index,
    staff_profile_id: profileId,
    team_logo_url: entry.teamLogoUrl ?? null,
    team_name: entry.teamName,
  };
}

function mapPlayerExperienceFormToStaffRecord(
  profileId: string,
  entry: PlayerExperienceForm,
  index: number,
): StaffPlayerCareerEntryRecord {
  return {
    appearances: entry.appearances ? Number(entry.appearances) : 0,
    assists: entry.assists ? Number(entry.assists) : 0,
    category: entry.category || null,
    goals: entry.goals ? Number(entry.goals) : 0,
    id: entry.id ?? `${profileId}-staff-player-${index}`,
    position: null,
    season: entry.seasonLabel,
    sort_order: index,
    staff_profile_id: profileId,
    team_logo_url: entry.teamLogoUrl || null,
    team_name: entry.clubName,
  };
}

function normalizeCoachCareerEntryForJson(entry: CoachCareerEntry): CoachCareerEntry {
  return {
    ...entry,
    description: entry.description?.trim() || null,
    seasonDetails: entry.seasonDetails ?? {},
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ValidationMessage({
  children,
  tone = "danger",
}: {
  children?: string;
  tone?: "danger" | "muted";
}) {
  if (!children) {
    return null;
  }

  if (tone === "muted") {
    return (
      <AppText color="secondary" variant="meta">
        {children}
      </AppText>
    );
  }

  return <InlineError message={children} />;
}

/** Copy di chiusura contestuale al ruolo (§AI). Il titolo resta uno solo. */
function getCompletionDescription(role: string) {
  if (role === "club_admin") {
    return "Inizia subito a cercare giocatori, allenatori e staff per la tua squadra.";
  }

  if (role === "media") {
    return "Ora puoi raccontare il calcio e farti trovare dalla community.";
  }

  if (role === "fan") {
    return "Ora puoi esplorare il network e seguire le aree che ti interessano.";
  }

  return "Ora puoi connetterti con squadre, allenatori e giocatori.";
}

// ---------------------------------------------------------------------------
// Alert helpers
// ---------------------------------------------------------------------------

function getBaseStepAlert(error: unknown) {
  if (error instanceof BaseProfileValidationError) {
    return {
      title: "Dati base non completi",
      message: error.message,
    };
  }

  return {
    title: "Salvataggio non riuscito",
    message:
      error instanceof Error
        ? error.message
        : "Errore inatteso durante il salvataggio dei dati base.",
  };
}

function getMediaUploadAlert(field: string, error: unknown) {
  if (field === "avatar") {
    if (
      error instanceof ProfileMediaUploadError &&
      error.code === "bucket_not_found"
    ) {
      return {
        title: "Foto profilo non caricata",
        message:
          "La foto profilo non è stata caricata perché l'archivio media del profilo non è disponibile. Puoi continuare e aggiungerla più tardi.",
      };
    }

    return {
      title: "Foto profilo non caricata",
      message:
        error instanceof Error
          ? `${error.message} Puoi continuare e aggiungerla più tardi.`
          : "La foto profilo non è stata caricata, ma puoi continuare e aggiungerla più tardi.",
    };
  }

  return {
    title: "Caricamento non riuscito",
    message:
      error instanceof Error
        ? error.message
        : "Errore inatteso durante il caricamento dei media.",
  };
}

function logMediaUploadFailure(payload: {
  bucket: string;
  error: unknown;
  field: string;
  folder: string;
}) {
  if (__DEV__) {
    console.error("[onboarding] media upload failed", payload);
  }
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function OnboardingProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const stepBackOverrideRef = useRef<(() => void) | null>(null);

  /** Back di sistema delegato alla schermata interna di uno step (§DB). */
  const registerStepBackOverride = useCallback(
    (handler: (() => void) | null) => {
      stepBackOverrideRef.current = handler;
    },
    [],
  );
  const params = useLocalSearchParams<{ step?: string | string[] }>();
  const { refreshProfile, session } = useSession();
  const {
    form,
    isHydrated,
    patchForm,
    resetForm,
    setCurrentStep,
    setFormValue,
  } = useOnboardingForm();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPhysicalFields, setShowPhysicalFields] = useState(
    Boolean(form.heightCm.trim() || form.weightKg.trim()),
  );
  const [validationErrors, setValidationErrors] =
    useState<OnboardingValidationErrors>({});

  const requestedStep = useMemo(() => {
    if (Array.isArray(params.step)) {
      return coerceOnboardingStep(params.step[0]);
    }

    return coerceOnboardingStep(params.step);
  }, [params.step]);

  const step = requestedStep ?? form.currentStep;
  const {
    agentAgencyLogoUrl,
    agentAgencyName,
    agentAgencyRole,
    agentAgencyStartYear,
    agentCareerEntries,
    agentFederation,
    agentHasOtherFootballExperience,
    agentHasPlayedFootball,
    agentIsFederationLicensed,
    agentLanguages,
    agentManagedPlayerEntries,
    agentOpenToClubs,
    agentOpenToPlayers,
    agentOperationalFocuses,
    agentOperationalNote,
    agentOtherFootballRoles,
    agentOperatingMacroAreas,
    agentOperatingRegions,
    agentPlayerCareerEntries,
    availabilityType,
    avatarUrl,
    bio,
    birthDate,
    careerEntries,
    clubCategory,
    clubCity,
    clubColors,
    clubCountry,
    clubDescription,
    clubEmail,
    clubFacebook,
    clubFieldAddress,
    clubFoundingYear,
    clubGalleryItems,
    clubHasYouthSector,
    clubHeadquartersAddress,
    clubInstagram,
    clubLeague,
    clubLogoUrl,
    clubName,
    clubPhone,
    clubPhoneCountryCode,
    clubRegion,
    clubStadium,
    clubTikTok,
    clubTotalMembers,
    clubWebsite,
    clubYouTube,
    clubYouthCategories,
    coachedCategories,
    coachedClubs,
    coachPreferredRegions,
    certifications,
    coachPrimaryRole,
    coachLicenseType,
    coachCategoriesArray,
    coachAvailableFrom,
    coachAvailabilityType,
    coachProvincesArray,
    coachRegionsArray,
    coachCareerEntries,
    hasPlayedFootball,
    coachPlayerCareerEntries,
    coachFormation,
    coachPlayStyle,
    coachLanguages,
    currentLocationCity,
    currentLocationCountry,
    domicile,
    domicileRegion,
    experienceSummary,
    firstName,
    gamePhilosophy,
    gender,
    heightCm,
    highlightVideoUrl,
    isOpenToTransfer,
    lastCompletedStep,
    lastName,
    legalStatus,
    licenses,
    nationality,
    openToNewRole,
    openToWork,
    phoneCountryCode,
    phoneNumber,
    communityProfileType,
    fanFavoriteClubId,
    fanFavoriteTeamName,
    fanInterestCategories,
    fanInterestRegions,
    mediaAffiliationName,
    mediaAffiliationType,
    mediaContentTypes,
    mediaEntityDescription,
    mediaEntityName,
    mediaFacebook,
    mediaFocusAreas,
    mediaInstagram,
    mediaLogoUrl,
    mediaTikTok,
    mediaWebsite,
    mediaYouTube,
    playerMediaItems,
    preferredCategories,
    preferredFoot,
    primaryPosition,
    repEmail,
    repPhone,
    repPhoneCountryCode,
    residence,
    residenceCountry,
    residenceRegion,
    role,
    secondaryPositions,
    staffAvailabilityType,
    staffAvailableFrom,
    staffCareerEntries,
    staffCoachCareerEntries,
    staffHasCoachedFootball,
    staffPlayerCareerEntries,
    staffPrimaryRole,
    staffPreferredCategories,
    staffPreferredProvinces,
    staffPreferredRegions,
    staffSpecialization,
    staffRoles,
    directorBio,
    directorCareerEntries,
    directorCategories,
    directorCoachCareerEntries,
    directorClubTypes,
    directorHasOtherFootballExperience,
    directorHasPlayedFootball,
    directorLanguages,
    directorMainFocus,
    directorMarketInvolvement,
    directorOtherFootballRoles,
    directorPlayerCareerEntries,
    directorPrimaryRole,
    directorResponsibilities,
    directorRoles,
    technicalVideoUrl,
    transferProvinces,
    transferRegions,
    uploadingField,
    useResidenceForDomicile,
    weightKg,
    willingToChangeClub,
  } = form;

  const fullName = getOnboardingFullName(form);
  const nationalityCategory = getNationalityCategory(nationality);
  // REV-ONB-05 §AP: per la Società la sequenza dipende dalla struttura del
  // club, quindi contatore e progress si leggono da quella scelta.
  const clubStructure = form.clubStructure as ClubStructure;
  const visibleSteps = getOnboardingVisibleSteps(
    role as AppRole | "",
    clubStructure,
  );
  const progress = getOnboardingProgress(
    step,
    role as AppRole | "",
    clubStructure,
  );
  const counter = getOnboardingCounter(visibleSteps, progress.stepIndex);
  const canGoBack = step !== "role";
  const isBusy = isSubmitting || uploadingField !== null;
  const authEmail = session?.user?.email ?? "";

  useEffect(() => {
    if (!isHydrated || !authEmail) {
      return;
    }

    if (step === "club_representative" && !repEmail) {
      setFormValue("repEmail", authEmail);
    }
  }, [authEmail, isHydrated, repEmail, setFormValue, step]);

  const clearValidationErrors = useCallback((fields: string[]) => {
    setValidationErrors((current) => {
      const nextErrors = { ...current };

      fields.forEach((field) => {
        delete nextErrors[field];
      });

      return nextErrors;
    });
  }, []);

  const updateValue = useCallback(
    <Key extends keyof typeof form>(
      key: Key,
      value: (typeof form)[Key],
      fieldsToClear: string[] = [String(key)],
    ) => {
      setFormValue(key, value);
      clearValidationErrors(fieldsToClear);
    },
    [clearValidationErrors, setFormValue],
  );

  const handleFormattedNameBlur = useCallback(
    (field: "firstName" | "lastName") => {
      const currentValue = form[field];
      const formattedValue = formatName(currentValue);

      if (formattedValue && formattedValue !== currentValue) {
        updateValue(field, formattedValue);
      }
    },
    [form, updateValue],
  );

  /**
   * §BE: i colori sociali sono una collezione senza gerarchia. Il backend
   * conserva un singolo campo testo, quindi la lista viaggia serializzata —
   * ma nell'onboarding non esiste un colore principale e uno secondario.
   */
  const clubSocialColors = useMemo(
    () => fromDelimitedString(clubColors),
    [clubColors],
  );

  const handleClubSocialColorsChange = useCallback(
    (values: string[]) => {
      patchForm({ clubColors: toDelimitedString(values) });
      clearValidationErrors(["clubColors"]);
    },
    [clearValidationErrors, patchForm],
  );

  const handleClubCityChange = useCallback(
    (value: string) => {
      patchForm({
        clubCity: value,
        clubRegion:
          value.trim().toLowerCase() === clubCity.trim().toLowerCase()
            ? clubRegion
            : "",
      });
      clearValidationErrors(["clubCity", "clubRegion"]);
    },
    [clearValidationErrors, clubCity, clubRegion, patchForm],
  );

  const handleClubCitySelect = useCallback(
    (value: { name: string; region: string }) => {
      patchForm({
        clubCity: value.name,
        clubRegion: value.region,
      });
      clearValidationErrors(["clubCity", "clubRegion"]);
    },
    [clearValidationErrors, patchForm],
  );

  const handleResidenceChange = useCallback(
    (value: string) => {
      patchForm({
        residence: value,
        residenceRegion:
          value.trim().toLowerCase() === residence.trim().toLowerCase()
            ? residenceRegion
            : "",
      });
      clearValidationErrors(["residence"]);
    },
    [clearValidationErrors, patchForm, residence, residenceRegion],
  );

  const handleResidenceSelect = useCallback(
    (value: { name: string; region: string }) => {
      patchForm({
        residence: value.name,
        residenceRegion: value.region,
      });
      clearValidationErrors(["residence"]);
    },
    [clearValidationErrors, patchForm],
  );

  const handleDomicileToggle = useCallback(
    (value: boolean) => {
      const useResidence = !value;

      patchForm({
        useResidenceForDomicile: useResidence,
        domicile: useResidence ? "" : domicile,
        domicileRegion: useResidence ? "" : domicileRegion,
      });
      clearValidationErrors(["domicile"]);
    },
    [clearValidationErrors, domicile, domicileRegion, patchForm],
  );

  const handleDomicileChange = useCallback(
    (value: string) => {
      patchForm({
        domicile: value,
        domicileRegion:
          value.trim().toLowerCase() === domicile.trim().toLowerCase()
            ? domicileRegion
            : "",
      });
      clearValidationErrors(["domicile"]);
    },
    [clearValidationErrors, domicile, domicileRegion, patchForm],
  );

  const handleDomicileSelect = useCallback(
    (value: { name: string; region: string }) => {
      patchForm({
        domicile: value.name,
        domicileRegion: value.region,
      });
      clearValidationErrors(["domicile"]);
    },
    [clearValidationErrors, patchForm],
  );

  const handleNationalitySelect = useCallback(
    (value: string) => {
      const country = getCountryByCode(value);
      const newCategory = getNationalityCategory(value);
      const prevCategory = getNationalityCategory(nationality);

      const patch: Partial<typeof form> = {
        nationality: value,
        phoneCountryCode:
          !phoneNumber.trim() && country
            ? country.phoneCountryCode
            : phoneCountryCode,
      };

      // Reset fields that belong to the previous category when switching
      if (newCategory !== prevCategory) {
        if (prevCategory === "italy") {
          // Leaving Italy: clear Italian-specific location fields
          patch.residence = "";
          patch.residenceRegion = "";
          patch.domicile = "";
          patch.domicileRegion = "";
          patch.useResidenceForDomicile = true;
        }
        if (prevCategory === "eu" || prevCategory === "non_eu") {
          // Leaving EU/non-EU: clear international location fields
          patch.residenceCountry = "";
          patch.residenceCity = "";
          patch.currentLocationCountry = "";
          patch.currentLocationCity = "";
        }
        if (prevCategory === "non_eu") {
          // Leaving non-EU: clear legal status
          patch.legalStatus = "" as LegalStatus;
        }

        clearValidationErrors([
          "nationality",
          "phoneNumber",
          "residence",
          "residenceRegion",
          "domicile",
          "domicileRegion",
          "residenceCountry",
          "residenceCity",
          "currentLocationCountry",
          "currentLocationCity",
          "legalStatus",
        ]);
      } else {
        clearValidationErrors(["nationality", "phoneNumber"]);
      }

      patchForm(patch);
    },
    [
      clearValidationErrors,
      nationality,
      patchForm,
      phoneCountryCode,
      phoneNumber,
    ],
  );

  // Track whether the initial hydration navigation has been performed so we
  // only restore the saved step once and never fight with later navigations.
  const hasRestoredStepRef = useRef(false);

  const navigateToStep = useCallback(
    (nextStep: OnboardingStep, mode: "push" | "replace" = "push") => {
      setCurrentStep(nextStep);
      const target = {
        pathname: "/(onboarding)/profile" as const,
        params: nextStep === "role" ? {} : { step: nextStep },
      };

      if (mode === "replace") {
        routerRef.current.replace(target);
        return;
      }

      routerRef.current.push(target);
    },
    [setCurrentStep],
  );

  const handleBackNavigation = useCallback(() => {
    if (stepBackOverrideRef.current) {
      stepBackOverrideRef.current();
      return;
    }

    // §AQ: si torna allo step precedente del ramo davvero percorso — un club
    // "Solo settore giovanile" non deve passare da "Prima squadra".
    const previousStep = getPreviousOnboardingStep(
      step,
      lastCompletedStep,
      role as AppRole | "",
      clubStructure,
    );

    if (!previousStep) {
      return;
    }

    navigateToStep(previousStep, "replace");
  }, [clubStructure, lastCompletedStep, navigateToStep, role, step]);

  // Hydration restore: navigate to the saved step once on first mount.
  useEffect(() => {
    if (!isHydrated || hasRestoredStepRef.current) {
      return;
    }

    hasRestoredStepRef.current = true;

    if (!requestedStep && form.currentStep !== "role") {
      navigateToStep(form.currentStep, "replace");
    }
  }, [isHydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  // URL→form sync: when the URL step changes (e.g. swipe-back gesture pops
  // the screen), update the form step to match.
  useEffect(() => {
    if (!isHydrated || !hasRestoredStepRef.current) {
      return;
    }

    const urlStep = requestedStep ?? "role";

    if (urlStep !== form.currentStep) {
      setCurrentStep(urlStep);
    }
  }, [requestedStep]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (Platform.OS !== "android" || step === "role") {
      return undefined;
    }

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        handleBackNavigation();
        return true;
      },
    );

    return () => {
      subscription.remove();
    };
  }, [handleBackNavigation, step]);

  // -----------------------------------------------------------------------
  // Media upload
  // -----------------------------------------------------------------------

  async function handleMediaUpload({
    allowsMultipleSelection = false,
    field,
    folder,
    mediaTypes,
    onUploaded,
  }: {
    allowsMultipleSelection?: boolean;
    field: string;
    folder: string;
    mediaTypes: ["images"] | ["videos"] | ["images", "videos"];
    onUploaded: (items: UploadedMediaItem[]) => void;
  }) {
    if (!session?.user) {
      return;
    }

    try {
      setFormValue("uploadingField", field);

      const uploadedItems = await pickAndUploadMedia({
        allowsMultipleSelection,
        folder,
        mediaTypes,
        userId: session.user.id,
      });

      if (uploadedItems.length > 0) {
        onUploaded(uploadedItems);
      }
    } catch (error) {
      logMediaUploadFailure({
        bucket: PROFILE_MEDIA_BUCKET,
        error,
        field,
        folder,
      });
      const alertCopy = getMediaUploadAlert(field, error);
      Alert.alert(alertCopy.title, alertCopy.message);
    } finally {
      setFormValue("uploadingField", null);
    }
  }

  async function handleCameraCapture({
    field,
    folder,
    onUploaded,
  }: {
    field: string;
    folder: string;
    onUploaded: (items: UploadedMediaItem[]) => void;
  }) {
    if (!session?.user) {
      return;
    }

    try {
      setFormValue("uploadingField", field);

      const uploadedItems = await captureAndUploadPhoto({
        folder,
        userId: session.user.id,
      });

      if (uploadedItems.length > 0) {
        onUploaded(uploadedItems);
      }
    } catch (error) {
      logMediaUploadFailure({
        bucket: PROFILE_MEDIA_BUCKET,
        error,
        field,
        folder,
      });
      const alertCopy = getMediaUploadAlert(field, error);
      Alert.alert(alertCopy.title, alertCopy.message);
    } finally {
      setFormValue("uploadingField", null);
    }
  }

  // -----------------------------------------------------------------------
  // Profile creation
  // -----------------------------------------------------------------------

  /**
   * `overrides` serve ai valori normalizzati al momento del salvataggio —
   * i canali digitali della Società — che non hanno ancora fatto in tempo a
   * rientrare dal form provider.
   */
  async function ensureInitialProfileCreated(
    overrides: Partial<CreateInitialProfileInput> = {},
  ) {
    if (!session?.user) {
      throw new Error("Sessione non disponibile.");
    }

    await createInitialProfile({
      authEmail: session.user.email ?? "",
      avatarUrl,
      birthDate,
      clubCategory,
      clubCity,
      clubColors,
      clubCountry,
      clubDescription,
      clubEmail,
      clubFacebook,
      clubFieldAddress,
      clubFoundingYear,
      clubHasYouthSector,
      clubHeadquartersAddress,
      clubInstagram,
      clubLogoUrl,
      clubName,
      clubPhone: composePhoneNumber(clubPhoneCountryCode, clubPhone),
      clubRegion,
      clubStadium,
      clubStructure,
      clubTikTok,
      clubTotalMembers,
      clubWebsite,
      clubYouTube,
      clubYouthCategories,
      currentLocationCity,
      currentLocationCountry,
      domicile:
        nationalityCategory === "italy" ? getEffectiveDomicile(form) : "",
      fullName,
      gender: gender as ProfileGender,
      legalStatus,
      nationality,
      phoneNumber: composePhoneNumber(phoneCountryCode, phoneNumber),
      primaryPosition: primaryPosition || DEFAULT_PLAYER_PRIMARY_POSITION,
      repEmail,
      repPhone: composePhoneNumber(repPhoneCountryCode, repPhone),
      residence: nationalityCategory === "italy" ? residence : "",
      residenceCountry,
      role: role as AppRole,
      staffAvailableFrom,
      staffPrimaryRole,
      staffRoles,
      staffSpecialization,
      userId: session.user.id,
      ...overrides,
    });

    patchForm({
      hasCreatedProfile: true,
    });
  }

  function buildOnboardingProfilePayload({
    bioValue,
    isOpenToTransferValue = false,
    languages = [],
  }: {
    bioValue: string;
    isOpenToTransferValue?: boolean;
    languages?: string[];
  }) {
    return {
      avatar_url: parseOptionalText(avatarUrl),
      bio: parseOptionalText(normalizeProfileBioInput(bioValue)),
      birth_date: birthDate,
      city:
        nationalityCategory === "italy"
          ? parseOptionalText(residence)
          : parseOptionalText(currentLocationCity),
      current_location_city:
        nationalityCategory === "italy"
          ? null
          : parseOptionalText(currentLocationCity),
      current_location_country:
        nationalityCategory === "italy"
          ? null
          : parseOptionalText(currentLocationCountry),
      domicile:
        nationalityCategory === "italy"
          ? parseOptionalText(getEffectiveDomicile(form))
          : null,
      full_name: fullName,
      gender:
        gender === "male" ||
        gender === "female" ||
        gender === "non_binary" ||
        gender === "prefer_not_to_say"
          ? gender
          : null,
      is_open_to_transfer: isOpenToTransferValue,
      legal_status:
        nationalityCategory === "non_eu"
          ? parseOptionalText(legalStatus)
          : null,
      languages,
      nationality: parseOptionalText(nationality),
      region:
        nationalityCategory === "italy"
          ? parseOptionalText(residenceRegion)
          : null,
      residence:
        nationalityCategory === "italy" ? parseOptionalText(residence) : null,
      residence_country:
        nationalityCategory === "italy"
          ? null
          : parseOptionalText(residenceCountry),
    };
  }

  /**
   * §AH–§AK: le carriere pregresse da allenatore e da calciatore arricchiscono
   * lo stesso profilo Staff. Vengono incluse solo quando il relativo
   * sotto-flusso è stato effettivamente completato, così un salvataggio
   * intermedio non cancella né inventa nulla (§AU).
   */
  async function saveStaffProfessionalProfile({
    includeCoachCareer = false,
    includePlayerCareer = false,
  }: {
    includeCoachCareer?: boolean;
    includePlayerCareer?: boolean;
  } = {}) {
    if (!session?.user) {
      throw new Error("Sessione non disponibile.");
    }

    const profileId = session.user.id;

    await ensureInitialProfileCreated();

    await updateCompleteProfessionalProfile({
      club: null,
      clubSeasonEntries: [],
      coachProfile: null,
      playerCareerEntries: [],
      playerProfile: null,
      profile: buildOnboardingProfilePayload({
        bioValue: bio,
      }),
      profileId,
      role: role as AppRole,
      staffCareerEntries: (staffCareerEntries as CoachCareerEntry[]).map(
        (entry, index) => mapCoachCareerEntryToStaffRecord(profileId, entry, index),
      ),
      staffCoachCareerEntries: includeCoachCareer
        ? (staffCoachCareerEntries as CoachCareerEntry[]).map((entry, index) =>
            mapCoachCareerEntryToStaffRecord(profileId, entry, index),
          )
        : [],
      staffPlayerCareerEntries: includePlayerCareer
        ? staffPlayerCareerEntries.map((entry, index) =>
            mapPlayerExperienceFormToStaffRecord(profileId, entry, index),
          )
        : [],
      staffProfile: {
        certifications: fromDelimitedString(certifications),
        experience_entries: staffCareerEntries,
        experience_summary: parseOptionalText(experienceSummary),
        open_to_work: openToWork,
        availability_type: openToWork ? staffAvailabilityType : null,
        available_from: openToWork ? parseOptionalText(staffAvailableFrom) : null,
        primary_staff_role: staffPrimaryRole || null,
        preferred_categories: fromDelimitedString(staffPreferredCategories),
        preferred_provinces: fromDelimitedString(staffPreferredProvinces),
        preferred_regions: fromDelimitedString(staffPreferredRegions),
        specialization: mapStaffRoleToSpecialization(staffPrimaryRole),
        staff_roles: staffRoles,
      },
      userContacts: {
        email: "",
        facebook: "",
        instagram: "",
        phone: composePhoneNumber(phoneCountryCode, phoneNumber),
        showEmail: false,
        showFacebook: false,
        showInstagram: false,
      },
    });
  }

  // -----------------------------------------------------------------------
  // Step handlers
  // -----------------------------------------------------------------------

  function handleContinueFromRole() {
    const nextErrors = validateOnboardingStep("role", form);

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return;
    }

    setValidationErrors({});
    trackPlayerOnboardingEvent({
      name: "onboarding_profile_type_selected",
      profileType: role,
    });

    if (role === "fan" || role === "media") {
      navigateToStep("community_profile_type");
      return;
    }

    if (role === "player") {
      trackPlayerOnboardingEvent({ name: "player_onboarding_started" });
    }

    if (role === "club_admin") {
      trackClubOnboardingEvent({ name: "onboarding_society_started" });
    }

    navigateToStep(form.role === "club_admin" ? "club_representative" : "base");
  }

  function handleContinueFromCommunityProfileType() {
    const nextErrors = validateOnboardingStep("community_profile_type", form);

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return;
    }

    setValidationErrors({});
    patchForm({ lastCompletedStep: "community_profile_type" });
    navigateToStep(role === "media" ? "media_basic" : "fan_basic");
  }

  function handleContinueFromCommunityBasic() {
    const currentBasicStep = role === "media" ? "media_basic" : "fan_basic";
    const nextErrors = validateOnboardingStep(currentBasicStep, form);

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return;
    }

    setValidationErrors({});
    patchForm({ lastCompletedStep: currentBasicStep });
    navigateToStep(role === "media" ? "media_photo" : "fan_photo");
  }

  function handleContinueFromFanInterests() {
    const nextErrors = validateOnboardingStep("fan_interests", form);

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return;
    }

    setValidationErrors({});
    handleFinishFanOnboarding();
  }

  function handleContinueFromBase() {
    const nextErrors = validateOnboardingStep("base", form);

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return;
    }

    setValidationErrors({});
    patchForm({ lastCompletedStep: "base" });

    if (role === "player") {
      trackPlayerOnboardingEvent({ name: "personal_info_completed" });
    }

    navigateToStep("photo");
  }

  function handleContinueFromPhoto() {
    patchForm({ lastCompletedStep: "photo" });
    if (role === "agent") {
      navigateToStep("agent_agency");
    } else if (role === "coach") {
      navigateToStep("coach_role");
    } else if (role === "staff") {
      trackStaffOnboardingEvent({ name: "onboarding_staff_started" });
      navigateToStep("staff_role");
    } else if (role === "director") {
      navigateToStep("director_roles");
    } else if (role === "fan") {
      navigateToStep("fan_interests");
    } else if (role === "media") {
      navigateToStep("media_entity");
    } else {
      navigateToStep("technical");
    }
  }

  function handleContinueFromTechnical() {
    const nextErrors = validateOnboardingStep("technical", form);

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return;
    }

    setValidationErrors({});
    patchForm({ lastCompletedStep: "technical" });

    // Players get an availability step then experience; others save and go to completion
    if (role === "player") {
      navigateToStep("player_availability");
    } else {
      handleSaveNonPlayerTechnical();
    }
  }

  function handleContinueFromPlayerAvailability() {
    const nextErrors = validateOnboardingStep("player_availability", form);

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return;
    }

    setValidationErrors({});
    patchForm({ lastCompletedStep: "player_availability" });
    trackPlayerOnboardingEvent({
      experienceCount: careerEntries.length,
      name: "career_step_opened",
    });
    navigateToStep("experience");
  }

  async function handleSaveNonPlayerTechnical() {
    if (!session?.user) {
      return;
    }

    try {
      setIsSubmitting(true);

      await ensureInitialProfileCreated();

      await updateCompleteProfessionalProfile({
        club:
          role === "club_admin"
            ? {
                category: parseOptionalText(clubCategory),
                city: clubCity.trim(),
                club_colors: parseOptionalText(clubColors),
                club_email: clubEmail.trim().toLowerCase() || null,
                club_phone: parseOptionalText(
                  composePhoneNumber(clubPhoneCountryCode, clubPhone),
                ),
                country: clubCountry || "IT",
                description: parseOptionalText(clubDescription),
                field_address: parseOptionalText(clubFieldAddress),
                founding_year: parseOptionalNumber(clubFoundingYear),
                gallery_urls: clubGalleryItems.map((item) => item.url),
                headquarters_address: parseOptionalText(
                  clubHeadquartersAddress,
                ),
                league: parseOptionalText(clubLeague),
                logo_url: parseOptionalText(clubLogoUrl),
                name: clubName.trim(),
                region: clubRegion.trim(),
                website_url: parseOptionalText(clubWebsite),
              }
            : null,
        clubSeasonEntries: [],
        coachProfile:
          role === "coach"
            ? {
                availability_type: coachAvailabilityType || null,
                available_from: openToNewRole
                  ? parseOptionalText(coachAvailableFrom)
                  : null,
                coached_categories: fromDelimitedString(coachedCategories),
                coached_clubs: fromDelimitedString(coachedClubs),
                contract_end: null,
                current_club: null,
                game_philosophy: parseOptionalText(gamePhilosophy),
                licenses: fromDelimitedString(licenses),
                media_items: [],
                open_to_new_role: openToNewRole,
                play_styles: [],
                preferred_categories: [],
                preferred_formation: null,
                preferred_provinces: coachProvincesArray,
                preferred_regions: fromDelimitedString(coachPreferredRegions),
                primary_role: parseOptionalText(coachPrimaryRole),
                secondary_formations: [],
                technical_video_url: parseOptionalText(technicalVideoUrl),
              }
            : null,
        playerCareerEntries: [],
        playerProfile: null,
        profile: buildOnboardingProfilePayload({
          bioValue: bio,
          isOpenToTransferValue: isOpenToTransfer,
        }),
        profileId: session.user.id,
        role: role as AppRole,
        staffProfile:
          role === "staff"
            ? {
                certifications: fromDelimitedString(certifications),
                experience_entries: staffCareerEntries,
                experience_summary: parseOptionalText(experienceSummary),
                open_to_work: openToWork,
                availability_type: openToWork ? staffAvailabilityType : null,
                available_from: openToWork
                  ? parseOptionalText(staffAvailableFrom)
                  : null,
                primary_staff_role: staffPrimaryRole || null,
                preferred_categories: fromDelimitedString(
                  staffPreferredCategories,
                ),
                preferred_provinces: fromDelimitedString(
                  staffPreferredProvinces,
                ),
                preferred_regions: fromDelimitedString(staffPreferredRegions),
                specialization: mapStaffRoleToSpecialization(staffPrimaryRole),
                staff_roles: staffRoles,
              }
            : null,
        userContacts: {
          email: "",
          facebook: "",
          instagram: "",
          phone: composePhoneNumber(phoneCountryCode, phoneNumber),
          showEmail: false,
          showFacebook: false,
          showInstagram: false,
          showTikTok: false,
          showWebsite: false,
          showYouTube: false,
          tiktok: "",
          website: "",
          youtube: "",
        },
      });

      goToCompletion("technical");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore inatteso nel completamento profilo.";
      Alert.alert("Profilo sportivo non salvato", message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveExperiences() {
    if (!session?.user) {
      return;
    }

    try {
      setIsSubmitting(true);

      await ensureInitialProfileCreated();

      const normalizedCareerEntries = parsePlayerExperienceForms(careerEntries);

      await updateCompleteProfessionalProfile({
        club: null,
        clubSeasonEntries: [],
        coachProfile: null,
        playerCareerEntries: normalizedCareerEntries,
        playerProfile: {
          availability_type: availabilityType,
          height_cm: parseOptionalNumber(heightCm),
          highlight_video_url: parseOptionalText(highlightVideoUrl),
          media_items: playerMediaItems.map((item, index) => ({
            created_at: null,
            description: null,
            id: `onboarding-media-${index}`,
            is_featured: false,
            tag: "highlights",
            thumbnail_url: item.type === "image" ? item.url : null,
            type: item.type === "video" ? "video" : "image",
            url: item.url,
          })),
          media_urls: playerMediaItems.map((item) => item.url),
          preferred_categories: fromDelimitedString(preferredCategories),
          preferred_foot: preferredFoot || null,
          primary_position: primaryPosition || DEFAULT_PLAYER_PRIMARY_POSITION,
          secondary_positions: secondaryPositions,
          contract_expiry: null,
          contract_status: null,
          current_condition: null,
          open_to_trials: false,
          player_objectives: [],
          show_transfer_badge: false,
          show_regions_badge: false,
          transfer_provinces: fromDelimitedString(transferProvinces),
          transfer_regions: fromDelimitedString(transferRegions),
          weight_kg: parseOptionalNumber(weightKg),
          willing_to_change_club: willingToChangeClub,
        },
        profile: buildOnboardingProfilePayload({
          bioValue: bio,
          isOpenToTransferValue: isOpenToTransfer,
        }),
        profileId: session.user.id,
        role: role as AppRole,
        staffProfile: null,
        userContacts: {
          email: "",
          facebook: "",
          instagram: "",
          phone: composePhoneNumber(phoneCountryCode, phoneNumber),
          showEmail: false,
          showFacebook: false,
          showInstagram: false,
        },
      });

      const { error } = await supabase
        .from("player_profiles")
        .update({ media_urls: playerMediaItems.map((item) => item.url) })
        .eq("profile_id", session.user.id);

      if (error) {
        throw error;
      }

      trackPlayerOnboardingEvent({
        experienceCount: normalizedCareerEntries.length,
        name: "player_onboarding_completed",
      });
      goToCompletion("experience");
    } catch (error) {
      // §CD: un errore di rete non azzera il form, che resta nella bozza.
      const message =
        error instanceof Error
          ? error.message
          : "Errore inatteso nel salvataggio.";
      Alert.alert("Profilo non salvato", message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleContinueFromAgentAgency() {
    const nextErrors = validateOnboardingStep("agent_agency", form);

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return;
    }

    patchForm({ lastCompletedStep: "agent_agency" });
    setValidationErrors({});
    navigateToStep("agent_players");
  }

  function handleContinueFromAgentPlayers() {
    const nextErrors = validateOnboardingStep("agent_players", form);

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return;
    }

    patchForm({ lastCompletedStep: "agent_players" });
    setValidationErrors({});
    navigateToStep("agent_football_experience");
  }

  function handleContinueFromAgentFootballExperience() {
    const nextErrors = validateOnboardingStep(
      "agent_football_experience",
      form,
    );

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return;
    }

    patchForm({ lastCompletedStep: "agent_football_experience" });
    setValidationErrors({});
    navigateToStep("agent_player_career_toggle");
  }

  function handleContinueFromAgentPlayerCareerToggle() {
    patchForm({ lastCompletedStep: "agent_player_career_toggle" });

    if (agentHasPlayedFootball) {
      navigateToStep("agent_player_career");
      return;
    }

    navigateToStep("agent_portfolio");
  }

  function handleContinueFromAgentPlayerCareer() {
    patchForm({ lastCompletedStep: "agent_player_career" });
    navigateToStep("agent_portfolio");
  }

  function handleContinueFromAgentPortfolio() {
    const nextErrors = validateOnboardingStep("agent_portfolio", form);

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return;
    }

    patchForm({ lastCompletedStep: "agent_portfolio" });
    setValidationErrors({});
    navigateToStep("agent_availability");
  }

  function handleContinueFromAgentAvailability() {
    const nextErrors = validateOnboardingStep("agent_availability", form);

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return;
    }

    patchForm({ lastCompletedStep: "agent_availability" });
    setValidationErrors({});
    navigateToStep("agent_verification");
  }

  function handleContinueFromAgentVerification() {
    const nextErrors = validateOnboardingStep("agent_verification", form);

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return;
    }

    patchForm({ lastCompletedStep: "agent_verification" });
    setValidationErrors({});
    navigateToStep("agent_extra");
  }

  async function handleFinishAgentExtra() {
    if (!session?.user) {
      return;
    }

    try {
      setIsSubmitting(true);

      await ensureInitialProfileCreated();

      const derivedMainRoles = deriveLegacyMainPlayerRoles(agentManagedPlayerEntries);
      const derivedManagedPlayersCount = deriveLegacyManagedPlayersCount(
        agentManagedPlayerEntries,
      );
      const derivedPlayerTypes = deriveLegacyPlayerTypes(agentManagedPlayerEntries);

      await updateCompleteProfessionalProfile({
        agentCareerEntries: agentCareerEntries
          .filter((entry) => entry.agency_name.trim())
          .map((entry, index) => ({
            agency_logo_url: entry.agency_logo_url,
            agency_name: entry.agency_name.trim(),
            agent_profile_id: session.user.id,
            id: entry.id,
            period_end_month: null,
            period_end_year: entry.period_end_year,
            period_start_month: null,
            period_start_year: entry.period_start_year,
            role: entry.role.trim() || "Agente",
            sort_order: index,
          })),
        agentManagedPlayerEntries: agentManagedPlayerEntries
          .filter((entry) => entry.display_name.trim())
          .map((entry, index) => ({
            agent_profile_id: session.user.id,
            avatar_url: entry.avatar_url,
            birth_year: entry.birth_year,
            category_label: entry.category_label,
            display_name: entry.display_name.trim(),
            id: entry.id,
            is_free_agent: entry.is_free_agent,
            linked_profile_id: entry.linked_profile_id,
            primary_position: entry.primary_position,
            sort_order: index,
          })),
        agentProfile: {
          agency_logo_url: parseOptionalText(agentAgencyLogoUrl),
          agency_name: parseOptionalText(agentAgencyName),
          agency_role: parseOptionalText(agentAgencyRole),
          federation: agentIsFederationLicensed
            ? parseOptionalText(agentFederation)
            : null,
          has_other_football_experience: agentHasOtherFootballExperience,
          has_played_football: agentHasPlayedFootball,
          is_federation_licensed: agentIsFederationLicensed,
          main_player_roles: derivedMainRoles,
          managed_players_count: derivedManagedPlayersCount,
          open_to_clubs: agentOpenToClubs,
          open_to_players: agentOpenToPlayers,
          operational_focuses: agentOperationalFocuses,
          operational_note: parseOptionalText(agentOperationalNote),
          operating_macro_areas: agentOperatingMacroAreas,
          operating_regions: fromDelimitedString(agentOperatingRegions),
          other_football_roles: agentOtherFootballRoles,
          period_end_month: null,
          period_end_year: null,
          period_start_month: null,
          period_start_year: parseWheelValue(agentAgencyStartYear),
          player_career_entries: agentPlayerCareerEntries,
          player_types: derivedPlayerTypes,
        },
        club: null,
        clubSeasonEntries: [],
        coachProfile: null,
        playerCareerEntries: [],
        playerProfile: null,
        profile: buildOnboardingProfilePayload({
          bioValue: bio,
          languages: agentLanguages,
        }),
        profileId: session.user.id,
        role: role as AppRole,
        staffProfile: null,
        userContacts: {
          email: "",
          facebook: "",
          instagram: "",
          phone: composePhoneNumber(phoneCountryCode, phoneNumber),
          showEmail: false,
          showFacebook: false,
          showInstagram: false,
        },
      });

      goToCompletion("agent_extra");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore inatteso nel completamento profilo.";
      Alert.alert("Profilo non salvato", message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleContinueFromStaffRole() {
    const nextErrors = validateOnboardingStep("staff_role", form);

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return;
    }

    const normalizedPrimaryRole =
      staffRoles.length === 1 ? staffRoles[0] : staffPrimaryRole;

    patchForm({
      lastCompletedStep: "staff_role",
      staffPrimaryRole: normalizedPrimaryRole,
      staffSpecialization: mapStaffRoleToSpecialization(normalizedPrimaryRole),
    });
    setValidationErrors({});
    navigateToStep("staff_availability");
  }

  function handleContinueFromStaffAvailability() {
    const nextErrors = validateOnboardingStep("staff_availability", form);

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return;
    }

    patchForm({ lastCompletedStep: "staff_availability" });
    setValidationErrors({});
    navigateToStep("staff_career");
  }

  async function handleSaveStaffCareer() {
    if (!session?.user) {
      return;
    }

    try {
      setIsSubmitting(true);

      await saveStaffProfessionalProfile();

      patchForm({ lastCompletedStep: "staff_career" });
      navigateToStep("staff_previous_experiences");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore inatteso nel completamento profilo.";
      Alert.alert("Profilo non salvato", message);
    } finally {
      setIsSubmitting(false);
    }
  }

  /**
   * §AJ: se l'utente sceglie entrambe le carriere pregresse si percorre prima
   * l'Allenatore e poi il Calciatore, senza tornare all'inizio.
   */
  function handleContinueFromStaffPreviousExperiences() {
    const nextErrors = validateOnboardingStep("staff_previous_experiences", form);

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return;
    }

    setValidationErrors({});
    patchForm({ lastCompletedStep: "staff_previous_experiences" });

    const nextStep = getNextStaffSubFlowStep(readStaffPreviousExperiences(form));

    if (nextStep) {
      navigateToStep(nextStep);
      return;
    }

    finishStaffOnboarding("staff_previous_experiences");
  }

  async function handleContinueFromStaffCoachCareer() {
    if (!session?.user) {
      return;
    }

    try {
      setIsSubmitting(true);

      await saveStaffProfessionalProfile({ includeCoachCareer: true });

      patchForm({ lastCompletedStep: "staff_coach_career" });

      const nextStep = getNextStaffSubFlowStep(
        readStaffPreviousExperiences(form),
        ["coach"],
      );

      if (nextStep) {
        navigateToStep(nextStep);
        return;
      }

      finishStaffOnboarding("staff_coach_career");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore inatteso nel completamento profilo.";
      Alert.alert("Profilo non salvato", message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleContinueFromStaffPlayerCareer() {
    if (!session?.user) {
      return;
    }

    try {
      setIsSubmitting(true);

      await saveStaffProfessionalProfile({
        includeCoachCareer: staffHasCoachedFootball,
        includePlayerCareer: true,
      });

      patchForm({ lastCompletedStep: "staff_player_career" });
      finishStaffOnboarding("staff_player_career");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore inatteso nel completamento profilo.";
      Alert.alert("Profilo non salvato", message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function finishStaffOnboarding(lastStep: OnboardingStep) {
    trackStaffOnboardingEvent({
      experienceCount: staffCareerEntries.length,
      name: "onboarding_staff_completed",
    });
    goToCompletion(lastStep);
  }

  // -----------------------------------------------------------------------
  // Director step handlers
  // -----------------------------------------------------------------------

  function handleContinueFromDirectorRoles() {
    const nextErrors = validateOnboardingStep("director_roles", form);

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return;
    }

    const normalizedPrimaryRole =
      directorRoles.length === 1 ? directorRoles[0] : directorPrimaryRole;

    patchForm({
      lastCompletedStep: "director_roles",
      directorPrimaryRole: normalizedPrimaryRole,
    });
    setValidationErrors({});
    navigateToStep("director_responsibilities");
  }

  function handleContinueFromDirectorResponsibilities() {
    const nextErrors = validateOnboardingStep(
      "director_responsibilities",
      form,
    );

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return;
    }

    patchForm({ lastCompletedStep: "director_responsibilities" });
    setValidationErrors({});
    navigateToStep("director_categories");
  }

  function handleContinueFromDirectorCategories() {
    const nextErrors = validateOnboardingStep("director_categories", form);

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return;
    }

    patchForm({ lastCompletedStep: "director_categories" });
    setValidationErrors({});
    navigateToStep("director_focus");
  }

  function handleContinueFromDirectorFocus() {
    const nextErrors = validateOnboardingStep("director_focus", form);

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return;
    }

    patchForm({ lastCompletedStep: "director_focus" });
    setValidationErrors({});
    navigateToStep("director_market");
  }

  function handleContinueFromDirectorMarket() {
    const nextErrors = validateOnboardingStep("director_market", form);

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return;
    }

    patchForm({ lastCompletedStep: "director_market" });
    setValidationErrors({});
    navigateToStep("director_career");
  }

  function handleContinueFromDirectorCareer() {
    patchForm({ lastCompletedStep: "director_career" });
    navigateToStep("director_football_experience");
  }

  function handleContinueFromDirectorFootballExperience() {
    const nextErrors = validateOnboardingStep(
      "director_football_experience",
      form,
    );

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return;
    }

    patchForm({ lastCompletedStep: "director_football_experience" });
    setValidationErrors({});
    if (
      directorHasOtherFootballExperience &&
      directorOtherFootballRoles.includes("Allenatore")
    ) {
      navigateToStep("director_coach_career");
      return;
    }
    navigateToStep("director_player_career_toggle");
  }

  function handleContinueFromDirectorCoachCareer() {
    patchForm({ lastCompletedStep: "director_coach_career" });
    navigateToStep("director_player_career_toggle");
  }

  function handleContinueFromDirectorPlayerCareerToggle() {
    patchForm({ lastCompletedStep: "director_player_career_toggle" });

    if (directorHasPlayedFootball) {
      navigateToStep("director_player_career");
    } else {
      navigateToStep("director_club_type");
    }
  }

  function handleContinueFromDirectorPlayerCareer() {
    patchForm({ lastCompletedStep: "director_player_career" });
    navigateToStep("director_club_type");
  }

  function handleContinueFromDirectorClubType() {
    const nextErrors = validateOnboardingStep("director_club_type", form);

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return;
    }

    patchForm({ lastCompletedStep: "director_club_type" });
    setValidationErrors({});
    navigateToStep("director_extra");
  }

  async function handleFinishDirectorExtra() {
    if (!session?.user) {
      return;
    }

    try {
      setIsSubmitting(true);

      await ensureInitialProfileCreated();

      await updateCompleteProfessionalProfile({
        agentProfile: null,
        club: null,
        clubSeasonEntries: [],
        coachProfile: null,
        directorProfile: {
          career_entries: directorCareerEntries.map(normalizeCoachCareerEntryForJson),
          coach_career_entries:
            directorHasOtherFootballExperience &&
            directorOtherFootballRoles.includes("Allenatore")
              ? directorCoachCareerEntries.map(normalizeCoachCareerEntryForJson)
              : [],
          club_types: directorClubTypes,
          director_roles: directorRoles,
          experience_categories: directorCategories,
          has_other_football_experience: directorHasOtherFootballExperience,
          has_played_football: directorHasPlayedFootball,
          main_focus: directorMainFocus || null,
          market_involvement: directorMarketInvolvement || null,
          other_football_roles: directorOtherFootballRoles,
          player_career_entries: directorPlayerCareerEntries,
          primary_role: directorPrimaryRole || null,
          responsibilities: directorResponsibilities,
        },
        playerCareerEntries: [],
        playerProfile: null,
        profile: buildOnboardingProfilePayload({
          bioValue: directorBio,
          languages: directorLanguages,
        }),
        profileId: session.user.id,
        role: role as AppRole,
        staffProfile: null,
        userContacts: {
          email: "",
          facebook: "",
          instagram: "",
          phone: composePhoneNumber(phoneCountryCode, phoneNumber),
          showEmail: false,
          showFacebook: false,
          showInstagram: false,
        },
      });

      goToCompletion("director_extra");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore inatteso nel completamento profilo.";
      Alert.alert("Profilo non salvato", message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleContinueFromMediaEntity() {
    const nextErrors = validateOnboardingStep("media_entity", form);

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return;
    }

    patchForm({ lastCompletedStep: "media_entity" });
    setValidationErrors({});
    navigateToStep("media_content");
  }

  function handleContinueFromMediaContent() {
    const nextErrors = validateOnboardingStep("media_content", form);

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return;
    }

    patchForm({ lastCompletedStep: "media_content" });
    setValidationErrors({});
    navigateToStep("media_focus");
  }

  function handleContinueFromMediaFocus() {
    const nextErrors = validateOnboardingStep("media_focus", form);

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return;
    }

    patchForm({ lastCompletedStep: "media_focus" });
    setValidationErrors({});
    navigateToStep("media_channels");
  }

  function handleContinueFromMediaChannels() {
    patchForm({ lastCompletedStep: "media_channels" });
    setValidationErrors({});
    navigateToStep("media_collaborations");
  }

  function handleContinueFromMediaCollaborations() {
    const nextErrors = validateOnboardingStep("media_collaborations", form);

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return;
    }

    patchForm({ lastCompletedStep: "media_collaborations" });
    setValidationErrors({});
    handleFinishMediaOnboarding();
  }

  async function handleFinishFanOnboarding() {
    if (!session?.user) {
      return;
    }

    try {
      setIsSubmitting(true);

      await ensureInitialProfileCreated();

      await updateCompleteProfessionalProfile({
        agentProfile: null,
        club: null,
        clubSeasonEntries: [],
        coachProfile: null,
        directorProfile: null,
        fanProfile: {
          favorite_club_id: fanFavoriteClubId,
          favorite_team_name: fanFavoriteTeamName,
          interest_categories: fanInterestCategories,
          interest_regions: fanInterestRegions,
        },
        mediaProfile: null,
        playerCareerEntries: [],
        playerProfile: null,
        profile: {
          ...buildOnboardingProfilePayload({
            bioValue: "",
          }),
          bio: null,
        },
        profileId: session.user.id,
        role: role as AppRole,
        staffProfile: null,
        userContacts: {
          email: "",
          facebook: "",
          instagram: "",
          phone: "",
          showEmail: false,
          showFacebook: false,
          showInstagram: false,
          showTikTok: false,
          showWebsite: false,
          showYouTube: false,
          tiktok: "",
          website: "",
          youtube: "",
        },
      });

      goToCompletion("fan_interests");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore inatteso nel completamento profilo.";
      Alert.alert("Profilo non salvato", message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleFinishMediaOnboarding() {
    if (!session?.user) {
      return;
    }

    try {
      setIsSubmitting(true);

      await ensureInitialProfileCreated();

      await updateCompleteProfessionalProfile({
        agentProfile: null,
        club: null,
        clubSeasonEntries: [],
        coachProfile: null,
        directorProfile: null,
        fanProfile: null,
        mediaProfile: {
          affiliation_name:
            mediaAffiliationType !== "Nessuna"
              ? parseOptionalText(mediaAffiliationName)
              : null,
          affiliation_type:
            mediaAffiliationType !== "Nessuna"
              ? parseOptionalText(mediaAffiliationType)
              : null,
          content_types: mediaContentTypes,
          entity_name: parseOptionalText(mediaEntityName),
          focus_areas: mediaFocusAreas,
          logo_url: parseOptionalText(mediaLogoUrl),
          short_description: parseOptionalText(mediaEntityDescription),
        },
        playerCareerEntries: [],
        playerProfile: null,
        profile: buildOnboardingProfilePayload({
          bioValue: mediaEntityDescription,
        }),
        profileId: session.user.id,
        role: role as AppRole,
        staffProfile: null,
        userContacts: {
          email: "",
          facebook: mediaFacebook,
          instagram: mediaInstagram,
          phone: "",
          showEmail: false,
          showFacebook: Boolean(mediaFacebook.trim()),
          showInstagram: Boolean(mediaInstagram.trim()),
          showTikTok: Boolean(mediaTikTok.trim()),
          showWebsite: Boolean(mediaWebsite.trim()),
          showYouTube: Boolean(mediaYouTube.trim()),
          tiktok: mediaTikTok,
          website: mediaWebsite,
          youtube: mediaYouTube,
        },
      });

      goToCompletion("media_collaborations");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore inatteso nel completamento profilo media.";
      Alert.alert("Profilo media non salvato", message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleContinueFromCoachRole() {
    const nextErrors = validateOnboardingStep("coach_role", form);

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return;
    }

    setValidationErrors({});
    patchForm({ lastCompletedStep: "coach_role" });
    navigateToStep("coach_availability");
  }

  function handleContinueFromCoachAvailability() {
    setValidationErrors({});
    patchForm({ lastCompletedStep: "coach_availability" });
    navigateToStep("coach_career");
  }

  function handleContinueFromCoachCareer() {
    patchForm({ lastCompletedStep: "coach_career" });
    navigateToStep("player_career_toggle");
  }

  function handleContinueFromPlayerCareerToggle() {
    patchForm({ lastCompletedStep: "player_career_toggle" });

    if (hasPlayedFootball) {
      navigateToStep("player_career");
    } else {
      navigateToStep("coach_extra");
    }
  }

  function handleContinueFromPlayerCareer() {
    patchForm({ lastCompletedStep: "player_career" });
    navigateToStep("coach_extra");
  }

  async function handleFinishCoachExtra() {
    if (!session?.user) {
      return;
    }

    try {
      setIsSubmitting(true);

      await ensureInitialProfileCreated();

      await updateCompleteProfessionalProfile({
        club: null,
        clubSeasonEntries: [],
        coachCareerEntries: coachCareerEntries.map((entry, index) => ({
          category: entry.category || null,
          club_id: entry.clubId ?? null,
          coach_profile_id: session.user.id,
          description: entry.description?.trim() || null,
          experience_type: entry.type,
          id: entry.id,
          period_end_month: entry.period?.endMonth || null,
          period_end_year: entry.period?.endYear ? Number(entry.period.endYear) : null,
          period_start_month: entry.period?.startMonth || null,
          period_start_year: entry.period?.startYear ? Number(entry.period.startYear) : null,
          results: [],
          role: entry.role,
          season_details: entry.seasonDetails,
          seasons: entry.seasons,
          sort_order: index,
          team_logo_url: entry.teamLogoUrl ?? null,
          team_name: entry.teamName,
        })),
        coachDirectorCareerEntries: [],
        coachPlayerCareerEntries: coachPlayerCareerEntries.map((entry, index) => ({
          appearances: Number.parseInt(entry.appearances, 10) || 0,
          assists: Number.parseInt(entry.assists, 10) || 0,
          category: entry.category || null,
          coach_profile_id: session.user.id,
          goals: Number.parseInt(entry.goals, 10) || 0,
          id: entry.id ?? globalThis.crypto.randomUUID(),
          position: null,
          season: entry.seasonLabel,
          sort_order: index,
          team_logo_url: entry.teamLogoUrl || null,
          team_name: entry.clubName,
        })),
        coachProfile: {
          availability_type: coachAvailabilityType || null,
          available_from: openToNewRole
            ? parseOptionalText(coachAvailableFrom)
            : null,
          coached_categories: coachCategoriesArray,
          coached_clubs: [],
          contract_end: null,
          current_club: null,
          game_philosophy: gamePhilosophy || null,
          licenses: coachLicenseType ? [coachLicenseType] : [],
          media_items: [],
          open_to_new_role: openToNewRole,
          play_styles: coachPlayStyle ? [coachPlayStyle] : [],
          preferred_categories: [],
          preferred_formation: parseOptionalText(coachFormation),
          preferred_provinces: coachProvincesArray,
          preferred_regions: coachRegionsArray,
          primary_role: parseOptionalText(coachPrimaryRole),
          secondary_formations: [],
          technical_video_url: null,
        },
        playerCareerEntries: [],
        playerProfile: null,
        profile: buildOnboardingProfilePayload({
          bioValue: form.bio,
          languages: coachLanguages,
        }),
        profileId: session.user.id,
        role: role as AppRole,
        staffProfile: null,
        userContacts: {
          email: "",
          facebook: "",
          instagram: "",
          phone: composePhoneNumber(phoneCountryCode, phoneNumber),
          showEmail: false,
          showFacebook: false,
          showInstagram: false,
        },
      });

      goToCompletion("coach_extra");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore inatteso nel completamento profilo.";
      Alert.alert("Profilo non salvato", message);
    } finally {
      setIsSubmitting(false);
    }
  }

  /**
   * Avanzamento di uno step Società (REV-ONB-05 §S).
   *
   * Lo step successivo non è fisso: lo decide la struttura del club, così
   * chi non ha una prima squadra non incontra mai quella schermata.
   */
  function advanceClubStep(currentClubStep: OnboardingStep) {
    const nextErrors = validateOnboardingStep(currentClubStep, form);

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return false;
    }

    setValidationErrors({});
    patchForm({ lastCompletedStep: currentClubStep });

    const nextStep = getNextOnboardingStep(
      currentClubStep,
      "club_admin",
      clubStructure,
    );

    if (nextStep && nextStep !== "complete") {
      navigateToStep(nextStep);
    }

    return true;
  }

  function handleContinueFromClubRepresentative() {
    if (advanceClubStep("club_representative")) {
      trackClubOnboardingEvent({ name: "society_referent_completed" });
    }
  }

  function handleContinueFromClubIdentity() {
    if (advanceClubStep("club_data")) {
      trackClubOnboardingEvent({
        colorCount: clubSocialColors.length,
        name: "society_identity_completed",
      });
    }
  }

  function handleContinueFromClubStructure() {
    advanceClubStep("club_structure");
  }

  function handleContinueFromClubFirstTeam() {
    advanceClubStep("club_first_team");
  }

  function handleContinueFromClubYouth() {
    if (advanceClubStep("club_youth")) {
      trackClubOnboardingEvent({
        count: clubYouthCategories.length,
        name: "youth_categories_selected",
      });
    }
  }

  async function handleContinueFromClubContacts() {
    const nextErrors = validateOnboardingStep("club_contacts", form);

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      setValidationErrors({});

      // §BB: la rilevazione dei duplicati esisteva già e resta. Vive qui
      // perché è il primo punto in cui conosciamo sia il nome sia la città.
      const duplicates = await checkDuplicateClubs(clubName, clubCity);

      if (duplicates.length > 0) {
        const names = duplicates
          .map((d) => `• ${d.name} (${d.city})`)
          .join("\n");

        const confirmed = await new Promise<boolean>((resolve) => {
          Alert.alert(
            "Società simile già presente",
            `Esiste già una società con un nome simile:\n\n${names}\n\nVuoi continuare comunque?`,
            [
              {
                text: "Annulla",
                style: "cancel",
                onPress: () => resolve(false),
              },
              { text: "Continua comunque", onPress: () => resolve(true) },
            ],
          );
        });

        if (!confirmed) {
          return;
        }
      }

      trackClubOnboardingEvent({ name: "society_contacts_completed" });
      patchForm({ lastCompletedStep: "club_contacts" });
      navigateToStep("club_profile");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Errore inatteso.";
      Alert.alert("Verifica duplicati non riuscita", message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmitClubProfile() {
    try {
      setIsSubmitting(true);

      // §AM: i canali si normalizzano al salvataggio, così l'utente non deve
      // conoscere il formato che ci aspettiamo.
      const normalizedChannels = {
        clubFacebook: normalizeClubChannelValue("facebook", clubFacebook),
        clubInstagram: normalizeClubChannelValue("instagram", clubInstagram),
        clubTikTok: normalizeClubChannelValue("tiktok", clubTikTok),
        clubWebsite: normalizeClubChannelValue("website", clubWebsite),
        clubYouTube: normalizeClubChannelValue("youtube", clubYouTube),
      };

      patchForm(normalizedChannels);

      await ensureInitialProfileCreated(normalizedChannels);

      trackClubOnboardingEvent({
        channelCount: Object.values(normalizedChannels).filter(Boolean).length,
        name: "society_optional_profile_completed",
      });

      if (clubStructure) {
        trackClubOnboardingEvent({
          name: "onboarding_society_completed",
          structure: clubStructure,
        });
      }

      goToCompletion("club_profile");
    } catch (error) {
      const alertCopy = getBaseStepAlert(error);
      Alert.alert(alertCopy.title, alertCopy.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function finishOnboarding(destination: CompletionDestination) {
    await refreshProfile();
    await resetForm();

    if (destination === "network") {
      router.replace("/(tabs)/cerca");
      return;
    }

    if (destination === "profile") {
      router.replace("/(tabs)/profile");
      return;
    }

    router.replace("/(tabs)");
  }

  function goToCompletion(previousStep: OnboardingStep) {
    patchForm({ lastCompletedStep: previousStep });
    navigateToStep("complete");
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (!isHydrated) {
    return null;
  }

  if (step === "complete") {
    // §BJ–§BL: per il Calciatore la chiusura ha un solo invito e nessun
    // riepilogo del profilo.
    const isPlayer = role === "player";
    // REV-ONB-05 §AO: per la Società la chiusura è un invito, non un
    // cruscotto: nessun riepilogo, nessuna percentuale, una sola CTA.
    const isClub = role === "club_admin";
    const hasSingleCta = isPlayer || isClub;

    return (
      <>
        <Stack.Screen
          options={{
            fullScreenGestureEnabled: false,
            gestureEnabled: false,
            headerShown: false,
          }}
        />
        <OnboardingCompletion
          description={
            isClub
              ? "Benvenuto su ProLink. Ora puoi iniziare a raccontare e far crescere il tuo club."
              : isPlayer
                ? "Benvenuto in ProLink. Ora puoi iniziare a creare connessioni e scoprire nuove opportunità."
                : getCompletionDescription(role)
          }
          onPrimaryPress={() => finishOnboarding("feed")}
          onSecondaryPress={
            hasSingleCta ? undefined : () => finishOnboarding("profile")
          }
          primaryLabel={hasSingleCta ? "Scopri ProLink" : "Entra in ProLink"}
          secondaryLabel={
            hasSingleCta ? undefined : "Completa ulteriormente il profilo"
          }
          title={
            isClub ? "La pagina del club è pronta" : "Il tuo profilo è pronto"
          }
        />
      </>
    );
  }

  // ---------------------------------------------------------------------
  // Calciatore: i suoi passi vivono sulle pagine intere del Master
  // (REV-ONB-02). La rotta resta proprietaria di navigazione e salvataggio.
  // ---------------------------------------------------------------------
  if (isPlayerMasterStep(step, role)) {
    return (
      <>
        <Stack.Screen
          options={{
            fullScreenGestureEnabled: false,
            gestureEnabled: false,
            headerShown: false,
          }}
        />
        <PlayerOnboardingFlow
          counter={counter}
          form={form}
          isBusy={isBusy}
          nationalityCategory={nationalityCategory}
          onBack={handleBackNavigation}
          onClearValidationErrors={clearValidationErrors}
          onContinueFromAvailability={handleContinueFromPlayerAvailability}
          onContinueFromPersonalData={handleContinueFromBase}
          onContinueFromPhoto={handleContinueFromPhoto}
          onContinueFromSportsProfile={handleContinueFromTechnical}
          onDomicileChange={handleDomicileChange}
          onDomicileSelect={handleDomicileSelect}
          onDomicileToggle={handleDomicileToggle}
          onFormattedNameBlur={handleFormattedNameBlur}
          onNationalityChange={handleNationalitySelect}
          onPatchForm={patchForm}
          onPickPhotoFromLibrary={() =>
            handleMediaUpload({
              field: "avatar",
              folder: "avatars",
              mediaTypes: ["images"],
              onUploaded: (items) =>
                updateValue("avatarUrl", items[0]?.url ?? ""),
            })
          }
          onRegisterBack={registerStepBackOverride}
          onRemovePhoto={() => updateValue("avatarUrl", "")}
          onResidenceChange={handleResidenceChange}
          onResidenceSelect={handleResidenceSelect}
          onSaveCareer={handleSaveExperiences}
          onShowPhysicalFieldsChange={setShowPhysicalFields}
          onTakePhoto={() =>
            handleCameraCapture({
              field: "avatar",
              folder: "avatars",
              onUploaded: (items) =>
                updateValue("avatarUrl", items[0]?.url ?? ""),
            })
          }
          photoPreviewUrl={
            avatarUrl ? withDefaultProfileAvatar(avatarUrl) : null
          }
          searchTeams={searchTeams}
          showPhysicalFields={showPhysicalFields}
          step={step}
          validationErrors={validationErrors}
        />
      </>
    );
  }

  // ---------------------------------------------------------------------
  // Allenatore: stesse pagine intere del Master (REV-ONB-03). Le schermate
  // comuni e la carriera da giocatore riusano i componenti del Calciatore.
  // ---------------------------------------------------------------------
  if (isCoachMasterStep(step, role)) {
    return (
      <>
        <Stack.Screen
          options={{
            fullScreenGestureEnabled: false,
            gestureEnabled: false,
            headerShown: false,
          }}
        />
        <CoachOnboardingFlow
          counter={counter}
          form={form}
          isBusy={isBusy}
          nationalityCategory={nationalityCategory}
          onBack={handleBackNavigation}
          onClearValidationErrors={clearValidationErrors}
          onContinueFromAvailability={handleContinueFromCoachAvailability}
          onContinueFromCareer={handleContinueFromCoachCareer}
          onContinueFromPersonalData={handleContinueFromBase}
          onContinueFromPhoto={handleContinueFromPhoto}
          onContinueFromPlayerCareer={handleContinueFromPlayerCareer}
          onContinueFromPlayerCareerChoice={
            handleContinueFromPlayerCareerToggle
          }
          onContinueFromQualification={handleContinueFromCoachRole}
          onDomicileChange={handleDomicileChange}
          onDomicileSelect={handleDomicileSelect}
          onDomicileToggle={handleDomicileToggle}
          onFinish={handleFinishCoachExtra}
          onFormattedNameBlur={handleFormattedNameBlur}
          onNationalityChange={handleNationalitySelect}
          onPatchForm={patchForm}
          onPickPhotoFromLibrary={() =>
            handleMediaUpload({
              field: "avatar",
              folder: "avatars",
              mediaTypes: ["images"],
              onUploaded: (items) =>
                updateValue("avatarUrl", items[0]?.url ?? ""),
            })
          }
          onRegisterBack={registerStepBackOverride}
          onRemovePhoto={() => updateValue("avatarUrl", "")}
          onResidenceChange={handleResidenceChange}
          onResidenceSelect={handleResidenceSelect}
          onTakePhoto={() =>
            handleCameraCapture({
              field: "avatar",
              folder: "avatars",
              onUploaded: (items) =>
                updateValue("avatarUrl", items[0]?.url ?? ""),
            })
          }
          photoPreviewUrl={
            avatarUrl ? withDefaultProfileAvatar(avatarUrl) : null
          }
          searchTeams={searchTeams}
          step={step}
          validationErrors={validationErrors}
        />
      </>
    );
  }

  // ---------------------------------------------------------------------
  // Staff tecnico: stesse pagine intere del Master (REV-ONB-04). Schermate
  // comuni e disponibilità dal Calciatore, esperienze dall'Allenatore.
  // ---------------------------------------------------------------------
  if (isStaffMasterStep(step, role)) {
    return (
      <>
        <Stack.Screen
          options={{
            fullScreenGestureEnabled: false,
            gestureEnabled: false,
            headerShown: false,
          }}
        />
        <StaffOnboardingFlow
          counter={counter}
          form={form}
          isBusy={isBusy}
          nationalityCategory={nationalityCategory}
          onBack={handleBackNavigation}
          onClearValidationErrors={clearValidationErrors}
          onContinueFromAvailability={handleContinueFromStaffAvailability}
          onContinueFromCareer={handleSaveStaffCareer}
          onContinueFromCoachCareer={handleContinueFromStaffCoachCareer}
          onContinueFromPersonalData={handleContinueFromBase}
          onContinueFromPhoto={handleContinueFromPhoto}
          onContinueFromPlayerCareer={handleContinueFromStaffPlayerCareer}
          onContinueFromPreviousExperiences={
            handleContinueFromStaffPreviousExperiences
          }
          onContinueFromRoles={handleContinueFromStaffRole}
          onDomicileChange={handleDomicileChange}
          onDomicileSelect={handleDomicileSelect}
          onDomicileToggle={handleDomicileToggle}
          onFormattedNameBlur={handleFormattedNameBlur}
          onNationalityChange={handleNationalitySelect}
          onPatchForm={patchForm}
          onPickPhotoFromLibrary={() =>
            handleMediaUpload({
              field: "avatar",
              folder: "avatars",
              mediaTypes: ["images"],
              onUploaded: (items) =>
                updateValue("avatarUrl", items[0]?.url ?? ""),
            })
          }
          onRegisterBack={registerStepBackOverride}
          onRemovePhoto={() => updateValue("avatarUrl", "")}
          onResidenceChange={handleResidenceChange}
          onResidenceSelect={handleResidenceSelect}
          onTakePhoto={() =>
            handleCameraCapture({
              field: "avatar",
              folder: "avatars",
              onUploaded: (items) =>
                updateValue("avatarUrl", items[0]?.url ?? ""),
            })
          }
          photoPreviewUrl={
            avatarUrl ? withDefaultProfileAvatar(avatarUrl) : null
          }
          searchTeams={searchTeams}
          step={step}
          validationErrors={validationErrors}
        />
      </>
    );
  }

  // ---------------------------------------------------------------------
  // Società: stesse pagine intere del Master (REV-ONB-05). Il flusso si
  // adatta alla struttura reale del club invece di chiedere tutto a tutti.
  // ---------------------------------------------------------------------
  if (isClubMasterStep(step, role)) {
    return (
      <>
        <Stack.Screen
          options={{
            fullScreenGestureEnabled: false,
            gestureEnabled: false,
            headerShown: false,
          }}
        />
        <ClubOnboardingFlow
          counter={counter}
          form={form}
          isBusy={isBusy}
          onBack={handleBackNavigation}
          onCityChange={handleClubCityChange}
          onCitySelect={handleClubCitySelect}
          onClearValidationErrors={clearValidationErrors}
          onContinueFromContacts={handleContinueFromClubContacts}
          onContinueFromFirstTeam={handleContinueFromClubFirstTeam}
          onContinueFromIdentity={handleContinueFromClubIdentity}
          onContinueFromRepresentative={handleContinueFromClubRepresentative}
          onContinueFromStructure={handleContinueFromClubStructure}
          onContinueFromYouth={handleContinueFromClubYouth}
          onFormattedNameBlur={handleFormattedNameBlur}
          onPatchForm={patchForm}
          onPickLogoFromLibrary={() =>
            handleMediaUpload({
              field: "clubLogo",
              folder: "club-logos",
              mediaTypes: ["images"],
              onUploaded: (items) =>
                updateValue("clubLogoUrl", items[0]?.url ?? ""),
            })
          }
          onSocialColorsChange={handleClubSocialColorsChange}
          onSubmitProfile={handleSubmitClubProfile}
          onTakeLogoPhoto={() =>
            handleCameraCapture({
              field: "clubLogo",
              folder: "club-logos",
              onUploaded: (items) =>
                updateValue("clubLogoUrl", items[0]?.url ?? ""),
            })
          }
          socialColors={clubSocialColors}
          step={step}
          validationErrors={validationErrors}
        />
      </>
    );
  }

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      <Stack.Screen
        options={{
          fullScreenGestureEnabled: false,
          gestureEnabled: false,
          headerShown: false,
        }}
      />

      <OnboardingHeader
        currentStep={step === "role" ? undefined : counter.current}
        onBack={canGoBack ? handleBackNavigation : undefined}
        stepLabel={step === "role" ? undefined : counter.label}
        totalSteps={step === "role" ? undefined : counter.total}
      />

      <KeyboardAwareForm contentContainerStyle={styles.formContent}>
        {/* ============================================================= */}
        {/* STEP: Role                                                     */}
        {/* ============================================================= */}
        {step === "role" ? (
          <View style={styles.stepContainer}>
            <View style={styles.pageTitleGroup}>
              <AppText variant="screenTitle">Scegli il tuo profilo</AppText>
              <AppText color="secondary" variant="bodyLg">
                Seleziona il ruolo che ti rappresenta per un&apos;esperienza su
                misura.
              </AppText>
            </View>

            <ValidationMessage>{validationErrors.role}</ValidationMessage>

            <View
              accessibilityRole="radiogroup"
              style={styles.roleList}
            >
              {ONBOARDING_ROLE_OPTIONS.map((entry) => (
                <RoleCard
                  description={entry.description}
                  icon={entry.icon}
                  key={entry.value}
                  label={entry.label}
                  onPress={() => {
                    patchForm({
                      communityProfileType: "",
                      role: entry.value === "community" ? "fan" : entry.value,
                    });
                    clearValidationErrors(["role", "communityProfileType"]);
                  }}
                  selected={
                    entry.value === "community"
                      ? role === "fan" || role === "media"
                      : role === entry.value
                  }
                  testID={`role-card-${entry.value}`}
                />
              ))}
            </View>

            <Button
              disabled={!role}
              label="Continua"
              onPress={handleContinueFromRole}
              size="lg"
              style={styles.primaryCta}
              variant="primary"
            />
          </View>
        ) : null}

        {step === "community_profile_type" ? (
          <View style={styles.stepContainer}>
            <CommunityProfileTypeStep
              errorMessage={validationErrors.communityProfileType}
              onSelect={(value) => {
                patchForm({ communityProfileType: value, role: value });
                clearValidationErrors(["communityProfileType", "role"]);
              }}
              selectedValue={communityProfileType}
            />
            <Button
              disabled={!communityProfileType}
              label="Continua"
              onPress={handleContinueFromCommunityProfileType}
              variant="primary"
            />
          </View>
        ) : null}

        {/* ============================================================= */}
        {/* STEP: Base (personal data)                                     */}
        {/* ============================================================= */}
        {step === "fan_basic" || step === "media_basic" ? (
          <View style={styles.stepContainer}>
            <CommunityBasicInfoStep
              birthDate={birthDate}
              firstName={firstName}
              lastName={lastName}
              onFormattedNameBlur={handleFormattedNameBlur}
              onUpdate={(patch, fieldsToClear) => {
                patchForm(patch);
                clearValidationErrors(fieldsToClear ?? Object.keys(patch));
              }}
              subtitle={
                step === "media_basic"
                  ? "Inserisci i tuoi dati personali per creare il tuo account media."
                  : "Inserisci le tue informazioni personali per creare il tuo profilo base."
              }
              title="I tuoi dati"
              validationErrors={validationErrors}
            />
            <Button
              label="Continua"
              onPress={handleContinueFromCommunityBasic}
              variant="primary"
            />
          </View>
        ) : null}

        {step === "base" ? (
          role === "agent" || role === "director" ? (
            <AgentBasicInfoStep
              birthDate={birthDate}
              currentLocationCity={currentLocationCity}
              currentLocationCountry={currentLocationCountry}
              firstName={firstName}
              lastName={lastName}
              legalStatus={legalStatus as LegalStatus}
              nationality={nationality}
              phoneCountryCode={phoneCountryCode}
              phoneNumber={phoneNumber}
              residence={residence}
              residenceCountry={residenceCountry}
              residenceRegion={residenceRegion}
              validationErrors={validationErrors}
              onContinue={handleContinueFromBase}
              onFormattedNameBlur={handleFormattedNameBlur}
              onNationalityChange={handleNationalitySelect}
              onResidenceChange={handleResidenceChange}
              onResidenceSelect={handleResidenceSelect}
              onUpdate={(patch, fieldsToClear) => {
                patchForm(patch);
                clearValidationErrors(fieldsToClear ?? Object.keys(patch));
              }}
            />
          ) : (
            <View style={styles.stepContainer}>
              <OnboardingSectionCard
                title="Informazioni personali"
                subtitle="Completa i dati minimi per attivare il profilo."
              >
                {validationErrors.form ? (
                  <ValidationMessage>{validationErrors.form}</ValidationMessage>
                ) : null}

                <View style={styles.fieldGap12}>
                  <Input
                    autoCapitalize="words"
                    autoCorrect={false}
                    label="Nome *"
                    onBlur={() => handleFormattedNameBlur("firstName")}
                    onChangeText={(value) => updateValue("firstName", value)}
                    placeholder="Es. Marco"
                    style={
                      validationErrors.firstName
                        ? { borderColor: colors.danger }
                        : undefined
                    }
                    value={firstName}
                  />
                  {validationErrors.firstName ? (
                    <ValidationMessage>
                      {validationErrors.firstName}
                    </ValidationMessage>
                  ) : null}
                  <Input
                    autoCapitalize="words"
                    autoCorrect={false}
                    label="Cognome *"
                    onBlur={() => handleFormattedNameBlur("lastName")}
                    onChangeText={(value) => updateValue("lastName", value)}
                    placeholder="Es. Rossi"
                    style={
                      validationErrors.lastName
                        ? { borderColor: colors.danger }
                        : undefined
                    }
                    value={lastName}
                  />
                  {validationErrors.lastName ? (
                    <ValidationMessage>
                      {validationErrors.lastName}
                    </ValidationMessage>
                  ) : null}
                </View>

                <SegmentedSelector
                  errorMessage={validationErrors.gender}
                  label="Sesso"
                  onChange={(value) =>
                    updateValue("gender", value, ["gender"])
                  }
                  options={genderOptions}
                  testID="gender-selector"
                  value={gender}
                />

                <DatePickerField
                  label="Data di nascita *"
                  onChange={(value) => updateValue("birthDate", value)}
                  placeholder="Apri il calendario e seleziona la data"
                  value={birthDate}
                />
                {validationErrors.birthDate ? (
                  <ValidationMessage>
                    {validationErrors.birthDate}
                  </ValidationMessage>
                ) : null}

                <NationalityAutocompleteInput
                  errorMessage={validationErrors.nationality}
                  label="Nazionalità *"
                  onChange={handleNationalitySelect}
                  value={nationality}
                />
                {validationErrors.nationality ? (
                  <ValidationMessage>
                    {validationErrors.nationality}
                  </ValidationMessage>
                ) : null}

                {/* Italian users: Italian city autocomplete + optional domicile */}
                {nationalityCategory === "italy" ? (
                  <>
                    <ResidenceCityInput
                      errorMessage={validationErrors.residence}
                      helperText={
                        residenceRegion
                          ? `Città selezionata: ${residence} · ${residenceRegion}`
                          : undefined
                      }
                      onChangeText={handleResidenceChange}
                      onSelectCity={handleResidenceSelect}
                      value={residence}
                    />

                    <Toggle
                      label="Vuoi inserire un domicilio diverso dalla residenza?"
                      onValueChange={handleDomicileToggle}
                      value={!useResidenceForDomicile}
                    />

                    {!useResidenceForDomicile ? (
                      <ResidenceCityInput
                        errorMessage={validationErrors.domicile}
                        helperText={
                          domicileRegion
                            ? `Città selezionata: ${domicile} · ${domicileRegion}`
                            : undefined
                        }
                        label="Domicilio"
                        onChangeText={handleDomicileChange}
                        onSelectCity={handleDomicileSelect}
                        placeholder="Cerca la città di domicilio"
                        value={domicile}
                      />
                    ) : null}
                  </>
                ) : null}

                {/* EU and non-EU users: international residence + current location */}
                {(nationalityCategory === "eu" ||
                  nationalityCategory === "non_eu") &&
                nationality ? (
                  <>
                    <View style={styles.sectionHeaderGap}>
                      <AppText variant="titleSm">Residenza</AppText>
                      <AppText variant="bodySm" color="secondary">
                        Il paese dove sei ufficialmente residente.
                      </AppText>
                    </View>

                    <NationalityAutocompleteInput
                      errorMessage={validationErrors.residenceCountry}
                      label="Paese di residenza *"
                      onChange={(value) =>
                        updateValue("residenceCountry", value, [
                          "residenceCountry",
                        ])
                      }
                      value={residenceCountry}
                    />
                    {validationErrors.residenceCountry ? (
                      <ValidationMessage>
                        {validationErrors.residenceCountry}
                      </ValidationMessage>
                    ) : null}

                    <View style={styles.sectionHeaderGap}>
                      <AppText variant="titleSm">
                        Dove ti trovi attualmente
                      </AppText>
                      <AppText variant="bodySm" color="secondary">
                        Il paese e la città in cui vivi in questo momento.
                      </AppText>
                    </View>

                    <NationalityAutocompleteInput
                      errorMessage={validationErrors.currentLocationCountry}
                      label="Paese attuale *"
                      onChange={(value) =>
                        updateValue("currentLocationCountry", value, [
                          "currentLocationCountry",
                        ])
                      }
                      value={currentLocationCountry}
                    />
                    {validationErrors.currentLocationCountry ? (
                      <ValidationMessage>
                        {validationErrors.currentLocationCountry}
                      </ValidationMessage>
                    ) : null}

                    <Input
                      autoCapitalize="words"
                      autoCorrect={false}
                      label="Città attuale *"
                      onChangeText={(value) =>
                        updateValue("currentLocationCity", value, [
                          "currentLocationCity",
                        ])
                      }
                      placeholder="Es. Milano"
                      style={
                        validationErrors.currentLocationCity
                          ? { borderColor: colors.danger }
                          : undefined
                      }
                      value={currentLocationCity}
                    />
                    {validationErrors.currentLocationCity ? (
                      <ValidationMessage>
                        {validationErrors.currentLocationCity}
                      </ValidationMessage>
                    ) : null}
                  </>
                ) : null}

                {/* Non-EU only: legal status selector */}
                {nationalityCategory === "non_eu" && nationality ? (
                  <>
                    <View style={styles.sectionHeaderGap}>
                      <AppText variant="titleSm">Stato legale *</AppText>
                      <AppText variant="bodySm" color="secondary">
                        La tua situazione relativa al permesso di soggiorno in
                        Italia.
                      </AppText>
                    </View>

                    <View style={styles.legalStatusOptions}>
                      {LEGAL_STATUS_OPTIONS.map((option) => (
                        <Pressable
                          key={option.value}
                          onPress={() =>
                            updateValue("legalStatus", option.value, [
                              "legalStatus",
                            ])
                          }
                          style={[
                            styles.legalStatusOption,
                            legalStatus === option.value &&
                              styles.legalStatusOptionActive,
                          ]}
                        >
                          <AppText
                            variant="bodySm"
                            color={
                              legalStatus === option.value
                                ? "accentStrong"
                                : "primary"
                            }
                          >
                            {option.label}
                          </AppText>
                        </Pressable>
                      ))}
                    </View>
                    {validationErrors.legalStatus ? (
                      <ValidationMessage>
                        {validationErrors.legalStatus}
                      </ValidationMessage>
                    ) : null}
                  </>
                ) : null}

                <PhoneInputWithCountryCode
                  countryCode={phoneCountryCode}
                  errorMessage={validationErrors.phoneNumber}
                  label="Numero di cellulare"
                  onChangeCountryCode={(value) =>
                    updateValue("phoneCountryCode", value, ["phoneNumber"])
                  }
                  onChangePhoneNumber={(value) =>
                    updateValue("phoneNumber", value, ["phoneNumber"])
                  }
                  phoneNumber={phoneNumber}
                />

                {role === "club_admin" ? (
                  <View style={styles.fieldGap12}>
                    <AppText variant="headingSm">
                      Dati iniziali della società
                    </AppText>
                    <Input
                      label="Nome società"
                      onChangeText={(value) => updateValue("clubName", value)}
                      placeholder="Es. ASD Example"
                      style={
                        validationErrors.clubName
                          ? { borderColor: colors.danger }
                          : undefined
                      }
                      value={clubName}
                    />
                    {validationErrors.clubName ? (
                      <ValidationMessage>
                        {validationErrors.clubName}
                      </ValidationMessage>
                    ) : null}
                    <Input
                      label="Città"
                      onChangeText={(value) => updateValue("clubCity", value)}
                      placeholder="Es. Perugia"
                      style={
                        validationErrors.clubCity
                          ? { borderColor: colors.danger }
                          : undefined
                      }
                      value={clubCity}
                    />
                    {validationErrors.clubCity ? (
                      <ValidationMessage>
                        {validationErrors.clubCity}
                      </ValidationMessage>
                    ) : null}
                    <SelectField
                      label="Regione"
                      onChange={(value) => updateValue("clubRegion", value)}
                      options={REGION_OPTIONS}
                      placeholder="Seleziona la regione"
                      value={clubRegion}
                    />
                    {validationErrors.clubRegion ? (
                      <ValidationMessage>
                        {validationErrors.clubRegion}
                      </ValidationMessage>
                    ) : null}
                  </View>
                ) : null}
              </OnboardingSectionCard>

              <View style={styles.buttonRow}>
                <View style={styles.flex1}>
                  <Button
                    label="Indietro"
                    onPress={handleBackNavigation}
                    variant="secondary"
                  />
                </View>
                <View style={styles.flex1}>
                  <Button
                    label="Continua"
                    onPress={handleContinueFromBase}
                    variant="primary"
                  />
                </View>
              </View>
            </View>
          )
        ) : null}

        {/* ============================================================= */}
        {/* STEP: Photo                                                    */}
        {/* ============================================================= */}
        {step === "photo" || step === "fan_photo" || step === "media_photo" ? (
          <View style={styles.stepContainer}>
            <View style={styles.pageTitleGroup}>
              <AppText variant="screenTitle">Aggiungi la tua foto</AppText>
              <AppText color="secondary" variant="bodyLg">
                {step === "media_photo"
                  ? "Una foto personale rende riconoscibile il tuo account."
                  : "Una foto chiara aiuta gli altri a riconoscerti."}
              </AppText>
            </View>

            <PhotoPicker
              onPickFromLibrary={() =>
                handleMediaUpload({
                  field: "avatar",
                  folder: "avatars",
                  mediaTypes: ["images"],
                  onUploaded: (items) =>
                    updateValue("avatarUrl", items[0]?.url ?? ""),
                })
              }
              onRemove={avatarUrl ? () => updateValue("avatarUrl", "") : undefined}
              onTakePhoto={() =>
                handleCameraCapture({
                  field: "avatar",
                  folder: "avatars",
                  onUploaded: (items) =>
                    updateValue("avatarUrl", items[0]?.url ?? ""),
                })
              }
              uploading={uploadingField === "avatar"}
              value={avatarUrl ? withDefaultProfileAvatar(avatarUrl) : null}
            />

            <PhotoTips
              tips={[
                "Usa una foto chiara e recente",
                "Volto ben visibile",
                "Sfondo neutro, meglio",
              ]}
            />

            <Button
              disabled={uploadingField === "avatar"}
              label={avatarUrl ? "Continua" : "Salta per ora"}
              onPress={handleContinueFromPhoto}
              size="lg"
              style={styles.primaryCta}
              variant={avatarUrl ? "primary" : "secondary"}
            />
          </View>
        ) : null}

        {step === "fan_interests" ? (
          <View style={styles.stepContainer}>
            <FanInterestsStep
              favoriteClubId={fanFavoriteClubId}
              favoriteTeamName={fanFavoriteTeamName}
              interestCategories={fanInterestCategories}
              interestRegions={fanInterestRegions}
              onUpdate={(patch) => {
                patchForm(patch);
                clearValidationErrors(Object.keys(patch));
              }}
              searchTeams={searchTeams}
              validationErrors={validationErrors}
            />
            <Button
              disabled={isBusy}
              label={isBusy ? "Salvataggio..." : "Completa registrazione"}
              onPress={handleContinueFromFanInterests}
              variant="primary"
            />
          </View>
        ) : null}

        {step === "media_entity" ? (
          <View style={styles.stepContainer}>
            <MediaEntityStep
              description={mediaEntityDescription}
              entityName={mediaEntityName}
              errorMessage={validationErrors.mediaEntityName}
              onUpdate={(patch) => {
                patchForm(patch);
                clearValidationErrors(Object.keys(patch));
              }}
            />

            <OnboardingSectionCard
              title="Logo o immagine"
              subtitle="Carica un'immagine rappresentativa della tua pagina o progetto."
            >
              <MediaPickerField
                buttonLabel="Carica immagine"
                helperText="Puoi caricare un logo o una cover da usare come riferimento della tua pagina."
                isUploading={uploadingField === "media-logo"}
                label="Logo o immagine"
                mediaType="image"
                onPick={() =>
                  handleMediaUpload({
                    field: "media-logo",
                    folder: "media-logos",
                    mediaTypes: ["images"],
                    onUploaded: (items) =>
                      patchForm({ mediaLogoUrl: items[0]?.url ?? "" }),
                  })
                }
                onRemove={() => patchForm({ mediaLogoUrl: "" })}
                previewUrl={mediaLogoUrl}
                removable
              />
            </OnboardingSectionCard>

            <Button
              disabled={isBusy}
              label="Continua"
              onPress={handleContinueFromMediaEntity}
              variant="primary"
            />
          </View>
        ) : null}

        {step === "media_content" ? (
          <View style={styles.stepContainer}>
            <OnboardingSectionCard
              title="Che tipo di contenuti crei?"
              subtitle="Seleziona uno o più tipi di contenuti che descrivono il tuo lavoro."
            >
              <CommunityChipGroup
                onToggle={(value) => {
                  const next = mediaContentTypes.includes(value)
                    ? mediaContentTypes.filter((entry) => entry !== value)
                    : [...mediaContentTypes, value];
                  patchForm({ mediaContentTypes: next });
                  clearValidationErrors(["mediaContentTypes"]);
                }}
                options={MEDIA_CONTENT_TYPE_OPTIONS}
                selectedValues={mediaContentTypes}
              />
              {validationErrors.mediaContentTypes ? (
                <AppText variant="caption" color="danger">
                  {validationErrors.mediaContentTypes}
                </AppText>
              ) : null}
            </OnboardingSectionCard>

            <Button
              disabled={isBusy}
              label="Continua"
              onPress={handleContinueFromMediaContent}
              variant="primary"
            />
          </View>
        ) : null}

        {step === "media_focus" ? (
          <View style={styles.stepContainer}>
            <OnboardingSectionCard
              title="Ambito principale"
              subtitle="Cosa segui principalmente nei tuoi contenuti?"
            >
              <CommunityChipGroup
                onToggle={(value) => {
                  const next = mediaFocusAreas.includes(value)
                    ? mediaFocusAreas.filter((entry) => entry !== value)
                    : [...mediaFocusAreas, value];
                  patchForm({ mediaFocusAreas: next });
                  clearValidationErrors(["mediaFocusAreas"]);
                }}
                options={MEDIA_FOCUS_AREA_OPTIONS}
                selectedValues={mediaFocusAreas}
              />
              {validationErrors.mediaFocusAreas ? (
                <AppText variant="caption" color="danger">
                  {validationErrors.mediaFocusAreas}
                </AppText>
              ) : null}
            </OnboardingSectionCard>

            <Button
              disabled={isBusy}
              label="Continua"
              onPress={handleContinueFromMediaFocus}
              variant="primary"
            />
          </View>
        ) : null}

        {step === "media_channels" ? (
          <View style={styles.stepContainer}>
            <MediaChannelsStep
              facebook={mediaFacebook}
              instagram={mediaInstagram}
              onUpdate={(patch) => patchForm(patch)}
              tikTok={mediaTikTok}
              website={mediaWebsite}
              youTube={mediaYouTube}
            />
            <Button
              disabled={isBusy}
              label="Continua"
              onPress={handleContinueFromMediaChannels}
              variant="primary"
            />
            <Button
              label="Salta"
              onPress={handleContinueFromMediaChannels}
              variant="tertiary"
            />
          </View>
        ) : null}

        {step === "media_collaborations" ? (
          <View style={styles.stepContainer}>
            <MediaCollaborationsStep
              affiliationName={mediaAffiliationName}
              affiliationType={mediaAffiliationType}
              errorMessage={validationErrors.mediaAffiliationName}
              onUpdate={(patch) => {
                patchForm(patch);
                clearValidationErrors(Object.keys(patch));
              }}
              options={MEDIA_AFFILIATION_TYPE_OPTIONS}
            />
            <Button
              disabled={isBusy}
              label={isBusy ? "Salvataggio..." : "Completa registrazione"}
              onPress={handleContinueFromMediaCollaborations}
              variant="primary"
            />
            <Button
              label="Salta"
              onPress={handleFinishMediaOnboarding}
              variant="tertiary"
            />
          </View>
        ) : null}

        {/* ============================================================= */}
        {/* STEP: Technical profile                                        */}
        {/* ============================================================= */}
        {step === "technical" ? (
          <View style={styles.stepContainer}>
            {role === "coach" ? (
              <OnboardingSectionCard
                title="Profilo allenatore"
                subtitle="Aggiungi licenze, esperienze e filosofia di gioco."
              >
                <Input
                  label="Licenze"
                  onChangeText={(value) => updateValue("licenses", value)}
                  placeholder="UEFA C, UEFA B"
                  value={licenses}
                />
                <Input
                  label="Squadre allenate"
                  onChangeText={(value) => updateValue("coachedClubs", value)}
                  placeholder="ASD Example, FC Training"
                  value={coachedClubs}
                />
                <Input
                  label="Categorie allenate"
                  onChangeText={(value) =>
                    updateValue("coachedCategories", value)
                  }
                  placeholder="Juniores, Promozione"
                  value={coachedCategories}
                />
                <Input
                  label="Filosofia di gioco"
                  multiline
                  onChangeText={(value) => updateValue("gamePhilosophy", value)}
                  placeholder="Descrivi principi, metodologia e obiettivi"
                  value={gamePhilosophy}
                />
                <MediaPickerField
                  buttonLabel={
                    technicalVideoUrl
                      ? "Sostituisci video"
                      : "Carica video tecnico"
                  }
                  helperText="Carica dal telefono una clip tecnica o una presentazione video."
                  isUploading={uploadingField === "coach-video"}
                  label="Video tecnico"
                  mediaType="video"
                  onPick={() =>
                    handleMediaUpload({
                      field: "coach-video",
                      folder: "coach-videos",
                      mediaTypes: ["videos"],
                      onUploaded: (items) =>
                        updateValue("technicalVideoUrl", items[0]?.url ?? ""),
                    })
                  }
                  onRemove={() => updateValue("technicalVideoUrl", "")}
                  previewUrl={technicalVideoUrl || undefined}
                  removable
                  selectedLabel={
                    technicalVideoUrl
                      ? "Video tecnico caricato correttamente"
                      : undefined
                  }
                />
                <Input
                  label="Regioni preferite"
                  onChangeText={(value) =>
                    updateValue("coachPreferredRegions", value)
                  }
                  placeholder="Es. Lazio, Toscana"
                  value={coachPreferredRegions}
                />
                <Toggle
                  label="Disponibile a un nuovo incarico"
                  onValueChange={(value) => updateValue("openToNewRole", value)}
                  value={openToNewRole}
                />
              </OnboardingSectionCard>
            ) : null}

            <View style={styles.buttonRow}>
              <View style={styles.flex1}>
                <Button
                  label="Indietro"
                  onPress={handleBackNavigation}
                  variant="secondary"
                />
              </View>
              <View style={styles.flex1}>
                <Button
                  disabled={isBusy}
                  label={isBusy ? "Salvataggio..." : "Continua"}
                  onPress={handleContinueFromTechnical}
                  variant="primary"
                />
              </View>
            </View>
          </View>
        ) : null}

        {step === "agent_agency" ? (
          <AgentAgencyStep
            agencyRole={agentAgencyRole}
            agencyStartYear={agentAgencyStartYear}
            careerEntries={agentCareerEntries}
            agencyLogoUrl={agentAgencyLogoUrl}
            agencyName={agentAgencyName}
            errorMessage={validationErrors}
            isUploading={uploadingField === "agent-agency-logo"}
            onCareerEntriesChange={(entries) => patchForm({ agentCareerEntries: entries })}
            onContinue={handleContinueFromAgentAgency}
            onPickLogo={() =>
              handleMediaUpload({
                field: "agent-agency-logo",
                folder: "agent-agencies",
                mediaTypes: ["images"],
                onUploaded: (items) =>
                  patchForm({ agentAgencyLogoUrl: items[0]?.url ?? "" }),
              })
            }
            onUpdate={(patch) => patchForm(patch)}
          />
        ) : null}

        {step === "agent_players" ? (
          <AgentPlayersStep
            errorMessage={validationErrors.agentManagedPlayerEntries}
            isBusy={isBusy}
            managedPlayerEntries={agentManagedPlayerEntries}
            onContinue={handleContinueFromAgentPlayers}
            onUpdate={(entries) =>
              patchForm({
                agentManagedPlayerEntries: entries,
              })
            }
            searchPlayers={searchAgentPlayerCandidates}
          />
        ) : null}

        {step === "agent_football_experience" ? (
          <AgentFootballExperienceStep
            errorMessage={validationErrors.agentOtherFootballRoles}
            hasOtherFootballExperience={agentHasOtherFootballExperience}
            isBusy={isBusy}
            onContinue={handleContinueFromAgentFootballExperience}
            onToggleExperience={(value) =>
              patchForm({
                agentHasOtherFootballExperience: value,
                ...(value ? {} : { agentOtherFootballRoles: [] }),
              })
            }
            onUpdateRoles={(roles) =>
              patchForm({ agentOtherFootballRoles: roles })
            }
            otherFootballRoles={agentOtherFootballRoles}
          />
        ) : null}

        {step === "agent_player_career_toggle" ? (
          <PlayerCareerToggleStep
            buttonLabel={agentHasPlayedFootball ? "Continua" : "Salta"}
            hasPlayedFootball={agentHasPlayedFootball}
            isBusy={isBusy}
            onContinue={handleContinueFromAgentPlayerCareerToggle}
            onUpdate={(value) => patchForm({ agentHasPlayedFootball: value })}
            subtitle="Hai giocato a calcio? Puoi aggiungere i tuoi trascorsi in campo per aumentare l'autorevolezza del profilo."
            title="Carriera da giocatore"
            toggleLabel="Aggiungi carriera da giocatore"
            toggleSubtitle="Includi le esperienze da calciatore se sono rilevanti per il tuo percorso."
          />
        ) : null}

        {step === "agent_player_career" ? (
          <CareerExperienceStep
            addButtonLabel="Aggiungi carriera"
            careerEntries={agentPlayerCareerEntries}
            emptyMessage="Puoi aggiungere le tue esperienze da calciatore ora oppure proseguire e completarle più tardi."
            isBusy={isBusy}
            onSaveAndContinue={handleContinueFromAgentPlayerCareer}
            onSkip={handleContinueFromAgentPlayerCareer}
            onUpdateEntries={(entries) =>
              patchForm({ agentPlayerCareerEntries: entries })
            }
            searchTeams={searchTeams}
            subtitle="Aggiungi i tuoi trascorsi da calciatore con lo stesso pattern usato negli altri onboarding."
            title="Carriera da giocatore"
          />
        ) : null}

        {step === "agent_portfolio" ? (
          <AgentPortfolioStep
            isBusy={isBusy}
            onContinue={handleContinueFromAgentPortfolio}
            onUpdateMacroAreas={(values) =>
              patchForm({ agentOperatingMacroAreas: values })
            }
            onUpdateNote={(value) =>
              patchForm({ agentOperationalNote: value })
            }
            onUpdateOperationalFocuses={(values) =>
              patchForm({ agentOperationalFocuses: values })
            }
            onUpdateOperatingRegions={(value) =>
              patchForm({ agentOperatingRegions: value })
            }
            operationalFocuses={agentOperationalFocuses}
            operationalNote={agentOperationalNote}
            operatingMacroAreas={agentOperatingMacroAreas}
            operatingRegions={agentOperatingRegions}
            validationErrors={validationErrors}
          />
        ) : null}

        {step === "agent_availability" ? (
          <AgentAvailabilityStep
            errorMessage={validationErrors.agentAvailability}
            isBusy={isBusy}
            onContinue={handleContinueFromAgentAvailability}
            onUpdate={(patch) => patchForm(patch)}
            openToClubs={agentOpenToClubs}
            openToPlayers={agentOpenToPlayers}
          />
        ) : null}

        {step === "agent_verification" ? (
          <AgentVerificationStep
            federation={agentFederation}
            isBusy={isBusy}
            isFederationLicensed={agentIsFederationLicensed}
            onContinue={handleContinueFromAgentVerification}
            onUpdate={(patch) => patchForm(patch)}
            validationErrors={validationErrors}
          />
        ) : null}

        {step === "agent_extra" ? (
          <AgentExtraStep
            bio={bio}
            isBusy={isBusy}
            languages={agentLanguages}
            onFinish={handleFinishAgentExtra}
            onSkip={handleFinishAgentExtra}
            onUpdate={(patch) => patchForm(patch)}
          />
        ) : null}

        {/* ============================================================= */}
        {/* STEP: Director Roles                                           */}
        {/* ============================================================= */}
        {step === "director_roles" ? (
          <View style={styles.stepContainer}>
            <DirectorRolesStep
              primaryRole={directorPrimaryRole}
              selectedRoles={directorRoles}
              validationErrors={validationErrors}
              onUpdate={(patch) => patchForm(patch)}
            />
            <Button
              disabled={isBusy}
              label="Continua"
              onPress={handleContinueFromDirectorRoles}
              variant="primary"
            />
          </View>
        ) : null}

        {/* ============================================================= */}
        {/* STEP: Director Responsibilities                                */}
        {/* ============================================================= */}
        {step === "director_responsibilities" ? (
          <View style={styles.stepContainer}>
            <DirectorChipsStep
              options={DIRECTOR_RESPONSIBILITY_OPTIONS}
              selectedValues={directorResponsibilities}
              title="Aree di responsabilità"
              subtitle="Seleziona le principali aree di cui ti occupi come dirigente."
              errorMessage={validationErrors.directorResponsibilities}
              onToggle={(value) => {
                const next = directorResponsibilities.includes(value)
                  ? directorResponsibilities.filter((v) => v !== value)
                  : [...directorResponsibilities, value];
                patchForm({ directorResponsibilities: next });
                clearValidationErrors(["directorResponsibilities"]);
              }}
            />
            <Button
              disabled={isBusy}
              label="Continua"
              onPress={handleContinueFromDirectorResponsibilities}
              variant="primary"
            />
          </View>
        ) : null}

        {/* ============================================================= */}
        {/* STEP: Director Categories                                      */}
        {/* ============================================================= */}
        {step === "director_categories" ? (
          <View style={styles.stepContainer}>
            <DirectorChipsStep
              options={DIRECTOR_CATEGORY_OPTIONS}
              selectedValues={directorCategories}
              title="Categorie di esperienza"
              subtitle="Seleziona le categorie in cui hai operato o in cui desideri lavorare."
              errorMessage={validationErrors.directorCategories}
              onToggle={(value) => {
                const next = directorCategories.includes(value)
                  ? directorCategories.filter((v) => v !== value)
                  : [...directorCategories, value];
                patchForm({ directorCategories: next });
                clearValidationErrors(["directorCategories"]);
              }}
            />
            <Button
              disabled={isBusy}
              label="Continua"
              onPress={handleContinueFromDirectorCategories}
              variant="primary"
            />
          </View>
        ) : null}

        {/* ============================================================= */}
        {/* STEP: Director Focus                                           */}
        {/* ============================================================= */}
        {step === "director_focus" ? (
          <View style={styles.stepContainer}>
            <DirectorSingleSelectStep
              options={DIRECTOR_FOCUS_OPTIONS}
              selectedValue={directorMainFocus}
              title="Focus principale"
              subtitle="Su quale area vuoi concentrare la tua attività dirigenziale?"
              errorMessage={validationErrors.directorMainFocus}
              onSelect={(value) => {
                patchForm({ directorMainFocus: value });
                clearValidationErrors(["directorMainFocus"]);
              }}
            />
            <Button
              disabled={isBusy}
              label="Continua"
              onPress={handleContinueFromDirectorFocus}
              variant="primary"
            />
          </View>
        ) : null}

        {/* ============================================================= */}
        {/* STEP: Director Market                                          */}
        {/* ============================================================= */}
        {step === "director_market" ? (
          <View style={styles.stepContainer}>
            <DirectorSingleSelectStep
              options={DIRECTOR_MARKET_OPTIONS}
              selectedValue={directorMarketInvolvement}
              title="Coinvolgimento nel mercato"
              subtitle="Sei coinvolto nelle operazioni di mercato calciatori?"
              errorMessage={validationErrors.directorMarketInvolvement}
              onSelect={(value) => {
                patchForm({ directorMarketInvolvement: value });
                clearValidationErrors(["directorMarketInvolvement"]);
              }}
            />
            <Button
              disabled={isBusy}
              label="Continua"
              onPress={handleContinueFromDirectorMarket}
              variant="primary"
            />
          </View>
        ) : null}

        {/* ============================================================= */}
        {/* STEP: Director Career                                          */}
        {/* ============================================================= */}
        {step === "director_career" ? (
          <CoachCareerStep
            addButtonLabel="Aggiungi esperienza dirigenziale"
            defaultRole={directorPrimaryRole}
            descriptionLabel="Attività svolte"
            descriptionPlaceholder="Riassumi in una o due righe gestione rosa, mercato, scouting o coordinamento sportivo."
            emptyMessage="Aggiungi le tue esperienze dirigenziali. Puoi inserirle ora o completarle in seguito dal tuo profilo."
            entries={directorCareerEntries}
            isBusy={isBusy}
            onContinue={handleContinueFromDirectorCareer}
            onRegisterBack={registerStepBackOverride}
            onSkip={handleContinueFromDirectorCareer}
            onUpdateEntries={(entries) =>
              patchForm({ directorCareerEntries: entries })
            }
            roleOptions={DIRECTOR_ROLE_OPTIONS}
            searchTeams={searchTeams}
            selectorSubtitle="Scegli come vuoi inserire questa esperienza."
            selectorTitle="Aggiungi esperienza dirigenziale"
            showDescription
            subtitle="Aggiungi le tue esperienze come dirigente per completare il profilo."
            title="Carriera dirigenziale"
            typeOptions={EXPERIENCE_TYPE_OPTIONS}
          />
        ) : null}

        {/* ============================================================= */}
        {/* STEP: Director Football Experience                             */}
        {/* ============================================================= */}
        {step === "director_football_experience" ? (
          <DirectorFootballExperienceStep
            hasOtherFootballExperience={directorHasOtherFootballExperience}
            isBusy={isBusy}
            otherFootballRoles={directorOtherFootballRoles}
            errorMessage={validationErrors.directorOtherFootballRoles}
            onContinue={handleContinueFromDirectorFootballExperience}
            onToggleExperience={(value) =>
              patchForm({
                directorCoachCareerEntries: value ? directorCoachCareerEntries : [],
                directorHasOtherFootballExperience: value,
                directorOtherFootballRoles: value ? directorOtherFootballRoles : [],
              })
            }
            onUpdateRoles={(roles) => {
              patchForm({
                directorCoachCareerEntries: roles.includes("Allenatore")
                  ? directorCoachCareerEntries
                  : [],
                directorOtherFootballRoles: roles,
              });
            }}
          />
        ) : null}

        {/* ============================================================= */}
        {/* STEP: Director Coach Career                                    */}
        {/* ============================================================= */}
        {step === "director_coach_career" ? (
          <CoachCareerStep
            addButtonLabel="Aggiungi esperienza da allenatore"
            defaultRole="Allenatore"
            descriptionLabel="Attività svolte"
            descriptionPlaceholder="Riassumi in una o due righe gestione del gruppo, sviluppo tecnico o coordinamento sportivo."
            emptyMessage="Aggiungi eventuali esperienze da allenatore maturate prima del percorso dirigenziale."
            entries={directorCoachCareerEntries}
            isBusy={isBusy}
            onContinue={handleContinueFromDirectorCoachCareer}
            onRegisterBack={registerStepBackOverride}
            onSkip={handleContinueFromDirectorCoachCareer}
            onUpdateEntries={(entries) =>
              patchForm({ directorCoachCareerEntries: entries })
            }
            searchTeams={searchTeams}
            selectorSubtitle="Scegli come vuoi inserire questa esperienza precedente."
            selectorTitle="Aggiungi esperienza da allenatore"
            showDescription
            subtitle="Mantieni separate le esperienze da allenatore dalla carriera dirigenziale."
            title="Esperienze da allenatore"
          />
        ) : null}

        {/* ============================================================= */}
        {/* STEP: Director Player Career Toggle                            */}
        {/* ============================================================= */}
        {step === "director_player_career_toggle" ? (
          <PlayerCareerToggleStep
            hasPlayedFootball={directorHasPlayedFootball}
            isBusy={isBusy}
            onContinue={handleContinueFromDirectorPlayerCareerToggle}
            onUpdate={(value) =>
              patchForm({ directorHasPlayedFootball: value })
            }
            subtitle="Hai maturato esperienze come calciatore prima di diventare dirigente?"
            title="Carriera da giocatore"
          />
        ) : null}

        {/* ============================================================= */}
        {/* STEP: Director Player Career                                   */}
        {/* ============================================================= */}
        {step === "director_player_career" ? (
          <CareerExperienceStep
            careerEntries={directorPlayerCareerEntries}
            isBusy={isBusy}
            onSaveAndContinue={handleContinueFromDirectorPlayerCareer}
            onSkip={handleContinueFromDirectorPlayerCareer}
            onUpdateEntries={(entries) =>
              patchForm({ directorPlayerCareerEntries: entries })
            }
            searchTeams={searchTeams}
            subtitle="Aggiungi la tua carriera in campo per arricchire il tuo profilo dirigenziale."
            title="Carriera da giocatore"
          />
        ) : null}

        {/* ============================================================= */}
        {/* STEP: Director Club Type                                       */}
        {/* ============================================================= */}
        {step === "director_club_type" ? (
          <View style={styles.stepContainer}>
            <DirectorChipsStep
              options={DIRECTOR_CLUB_TYPE_OPTIONS.map((o) => o.value)}
              selectedValues={directorClubTypes}
              title="Tipo di società"
              subtitle="In quale tipo di società hai lavorato principalmente?"
              errorMessage={validationErrors.directorClubTypes}
              onToggle={(value) => {
                const next = directorClubTypes.includes(value)
                  ? directorClubTypes.filter((v) => v !== value)
                  : [...directorClubTypes, value];
                patchForm({ directorClubTypes: next });
                clearValidationErrors(["directorClubTypes"]);
              }}
            />
            <Button
              disabled={isBusy}
              label="Continua"
              onPress={handleContinueFromDirectorClubType}
              variant="primary"
            />
          </View>
        ) : null}

        {/* ============================================================= */}
        {/* STEP: Director Extra                                           */}
        {/* ============================================================= */}
        {step === "director_extra" ? (
          <DirectorExtraStep
            bio={directorBio}
            isBusy={isBusy}
            languages={directorLanguages}
            onFinish={handleFinishDirectorExtra}
            onSkip={handleFinishDirectorExtra}
            onUpdate={(patch) => patchForm(patch)}
          />
        ) : null}

      </KeyboardAwareForm>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  pageTitleGroup: {
    gap: spacing[8],
    paddingBottom: spacing[8],
  },
  primaryCta: {
    minHeight: onboardingLayout.ctaHeight,
  },
  roleList: {
    gap: spacing[10],
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing[12],
  },
  fieldGap12: {
    gap: spacing[12],
  },
  flex1: {
    flex: 1,
  },
  formContent: {
    gap: spacing[18],
    paddingBottom: onboardingLayout.pagePaddingBottom,
    paddingHorizontal: onboardingLayout.pagePaddingHorizontal,
    paddingTop: onboardingLayout.pagePaddingTop,
  },
  sectionHeaderGap: {
    gap: spacing[8],
  },
  legalStatusOption: {
    borderRadius: radius[12],
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[14],
  },
  legalStatusOptionActive: {
    borderColor: colors.accent,
    backgroundColor: colors.heroSoft,
  },
  legalStatusOptions: {
    gap: spacing[8],
  },
  stepContainer: {
    gap: spacing[16],
  },
});
