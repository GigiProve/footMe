import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { DatePickerField } from "../../src/components/ui/date-picker-field";
import { KeyboardAwareForm } from "../../src/components/ui/keyboard-aware-form";
import { MediaPickerField } from "../../src/components/ui/media-picker-field";
import { NationalityAutocompleteInput } from "../../src/components/ui/nationality-autocomplete-input";
import { PhoneInputWithCountryCode } from "../../src/components/ui/phone-input-with-country-code";
import { ResidenceCityInput } from "../../src/components/ui/residence-city-input";
import { SelectField } from "../../src/components/ui/select-field";
import { WheelPickerField } from "../../src/components/ui/wheel-picker-field";
import { useSession } from "../../src/features/auth/use-session";
import {
  createInitialProfile,
  BaseProfileValidationError,
  type AppRole,
  type ProfileGender,
} from "../../src/features/onboarding/create-initial-profile";
import {
  coerceOnboardingStep,
  getEffectiveDomicile,
  getOnboardingFullName,
  getOnboardingProgress,
  getOnboardingVisibleSteps,
  getPreviousOnboardingStep,
  validateOnboardingStep,
  type LegalStatus,
  type OnboardingStep,
  type OnboardingValidationErrors,
} from "../../src/features/onboarding/onboarding-form";
import {
  OnboardingCheckboxRow,
  OnboardingEyebrow,
  OnboardingInfoCard,
  OnboardingProgressBar,
  OnboardingScreenHeader,
  OnboardingSectionCard,
  OnboardingToggleRow,
} from "../../src/features/onboarding/onboarding-ui";
import { WhereToPlaySection } from "../../src/features/onboarding/where-to-play-section";
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
import type { CoachCareerEntry } from "../../src/features/onboarding/coach/coach-career-types";
import {
  AVAILABLE_FROM_OPTIONS,
  CoachRoleStep,
} from "../../src/features/onboarding/coach/CoachRoleStep";
import { CoachCareerStep } from "../../src/features/onboarding/coach/CoachCareerStep";
import { PlayerCareerToggleStep } from "../../src/features/onboarding/coach/PlayerCareerToggleStep";
import { CoachExtraStep } from "../../src/features/onboarding/coach/CoachExtraStep";
import { StaffAvailabilityStep } from "../../src/features/onboarding/staff/StaffAvailabilityStep";
import { StaffRoleStep } from "../../src/features/onboarding/staff/StaffRoleStep";
import {
  mapStaffRoleToSpecialization,
  MEDIA_AFFILIATION_TYPE_OPTIONS,
  MEDIA_CONTENT_TYPE_OPTIONS,
  MEDIA_FOCUS_AREA_OPTIONS,
  STAFF_ROLE_OPTIONS,
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
import { PlayerCharacteristicsSection } from "../../src/features/profiles/player-sports-section";
import {
  DEFAULT_PLAYER_PRIMARY_POSITION,
  excludePrimaryFromSecondaryPositions,
  parsePlayerExperienceForms,
  SENIOR_CATEGORY_OPTIONS,
  YOUTH_CATEGORY_OPTIONS,
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
  searchTeams,
  updateCompleteProfessionalProfile,
} from "../../src/features/profiles/profile-service";
import { supabase } from "../../src/lib/supabase";
import { colors, radius, spacing } from "../../src/theme/tokens";
import { AppText, Button, Input, Toggle } from "../../src/ui";

type CompletionDestination = "feed" | "network" | "profile";

const roleOptions: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: AppRole | "community";
}[] = [
  {
    icon: "person-outline",
    label: "Calciatore",
    value: "player",
  },
  {
    icon: "clipboard-outline",
    label: "Allenatore",
    value: "coach",
  },
  {
    icon: "briefcase-outline",
    label: "Staff Tecnico",
    value: "staff",
  },
  {
    icon: "shield-outline",
    label: "Societa'",
    value: "club_admin",
  },
  {
    icon: "people-outline",
    label: "Agente",
    value: "agent",
  },
  {
    icon: "people-outline",
    label: "Dirigente",
    value: "director",
  },
  {
    icon: "newspaper-outline",
    label: "Media e appassionati",
    value: "community",
  },
];

const genderOptions: { label: string; value: ProfileGender }[] = [
  { label: "Uomo", value: "male" },
  { label: "Donna", value: "female" },
];

const LEGAL_STATUS_OPTIONS: { label: string; value: LegalStatus }[] = [
  { label: "Ho il permesso di soggiorno", value: "has_permit" },
  { label: "Non ho il permesso di soggiorno", value: "no_permit" },
  { label: "In fase di richiesta", value: "pending_permit" },
];

const staffExperienceRoleOptions = STAFF_ROLE_OPTIONS.map((option) => ({
  label: option.label,
  value: option.value,
}));

