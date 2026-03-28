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

import { AvailabilityRegionsSelector } from "../../src/components/ui/availability-regions-selector";
import { InterestCategoriesSelector } from "../../src/components/ui/interest-categories-selector";
import { DatePickerField } from "../../src/components/ui/date-picker-field";
import { KeyboardAwareForm } from "../../src/components/ui/keyboard-aware-form";
import { MediaPickerField } from "../../src/components/ui/media-picker-field";
import { NationalityAutocompleteInput } from "../../src/components/ui/nationality-autocomplete-input";
import { PhoneInputWithCountryCode } from "../../src/components/ui/phone-input-with-country-code";
import { ResidenceCityInput } from "../../src/components/ui/residence-city-input";
import { SelectField } from "../../src/components/ui/select-field";
import { WheelPicker } from "../../src/components/ui/wheel-picker";
import { WheelPickerField } from "../../src/components/ui/wheel-picker-field";
import { useSession } from "../../src/features/auth/use-session";
import {
  createInitialProfile,
  BaseProfileValidationError,
  type AppRole,
  type ProfileGender,
  type StaffSpecialization,
} from "../../src/features/onboarding/create-initial-profile";
import {
  coerceOnboardingStep,
  getEffectiveDomicile,
  getOnboardingFullName,
  getOnboardingProgress,
  getOnboardingVisibleSteps,
  getPreviousOnboardingStep,
  validateOnboardingStep,
  type OnboardingStep,
  type OnboardingValidationErrors,
} from "../../src/features/onboarding/onboarding-form";
import {
  OnboardingInfoCard,
  OnboardingProgressBar,
  OnboardingScreenHeader,
  OnboardingSectionCard,
} from "../../src/features/onboarding/onboarding-ui";
import { useOnboardingForm } from "../../src/features/onboarding/onboarding-form-provider";
import {
  PlayerCharacteristicsSection,
  PlayerExperiencesSection,
} from "../../src/features/profiles/player-sports-section";
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
  value: AppRole;
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
    icon: "hand-right-outline",
    label: "Procuratore",
    value: "agent",
  },
  {
    icon: "people-outline",
    label: "Dirigente",
    value: "director",
  },
];

const genderOptions: { label: string; value: ProfileGender }[] = [
  { label: "Uomo", value: "male" },
  { label: "Donna", value: "female" },
];

const staffSpecializationOptions: {
  label: string;
  value: StaffSpecialization;
}[] = [
  { label: "Preparatore atletico", value: "fitness_coach" },
  { label: "Preparatore portieri", value: "goalkeeper_coach" },
  { label: "Fisioterapista", value: "physiotherapist" },
  { label: "Match analyst", value: "match_analyst" },
  { label: "Team manager", value: "team_manager" },
  { label: "Altro", value: "other" },
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
      style={[
        styles.roleCard,
        active ? styles.roleCardActive : null,
      ]}
      testID={testID}
    >
      <View style={[styles.roleIconCircle, active ? styles.roleIconCircleActive : null]}>
        <Ionicons
          name={icon}
          size={24}
          color={active ? colors.inkInvert : colors.accentStrong}
        />
      </View>
      <AppText
        variant="bodySm"
        style={[styles.roleCardTitle, active ? styles.roleCardActiveText : undefined]}
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
      <AppText variant="titleSm" style={active ? styles.genderCardActiveText : undefined}>
        {label}
      </AppText>
    </Pressable>
  );
}

function FootChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Button
      label={label}
      onPress={onPress}
      selected={active}
      size="sm"
      variant="chipAction"
    />
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
  const [showExperienceForm, setShowExperienceForm] = useState(false);

  const requestedStep = useMemo(() => {
    if (Array.isArray(params.step)) {
      return coerceOnboardingStep(params.step[0]);
    }

    return coerceOnboardingStep(params.step);
  }, [params.step]);

  const step = requestedStep ?? form.currentStep;
  const {
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
    clubHasYouthSector,
    clubYouthCategories,
    clubFieldAddress,
    clubFoundingYear,
    clubGalleryItems,
    clubHeadquartersAddress,
    clubLeague,
    clubLogoUrl,
    clubName,
    clubPhone,
    clubPhoneCountryCode,
    clubRegion,
    clubWebsite,
    coachedCategories,
    coachedClubs,
    coachPreferredRegions,
    certifications,
    domicile,
    domicileRegion,
    experienceSummary,
    firstName,
    gamePhilosophy,
    gender,
    hasCreatedProfile,
    heightCm,
    highlightVideoUrl,
    isOpenToTransfer,
    lastCompletedStep,
    lastName,
    licenses,
    nationality,
    openToNewRole,
    openToWork,
    phoneCountryCode,
    phoneNumber,
    playerMediaItems,
    preferredCategories,
    preferredFoot,
    primaryPosition,
    residence,
    residenceRegion,
    role,
    secondaryPositions,
    staffPreferredRegions,
    staffSpecialization,
    technicalVideoUrl,
    transferRegions,
    uploadingField,
    useResidenceForDomicile,
    weightKg,
    willingToChangeClub,
  } = form;

  const fullName = getOnboardingFullName(form);
  const visibleSteps = getOnboardingVisibleSteps(role as AppRole | "");
  const progress = getOnboardingProgress(step, role as AppRole | "");
  const canGoBack = step !== "role";
  const isBusy = isSubmitting || uploadingField !== null;
  const authEmail = session?.user?.email ?? "";

  useEffect(() => {
    if (!isHydrated || !authEmail) {
      return;
    }

    if (step === "club" && !clubEmail) {
      setFormValue("clubEmail", authEmail);
    }
  }, [authEmail, clubEmail, isHydrated, setFormValue, step]);

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

  const handleClubCountrySelect = useCallback(
    (value: string) => {
      const country = getCountryByCode(value);

      patchForm({
        clubCountry: value,
        clubPhoneCountryCode:
          !clubPhone.trim() && country
            ? country.phoneCountryCode
            : clubPhoneCountryCode,
      });
      clearValidationErrors(["clubCountry"]);
    },
    [clearValidationErrors, clubPhone, clubPhoneCountryCode, patchForm],
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

      patchForm({
        nationality: value,
        phoneCountryCode:
          !phoneNumber.trim() && country
            ? country.phoneCountryCode
            : phoneCountryCode,
      });
      clearValidationErrors(["nationality", "phoneNumber"]);
    },
    [clearValidationErrors, patchForm, phoneCountryCode, phoneNumber],
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
      clubEmail,
      clubHasYouthSector,
      clubYouthCategories,
      clubFieldAddress,
      clubFoundingYear,
      clubHeadquartersAddress,
      clubLogoUrl,
      clubName,
      clubPhone: composePhoneNumber(clubPhoneCountryCode, clubPhone),
      clubRegion,
      clubWebsite,
      domicile: getEffectiveDomicile(form),
      fullName,
      gender: gender as ProfileGender,
      nationality,
      phoneNumber: composePhoneNumber(phoneCountryCode, phoneNumber),
      primaryPosition: primaryPosition || DEFAULT_PLAYER_PRIMARY_POSITION,
      residence,
      role: role as AppRole,
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
    navigateToStep(form.role === "club_admin" ? "club" : "base");
  }

  async function handleContinueFromBase() {
    const nextErrors = validateOnboardingStep("base", form);

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      setValidationErrors({});
      await ensureInitialProfileCreated();
      patchForm({ lastCompletedStep: "base" });
      navigateToStep("photo");
    } catch (error) {
      const alertCopy = getBaseStepAlert(error);
      setValidationErrors(validateOnboardingStep("base", form));
      Alert.alert(alertCopy.title, alertCopy.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleContinueFromPhoto() {
    patchForm({ lastCompletedStep: "photo" });
    navigateToStep("technical");
  }

  async function handleContinueFromTechnical() {
    if (!session?.user) {
      return;
    }

    const nextErrors = validateOnboardingStep("technical", form);

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      setValidationErrors({});

      if (!hasCreatedProfile) {
        await ensureInitialProfileCreated();
      }

      const normalizedCareerEntries = parsePlayerExperienceForms(careerEntries);

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
                coached_categories: fromDelimitedString(coachedCategories),
                coached_clubs: fromDelimitedString(coachedClubs),
                game_philosophy: parseOptionalText(gamePhilosophy),
                licenses: fromDelimitedString(licenses),
                open_to_new_role: openToNewRole,
                preferred_regions: fromDelimitedString(coachPreferredRegions),
                technical_video_url: parseOptionalText(technicalVideoUrl),
              }
            : null,
        playerCareerEntries: role === "player" ? normalizedCareerEntries : [],
        playerProfile:
          role === "player"
            ? {
                height_cm: parseOptionalNumber(heightCm),
                highlight_video_url: parseOptionalText(highlightVideoUrl),
                preferred_categories: fromDelimitedString(preferredCategories),
                preferred_foot: preferredFoot || null,
                primary_position:
                  primaryPosition || DEFAULT_PLAYER_PRIMARY_POSITION,
                secondary_positions: secondaryPositions,
                transfer_regions: fromDelimitedString(transferRegions),
                weight_kg: parseOptionalNumber(weightKg),
                willing_to_change_club: willingToChangeClub,
              }
            : null,
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
                experience_summary: parseOptionalText(experienceSummary),
                open_to_work: openToWork,
                preferred_regions: fromDelimitedString(staffPreferredRegions),
                specialization: staffSpecialization,
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
        },
      });

      if (role === "player") {
        const { error } = await supabase
          .from("player_profiles")
          .update({ media_urls: playerMediaItems.map((item) => item.url) })
          .eq("profile_id", session.user.id);

        if (error) {
          throw error;
        }
      }

      patchForm({ lastCompletedStep: "technical" });

      // Players get an optional experience step; others go straight to completion
      if (role === "player") {
        navigateToStep("experience");
      } else {
        goToCompletion("technical");
      }
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

      const normalizedCareerEntries = parsePlayerExperienceForms(careerEntries);

      await updateCompleteProfessionalProfile({
        club: null,
        clubSeasonEntries: [],
        coachProfile: null,
        playerCareerEntries: normalizedCareerEntries,
        playerProfile: {
          height_cm: parseOptionalNumber(heightCm),
          highlight_video_url: parseOptionalText(highlightVideoUrl),
          preferred_categories: fromDelimitedString(preferredCategories),
          preferred_foot: preferredFoot || null,
          primary_position:
            primaryPosition || DEFAULT_PLAYER_PRIMARY_POSITION,
          secondary_positions: secondaryPositions,
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

      goToCompletion("experience");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore inatteso nel salvataggio esperienze.";
      Alert.alert("Esperienze non salvate", message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmitClub() {
    const nextErrors = validateOnboardingStep("club", form);

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

      await ensureInitialProfileCreated();
      goToCompletion("club");
    } catch (error) {
      const alertCopy = getBaseStepAlert(error);
      setValidationErrors(validateOnboardingStep("club", form));
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

  function appendUploadedMedia(
    field: "clubGalleryItems" | "playerMediaItems",
    items: UploadedMediaItem[],
  ) {
    const currentItems = form[field];
    updateValue(field, [...currentItems, ...items]);
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

      {step !== "complete" ? (
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
                    const pair = roleOptions.slice(rowIndex * 2, rowIndex * 2 + 2);
                    return (
                      <View key={rowIndex} style={styles.roleGridRow}>
                        {pair.map((entry) => (
                          <RoleSelectionCard
                            key={entry.value}
                            active={role === entry.value}
                            icon={entry.icon}
                            label={entry.label}
                            onPress={() => updateValue("role", entry.value, ["role"])}
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
              label={role ? `Continua come ${roleOptions.find((r) => r.value === role)?.label}` : "Seleziona un ruolo"}
              onPress={handleContinueFromRole}
              variant="primary"
            />
          </View>
        ) : null}

        {/* ============================================================= */}
        {/* STEP: Base (personal data)                                     */}
        {/* ============================================================= */}
        {step === "base" ? (
          <View style={styles.stepContainer}>
            <OnboardingSectionCard
              title="Dati del calciatore"
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
                label="Nazionalità"
                onChange={handleNationalitySelect}
                value={nationality}
              />

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
                  disabled={isBusy}
                  label={isBusy ? "Salvataggio..." : "Continua"}
                  onPress={handleContinueFromBase}
                  variant="primary"
                />
              </View>
            </View>
          </View>
        ) : null}

        {/* ============================================================= */}
        {/* STEP: Photo                                                    */}
        {/* ============================================================= */}
        {step === "photo" ? (
          <View style={styles.stepContainer}>
            <OnboardingSectionCard
              title="Aggiungi una foto"
              subtitle="Una foto profilo aiuta gli altri a riconoscerti. Puoi saltare questo passaggio e aggiungerla in seguito."
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
              label={uploadingField === "avatar" ? "Caricamento..." : "Carica da galleria"}
              leftIcon={<Ionicons name="images-outline" size={18} color={colors.inkInvert} />}
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
              leftIcon={<Ionicons name="camera-outline" size={18} color={colors.accentStrong} />}
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

                <OnboardingSectionCard
                  title="Disponibilita'"
                  subtitle="Indica apertura al trasferimento, regioni di interesse e categorie in cui vuoi ricevere opportunita'."
                >
                  <Toggle
                    label="Disponibile a cambiare squadra"
                    onValueChange={(value) =>
                      patchForm({
                        isOpenToTransfer: value,
                        willingToChangeClub: value,
                      })
                    }
                    subtitle="Il tuo profilo puo' comparire tra i calciatori disponibili."
                    value={isOpenToTransfer}
                  />
                  <AvailabilityRegionsSelector
                    label="Regioni di interesse"
                    onChange={(regions) =>
                      updateValue("transferRegions", regions.join(", "))
                    }
                    placeholder="Cerca regione"
                    value={fromDelimitedString(transferRegions)}
                  />
                  <InterestCategoriesSelector
                    onChange={(categories) =>
                      updateValue("preferredCategories", categories.join(", "))
                    }
                    value={fromDelimitedString(preferredCategories)}
                  />
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
                  onChangeText={(value) =>
                    updateValue("gamePhilosophy", value)
                  }
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
                  onValueChange={(value) =>
                    updateValue("openToNewRole", value)
                  }
                  value={openToNewRole}
                />
              </OnboardingSectionCard>
            ) : null}

            {role === "staff" ? (
              <OnboardingSectionCard
                title="Profilo staff tecnico"
                subtitle="Inserisci specializzazione, certificazioni e disponibilita'."
              >
                <SelectField
                  label="Specializzazione"
                  onChange={(value) =>
                    updateValue(
                      "staffSpecialization",
                      value as StaffSpecialization,
                    )
                  }
                  options={staffSpecializationOptions}
                  placeholder="Seleziona la specializzazione"
                  value={staffSpecialization}
                />
                <Input
                  label="Certificazioni"
                  onChangeText={(value) =>
                    updateValue("certifications", value)
                  }
                  placeholder="Es. UEFA Fitness, FMS"
                  value={certifications}
                />
                <Input
                  label="Esperienza"
                  multiline
                  onChangeText={(value) =>
                    updateValue("experienceSummary", value)
                  }
                  placeholder="Ruoli, staff e contesti in cui hai lavorato"
                  value={experienceSummary}
                />
                <Input
                  label="Regioni preferite"
                  onChangeText={(value) =>
                    updateValue("staffPreferredRegions", value)
                  }
                  placeholder="Es. Lombardia, Emilia-Romagna"
                  value={staffPreferredRegions}
                />
                <Toggle
                  label="Disponibile a collaborare subito"
                  onValueChange={(value) =>
                    updateValue("openToWork", value)
                  }
                  value={openToWork}
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
                  label={isBusy ? "Salvataggio..." : "Conferma profilo"}
                  onPress={handleContinueFromTechnical}
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
          <View style={styles.stepContainer}>
            {!showExperienceForm ? (
              <>
                <OnboardingSectionCard
                  title="Aggiungi esperienza"
                  subtitle="Un profilo con esperienze e' piu' visibile per club e allenatori."
                >
                  <View style={styles.experienceBridgeIcon}>
                    <Ionicons
                      name="trophy-outline"
                      size={48}
                      color={colors.accent}
                    />
                  </View>
                  <OnboardingInfoCard message="Puoi aggiungere le tue esperienze calcistiche ora oppure farlo in seguito dal tuo profilo." />
                </OnboardingSectionCard>

                <Button
                  label="Aggiungi esperienza"
                  onPress={() => setShowExperienceForm(true)}
                  variant="primary"
                />
                <Button
                  label="Completa la registrazione"
                  onPress={() => goToCompletion("experience")}
                  variant="secondary"
                />
              </>
            ) : (
              <>
                <OnboardingSectionCard
                  title="Carriera calcistica"
                  subtitle="Aggiungi una stagione per volta con squadra, categoria e statistiche."
                >
                  <PlayerExperiencesSection
                    addButtonLabel="Aggiungi altra esperienza"
                    autoOpenFlow
                    editable
                    emptyStateLabel="Aggiungi la tua prima esperienza stagionale."
                    experiences={careerEntries}
                    onChange={(value) => updateValue("careerEntries", value)}
                    searchTeams={searchTeams}
                  />
                </OnboardingSectionCard>

                <View style={styles.buttonRow}>
                  <View style={styles.flex1}>
                    <Button
                      label="Salta"
                      onPress={() => goToCompletion("experience")}
                      variant="secondary"
                    />
                  </View>
                  <View style={styles.flex1}>
                    <Button
                      disabled={isBusy || careerEntries.length === 0}
                      label={isBusy ? "Salvataggio..." : "Salva e continua"}
                      onPress={handleSaveExperiences}
                      variant="primary"
                    />
                  </View>
                </View>
              </>
            )}
          </View>
        ) : null}

        {/* ============================================================= */}
        {/* STEP: Club                                                     */}
        {/* ============================================================= */}
        {step === "club" ? (
          <View style={styles.stepContainer}>
            <OnboardingSectionCard
              title="Il tuo club"
              subtitle="Inserisci le informazioni della tua società. I campi obbligatori sono contrassegnati con *."
            >
              <View style={styles.sectionHeaderGap}>
                <AppText variant="headingSm">Dati del responsabile</AppText>
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
              </View>

              <View style={styles.sectionHeaderGap}>
                <AppText variant="headingSm">Dati della società</AppText>
                <View style={styles.fieldGap12}>
                  <Input
                    label="Nome società *"
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

                  <MediaPickerField
                    buttonLabel={
                      clubLogoUrl ? "Sostituisci logo" : "Carica logo società"
                    }
                    helperText="Carica il logo della tua società."
                    isUploading={uploadingField === "clubLogo"}
                    label="Logo"
                    onPick={() =>
                      handleMediaUpload({
                        field: "clubLogo",
                        folder: "club-logos",
                        mediaTypes: ["images"],
                        onUploaded: (items) =>
                          updateValue("clubLogoUrl", items[0]?.url ?? ""),
                      })
                    }
                    onRemove={() => updateValue("clubLogoUrl", "")}
                    previewUrl={clubLogoUrl || undefined}
                    removable
                    selectedLabel={
                      clubLogoUrl ? "Logo caricato correttamente" : undefined
                    }
                  />

                  <Input
                    keyboardType="number-pad"
                    label="Anno di fondazione"
                    maxLength={4}
                    onChangeText={(value) =>
                      updateValue("clubFoundingYear", value)
                    }
                    placeholder="Es. 1920"
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

                  <Input
                    label="Colori sociali"
                    onChangeText={(value) => updateValue("clubColors", value)}
                    placeholder="Es. Biancorosso"
                    value={clubColors}
                  />

                  <SelectField
                    label="Categoria prima squadra *"
                    onChange={(value) => updateValue("clubCategory", value)}
                    options={SENIOR_CATEGORY_OPTIONS}
                    placeholder="Seleziona la categoria"
                    value={clubCategory}
                  />
                  {validationErrors.clubCategory ? (
                    <ValidationMessage>
                      {validationErrors.clubCategory}
                    </ValidationMessage>
                  ) : null}

                  <Toggle
                    label="Settore giovanile"
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
                    <View style={styles.sectionHeaderGap}>
                      <AppText variant="titleSm">
                        Seleziona le categorie giovanili
                      </AppText>
                      <View style={styles.youthCategoryGrid}>
                        {YOUTH_CATEGORY_OPTIONS.map((option) => {
                          const isSelected = clubYouthCategories.includes(
                            option.value,
                          );
                          return (
                            <FootChip
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
                    </View>
                  ) : null}

                  <ResidenceCityInput
                    errorMessage={validationErrors.clubCity}
                    helperText={
                      clubRegion
                        ? `Città selezionata: ${clubCity} · ${clubRegion}`
                        : undefined
                    }
                    label="Città *"
                    onChangeText={handleClubCityChange}
                    onSelectCity={handleClubCitySelect}
                    value={clubCity}
                  />

                  <NationalityAutocompleteInput
                    label="Nazione"
                    onChange={handleClubCountrySelect}
                    value={clubCountry}
                  />

                  <Input
                    label="Indirizzo sede"
                    onChangeText={(value) =>
                      updateValue("clubHeadquartersAddress", value)
                    }
                    placeholder="Es. Via Roma 1"
                    value={clubHeadquartersAddress}
                  />

                  <Input
                    autoCapitalize="none"
                    keyboardType="email-address"
                    label="Email società *"
                    onChangeText={(value) => updateValue("clubEmail", value)}
                    placeholder="Es. info@asdesempio.it"
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
                    label="Telefono società"
                    onChangeCountryCode={(value) =>
                      updateValue("clubPhoneCountryCode", value, ["clubPhone"])
                    }
                    onChangePhoneNumber={(value) =>
                      updateValue("clubPhone", value, ["clubPhone"])
                    }
                    phoneNumber={clubPhone}
                  />

                  <Input
                    autoCapitalize="none"
                    keyboardType="url"
                    label="Sito web"
                    onChangeText={(value) => updateValue("clubWebsite", value)}
                    placeholder="Es. https://www.asdesempio.it"
                    style={
                      validationErrors.clubWebsite
                        ? { borderColor: colors.danger }
                        : undefined
                    }
                    value={clubWebsite}
                  />
                  {validationErrors.clubWebsite ? (
                    <ValidationMessage>
                      {validationErrors.clubWebsite}
                    </ValidationMessage>
                  ) : null}

                  <Input
                    label="Indirizzo campo"
                    onChangeText={(value) =>
                      updateValue("clubFieldAddress", value)
                    }
                    placeholder="Es. Stadio Comunale, Via dello Sport 5"
                    value={clubFieldAddress}
                  />

                  <MediaPickerField
                    buttonLabel="Carica gallery media"
                    helperText="Aggiungi foto e video della societa' dalla libreria del telefono."
                    isUploading={uploadingField === "club-gallery"}
                    label="Gallery media"
                    onPick={() =>
                      handleMediaUpload({
                        allowsMultipleSelection: true,
                        field: "club-gallery",
                        folder: "club-gallery",
                        mediaTypes: ["images", "videos"],
                        onUploaded: (items) =>
                          appendUploadedMedia("clubGalleryItems", items),
                      })
                    }
                    onRemove={() => updateValue("clubGalleryItems", [])}
                    removable
                    removeLabel="Svuota gallery"
                    selectedCount={clubGalleryItems.length}
                  />

                  <Input
                    label="Descrizione"
                    multiline
                    onChangeText={(value) =>
                      updateValue("clubDescription", value)
                    }
                    placeholder="Racconta identita', struttura e obiettivi del club"
                    value={clubDescription}
                  />
                </View>
              </View>
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
                  label={isBusy ? "Salvataggio..." : "Crea la pagina del club"}
                  onPress={handleSubmitClub}
                  variant="primary"
                />
              </View>
            </View>
          </View>
        ) : null}

        {/* ============================================================= */}
        {/* STEP: Complete                                                 */}
        {/* ============================================================= */}
        {step === "complete" ? (
          <View style={styles.stepContainer}>
            <OnboardingSectionCard>
              <View style={styles.completionIcon}>
                <Ionicons
                  name="checkmark-circle"
                  size={64}
                  color={colors.success}
                />
              </View>
              <AppText variant="displaySm" style={styles.textCenter}>
                Il tuo profilo e' pronto!
              </AppText>
              <AppText
                variant="bodySm"
                color="secondary"
                style={styles.textCenter}
              >
                Ora puoi iniziare a connetterti con squadre, allenatori e
                giocatori. Se vuoi, potrai aggiungere altri dettagli in
                qualsiasi momento.
              </AppText>
            </OnboardingSectionCard>

            <Button
              label="Vai alla home feed"
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
  completionIcon: {
    alignItems: "center",
    paddingVertical: spacing[8],
  },
  experienceBridgeIcon: {
    alignItems: "center",
    paddingVertical: spacing[16],
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
