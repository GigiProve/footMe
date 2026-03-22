import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import { AvailabilityRegionsSelector } from "../../src/components/ui/availability-regions-selector";
import { InterestCategoriesSelector } from "../../src/components/ui/interest-categories-selector";
import { DatePickerField } from "../../src/components/ui/date-picker-field";
import { KeyboardAwareForm } from "../../src/components/ui/keyboard-aware-form";
import { MediaPickerField } from "../../src/components/ui/media-picker-field";
import { NationalityAutocompleteInput } from "../../src/components/ui/nationality-autocomplete-input";
import { PhoneInputWithCountryCode } from "../../src/components/ui/phone-input-with-country-code";
import { ResidenceCityInput } from "../../src/components/ui/residence-city-input";
import { Screen } from "../../src/components/ui/screen";
import { SelectField } from "../../src/components/ui/select-field";
import { WheelPicker } from "../../src/components/ui/wheel-picker";
import { useSession } from "../../src/features/auth/use-session";
import {
  createInitialProfile,
  BaseProfileValidationError,
  type AppRole,
  type ProfileGender,
  type StaffSpecialization,
} from "../../src/features/onboarding/create-initial-profile";
import {
  PlayerCharacteristicsSection,
  PlayerExperiencesSection,
} from "../../src/features/profiles/player-sports-section";
import {
  DEFAULT_PLAYER_PRIMARY_POSITION,
  excludePrimaryFromSecondaryPositions,
  parsePlayerExperienceForms,
  PLAYER_CATEGORY_OPTIONS,
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
  pickAndUploadMedia,
  ProfileMediaUploadError,
  PROFILE_MEDIA_BUCKET,
  type UploadedMediaItem,
} from "../../src/features/profiles/media-upload-service";
import {
  coerceOnboardingStep,
  getOnboardingFullName,
  getOnboardingProgress,
  getPreviousOnboardingStep,
  onboardingVisibleSteps,
  validateOnboardingStep,
  type OnboardingStep,
  type OnboardingValidationErrors,
} from "../../src/features/onboarding/onboarding-form";
import { useOnboardingForm } from "../../src/features/onboarding/onboarding-form-provider";
import {
  checkDuplicateClubs,
  searchTeams,
  updateCompleteProfessionalProfile,
} from "../../src/features/profiles/profile-service";
import { supabase } from "../../src/lib/supabase";
import { colors, radius, spacing } from "../../src/theme/tokens";
import { AppText, Button, Card, Input } from "../../src/ui";

type CompletionDestination = "feed" | "network" | "profile";