const staffExperienceTypeOptions = [
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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RoleSelectionCard({
  active,
  icon,
  label,
  onPress,
  testID,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.roleCard, active ? styles.roleCardActive : null]}
      testID={testID}
    >
      <View
        style={[
          styles.roleIconCircle,
          active ? styles.roleIconCircleActive : null,
        ]}
      >
        <Ionicons
          name={icon}
          size={24}
          color={active ? colors.inkInvert : colors.accentStrong}
        />
      </View>
      <AppText
        variant="bodySm"
        style={[
          styles.roleCardTitle,
          active ? styles.roleCardActiveText : undefined,
        ]}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

function GenderCard({
  active,
  label,
  onPress,
  testID,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.genderCard, active ? styles.genderCardActive : null]}
      testID={testID}
    >
      <AppText
        variant="titleSm"
        style={active ? styles.genderCardActiveText : undefined}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

function ValidationMessage({
  children,
  tone = "danger",
}: {
  children: string;
  tone?: "danger" | "muted";
}) {
  return (
    <AppText
      variant="bodySm"
      color={tone === "danger" ? "danger" : "secondary"}
    >
      {children}
    </AppText>
  );
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
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const stepBackOverrideRef = useRef<(() => void) | null>(null);

  const registerCoachCareerBack = useCallback((fn: (() => void) | null) => {
    stepBackOverrideRef.current = fn;
  }, []);
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
    agentFederation,
    agentHasOtherFootballExperience,
    agentHasPlayedFootball,
    agentIsFederationLicensed,
    agentLanguages,
    agentMainPlayerRoles,
    agentManagedPlayersCount,
    agentOpenToClubs,
    agentOpenToPlayers,
    agentOtherFootballRoles,
    agentPlayerCareerEntries,
    agentPlayerTypes,
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
    clubTotalMembers,
    clubWebsite,
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
    staffHasPlayedFootball,
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
  const visibleSteps = getOnboardingVisibleSteps(role as AppRole | "");
  const progress = getOnboardingProgress(step, role as AppRole | "");
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

    const previousStep = getPreviousOnboardingStep(
      step,
      lastCompletedStep,
      role as AppRole | "",
    );

    if (!previousStep) {
      return;
    }

    navigateToStep(previousStep, "replace");
  }, [lastCompletedStep, navigateToStep, role, step]);

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

  async function ensureInitialProfileCreated() {
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
      clubTotalMembers,
      clubWebsite,
      clubYouthCategories,
      domicile:
        nationalityCategory === "italy"
          ? getEffectiveDomicile(form)
          : currentLocationCity,
      fullName,
      gender: gender as ProfileGender,
      nationality,
      phoneNumber: composePhoneNumber(phoneCountryCode, phoneNumber),
      primaryPosition: primaryPosition || DEFAULT_PLAYER_PRIMARY_POSITION,
      repEmail,
      repPhone: composePhoneNumber(repPhoneCountryCode, repPhone),
      residence: nationalityCategory === "italy" ? residence : residenceCountry,
      role: role as AppRole,
      staffAvailableFrom,
      staffPrimaryRole,
      staffRoles,
      staffSpecialization,
      userId: session.user.id,
    });

    patchForm({
      hasCreatedProfile: true,
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
    if (role === "fan" || role === "media") {
      navigateToStep("community_profile_type");
      return;
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
    navigateToStep("photo");
  }

  function handleContinueFromPhoto() {
    patchForm({ lastCompletedStep: "photo" });
    if (role === "agent") {
      navigateToStep("agent_agency");
    } else if (role === "coach") {
      navigateToStep("coach_role");
    } else if (role === "staff") {
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
                secondary_formations: [],
                technical_video_url: parseOptionalText(technicalVideoUrl),
              }
            : null,
        playerCareerEntries: [],
        playerProfile: null,
        profile: {
          avatar_url: parseOptionalText(avatarUrl),
          bio: parseOptionalText(normalizeProfileBioInput(bio)),
          birth_date: birthDate,
          city: null,
          full_name: fullName,
          is_open_to_transfer: isOpenToTransfer,
          languages: [],
          nationality,
          region: null,
        },
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
        profile: {
          avatar_url: parseOptionalText(avatarUrl),
          bio: parseOptionalText(normalizeProfileBioInput(bio)),
          birth_date: birthDate,
          city: null,
          full_name: fullName,
          is_open_to_transfer: isOpenToTransfer,
          languages: [],
          nationality,
          region: null,
        },
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

      goToCompletion("experience");
    } catch (error) {
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

      await updateCompleteProfessionalProfile({
        agentProfile: {
          agency_logo_url: parseOptionalText(agentAgencyLogoUrl),
          agency_name: parseOptionalText(agentAgencyName),
          federation: agentIsFederationLicensed
            ? parseOptionalText(agentFederation)
            : null,
          has_other_football_experience: agentHasOtherFootballExperience,
          has_played_football: agentHasPlayedFootball,
          is_federation_licensed: agentIsFederationLicensed,
          main_player_roles: agentMainPlayerRoles,
          managed_players_count: parseOptionalText(agentManagedPlayersCount),
          open_to_clubs: agentOpenToClubs,
          open_to_players: agentOpenToPlayers,
          other_football_roles: agentOtherFootballRoles,
          player_career_entries: agentPlayerCareerEntries,
          player_types: agentPlayerTypes,
        },
        club: null,
        clubSeasonEntries: [],
        coachProfile: null,
        playerCareerEntries: [],
        playerProfile: null,
        profile: {
          avatar_url: parseOptionalText(avatarUrl),
          bio: parseOptionalText(normalizeProfileBioInput(bio)),
          birth_date: birthDate,
          city: parseOptionalText(residence),
          full_name: fullName,
          is_open_to_transfer: false,
          languages: agentLanguages,
          nationality,
          region: parseOptionalText(residenceRegion),
        },
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

      await ensureInitialProfileCreated();

      await updateCompleteProfessionalProfile({
        club: null,
        clubSeasonEntries: [],
        coachProfile: null,
        playerCareerEntries: [],
        playerProfile: null,
        profile: {
          avatar_url: parseOptionalText(avatarUrl),
          bio: parseOptionalText(normalizeProfileBioInput(bio)),
          birth_date: birthDate,
          city: null,
          full_name: fullName,
          is_open_to_transfer: false,
          languages: [],
          nationality,
          region: null,
        },
        profileId: session.user.id,
        role: role as AppRole,
        staffProfile: {
          certifications: fromDelimitedString(certifications),
          experience_entries: staffCareerEntries,
          experience_summary: parseOptionalText(experienceSummary),
          open_to_work: openToWork,
          availability_type: openToWork ? staffAvailabilityType : null,
          available_from: openToWork
            ? parseOptionalText(staffAvailableFrom)
            : null,
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

      patchForm({ lastCompletedStep: "staff_career" });
      navigateToStep("staff_player_career_toggle");
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

  function handleContinueFromStaffPlayerCareerToggle() {
    patchForm({ lastCompletedStep: "staff_player_career_toggle" });

    if (staffHasPlayedFootball) {
      navigateToStep("staff_player_career");
    } else {
      goToCompletion("staff_player_career_toggle");
    }
  }

  function handleContinueFromStaffPlayerCareer() {
    patchForm({ lastCompletedStep: "staff_player_career" });
    goToCompletion("staff_player_career");
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
          career_entries: directorCareerEntries,
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
        profile: {
          avatar_url: parseOptionalText(avatarUrl),
          bio: parseOptionalText(normalizeProfileBioInput(directorBio)),
          birth_date: birthDate,
          city: parseOptionalText(residence),
          full_name: fullName,
          is_open_to_transfer: false,
          languages: directorLanguages,
          nationality,
          region: parseOptionalText(residenceRegion),
        },
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
          interest_categories: fanInterestCategories,
          interest_regions: fanInterestRegions,
        },
        mediaProfile: null,
        playerCareerEntries: [],
        playerProfile: null,
        profile: {
          avatar_url: parseOptionalText(avatarUrl),
          bio: null,
          birth_date: birthDate,
          city: null,
          full_name: fullName,
          is_open_to_transfer: false,
          languages: [],
          nationality: null,
          region: null,
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
        profile: {
          avatar_url: parseOptionalText(avatarUrl),
          bio: parseOptionalText(
            normalizeProfileBioInput(mediaEntityDescription),
          ),
          birth_date: birthDate,
          city: null,
          full_name: fullName,
          is_open_to_transfer: false,
          languages: [],
          nationality: null,
          region: null,
        },
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
          club_id: null,
          coach_profile_id: session.user.id,
          description: null,
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
          team_logo_url: null,
          team_name: entry.teamName,
        })),
        coachDirectorCareerEntries: [],
        coachPlayerCareerEntries: coachPlayerCareerEntries.map((entry, index) => ({
          appearances: Number.parseInt(entry.appearances, 10) || 0,
          assists: Number.parseInt(entry.assists, 10) || 0,
          category: entry.category || null,
          coach_profile_id: session.user.id,
          goals: Number.parseInt(entry.goals, 10) || 0,
          id: entry.id ?? `coach-player-${index}`,
          position: null,
          season: entry.seasonLabel,
          sort_order: index,
          team_logo_url: entry.teamLogoUrl || null,
          team_name: entry.clubName,
        })),
        coachProfile: {
          availability_type: coachAvailabilityType || null,
          coached_categories: coachCategoriesArray,
          coached_clubs: [],
          contract_end: null,
          current_club: null,
          game_philosophy: gamePhilosophy || null,
          licenses: coachLicenseType ? [coachLicenseType] : [],
          media_items: [],
          open_to_new_role: openToNewRole,
          play_styles: [],
          preferred_categories: [],
          preferred_formation: null,
          preferred_provinces: coachProvincesArray,
          preferred_regions: coachRegionsArray,
          secondary_formations: [],
          technical_video_url: null,
        },
        playerCareerEntries: [],
        playerProfile: null,
        profile: {
          avatar_url: parseOptionalText(avatarUrl),
          bio: parseOptionalText(normalizeProfileBioInput(form.bio)),
          birth_date: birthDate,
          city: null,
          full_name: fullName,
          is_open_to_transfer: false,
          languages: coachLanguages,
          nationality,
          region: null,
        },
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

  function handleContinueFromClubRepresentative() {
    const nextErrors = validateOnboardingStep("club_representative", form);

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return;
    }

    setValidationErrors({});
    patchForm({ lastCompletedStep: "club_representative" });
    navigateToStep("club_data");
  }

  async function handleContinueFromClubData() {
    const nextErrors = validateOnboardingStep("club_data", form);

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      setValidationErrors({});

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

      patchForm({ lastCompletedStep: "club_data" });
      navigateToStep("club_youth");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Errore inatteso.";
      Alert.alert("Verifica duplicati non riuscita", message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleContinueFromClubYouth() {
    const nextErrors = validateOnboardingStep("club_youth", form);

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return;
    }

    setValidationErrors({});
    patchForm({ lastCompletedStep: "club_youth" });
    navigateToStep("club_profile");
  }

  async function handleSubmitClubProfile() {
    try {
      setIsSubmitting(true);

      await ensureInitialProfileCreated();
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
      router.replace("/(tabs)/network");
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen
        options={{
          fullScreenGestureEnabled: false,
          gestureEnabled: false,
          headerShown: false,
        }}
      />

      {step !== "complete" ? (
        <OnboardingScreenHeader
          onBack={canGoBack ? handleBackNavigation : undefined}
        />
      ) : null}

      {step !== "complete" && step !== "role" ? (
        <OnboardingProgressBar
          currentIndex={progress.stepIndex}
          steps={visibleSteps}
        />
      ) : null}

      <KeyboardAwareForm contentContainerStyle={styles.formContent}>
        {/* ============================================================= */}
        {/* STEP: Role                                                     */}
        {/* ============================================================= */}
        {step === "role" ? (
          <View style={styles.stepContainer}>
            <OnboardingSectionCard
              title="Scegli il tuo ruolo"
              subtitle="Seleziona il profilo che ti rappresenta meglio. Ti mostreremo solo i campi utili per iniziare."
            >
              {validationErrors.role ? (
                <ValidationMessage>{validationErrors.role}</ValidationMessage>
              ) : null}

              <View style={styles.roleGrid}>
                {Array.from(
                  { length: Math.ceil(roleOptions.length / 2) },
                  (_, rowIndex) => {
                    const pair = roleOptions.slice(
                      rowIndex * 2,
                      rowIndex * 2 + 2,
                    );
                    return (
                      <View key={rowIndex} style={styles.roleGridRow}>
                        {pair.map((entry) => (
                          <RoleSelectionCard
                            key={entry.value}
                            active={
                              entry.value === "community"
                                ? role === "fan" || role === "media"
                                : role === entry.value
                            }
                            icon={entry.icon}
                            label={entry.label}
                            onPress={() => {
                              if (entry.value === "community") {
                                patchForm({
                                  communityProfileType: "",
                                  role: "fan",
                                });
                                clearValidationErrors([
                                  "role",
                                  "communityProfileType",
                                ]);
                                return;
                              }

                              patchForm({
                                communityProfileType: "",
                                role: entry.value,
                              });
                              clearValidationErrors([
                                "role",
                                "communityProfileType",
                              ]);
                            }}
                            testID={`role-card-${entry.value}`}
                          />
                        ))}
                      </View>
                    );
                  },
                )}
              </View>
            </OnboardingSectionCard>

            <Button
              disabled={!role}
              label={
                role
                  ? `Continua come ${
                      role === "fan" || role === "media"
                        ? "Media e appassionati"
                        : roleOptions.find((r) => r.value === role)?.label
                    }`
                  : "Seleziona un ruolo"
              }
              onPress={handleContinueFromRole}
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

                <View style={styles.sectionHeaderGap}>
                  <AppText variant="titleSm">Sesso *</AppText>
                  <View style={styles.genderRow}>
                    {genderOptions.map((entry) => (
                      <GenderCard
                        key={entry.value}
                        active={gender === entry.value}
                        label={entry.label}
                        onPress={() =>
                          updateValue("gender", entry.value, ["gender"])
                        }
                        testID={`gender-card-${entry.value}`}
                      />
                    ))}
                  </View>
                  {validationErrors.gender ? (
                    <ValidationMessage>
                      {validationErrors.gender}
                    </ValidationMessage>
                  ) : null}
                </View>

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
            <OnboardingSectionCard
              title="Aggiungi una foto"
              subtitle={
                step === "fan_photo"
                  ? "Aggiungi una foto per farti riconoscere dagli altri utenti della community. Puoi saltare questo passaggio."
                  : step === "media_photo"
                    ? "Carica una foto personale per il tuo profilo account. Puoi saltare questo passaggio."
                    : "Una foto profilo aiuta gli altri a riconoscerti. Puoi saltare questo passaggio e aggiungerla in seguito."
              }
            >
              <View style={styles.photoPreviewContainer}>
                <View style={styles.photoWrapper}>
                  <View style={styles.photoCircle}>
                    {avatarUrl ? (
                      <Image
                        source={{ uri: withDefaultProfileAvatar(avatarUrl) }}
                        style={styles.photoImage}
                      />
                    ) : (
                      <Ionicons
                        name="person-outline"
                        size={48}
                        color={colors.textMuted}
                      />
                    )}
                  </View>
                </View>
              </View>

              {!avatarUrl ? (
                <OnboardingInfoCard message="Se non carichi una foto ora, useremo un'immagine di default." />
              ) : null}
            </OnboardingSectionCard>

            <Button
              disabled={uploadingField === "avatar"}
              label={
                uploadingField === "avatar"
                  ? "Caricamento..."
                  : "Carica da galleria"
              }
              leftIcon={
                <Ionicons
                  name="images-outline"
                  size={18}
                  color={colors.inkInvert}
                />
              }
              onPress={() =>
                handleMediaUpload({
                  field: "avatar",
                  folder: "avatars",
                  mediaTypes: ["images"],
                  onUploaded: (items) =>
                    updateValue("avatarUrl", items[0]?.url ?? ""),
                })
              }
              variant="primary"
            />
            <Button
              disabled={uploadingField === "avatar"}
              label="Scatta foto"
              leftIcon={
                <Ionicons
                  name="camera-outline"
                  size={18}
                  color={colors.accentStrong}
                />
              }
              onPress={() =>
                handleCameraCapture({
                  field: "avatar",
                  folder: "avatars",
                  onUploaded: (items) =>
                    updateValue("avatarUrl", items[0]?.url ?? ""),
                })
              }
              variant="secondary"
            />
            {avatarUrl ? (
              <Button
                label="Continua"
                onPress={handleContinueFromPhoto}
                variant="primary"
              />
            ) : (
              <Button
                label="Salta per ora"
                onPress={handleContinueFromPhoto}
                variant="tertiary"
              />
            )}
          </View>
        ) : null}

        {step === "fan_interests" ? (
          <View style={styles.stepContainer}>
            <FanInterestsStep
              interestCategories={fanInterestCategories}
              interestRegions={fanInterestRegions}
              onUpdate={(patch) => {
                patchForm(patch);
                clearValidationErrors(Object.keys(patch));
              }}
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
            {role === "player" ? (
              <>
                <OnboardingSectionCard
                  title="Informazioni tecniche"
                  subtitle="Definisci il tuo profilo tecnico: ruolo, caratteristiche fisiche e piede preferito."
                >
                  <PlayerCharacteristicsSection
                    editable
                    primaryPositionError={validationErrors.primaryPosition}
                    onPreferredFootChange={(value) =>
                      updateValue("preferredFoot", value)
                    }
                    onPrimaryPositionChange={(value) => {
                      patchForm({
                        primaryPosition: value,
                        secondaryPositions:
                          excludePrimaryFromSecondaryPositions(
                            secondaryPositions,
                            value,
                          ),
                      });
                      clearValidationErrors([
                        "primaryPosition",
                        "secondaryPositions",
                      ]);
                    }}
                    onSecondaryPositionsChange={(value) => {
                      patchForm({
                        secondaryPositions:
                          excludePrimaryFromSecondaryPositions(
                            value,
                            primaryPosition,
                          ),
                      });
                      clearValidationErrors(["secondaryPositions"]);
                    }}
                    preferredFoot={preferredFoot}
                    primaryPosition={primaryPosition}
                    secondaryPositions={secondaryPositions}
                  />

                  <Toggle
                    label="Vuoi mostrare altezza e peso nel profilo?"
                    onValueChange={(value) => {
                      setShowPhysicalFields(value);
                      if (!value) {
                        patchForm({ heightCm: "", weightKg: "" });
                      }
                    }}
                    value={showPhysicalFields}
                  />
                  {showPhysicalFields ? (
                    <View style={styles.buttonRow}>
                      <View style={styles.flex1}>
                        <WheelPickerField
                          label="Altezza"
                          max={220}
                          min={140}
                          onChange={(value) =>
                            updateValue("heightCm", String(value))
                          }
                          unit="cm"
                          value={parseWheelValue(heightCm)}
                        />
                      </View>
                      <View style={styles.flex1}>
                        <WheelPickerField
                          label="Peso"
                          max={130}
                          min={40}
                          onChange={(value) =>
                            updateValue("weightKg", String(value))
                          }
                          unit="kg"
                          value={parseWheelValue(weightKg)}
                        />
                      </View>
                    </View>
                  ) : null}
                </OnboardingSectionCard>
              </>
            ) : null}

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

        {/* ============================================================= */}
        {/* STEP: Player Availability (dove vuoi giocare)                   */}
        {/* ============================================================= */}
        {step === "player_availability" ? (
          <View style={styles.stepContainer}>
            <OnboardingSectionCard
              title="Dove vuoi giocare?"
              subtitle="Seleziona le zone in cui sei disponibile a giocare e le categorie in cui vuoi ricevere opportunità."
            >
              <WhereToPlaySection
                availabilityType={availabilityType}
                categories={fromDelimitedString(preferredCategories)}
                isAvailable={isOpenToTransfer}
                onAvailabilityTypeChange={(type) => {
                  patchForm({ availabilityType: type });
                  clearValidationErrors([
                    "transferRegions",
                    "transferProvinces",
                  ]);
                }}
                onCategoriesChange={(categories) => {
                  updateValue("preferredCategories", categories.join(", "));
                  clearValidationErrors(["preferredCategories"]);
                }}
                onIsAvailableChange={(value) => {
                  patchForm({
                    isOpenToTransfer: value,
                    willingToChangeClub: value,
                  });
                  if (!value) {
                    clearValidationErrors([
                      "transferRegions",
                      "transferProvinces",
                      "preferredCategories",
                    ]);
                  }
                }}
                onProvincesChange={(nextProvinces) => {
                  updateValue("transferProvinces", nextProvinces.join(", "));
                  clearValidationErrors(["transferProvinces"]);
                }}
                onRegionsChange={(nextRegions) => {
                  updateValue("transferRegions", nextRegions.join(", "));
                  clearValidationErrors(["transferRegions"]);
                }}
                provinces={fromDelimitedString(transferProvinces)}
                regions={fromDelimitedString(transferRegions)}
                validationErrors={validationErrors}
              />
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
                  disabled={isBusy}
                  label="Continua"
                  onPress={handleContinueFromPlayerAvailability}
                  variant="primary"
                />
              </View>
            </View>
          </View>
        ) : null}

        {/* ============================================================= */}
        {/* STEP: Experience (player only, optional)                        */}
        {/* ============================================================= */}
        {step === "experience" ? (
          <CareerExperienceStep
            careerEntries={careerEntries}
            isBusy={isBusy}
            onSaveAndContinue={handleSaveExperiences}
            onSkip={handleSaveExperiences}
            onUpdateEntries={(entries) => updateValue("careerEntries", entries)}
            searchTeams={searchTeams}
          />
        ) : null}

        {step === "agent_agency" ? (
          <AgentAgencyStep
            agencyLogoUrl={agentAgencyLogoUrl}
            agencyName={agentAgencyName}
            errorMessage={validationErrors.agentAgencyName}
            isUploading={uploadingField === "agent-agency-logo"}
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
            errorMessage={validationErrors.agentManagedPlayersCount}
            isBusy={isBusy}
            managedPlayersCount={agentManagedPlayersCount}
            onContinue={handleContinueFromAgentPlayers}
            onUpdate={(value) =>
              updateValue("agentManagedPlayersCount", value, [
                "agentManagedPlayersCount",
              ])
            }
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
            emptyMessage="Puoi aggiungere le tue esperienze da calciatore ora oppure proseguire e completarle piu' tardi."
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
            mainPlayerRoles={agentMainPlayerRoles}
            onContinue={handleContinueFromAgentPortfolio}
            onUpdateMainRoles={(roles) =>
              patchForm({ agentMainPlayerRoles: roles })
            }
            onUpdatePlayerTypes={(types) =>
              patchForm({ agentPlayerTypes: types })
            }
            playerTypes={agentPlayerTypes}
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
        {/* STEP: Coach Role (Qualifica)                                   */}
        {/* ============================================================= */}
        {step === "coach_role" ? (
          <View style={styles.stepContainer}>
            <CoachRoleStep
              categoriesArray={coachCategoriesArray}
              licenseType={coachLicenseType}
              primaryRole={coachPrimaryRole}
              onUpdate={(patch) => patchForm(patch)}
              validationErrors={validationErrors}
            />
            <Button
              disabled={isBusy}
              label="Continua"
              onPress={handleContinueFromCoachRole}
              variant="primary"
            />
          </View>
        ) : null}

        {/* ============================================================= */}
        {/* STEP: Coach Availability (disponibilità nuova squadra)         */}
        {/* ============================================================= */}
        {step === "coach_availability" ? (
          <View style={styles.stepContainer}>
            <OnboardingSectionCard
              title="Disponibilità"
              subtitle="Indica se sei disponibile per una nuova squadra e le zone di interesse."
            >
              <WhereToPlaySection
                availabilityType={coachAvailabilityType}
                categories={[]}
                hideCategories
                infoMessages={{
                  ITALY: "",
                  REGIONS:
                    "Indica una o più regioni in cui sei disponibile ad allenare.",
                  PROVINCES:
                    "Indica una o più province in cui sei disponibile ad allenare.",
                }}
                isAvailable={openToNewRole}
                onAvailabilityTypeChange={(value) =>
                  patchForm({ coachAvailabilityType: value })
                }
                onCategoriesChange={() => undefined}
                onIsAvailableChange={(value) => {
                  patchForm({
                    openToNewRole: value,
                    ...(value
                      ? {}
                      : {
                          coachAvailableFrom: "",
                          coachProvincesArray: [],
                          coachRegionsArray: [],
                        }),
                  });
                }}
                onProvincesChange={(value) =>
                  patchForm({ coachProvincesArray: value })
                }
                onRegionsChange={(value) =>
                  patchForm({ coachRegionsArray: value })
                }
                provinces={coachProvincesArray}
                provincesHelperText="Puoi selezionare più province in cui allenare."
                provincesLabel="Province di interesse"
                regions={coachRegionsArray}
                regionsHelperText="Puoi selezionare più regioni in cui allenare."
                regionsLabel="Regioni di interesse"
                toggleLabel="Disponibile per una nuova squadra"
                toggleSubtitle="Il tuo profilo può comparire tra gli allenatori disponibili sul mercato."
                validationErrors={validationErrors}
              />
              {openToNewRole ? (
                <SelectField
                  label="Disponibile da"
                  onChange={(val) => patchForm({ coachAvailableFrom: val })}
                  options={AVAILABLE_FROM_OPTIONS}
                  placeholder="Seleziona disponibilità"
                  value={coachAvailableFrom}
                />
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
                  disabled={isBusy}
                  label="Continua"
                  onPress={handleContinueFromCoachAvailability}
                  variant="primary"
                />
              </View>
            </View>
          </View>
        ) : null}

        {step === "staff_role" ? (
          <View style={styles.stepContainer}>
            <StaffRoleStep
              certifications={certifications}
              experienceSummary={experienceSummary}
              primaryRole={staffPrimaryRole}
              selectedRoles={staffRoles}
              onUpdate={(patch) => patchForm(patch)}
              validationErrors={validationErrors}
            />
            <Button
              disabled={isBusy}
              label="Continua"
              onPress={handleContinueFromStaffRole}
              variant="primary"
            />
          </View>
        ) : null}

        {step === "staff_availability" ? (
          <StaffAvailabilityStep
            availabilityType={staffAvailabilityType}
            availableFrom={staffAvailableFrom}
            isBusy={isBusy}
            onContinue={handleContinueFromStaffAvailability}
            onUpdate={(patch) => patchForm(patch)}
            openToWork={openToWork}
            preferredCategories={fromDelimitedString(staffPreferredCategories)}
            preferredProvinces={fromDelimitedString(staffPreferredProvinces)}
            preferredRegions={fromDelimitedString(staffPreferredRegions)}
            validationErrors={validationErrors}
          />
        ) : null}

        {/* ============================================================= */}
        {/* STEP: Coach Career                                             */}
        {/* ============================================================= */}
        {step === "coach_career" ? (
          <CoachCareerStep
            entries={coachCareerEntries as CoachCareerEntry[]}
            isBusy={isBusy}
            onContinue={handleContinueFromCoachCareer}
            onRegisterBack={registerCoachCareerBack}
            onSkip={handleContinueFromCoachCareer}
            onUpdateEntries={(entries) =>
              patchForm({ coachCareerEntries: entries })
            }
            searchTeams={searchTeams}
          />
        ) : null}

        {step === "staff_career" ? (
          <CoachCareerStep
            addButtonLabel="Aggiungi esperienza"
            defaultRole={staffPrimaryRole}
            entries={staffCareerEntries as CoachCareerEntry[]}
            emptyMessage="Aggiungi le tue esperienze nello staff tecnico. Puoi inserirne anche più di una per la stessa squadra."
            isBusy={isBusy}
            onContinue={handleSaveStaffCareer}
            onSkip={handleSaveStaffCareer}
            onUpdateEntries={(entries) =>
              patchForm({ staffCareerEntries: entries })
            }
            roleOptions={staffExperienceRoleOptions}
            searchTeams={searchTeams}
            selectorSubtitle="Scegli come vuoi inserire questa esperienza."
            selectorTitle="Aggiungi esperienza"
            subtitle="Aggiungi le tue esperienze da staff tecnico per completare il profilo."
            title="Esperienze staff tecnico"
            typeOptions={staffExperienceTypeOptions}
          />
        ) : null}

        {step === "staff_player_career_toggle" ? (
          <PlayerCareerToggleStep
            hasPlayedFootball={staffHasPlayedFootball}
            isBusy={isBusy}
            onContinue={handleContinueFromStaffPlayerCareerToggle}
            onUpdate={(value) => patchForm({ staffHasPlayedFootball: value })}
          />
        ) : null}

        {step === "staff_player_career" ? (
          <CareerExperienceStep
            careerEntries={staffPlayerCareerEntries}
            isBusy={isBusy}
            onSaveAndContinue={handleContinueFromStaffPlayerCareer}
            onSkip={handleContinueFromStaffPlayerCareer}
            onUpdateEntries={(entries) =>
              patchForm({ staffPlayerCareerEntries: entries })
            }
            searchTeams={searchTeams}
          />
        ) : null}

        {/* ============================================================= */}
        {/* STEP: Player Career Toggle                                     */}
        {/* ============================================================= */}
        {step === "player_career_toggle" ? (
          <PlayerCareerToggleStep
            hasPlayedFootball={hasPlayedFootball}
            isBusy={isBusy}
            onContinue={handleContinueFromPlayerCareerToggle}
            onUpdate={(value) => patchForm({ hasPlayedFootball: value })}
          />
        ) : null}

        {/* ============================================================= */}
        {/* STEP: Player Career                                            */}
        {/* ============================================================= */}
        {step === "player_career" ? (
          <CareerExperienceStep
            careerEntries={coachPlayerCareerEntries}
            isBusy={isBusy}
            onSaveAndContinue={handleContinueFromPlayerCareer}
            onSkip={handleContinueFromPlayerCareer}
            onUpdateEntries={(entries) =>
              patchForm({ coachPlayerCareerEntries: entries })
            }
            searchTeams={searchTeams}
          />
        ) : null}

        {/* ============================================================= */}
        {/* STEP: Coach Extra (filosofia e stile)                          */}
        {/* ============================================================= */}
        {step === "coach_extra" ? (
          <CoachExtraStep
            bio={bio}
            formation={coachFormation}
            isBusy={isBusy}
            languages={coachLanguages}
            playStyle={coachPlayStyle}
            onFinish={handleFinishCoachExtra}
            onSkip={handleFinishCoachExtra}
            onUpdate={(patch) => patchForm(patch)}
          />
        ) : null}

        {/* ============================================================= */}
        {/* STEP: Club Representative (Referente società)                  */}
        {/* ============================================================= */}
        {step === "club_representative" ? (
          <View style={styles.stepContainer}>
            <View style={styles.clubStepHeader}>
              <OnboardingEyebrow>Il tuo club</OnboardingEyebrow>
              <AppText variant="displaySm">Referente società</AppText>
              <AppText variant="bodySm" color="secondary">
                Inserisci i dati del responsabile della società sportiva.
              </AppText>
            </View>

            <OnboardingSectionCard>
              <View style={styles.clubFieldRow}>
                <View style={styles.flex1}>
                  <Input
                    autoCapitalize="words"
                    autoCorrect={false}
                    label="Nome"
                    onBlur={() => handleFormattedNameBlur("firstName")}
                    onChangeText={(value) => updateValue("firstName", value)}
                    placeholder="Es. Andrea"
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
                </View>
                <View style={styles.flex1}>
                  <Input
                    autoCapitalize="words"
                    autoCorrect={false}
                    label="Cognome"
                    onBlur={() => handleFormattedNameBlur("lastName")}
                    onChangeText={(value) => updateValue("lastName", value)}
                    placeholder="Es. Bianchi"
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
              </View>

              <Input
                autoCapitalize="none"
                keyboardType="email-address"
                label="Email responsabile"
                onChangeText={(value) => updateValue("repEmail", value)}
                placeholder="andrea.bianchi@email.com"
                style={
                  validationErrors.repEmail
                    ? { borderColor: colors.danger }
                    : undefined
                }
                value={repEmail}
              />
              {validationErrors.repEmail ? (
                <ValidationMessage>
                  {validationErrors.repEmail}
                </ValidationMessage>
              ) : null}

              <PhoneInputWithCountryCode
                countryCode={repPhoneCountryCode}
                errorMessage={validationErrors.repPhone}
                label="Telefono responsabile"
                onChangeCountryCode={(value) =>
                  updateValue("repPhoneCountryCode", value, ["repPhone"])
                }
                onChangePhoneNumber={(value) =>
                  updateValue("repPhone", value, ["repPhone"])
                }
                phoneNumber={repPhone}
              />
            </OnboardingSectionCard>

            <Button
              disabled={isBusy}
              label="Continua"
              onPress={handleContinueFromClubRepresentative}
              variant="primary"
            />
          </View>
        ) : null}

        {/* ============================================================= */}
        {/* STEP: Club Data (Dati della società)                           */}
        {/* ============================================================= */}
        {step === "club_data" ? (
          <View style={styles.stepContainer}>
            <View style={styles.clubStepHeader}>
              <AppText variant="displaySm">Dati della società</AppText>
              <AppText variant="bodySm" color="secondary">
                Aggiungi le informazioni ufficiali del club sportivo.
              </AppText>
            </View>

            <View style={styles.clubLogoStage}>
              <Pressable
                onPress={() =>
                  handleMediaUpload({
                    field: "clubLogo",
                    folder: "club-logos",
                    mediaTypes: ["images"],
                    onUploaded: (items) =>
                      updateValue("clubLogoUrl", items[0]?.url ?? ""),
                  })
                }
                style={[
                  styles.clubLogoShell,
                  clubLogoUrl ? styles.clubLogoShellFilled : null,
                ]}
              >
                {clubLogoUrl ? (
                  <Image
                    source={{ uri: clubLogoUrl }}
                    style={styles.clubLogoImage}
                  />
                ) : (
                  <Ionicons
                    name="shield-outline"
                    size={64}
                    color={colors.textMuted}
                  />
                )}
                <View style={styles.clubLogoCameraBadge}>
                  <Ionicons name="camera" size={18} color={colors.inkInvert} />
                </View>
              </Pressable>
              <Pressable
                onPress={() =>
                  handleMediaUpload({
                    field: "clubLogo",
                    folder: "club-logos",
                    mediaTypes: ["images"],
                    onUploaded: (items) =>
                      updateValue("clubLogoUrl", items[0]?.url ?? ""),
                  })
                }
              >
                <AppText variant="bodySm" style={styles.clubLogoLink}>
                  Carica logo squadra
                </AppText>
              </Pressable>
            </View>

            <OnboardingSectionCard>
              <Input
                label="Nome società"
                onChangeText={(value) => updateValue("clubName", value)}
                placeholder="Es. ASD Calcio Milano"
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

              <View style={styles.clubFieldRow}>
                <View style={styles.flex1}>
                  <Input
                    keyboardType="number-pad"
                    label="Anno di fondazione"
                    maxLength={4}
                    onChangeText={(value) =>
                      updateValue("clubFoundingYear", value)
                    }
                    placeholder="Es. 1999"
                    style={
                      validationErrors.clubFoundingYear
                        ? { borderColor: colors.danger }
                        : undefined
                    }
                    value={clubFoundingYear}
                  />
                  {validationErrors.clubFoundingYear ? (
                    <ValidationMessage>
                      {validationErrors.clubFoundingYear}
                    </ValidationMessage>
                  ) : null}
                </View>
                <View style={styles.flex1}>
                  <Input
                    label="Colori sociali"
                    onChangeText={(value) => updateValue("clubColors", value)}
                    placeholder="Seleziona"
                    value={clubColors}
                  />
                </View>
              </View>

              <SelectField
                label="Categoria prima squadra"
                onChange={(value) => updateValue("clubCategory", value)}
                options={SENIOR_CATEGORY_OPTIONS}
                placeholder="Scegli il campionato"
                value={clubCategory}
              />
              {validationErrors.clubCategory ? (
                <ValidationMessage>
                  {validationErrors.clubCategory}
                </ValidationMessage>
              ) : null}
            </OnboardingSectionCard>

            <OnboardingSectionCard>
              <ResidenceCityInput
                errorMessage={validationErrors.clubCity}
                helperText={
                  clubRegion
                    ? `Città selezionata: ${clubCity} · ${clubRegion}`
                    : undefined
                }
                label="Città"
                onChangeText={handleClubCityChange}
                onSelectCity={handleClubCitySelect}
                value={clubCity}
              />

              <Input
                label="Indirizzo sede"
                onChangeText={(value) =>
                  updateValue("clubHeadquartersAddress", value)
                }
                placeholder="Es. Via Roma, 10"
                value={clubHeadquartersAddress}
              />

              <Input
                autoCapitalize="none"
                keyboardType="email-address"
                label="Email ufficiale società"
                onChangeText={(value) => updateValue("clubEmail", value)}
                placeholder="info@societa.it"
                style={
                  validationErrors.clubEmail
                    ? { borderColor: colors.danger }
                    : undefined
                }
                value={clubEmail}
              />
              {validationErrors.clubEmail ? (
                <ValidationMessage>
                  {validationErrors.clubEmail}
                </ValidationMessage>
              ) : null}

              <PhoneInputWithCountryCode
                countryCode={clubPhoneCountryCode}
                errorMessage={validationErrors.clubPhone}
                label="Telefono segreteria"
                onChangeCountryCode={(value) =>
                  updateValue("clubPhoneCountryCode", value, ["clubPhone"])
                }
                onChangePhoneNumber={(value) =>
                  updateValue("clubPhone", value, ["clubPhone"])
                }
                phoneNumber={clubPhone}
              />
            </OnboardingSectionCard>

            <Button
              disabled={isBusy}
              label={isBusy ? "Verifica..." : "Continua"}
              onPress={handleContinueFromClubData}
              variant="primary"
            />
          </View>
        ) : null}

        {/* ============================================================= */}
        {/* STEP: Club Youth (Settore giovanile)                           */}
        {/* ============================================================= */}
        {step === "club_youth" ? (
          <View style={styles.stepContainer}>
            <View style={styles.clubStepHeader}>
              <AppText variant="displaySm">Settore giovanile</AppText>
              <AppText variant="bodySm" color="secondary">
                Indica se la società gestisce un vivaio e in quali categorie
                opera.
              </AppText>
            </View>

            <OnboardingToggleRow
              label="La società ha un settore giovanile"
              onValueChange={(value) => {
                if (value) {
                  updateValue("clubHasYouthSector", true);
                } else {
                  patchForm({
                    clubHasYouthSector: false,
                    clubYouthCategories: [],
                  });
                }
              }}
              value={clubHasYouthSector}
            />

            {clubHasYouthSector ? (
              <>
                <View style={styles.clubCheckboxList}>
                  {YOUTH_CATEGORY_OPTIONS.map((option) => {
                    const isSelected = clubYouthCategories.includes(
                      option.value,
                    );
                    return (
                      <OnboardingCheckboxRow
                        key={option.value}
                        active={isSelected}
                        label={option.label}
                        onPress={() => {
                          const updated = isSelected
                            ? clubYouthCategories.filter(
                                (v) => v !== option.value,
                              )
                            : [...clubYouthCategories, option.value];
                          updateValue("clubYouthCategories", updated);
                        }}
                      />
                    );
                  })}
                </View>
                {validationErrors.clubYouthCategories ? (
                  <ValidationMessage>
                    {validationErrors.clubYouthCategories}
                  </ValidationMessage>
                ) : null}
              </>
            ) : null}

            <Button
              label="Continua"
              onPress={handleContinueFromClubYouth}
              variant="primary"
            />
          </View>
        ) : null}

        {/* ============================================================= */}
        {/* STEP: Club Profile (Completa il profilo)                       */}
        {/* ============================================================= */}
        {step === "club_profile" ? (
          <View style={styles.stepContainer}>
            <View style={styles.clubStepHeader}>
              <AppText variant="displaySm">Completa il profilo</AppText>
              <AppText variant="bodySm" color="secondary">
                Aggiungi dettagli per rendere la pagina della società più
                attraente e autorevole.
              </AppText>
            </View>

            <OnboardingSectionCard>
              <Input
                label="Descrizione società"
                multiline
                onChangeText={(value) => updateValue("clubDescription", value)}
                placeholder="Racconta la storia e i valori del club..."
                value={clubDescription}
              />

              <Input
                label="Stadio / Campo sportivo principale"
                onChangeText={(value) => updateValue("clubStadium", value)}
                placeholder="Nome dell'impianto"
                value={clubStadium}
              />

              <Input
                keyboardType="number-pad"
                label="Numero totale tesserati"
                onChangeText={(value) => updateValue("clubTotalMembers", value)}
                placeholder="Es. 250"
                value={clubTotalMembers}
              />

              <Input
                autoCapitalize="none"
                keyboardType="url"
                label="Sito web"
                onChangeText={(value) => updateValue("clubWebsite", value)}
                placeholder="www.societa.it"
                value={clubWebsite}
              />

              <Input
                autoCapitalize="none"
                label="Instagram"
                onChangeText={(value) => updateValue("clubInstagram", value)}
                placeholder="@societa"
                value={clubInstagram}
              />

              <Input
                autoCapitalize="none"
                label="Facebook"
                onChangeText={(value) => updateValue("clubFacebook", value)}
                placeholder="Nome Pagina"
                value={clubFacebook}
              />
            </OnboardingSectionCard>

            <Button
              disabled={isBusy}
              label={
                isBusy ? "Creazione in corso..." : "Completa registrazione"
              }
              onPress={handleSubmitClubProfile}
              variant="primary"
            />
          </View>
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
            emptyMessage="Aggiungi le tue esperienze dirigenziali. Puoi inserirle ora o completarle in seguito dal tuo profilo."
            entries={directorCareerEntries}
            isBusy={isBusy}
            onContinue={handleContinueFromDirectorCareer}
            onRegisterBack={registerCoachCareerBack}
            onSkip={handleContinueFromDirectorCareer}
            onUpdateEntries={(entries) =>
              patchForm({ directorCareerEntries: entries })
            }
            roleOptions={DIRECTOR_ROLE_OPTIONS}
            searchTeams={searchTeams}
            selectorSubtitle="Scegli come vuoi inserire questa esperienza."
            selectorTitle="Aggiungi esperienza dirigenziale"
            subtitle="Aggiungi le tue esperienze come dirigente per completare il profilo."
            title="Carriera dirigenziale"
            typeOptions={staffExperienceTypeOptions}
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
              patchForm({ directorHasOtherFootballExperience: value })
            }
            onUpdateRoles={(roles) =>
              patchForm({ directorOtherFootballRoles: roles })
            }
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

        {/* ============================================================= */}
        {/* STEP: Complete                                                 */}
        {/* ============================================================= */}
        {step === "complete" ? (
          <View style={styles.stepContainer}>
            {role === "club_admin" ? (
              <>
                <View style={styles.clubSuccessContainer}>
                  <View style={styles.clubSuccessIcon}>
                    <Ionicons
                      name="checkmark"
                      size={48}
                      color={colors.successForeground}
                    />
                  </View>
                  <AppText variant="displaySm" style={styles.textCenter}>
                    Profilo società{"\n"}creato con successo
                  </AppText>
                  <AppText
                    variant="bodyLg"
                    color="secondary"
                    style={styles.clubSuccessDesc}
                  >
                    Benvenuto su FootMe. Inizia subito a cercare giocatori,
                    allenatori e staff per la tua squadra.
                  </AppText>
                </View>

                <Button
                  label="Vai alla Home"
                  onPress={() => finishOnboarding("feed")}
                  variant="primary"
                />
                <Button
                  label="Completa il profilo più tardi"
                  onPress={() => finishOnboarding("profile")}
                  variant="tertiary"
                />
              </>
            ) : (
              <>
                <OnboardingSectionCard>
                  <View style={styles.completionIcon}>
                    <Ionicons
                      name="checkmark-circle"
                      size={64}
                      color={colors.success}
                    />
                  </View>
                  <AppText variant="displaySm" style={styles.textCenter}>
                    {role === "media"
                      ? "Profilo media creato con successo"
                      : role === "fan"
                        ? "Profilo creato con successo"
                        : "Il tuo profilo e' pronto!"}
                  </AppText>
                  <AppText
                    variant="bodySm"
                    color="secondary"
                    style={styles.textCenter}
                  >
                    {role === "media"
                      ? "Il tuo profilo e' pronto per raccontare il mondo del calcio e farsi trovare dalla community di FootMe."
                      : role === "fan"
                        ? "Ora puoi esplorare il network, seguire le aree che ti interessano e partecipare alla community."
                        : "Ora puoi iniziare a connetterti con squadre, allenatori e giocatori. Se vuoi, potrai aggiungere altri dettagli in qualsiasi momento."}
                  </AppText>
                </OnboardingSectionCard>

                <Button
                  label={
                    role === "fan" || role === "media"
                      ? "Vai alla Home"
                      : "Vai alla home feed"
                  }
                  onPress={() => finishOnboarding("feed")}
                  variant="primary"
                />
                <Button
                  label="Cerca squadre e contatti"
                  onPress={() => finishOnboarding("network")}
                  variant="secondary"
                />
                <Button
                  label="Completa ulteriormente il profilo"
                  onPress={() => finishOnboarding("profile")}
                  variant="tertiary"
                />
              </>
            )}
          </View>
        ) : null}
      </KeyboardAwareForm>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing[12],
  },
  clubCheckboxList: {
    gap: spacing[10],
  },
  clubFieldRow: {
    flexDirection: "row",
    gap: spacing[12],
  },
  clubLogoCameraBadge: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderColor: colors.background,
    borderRadius: radius.full,
    borderWidth: 3,
    bottom: -8,
    height: 36,
    justifyContent: "center",
    position: "absolute",
    right: -8,
    width: 36,
  },
  clubLogoImage: {
    borderRadius: radius[12],
    height: "100%",
    width: "100%",
  },
  clubLogoLink: {
    color: colors.accent,
    fontWeight: "600",
    marginTop: spacing[16],
  },
  clubLogoShell: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[12],
    borderStyle: "dashed",
    borderWidth: 2,
    height: 140,
    justifyContent: "center",
    overflow: "hidden",
    width: 140,
  },
  clubLogoShellFilled: {
    borderStyle: "solid",
    borderWidth: 4,
    borderColor: colors.surface,
  },
  clubLogoStage: {
    alignItems: "center",
    paddingBottom: spacing[8],
    paddingTop: spacing[24],
  },
  clubStepHeader: {
    gap: spacing[12],
  },
  clubSuccessContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing[32],
  },
  clubSuccessDesc: {
    marginTop: spacing[12],
    maxWidth: 300,
    textAlign: "center",
  },
  clubSuccessIcon: {
    alignItems: "center",
    backgroundColor: colors.successSoft,
    borderRadius: radius.full,
    height: 88,
    justifyContent: "center",
    marginBottom: spacing[24],
    shadowColor: "rgba(16, 185, 129, 0.24)",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 32,
    elevation: 4,
    width: 88,
  },
  completionIcon: {
    alignItems: "center",
    paddingVertical: spacing[8],
  },
  fieldGap12: {
    gap: spacing[12],
  },
  flex1: {
    flex: 1,
  },
  formContent: {
    gap: spacing[18],
    paddingBottom: 28,
    paddingHorizontal: spacing[16],
    paddingTop: spacing[16],
  },
  genderCard: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    paddingVertical: spacing[14],
  },
  genderCardActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  genderCardActiveText: {
    color: colors.accent,
  },
  genderRow: {
    flexDirection: "row",
    gap: spacing[12],
  },
  photoCameraOverlay: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: 3,
    bottom: 0,
    height: 38,
    justifyContent: "center",
    position: "absolute",
    right: 0,
    width: 38,
  },
  photoCircle: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 70,
    borderWidth: 2,
    height: 140,
    justifyContent: "center",
    overflow: "hidden",
    width: 140,
  },
  photoImage: {
    height: "100%",
    width: "100%",
  },
  photoPreviewContainer: {
    alignItems: "center",
    paddingVertical: spacing[16],
  },
  photoWrapper: {
    height: 140,
    width: 140,
  },
  roleCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: 1,
    flex: 1,
    gap: spacing[12],
    justifyContent: "center",
    minHeight: 106,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[16],
    shadowColor: "rgba(15,23,36,0.04)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 1,
  },
  roleCardActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
    shadowColor: "rgba(10,102,194,0.20)",
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    elevation: 3,
  },
  roleCardActiveText: {
    color: colors.inkInvert,
  },
  roleCardTitle: {
    fontWeight: "600",
  },
  roleGrid: {
    gap: spacing[14],
  },
  roleGridRow: {
    flexDirection: "row",
    gap: spacing[14],
  },
  roleIconCircle: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  roleIconCircleActive: {
    backgroundColor: "rgba(255,255,255,0.18)",
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
  textCenter: {
    textAlign: "center",
  },
  youthCategoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
});
