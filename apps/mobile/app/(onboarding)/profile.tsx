import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, BackHandler, Platform, Pressable, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import { DatePickerField } from "../../src/components/ui/date-picker-field";
import { KeyboardAwareScrollView } from "../../src/components/ui/keyboard-aware-scroll-view";
import { MediaPickerField } from "../../src/components/ui/media-picker-field";
import { Screen } from "../../src/components/ui/screen";
import { SelectField } from "../../src/components/ui/select-field";
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
  parsePlayerExperienceForms,
} from "../../src/features/profiles/player-sports";
import {
  NATIONALITY_OPTIONS,
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
  getEffectiveDomicile,
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
  searchTeams,
  updateCompleteProfessionalProfile,
} from "../../src/features/profiles/profile-service";
import { supabase } from "../../src/lib/supabase";
import { colors, radius, spacing, typography } from "../../src/theme/tokens";
import { Button, Card, Input } from "../../src/ui";

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
    label: "Societa' / squadra",
    value: "club_admin",
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

function fromDelimitedString(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function StepChip({ isActive, label }: { isActive: boolean; label: string }) {
  return (
    <View
      style={{
        paddingHorizontal: spacing[12],
        paddingVertical: spacing[8],
        borderRadius: radius.full,
        backgroundColor: isActive ? colors.hero : colors.surfaceMuted,
      }}
    >
      <Text
        style={{
          color: isActive ? colors.inkInvert : colors.textSecondary,
          fontSize: typography.fontSize[12],
          fontWeight: typography.fontWeight.bold,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
    </View>
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
      style={({ pressed }) => ({
        alignItems: "center",
        alignSelf: "flex-start",
        backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
        borderColor: colors.border,
        borderRadius: radius.full,
        borderWidth: 1,
        height: 44,
        justifyContent: "center",
        width: 44,
      })}
    >
      <Text
        style={{
          color: colors.textPrimary,
          fontSize: typography.fontSize[24],
          fontWeight: typography.fontWeight.heavy,
          lineHeight: typography.lineHeight[28],
        }}
      >
        ←
      </Text>
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
    <Text
      style={{
        color: tone === "danger" ? colors.danger : colors.textSecondary,
        lineHeight: typography.lineHeight[22],
      }}
    >
      {children}
    </Text>
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
  const params = useLocalSearchParams<{ step?: string | string[] }>();
  const { refreshProfile, session } = useSession();
  const { form, isHydrated, patchForm, resetForm, setCurrentStep, setFormValue } =
    useOnboardingForm();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<OnboardingValidationErrors>(
    {},
  );

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
    clubDescription,
    clubGalleryItems,
    clubLeague,
    clubLogoUrl,
    clubName,
    clubRegion,
    coachedCategories,
    coachedClubs,
    coachPreferredRegions,
    certifications,
    domicile,
    experienceSummary,
    firstName,
    gamePhilosophy,
    gender,
    hasCreatedProfile,
    heightCm,
    highlightVideoUrl,
    isAvailable,
    isOpenToTransfer,
    lastCompletedStep,
    lastName,
    licenses,
    nationality,
    openToNewRole,
    openToWork,
    phoneNumber,
    playerMediaItems,
    preferredCategories,
    preferredFoot,
    primaryPosition,
    residence,
    role,
    secondaryPosition,
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
  const effectiveDomicile = getEffectiveDomicile(form);
  const progress = getOnboardingProgress(step);
  const canGoBack = step !== "role";
  const isBusy = isSubmitting || uploadingField !== null;

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

  const navigateToStep = useCallback(
    (nextStep: OnboardingStep, mode: "push" | "replace" = "push") => {
      setCurrentStep(nextStep);
      const target = {
        pathname: "/(onboarding)/profile" as const,
        params: nextStep === "role" ? {} : { step: nextStep },
      };

      if (mode === "replace") {
        router.replace(target);
        return;
      }

      router.push(target);
    },
    [router, setCurrentStep],
  );

  const handleBackNavigation = useCallback(() => {
    const previousStep = getPreviousOnboardingStep(step, lastCompletedStep);

    if (!previousStep) {
      return;
    }

    navigateToStep(previousStep, "replace");
  }, [lastCompletedStep, navigateToStep, step]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!requestedStep && form.currentStep !== "role") {
      navigateToStep(form.currentStep, "replace");
      return;
    }

    if (requestedStep && requestedStep !== form.currentStep) {
      setCurrentStep(requestedStep);
    }
  }, [form.currentStep, isHydrated, navigateToStep, requestedStep, setCurrentStep]);

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
      avatarUrl,
      birthDate,
      clubCity,
      clubName,
      clubRegion,
      domicile: effectiveDomicile,
      fullName,
      gender,
      nationality,
      phoneNumber,
      primaryPosition,
      residence,
      role,
      staffSpecialization,
      userId: session.user.id,
    });

    patchForm({
      hasCreatedProfile: true,
    });
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
                description: parseOptionalText(clubDescription),
                gallery_urls: clubGalleryItems.map((item) => item.url),
                league: parseOptionalText(clubLeague),
                logo_url: parseOptionalText(clubLogoUrl),
                name: clubName.trim(),
                region: clubRegion.trim(),
              }
            : null,
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
                primary_position: primaryPosition,
                secondary_position: secondaryPosition || null,
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
          is_available: isAvailable,
          is_open_to_transfer: isOpenToTransfer,
          nationality,
          region: null,
        },
        profileId: session.user.id,
        role,
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
          phone: phoneNumber.trim(),
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

  function goToCompletion(previousStep: "decision" | "details") {
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
      <KeyboardAwareScrollView
        contentContainerStyle={{ gap: spacing[18], paddingBottom: 28 }}
      >
        <View
          style={{
            gap: spacing[10],
            padding: spacing[22],
            borderRadius: radius[24],
            backgroundColor: colors.textPrimary,
          }}
        >
          {canGoBack ? <OnboardingBackButton onPress={handleBackNavigation} /> : null}
          <Text
            style={{
              color: colors.heroSoft,
              fontSize: typography.fontSize[12],
              fontWeight: typography.fontWeight.heavy,
              letterSpacing: 1.2,
              textTransform: "uppercase",
            }}
          >
            Primo accesso
          </Text>
          <Text
            style={{
              color: colors.inkInvert,
              fontSize: typography.fontSize[32],
              fontWeight: typography.fontWeight.heavy,
              lineHeight: typography.lineHeight[38],
            }}
          >
            Costruisci il tuo profilo sportivo in pochi minuti
          </Text>
          <Text
            style={{
              color: colors.textInverseMuted,
              fontSize: typography.fontSize[16],
              lineHeight: typography.lineHeight[24],
            }}
          >
            Un percorso guidato, rapido e flessibile: inserisci i dati
            essenziali ora e completa i dettagli quando vuoi.
          </Text>
          <View style={{ gap: spacing[8] }}>
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "space-between",
                gap: spacing[12],
              }}
            >
              <Text
                style={{
                  color: colors.inkInvert,
                  fontSize: typography.fontSize[14],
                  fontWeight: typography.fontWeight.bold,
                }}
              >
                Profilo {progress.percentage}% completato
              </Text>
              <Text
                style={{
                  color: colors.textInverseMuted,
                  fontSize: typography.fontSize[12],
                  fontWeight: typography.fontWeight.bold,
                  textTransform: "uppercase",
                }}
              >
                Step {progress.stepIndex + 1} di {progress.totalSteps}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: "rgba(255,255,255,0.16)",
                borderRadius: radius.full,
                height: 8,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  backgroundColor: colors.heroSoft,
                  borderRadius: radius.full,
                  height: "100%",
                  width: `${progress.percentage}%`,
                }}
              />
            </View>
            <ValidationMessage tone="muted">
              {progress.currentStep.description}
            </ValidationMessage>
          </View>
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[8] }}
          >
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
          <Card style={{ gap: spacing[16] }}>
            <View style={{ gap: spacing[8] }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: typography.fontSize[24],
                  fontWeight: typography.fontWeight.heavy,
                }}
              >
                1. Che profilo vuoi creare?
              </Text>
              <Text style={{ color: colors.textSecondary, lineHeight: 22 }}>
                Questa scelta definisce il percorso di onboarding e le
                informazioni sportive che ti chiederemo in seguito.
              </Text>
            </View>

            {roleOptions.map((entry) => {
              const isActive = role === entry.value;

              return (
                <Pressable
                  key={entry.value}
                  accessibilityRole="button"
                  onPress={() => updateValue("role", entry.value)}
                  style={{
                    gap: spacing[8],
                    borderRadius: radius[20],
                    borderWidth: 1,
                    borderColor: isActive ? colors.hero : colors.border,
                    backgroundColor: isActive
                      ? colors.heroSoft
                      : colors.surface,
                    padding: spacing[16],
                  }}
                >
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontSize: typography.fontSize[18],
                      fontWeight: typography.fontWeight.heavy,
                    }}
                  >
                    {entry.emoji} {entry.label}
                  </Text>
                  <Text style={{ color: colors.textSecondary, lineHeight: 22 }}>
                    {entry.description}
                  </Text>
                </Pressable>
              );
            })}

            <Button
              label="Continua"
              onPress={() => navigateToStep("base")}
              variant="primary"
            />
          </Card>
        ) : null}

        {step === "base" ? (
          <Card style={{ gap: spacing[16] }}>
            <View style={{ gap: spacing[8] }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: typography.fontSize[24],
                  fontWeight: typography.fontWeight.heavy,
                }}
              >
                2. Inserisci le informazioni essenziali
              </Text>
              <Text style={{ color: colors.textSecondary, lineHeight: 22 }}>
                Completa il minimo necessario per attivare il profilo e farti
                trovare in piattaforma.
              </Text>
              {validationErrors.form ? (
                <ValidationMessage>{validationErrors.form}</ValidationMessage>
              ) : null}
            </View>

            <View style={{ flexDirection: "row", gap: spacing[12] }}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Nome"
                  onChangeText={(value) => updateValue("firstName", value)}
                  placeholder="Es. Marco"
                  style={validationErrors.firstName ? { borderColor: colors.danger } : undefined}
                  value={firstName}
                />
                {validationErrors.firstName ? (
                  <ValidationMessage>{validationErrors.firstName}</ValidationMessage>
                ) : null}
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Cognome"
                  onChangeText={(value) => updateValue("lastName", value)}
                  placeholder="Es. Rossi"
                  style={validationErrors.lastName ? { borderColor: colors.danger } : undefined}
                  value={lastName}
                />
                {validationErrors.lastName ? (
                  <ValidationMessage>{validationErrors.lastName}</ValidationMessage>
                ) : null}
              </View>
            </View>

            <View style={{ gap: spacing[8] }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontWeight: typography.fontWeight.bold,
                }}
              >
                Sesso
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing[8],
                }}
              >
                {genderOptions.map((entry) => (
                  <OptionPill
                    key={entry.value}
                    active={gender === entry.value}
                    label={entry.label}
                    onPress={() => updateValue("gender", entry.value)}
                  />
                ))}
              </View>
            </View>

            <DatePickerField
              label="Data di nascita"
              onChange={(value) => updateValue("birthDate", value)}
              placeholder="Apri il calendario e seleziona la data"
              value={birthDate}
            />
            {validationErrors.birthDate ? (
              <ValidationMessage>{validationErrors.birthDate}</ValidationMessage>
            ) : null}

            <SelectField
              label="Nazionalità"
              onChange={(value) => updateValue("nationality", value)}
              options={NATIONALITY_OPTIONS}
              placeholder="Seleziona la nazionalità"
              value={nationality}
            />
            {validationErrors.nationality ? (
              <ValidationMessage>{validationErrors.nationality}</ValidationMessage>
            ) : null}

            <Input
              label="Residenza"
              onChangeText={(value) =>
                updateValue(
                  "residence",
                  value,
                  useResidenceForDomicile ? ["residence", "domicile"] : ["residence"],
                )
              }
              placeholder="Citta' e provincia di residenza"
              style={validationErrors.residence ? { borderColor: colors.danger } : undefined}
              value={residence}
            />
            {validationErrors.residence ? (
              <ValidationMessage>{validationErrors.residence}</ValidationMessage>
            ) : null}

            <View style={{ gap: spacing[8] }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontWeight: typography.fontWeight.bold,
                }}
              >
                Domicilio
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing[8],
                }}
              >
                 <OptionPill
                   active={useResidenceForDomicile}
                   label="Uguale alla residenza"
                   onPress={() =>
                     updateValue("useResidenceForDomicile", true, ["domicile"])
                   }
                 />
                 <OptionPill
                   active={!useResidenceForDomicile}
                   label="Diverso dalla residenza"
                   onPress={() =>
                     updateValue("useResidenceForDomicile", false, ["domicile"])
                   }
                 />
               </View>
             </View>

            {!useResidenceForDomicile ? (
              <Input
                label="Domicilio effettivo"
                onChangeText={(value) => updateValue("domicile", value)}
                placeholder="Inserisci il domicilio"
                style={validationErrors.domicile ? { borderColor: colors.danger } : undefined}
                value={domicile}
              />
            ) : null}
            {validationErrors.domicile ? (
              <ValidationMessage>{validationErrors.domicile}</ValidationMessage>
            ) : null}

            <Input
              keyboardType="phone-pad"
              label="Numero di telefono (facoltativo)"
              onChangeText={(value) => updateValue("phoneNumber", value)}
              placeholder="Es. +39 333 1234567"
              value={phoneNumber}
            />

            <MediaPickerField
              buttonLabel="Carica foto profilo"
              helperText="Se non la carichi ora useremo un'immagine profilo blank di default."
              isUploading={uploadingField === "avatar"}
              label="Foto profilo"
              onPick={() =>
                handleMediaUpload({
                   field: "avatar",
                   folder: "avatars",
                   mediaTypes: ["images"],
                   onUploaded: (items) => updateValue("avatarUrl", items[0]?.url ?? ""),
                 })
               }
              previewUrl={withDefaultProfileAvatar(avatarUrl)}
              selectedLabel={
                avatarUrl
                  ? "Immagine profilo caricata correttamente"
                  : "Immagine blank di default attiva"
              }
            />

            {role === "club_admin" ? (
              <View style={{ gap: spacing[12] }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: typography.fontSize[18],
                    fontWeight: typography.fontWeight.heavy,
                  }}
                >
                  Dati iniziali della società
                </Text>
                <Input
                  label="Nome società"
                  onChangeText={(value) => updateValue("clubName", value)}
                  placeholder="Es. ASD Example"
                  style={validationErrors.clubName ? { borderColor: colors.danger } : undefined}
                  value={clubName}
                />
                {validationErrors.clubName ? (
                  <ValidationMessage>{validationErrors.clubName}</ValidationMessage>
                ) : null}
                <Input
                  label="Città"
                  onChangeText={(value) => updateValue("clubCity", value)}
                  placeholder="Es. Perugia"
                  style={validationErrors.clubCity ? { borderColor: colors.danger } : undefined}
                  value={clubCity}
                />
                {validationErrors.clubCity ? (
                  <ValidationMessage>{validationErrors.clubCity}</ValidationMessage>
                ) : null}
                <SelectField
                  label="Regione"
                  onChange={(value) => updateValue("clubRegion", value)}
                  options={REGION_OPTIONS}
                  placeholder="Seleziona la regione"
                  value={clubRegion}
                />
                {validationErrors.clubRegion ? (
                  <ValidationMessage>{validationErrors.clubRegion}</ValidationMessage>
                ) : null}
              </View>
            ) : null}

            <View style={{ flexDirection: "row", gap: spacing[12] }}>
              <View style={{ flex: 1 }}>
                <Button
                  label="Indietro"
                  onPress={handleBackNavigation}
                  variant="secondary"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  disabled={isBusy}
                  label={isBusy ? "Salvataggio..." : "Salva e continua"}
                  onPress={handleContinueToDecision}
                  variant="primary"
                />
              </View>
            </View>
          </Card>
        ) : null}

        {step === "decision" ? (
          <Card style={{ gap: spacing[16] }}>
            <View style={{ gap: spacing[8] }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: typography.fontSize[24],
                  fontWeight: typography.fontWeight.heavy,
                }}
              >
                3. Vuoi completare ora il profilo sportivo?
              </Text>
              <Text style={{ color: colors.textSecondary, lineHeight: 22 }}>
                Un profilo completo aumenta la tua visibilita' verso squadre,
                allenatori e dirigenti.
              </Text>
            </View>

            <Card
              style={{ gap: spacing[8], backgroundColor: colors.surfaceMuted }}
            >
              <Text
                style={{
                  color: colors.textPrimary,
                  fontWeight: typography.fontWeight.heavy,
                }}
              >
                Profilo selezionato
              </Text>
              <Text style={{ color: colors.textSecondary, lineHeight: 22 }}>
                {roleOptions.find((entry) => entry.value === role)?.label} ·{" "}
                {fullName}
              </Text>
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
          <Card style={{ gap: spacing[16] }}>
            <View style={{ gap: spacing[8] }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: typography.fontSize[24],
                  fontWeight: typography.fontWeight.heavy,
                }}
              >
                4. Completa il tuo profilo sportivo
              </Text>
              <Text style={{ color: colors.textSecondary, lineHeight: 22 }}>
                Aggiungi dettagli professionali, esperienze e contenuti media.
                Puoi sempre aggiornare tutto in seguito.
              </Text>
              {validationErrors.bio ? (
                <ValidationMessage>{validationErrors.bio}</ValidationMessage>
              ) : null}
            </View>

            {role === "player" ? (
              <>
                <View style={{ gap: spacing[10] }}>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontSize: typography.fontSize[18],
                      fontWeight: typography.fontWeight.heavy,
                    }}
                  >
                    Informazioni tecniche
                  </Text>
                  <PlayerCharacteristicsSection
                    editable
                    onPreferredFootChange={(value) => updateValue("preferredFoot", value)}
                    onPrimaryPositionChange={(value) => updateValue("primaryPosition", value)}
                    onSecondaryPositionChange={(value) =>
                      updateValue("secondaryPosition", value)
                    }
                    preferredFoot={preferredFoot}
                    primaryPosition={primaryPosition}
                    secondaryPosition={secondaryPosition}
                  />
                  <View style={{ flexDirection: "row", gap: spacing[12] }}>
                    <View style={{ flex: 1 }}>
                      <Input
                        keyboardType="number-pad"
                        label="Altezza (cm)"
                        onChangeText={(value) => updateValue("heightCm", value)}
                        placeholder="Es. 182"
                        value={heightCm}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Input
                        keyboardType="number-pad"
                        label="Peso (kg)"
                        onChangeText={(value) => updateValue("weightKg", value)}
                        placeholder="Es. 76"
                        value={weightKg}
                      />
                    </View>
                  </View>
                </View>

                <View style={{ gap: spacing[10] }}>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontSize: typography.fontSize[18],
                      fontWeight: typography.fontWeight.heavy,
                    }}
                  >
                    Disponibilita'
                  </Text>
                  <View style={{ gap: spacing[8] }}>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontWeight: typography.fontWeight.bold,
                      }}
                    >
                      Disponibile per una nuova squadra?
                    </Text>
                    <View style={{ flexDirection: "row", gap: spacing[8] }}>
                      <OptionPill
                        active={isAvailable}
                        label="Si'"
                        onPress={() => updateValue("isAvailable", true)}
                      />
                      <OptionPill
                        active={!isAvailable}
                        label="No"
                        onPress={() => updateValue("isAvailable", false)}
                      />
                    </View>
                  </View>
                  <Input
                    label="Regioni in cui sei disponibile a giocare"
                    onChangeText={(value) => updateValue("transferRegions", value)}
                    placeholder="Es. Lombardia, Veneto"
                    value={transferRegions}
                  />
                  <Input
                    label="Categorie di interesse"
                    onChangeText={(value) => updateValue("preferredCategories", value)}
                    placeholder="Es. Promozione, Eccellenza"
                    value={preferredCategories}
                  />
                  <View style={{ gap: spacing[8] }}>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontWeight: typography.fontWeight.bold,
                      }}
                    >
                      Disponibile al trasferimento?
                    </Text>
                    <View style={{ flexDirection: "row", gap: spacing[8] }}>
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
                  <View style={{ gap: spacing[8] }}>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontWeight: typography.fontWeight.bold,
                      }}
                    >
                      Disponibile a cambiare club subito?
                    </Text>
                    <View style={{ flexDirection: "row", gap: spacing[8] }}>
                      <OptionPill
                        active={willingToChangeClub}
                        label="Si'"
                        onPress={() => updateValue("willingToChangeClub", true)}
                      />
                      <OptionPill
                        active={!willingToChangeClub}
                        label="No"
                        onPress={() => updateValue("willingToChangeClub", false)}
                      />
                    </View>
                  </View>
                </View>

                <View style={{ gap: spacing[10] }}>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontSize: typography.fontSize[18],
                      fontWeight: typography.fontWeight.heavy,
                    }}
                  >
                    Carriera calcistica
                  </Text>
                  <Text style={{ color: colors.textSecondary, lineHeight: 22 }}>
                    Aggiungi una stagione per volta con squadra, categoria e
                    statistiche.
                  </Text>
                  <PlayerExperiencesSection
                    addButtonLabel="Aggiungi esperienza calcistica"
                    editable
                    emptyStateLabel="Aggiungi la tua prima esperienza stagionale."
                    experiences={careerEntries}
                    onChange={(value) => updateValue("careerEntries", value)}
                    searchTeams={searchTeams}
                  />
                </View>

                <View style={{ gap: spacing[10] }}>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontSize: typography.fontSize[18],
                      fontWeight: typography.fontWeight.heavy,
                    }}
                  >
                    Media e contenuti
                  </Text>
                  <MediaPickerField
                    buttonLabel="Carica video highlights"
                    helperText="Seleziona un video dal cellulare per mostrare i tuoi highlights."
                    isUploading={uploadingField === "highlight-video"}
                    label="Video highlights"
                    onPick={() =>
                      handleMediaUpload({
                        field: "highlight-video",
                        folder: "highlight-videos",
                        mediaTypes: ["videos"],
                        onUploaded: (items) =>
                          updateValue("highlightVideoUrl", items[0]?.url ?? ""),
                      })
                    }
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
                    selectedCount={playerMediaItems.length}
                  />
                </View>
              </>
            ) : null}

            {role === "coach" ? (
              <View style={{ gap: spacing[10] }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: typography.fontSize[18],
                    fontWeight: typography.fontWeight.heavy,
                  }}
                >
                  Profilo allenatore
                </Text>
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
                  onChangeText={(value) => updateValue("coachedCategories", value)}
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
                  buttonLabel="Carica video tecnico"
                  helperText="Carica dal telefono una clip tecnica o una presentazione video."
                  isUploading={uploadingField === "coach-video"}
                  label="Video tecnico"
                  onPick={() =>
                    handleMediaUpload({
                        field: "coach-video",
                        folder: "coach-videos",
                        mediaTypes: ["videos"],
                        onUploaded: (items) =>
                          updateValue("technicalVideoUrl", items[0]?.url ?? ""),
                      })
                    }
                  selectedLabel={
                    technicalVideoUrl
                      ? "Video tecnico caricato correttamente"
                      : undefined
                  }
                />
                <Input
                  label="Regioni preferite"
                  onChangeText={(value) => updateValue("coachPreferredRegions", value)}
                  placeholder="Es. Lazio, Toscana"
                  value={coachPreferredRegions}
                />
                <View style={{ gap: spacing[8] }}>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontWeight: typography.fontWeight.bold,
                    }}
                  >
                    Disponibile a un nuovo incarico?
                  </Text>
                  <View style={{ flexDirection: "row", gap: spacing[8] }}>
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
              <View style={{ gap: spacing[10] }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: typography.fontSize[18],
                    fontWeight: typography.fontWeight.heavy,
                  }}
                >
                  Profilo staff tecnico
                </Text>
                <SelectField
                  label="Specializzazione"
                  onChange={(value) =>
                    updateValue("staffSpecialization", value as StaffSpecialization)
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
                  onChangeText={(value) => updateValue("experienceSummary", value)}
                  placeholder="Ruoli, staff e contesti in cui hai lavorato"
                  value={experienceSummary}
                />
                <Input
                  label="Regioni preferite"
                  onChangeText={(value) => updateValue("staffPreferredRegions", value)}
                  placeholder="Es. Lombardia, Emilia-Romagna"
                  value={staffPreferredRegions}
                />
                <View style={{ gap: spacing[8] }}>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontWeight: typography.fontWeight.bold,
                    }}
                  >
                    Disponibile a collaborare subito?
                  </Text>
                  <View style={{ flexDirection: "row", gap: spacing[8] }}>
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
              <View style={{ gap: spacing[10] }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: typography.fontSize[18],
                    fontWeight: typography.fontWeight.heavy,
                  }}
                >
                  Pagina societa'
                </Text>
                <Input
                  label="Categoria"
                  onChangeText={(value) => updateValue("clubCategory", value)}
                  placeholder="Es. Eccellenza"
                  value={clubCategory}
                />
                <Input
                  label="Campionato / lega"
                  onChangeText={(value) => updateValue("clubLeague", value)}
                  placeholder="Es. Girone A"
                  value={clubLeague}
                />
                <MediaPickerField
                  buttonLabel="Carica logo societa'"
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
                  previewUrl={clubLogoUrl}
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
                  selectedCount={clubGalleryItems.length}
                />
                <Input
                  label="Descrizione"
                  multiline
                  onChangeText={(value) => updateValue("clubDescription", value)}
                  placeholder="Racconta identita', struttura e obiettivi del club"
                  value={clubDescription}
                />
              </View>
            ) : null}

            <View style={{ gap: spacing[10] }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: typography.fontSize[18],
                  fontWeight: typography.fontWeight.heavy,
                }}
              >
                Bio personale
              </Text>
              <Input
                label="Presentazione"
                maxLength={400}
                multiline
                onChangeText={(value) =>
                  updateValue("bio", normalizeProfileBioInput(value), ["bio"])
                }
                placeholder="Racconta brevemente il tuo percorso calcistico, le tue caratteristiche e cosa cerchi per la prossima stagione."
                style={validationErrors.bio ? { borderColor: colors.danger } : undefined}
                value={bio}
              />
              {validationErrors.bio ? (
                <ValidationMessage>{validationErrors.bio}</ValidationMessage>
              ) : null}
            </View>

            <View style={{ flexDirection: "row", gap: spacing[12] }}>
              <View style={{ flex: 1 }}>
                <Button
                  label="Piu' tardi"
                  onPress={() => goToCompletion("details")}
                  variant="secondary"
                />
              </View>
              <View style={{ flex: 1 }}>
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
          <Card style={{ gap: spacing[16] }}>
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: typography.fontSize[28],
                fontWeight: typography.fontWeight.heavy,
              }}
            >
              Il tuo profilo e' pronto!
            </Text>
            <Text style={{ color: colors.textSecondary, lineHeight: 24 }}>
              Ora puoi iniziare a connetterti con squadre, allenatori e
              giocatori. Se vuoi, potrai aggiungere altri dettagli in qualsiasi
              momento.
            </Text>
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
      </KeyboardAwareScrollView>
    </Screen>
  );
}