const roleOptions: {
  description: string;
  emoji: string;
  label: string;
  value: AppRole;
}[] = [
  {
    description:
      "Metti in evidenza caratteristiche tecniche, disponibilita' e carriera stagione dopo stagione.",
    emoji: "⚽",
    label: "Calciatore",
    value: "player",
  },
  {
    description:
      "Presenta licenze, filosofia di gioco e disponibilita' verso nuove opportunita'.",
    emoji: "🧠",
    label: "Allenatore",
    value: "coach",
  },
  {
    description:
      "Valorizza specializzazione, certificazioni e ambiti di collaborazione tecnica.",
    emoji: "🏋️",
    label: "Staff tecnico",
    value: "staff",
  },
  {
    description:
      "Configura la pagina iniziale del club con i riferimenti essenziali per scouting e recruiting.",
    emoji: "🏟️",
    label: "Societa'",
    value: "club_admin",
  },
  {
    description:
      "Presenta i profili che segui e rendi immediata la tua disponibilita' verso opportunita' e contatti.",
    emoji: "🤝",
    label: "Procuratore",
    value: "agent",
  },
  {
    description:
      "Condividi visione strategica, area di competenza e network professionale nel calcio dilettantistico.",
    emoji: "📋",
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

function StepChip({ isActive, label }: { isActive: boolean; label: string }) {
  return (
    <View
      style={[
        styles.stepChip,
        { backgroundColor: isActive ? colors.hero : colors.surfaceMuted },
      ]}
    >
      <AppText variant="overline" color={isActive ? "inverse" : "secondary"}>
        {label}
      </AppText>
    </View>
  );
}

function SelectionCard({
  active,
  description,
  label,
  onPress,
  testID,
}: {
  active: boolean;
  description?: string;
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.selectionCard,
        {
          borderColor: active ? colors.hero : colors.border,
          backgroundColor: active ? colors.heroSoft : colors.surface,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
      testID={testID}
    >
      <AppText variant="titleMd">{label}</AppText>
      {description ? (
        <AppText variant="bodySm" color="secondary">
          {description}
        </AppText>
      ) : null}
    </Pressable>
  );
}

function OptionPill({
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

function OnboardingBackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Torna allo step precedente"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.backButton,
        { backgroundColor: pressed ? colors.surfaceMuted : colors.surface },
      ]}
    >
      <AppText variant="headingLg" color="primary">
        ←
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
    weightKg,
    willingToChangeClub,
  } = form;

  const fullName = getOnboardingFullName(form);
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
  // the screen), update the form step to match.  This must NOT depend on
  // form.currentStep to avoid a two-way sync loop.
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
      clubFieldAddress,
      clubFoundingYear,
      clubHeadquartersAddress,
      clubLogoUrl,
      clubName,
      clubPhone: composePhoneNumber(clubPhoneCountryCode, clubPhone),
      clubRegion,
      clubWebsite,
      domicile: residence,
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

  function handleContinueFromRole() {
    const nextErrors = validateOnboardingStep("role", form);

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return;
    }

    setValidationErrors({});
    navigateToStep(form.role === "club_admin" ? "club" : "base");
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

  async function handleContinueToDecision() {
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
      navigateToStep("decision");
    } catch (error) {
      const alertCopy = getBaseStepAlert(error);
      setValidationErrors(validateOnboardingStep("base", form));
      Alert.alert(alertCopy.title, alertCopy.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleChooseCompletion(mode: "later" | "now") {
    try {
      setIsSubmitting(true);

      if (!hasCreatedProfile) {
        await ensureInitialProfileCreated();
      }

      if (mode === "now") {
        patchForm({ lastCompletedStep: "decision" });
        navigateToStep("details");
        return;
      }

      goToCompletion("decision");
    } catch (error) {
      const alertCopy = getBaseStepAlert(error);
      Alert.alert(alertCopy.title, alertCopy.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmitDetails() {
    if (!session?.user) {
      return;
    }

    try {
      setIsSubmitting(true);

      if (!hasCreatedProfile) {
        await ensureInitialProfileCreated();
      }

      const nextErrors = validateOnboardingStep("details", form);

      if (Object.keys(nextErrors).length > 0) {
        setValidationErrors(nextErrors);
        return;
      }

      setValidationErrors({});

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

      goToCompletion("details");
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

  function goToCompletion(previousStep: "club" | "decision" | "details") {
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

  if (!isHydrated) {
    return null;
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          fullScreenGestureEnabled: canGoBack,
          gestureEnabled: canGoBack,
          headerShown: false,
        }}
      />
      <KeyboardAwareForm contentContainerStyle={styles.formContent}>
        <View style={styles.heroContainer}>
          {canGoBack ? (
            <OnboardingBackButton onPress={handleBackNavigation} />
          ) : null}
          <AppText variant="overline" color="inverseSoft">
            Primo accesso
          </AppText>
          <AppText variant="displayLg" color="inverse">
            Costruisci il tuo profilo sportivo in pochi minuti
          </AppText>
          <AppText variant="bodyLg" color="inverseMuted">
            Un percorso guidato, rapido e flessibile: inserisci i dati
            essenziali ora e completa i dettagli quando vuoi.
          </AppText>
          <View style={styles.progressSection}>
            <View style={styles.progressRow}>
              <AppText
                variant="bodySm"
                color="inverse"
                style={styles.progressLabel}
              >
                Profilo {progress.percentage}% completato
              </AppText>
              <AppText variant="overline" color="inverseMuted">
                Step {progress.stepIndex + 1} di {progress.totalSteps}
              </AppText>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progress.percentage}%` },
                ]}
              />
            </View>
            <ValidationMessage tone="muted">
              {progress.currentStep.description}
            </ValidationMessage>
          </View>
          <View style={styles.stepChipsRow}>
            {onboardingVisibleSteps.map((entry, index) => (
              <StepChip
                key={entry.step}
                isActive={index <= progress.stepIndex}
                label={entry.label}
              />
            ))}
          </View>
        </View>

        {step === "role" ? (
          <Card style={styles.cardGap}>
            <View style={styles.sectionHeaderGap}>
              <AppText variant="headingLg">
                Seleziona il tuo ruolo nel calcio
              </AppText>
              <AppText variant="bodySm" color="secondary">
                Scegli il profilo che ti rappresenta meglio. Ti mostreremo solo
                i campi davvero utili per iniziare in meno di un minuto.
              </AppText>
              {validationErrors.role ? (
                <ValidationMessage>{validationErrors.role}</ValidationMessage>
              ) : null}
            </View>

            {roleOptions.map((entry) => {
              const isActive = role === entry.value;

              return (
                <SelectionCard
                  key={entry.value}
                  active={isActive}
                  description={entry.description}
                  label={`${entry.emoji} ${entry.label}`}
                  onPress={() => updateValue("role", entry.value, ["role"])}
                  testID={`role-card-${entry.value}`}
                />
              );
            })}

            <Button
              disabled={!role}
              label="Continua"
              onPress={handleContinueFromRole}
              variant="primary"
            />
          </Card>
        ) : null}

        {step === "base" ? (
          <Card style={styles.cardGap}>
            <View style={styles.sectionHeaderGap}>
              <AppText variant="headingLg">Informazioni essenziali</AppText>
              <AppText variant="bodySm" color="secondary">
                Completa i dati minimi per attivare il profilo. I campi
                obbligatori sono evidenziati e i suggerimenti automatici ti
                aiutano a finire rapidamente.
              </AppText>
              {validationErrors.form ? (
                <ValidationMessage>{validationErrors.form}</ValidationMessage>
              ) : null}
            </View>

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
              <View style={styles.fieldGap10}>
                {genderOptions.map((entry) => (
                  <SelectionCard
                    key={entry.value}
                    active={gender === entry.value}
                    description={undefined}
                    label={entry.label}
                    onPress={() =>
                      updateValue("gender", entry.value, ["gender"])
                    }
                    testID={`gender-card-${entry.value}`}
                  />
                ))}
              </View>
              {validationErrors.gender ? (
                <ValidationMessage>{validationErrors.gender}</ValidationMessage>
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

            <MediaPickerField
              buttonLabel={
                avatarUrl ? "Sostituisci foto" : "Carica foto profilo"
              }
              helperText="Se non la carichi ora useremo un'immagine profilo blank di default."
              isUploading={uploadingField === "avatar"}
              label="Foto profilo"
              onPick={() =>
                handleMediaUpload({
                  field: "avatar",
                  folder: "avatars",
                  mediaTypes: ["images"],
                  onUploaded: (items) =>
                    updateValue("avatarUrl", items[0]?.url ?? ""),
                })
              }
              onRemove={() => updateValue("avatarUrl", "")}
              previewUrl={withDefaultProfileAvatar(avatarUrl)}
              removable
              selectedLabel={
                avatarUrl
                  ? "Immagine profilo caricata correttamente"
                  : "Immagine blank di default attiva"
              }
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
                  onPress={handleContinueToDecision}
                  variant="primary"
                />
              </View>
            </View>
          </Card>
        ) : null}

        {step === "club" ? (
          <Card style={styles.cardGap}>
            <View style={styles.sectionHeaderGap}>
              <AppText variant="headingLg">Il tuo club</AppText>
              <AppText variant="bodySm" color="secondary">
                Inserisci le informazioni della tua società. I campi obbligatori
                sono contrassegnati con *.
              </AppText>
            </View>

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
                  label="Categoria attuale"
                  onChange={(value) => updateValue("clubCategory", value)}
                  options={PLAYER_CATEGORY_OPTIONS}
                  placeholder="Seleziona la categoria"
                  value={clubCategory}
                />

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
              </View>
            </View>

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
          </Card>
        ) : null}

        {step === "decision" ? (
          <Card style={styles.cardGap}>
            <View style={styles.sectionHeaderGap}>
              <AppText variant="headingLg">
                3. Vuoi completare ora il profilo sportivo?
              </AppText>
              <AppText variant="bodySm" color="secondary">
                Un profilo completo aumenta la tua visibilita' verso squadre,
                allenatori e dirigenti.
              </AppText>
            </View>

            <Card style={styles.decisionSummaryCard}>
              <AppText variant="titleSm">Profilo selezionato</AppText>
              <AppText variant="bodySm" color="secondary">
                {roleOptions.find((entry) => entry.value === role)?.label} ·{" "}
                {fullName}
              </AppText>
            </Card>
            <Button
              disabled={isBusy}
              label="Completa ora il tuo profilo sportivo"
              onPress={() => handleChooseCompletion("now")}
              variant="primary"
            />
            <Button
              disabled={isBusy}
              label="Salta e completa piu' tardi"
              onPress={() => handleChooseCompletion("later")}
              variant="secondary"
            />
          </Card>
        ) : null}

        {step === "details" ? (
          <Card style={styles.cardGap}>
            <View style={styles.sectionHeaderGap}>
              <AppText variant="headingLg">
                4. Completa il tuo profilo sportivo
              </AppText>
              <AppText variant="bodySm" color="secondary">
                Aggiungi dettagli professionali, esperienze e contenuti media.
                Puoi sempre aggiornare tutto in seguito.
              </AppText>
              {validationErrors.bio ? (
                <ValidationMessage>{validationErrors.bio}</ValidationMessage>
              ) : null}
            </View>

            {role === "player" ? (
              <>
                <View style={styles.fieldGap10}>
                  <AppText variant="headingSm">Informazioni tecniche</AppText>
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
                  <View style={styles.buttonRow}>
                    <View style={styles.flex1}>
                      <WheelPicker
                        label="Altezza (cm)"
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
                      <WheelPicker
                        label="Peso (kg)"
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
                </View>

                <View style={styles.fieldGap10}>
                  <AppText variant="headingSm">Disponibilita'</AppText>
                  <AvailabilityRegionsSelector
                    onChange={(regions) =>
                      updateValue("transferRegions", regions.join(", "))
                    }
                    value={fromDelimitedString(transferRegions)}
                  />
                  <InterestCategoriesSelector
                    onChange={(categories) =>
                      updateValue("preferredCategories", categories.join(", "))
                    }
                    value={fromDelimitedString(preferredCategories)}
                  />
                  <View style={styles.sectionHeaderGap}>
                    <AppText variant="titleSm">
                      Disponibile al trasferimento?
                    </AppText>
                    <View style={styles.optionPillRow}>
                      <OptionPill
                        active={isOpenToTransfer}
                        label="Si'"
                        onPress={() => updateValue("isOpenToTransfer", true)}
                      />
                      <OptionPill
                        active={!isOpenToTransfer}
                        label="No"
                        onPress={() => updateValue("isOpenToTransfer", false)}
                      />
                    </View>
                  </View>
                  <View style={styles.sectionHeaderGap}>
                    <AppText variant="titleSm">
                      Disponibile a cambiare club subito?
                    </AppText>
                    <View style={styles.optionPillRow}>
                      <OptionPill
                        active={willingToChangeClub}
                        label="Si'"
                        onPress={() => updateValue("willingToChangeClub", true)}
                      />
                      <OptionPill
                        active={!willingToChangeClub}
                        label="No"
                        onPress={() =>
                          updateValue("willingToChangeClub", false)
                        }
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.fieldGap10}>
                  <AppText variant="headingSm">Carriera calcistica</AppText>
                  <AppText variant="bodySm" color="secondary">
                    Aggiungi una stagione per volta con squadra, categoria e
                    statistiche.
                  </AppText>
                  <PlayerExperiencesSection
                    addButtonLabel="Aggiungi esperienza calcistica"
                    editable
                    emptyStateLabel="Aggiungi la tua prima esperienza stagionale."
                    experiences={careerEntries}
                    onChange={(value) => updateValue("careerEntries", value)}
                    searchTeams={searchTeams}
                  />
                </View>

                <View style={styles.fieldGap10}>
                  <AppText variant="headingSm">Media e contenuti</AppText>
                  <MediaPickerField
                    buttonLabel={
                      highlightVideoUrl
                        ? "Sostituisci video"
                        : "Carica video highlights"
                    }
                    helperText="Seleziona un video dal cellulare per mostrare i tuoi highlights."
                    isUploading={uploadingField === "highlight-video"}
                    label="Video highlights"
                    mediaType="video"
                    onPick={() =>
                      handleMediaUpload({
                        field: "highlight-video",
                        folder: "highlight-videos",
                        mediaTypes: ["videos"],
                        onUploaded: (items) =>
                          updateValue("highlightVideoUrl", items[0]?.url ?? ""),
                      })
                    }
                    onRemove={() => updateValue("highlightVideoUrl", "")}
                    previewUrl={highlightVideoUrl || undefined}
                    removable
                    selectedLabel={
                      highlightVideoUrl
                        ? "Video highlights caricato correttamente"
                        : undefined
                    }
                  />
                  <MediaPickerField
                    buttonLabel="Carica foto e video in azione"
                    helperText="Puoi selezionare piu' file direttamente dalla libreria del telefono."
                    isUploading={uploadingField === "player-media"}
                    label="Foto e video in azione"
                    onPick={() =>
                      handleMediaUpload({
                        allowsMultipleSelection: true,
                        field: "player-media",
                        folder: "player-media",
                        mediaTypes: ["images", "videos"],
                        onUploaded: (items) =>
                          appendUploadedMedia("playerMediaItems", items),
                      })
                    }
                    onRemove={() => updateValue("playerMediaItems", [])}
                    removable
                    removeLabel="Svuota gallery"
                    selectedCount={playerMediaItems.length}
                  />
                </View>
              </>
            ) : null}

            {role === "coach" ? (
              <View style={styles.fieldGap10}>
                <AppText variant="headingSm">Profilo allenatore</AppText>
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
                <View style={styles.sectionHeaderGap}>
                  <AppText variant="titleSm">
                    Disponibile a un nuovo incarico?
                  </AppText>
                  <View style={styles.optionPillRow}>
                    <OptionPill
                      active={openToNewRole}
                      label="Si'"
                      onPress={() => updateValue("openToNewRole", true)}
                    />
                    <OptionPill
                      active={!openToNewRole}
                      label="No"
                      onPress={() => updateValue("openToNewRole", false)}
                    />
                  </View>
                </View>
              </View>
            ) : null}

            {role === "staff" ? (
              <View style={styles.fieldGap10}>
                <AppText variant="headingSm">Profilo staff tecnico</AppText>
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
                  onChangeText={(value) => updateValue("certifications", value)}
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
                <View style={styles.sectionHeaderGap}>
                  <AppText variant="titleSm">
                    Disponibile a collaborare subito?
                  </AppText>
                  <View style={styles.optionPillRow}>
                    <OptionPill
                      active={openToWork}
                      label="Si'"
                      onPress={() => updateValue("openToWork", true)}
                    />
                    <OptionPill
                      active={!openToWork}
                      label="No"
                      onPress={() => updateValue("openToWork", false)}
                    />
                  </View>
                </View>
              </View>
            ) : null}

            {role === "club_admin" ? (
              <View style={styles.fieldGap10}>
                <AppText variant="headingSm">Pagina societa'</AppText>
                <Input
                  label="Categoria"
                  onChangeText={(value) => updateValue("clubCategory", value)}
                  placeholder="Es. Eccellenza"
                  value={clubCategory}
                />
                <Input
                  label="Girone"
                  onChangeText={(value) => updateValue("clubLeague", value)}
                  placeholder="Es. Girone A"
                  value={clubLeague}
                />
                <MediaPickerField
                  buttonLabel={
                    clubLogoUrl ? "Sostituisci logo" : "Carica logo societa'"
                  }
                  helperText="Seleziona il logo direttamente dal telefono."
                  isUploading={uploadingField === "club-logo"}
                  label="Logo societa'"
                  onPick={() =>
                    handleMediaUpload({
                      field: "club-logo",
                      folder: "club-logos",
                      mediaTypes: ["images"],
                      onUploaded: (items) =>
                        updateValue("clubLogoUrl", items[0]?.url ?? ""),
                    })
                  }
                  onRemove={() => updateValue("clubLogoUrl", "")}
                  previewUrl={clubLogoUrl}
                  removable
                  selectedLabel={
                    clubLogoUrl
                      ? "Logo societa' caricato correttamente"
                      : undefined
                  }
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
            ) : null}

            <View style={styles.fieldGap10}>
              <AppText variant="headingSm">Bio personale</AppText>
              <Input
                label="Presentazione"
                maxLength={400}
                multiline
                onChangeText={(value) =>
                  updateValue("bio", normalizeProfileBioInput(value), ["bio"])
                }
                placeholder="Racconta brevemente il tuo percorso calcistico, le tue caratteristiche e cosa cerchi per la prossima stagione."
                style={
                  validationErrors.bio
                    ? { borderColor: colors.danger }
                    : undefined
                }
                value={bio}
              />
              {validationErrors.bio ? (
                <ValidationMessage>{validationErrors.bio}</ValidationMessage>
              ) : null}
            </View>

            <View style={styles.buttonRow}>
              <View style={styles.flex1}>
                <Button
                  label="Piu' tardi"
                  onPress={() => goToCompletion("details")}
                  variant="secondary"
                />
              </View>
              <View style={styles.flex1}>
                <Button
                  disabled={isBusy}
                  label={isBusy ? "Salvataggio..." : "Conferma profilo"}
                  onPress={handleSubmitDetails}
                  variant="primary"
                />
              </View>
            </View>
          </Card>
        ) : null}

        {step === "complete" ? (
          <Card style={styles.cardGap}>
            <AppText variant="displaySm">Il tuo profilo e' pronto!</AppText>
            <AppText variant="bodySm" color="secondary">
              Ora puoi iniziare a connetterti con squadre, allenatori e
              giocatori. Se vuoi, potrai aggiungere altri dettagli in qualsiasi
              momento.
            </AppText>
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
          </Card>
        ) : null}
      </KeyboardAwareForm>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing[12],
  },
  cardGap: {
    gap: spacing[16],
  },
  decisionSummaryCard: {
    backgroundColor: colors.surfaceMuted,
    gap: spacing[8],
  },
  fieldGap10: {
    gap: spacing[10],
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
  },
  heroContainer: {
    backgroundColor: colors.textPrimary,
    borderRadius: radius[24],
    gap: spacing[10],
    padding: spacing[22],
  },
  optionPillRow: {
    flexDirection: "row",
    gap: spacing[8],
  },
  progressFill: {
    backgroundColor: colors.heroSoft,
    borderRadius: radius.full,
    height: "100%",
  },
  progressLabel: {
    fontWeight: "bold",
  },
  progressRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    justifyContent: "space-between",
  },
  progressSection: {
    gap: spacing[8],
  },
  progressTrack: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: radius.full,
    height: 8,
    overflow: "hidden",
  },
  sectionHeaderGap: {
    gap: spacing[8],
  },
  selectionCard: {
    borderRadius: radius[20],
    borderWidth: 1,
    gap: spacing[6],
    padding: spacing[16],
  },
  stepChip: {
    borderRadius: radius.full,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
  },
  stepChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
});
