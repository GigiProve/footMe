import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { DatePickerField } from "../../src/components/ui/date-picker-field";
import { MediaPickerField } from "../../src/components/ui/media-picker-field";
import { Screen } from "../../src/components/ui/screen";
import { SelectField } from "../../src/components/ui/select-field";
import { useSession } from "../../src/features/auth/use-session";
import {
  createInitialProfile,
  type AppRole,
  type PlayerPosition,
  type ProfileGender,
  type StaffSpecialization,
} from "../../src/features/onboarding/create-initial-profile";
import {
  NATIONALITY_OPTIONS,
  REGION_OPTIONS,
  isSeasonLabelValid,
  normalizeSeasonLabelInput,
} from "../../src/features/profiles/profile-form-utils";
import { withDefaultProfileAvatar } from "../../src/features/profiles/profile-avatar";
import {
  pickAndUploadMedia,
  type UploadedMediaItem,
} from "../../src/features/profiles/media-upload-service";
import { updateCompleteProfessionalProfile } from "../../src/features/profiles/profile-service";
import { supabase } from "../../src/lib/supabase";
import { colors, radius, spacing, typography } from "../../src/theme/tokens";
import { Button, Card, Input } from "../../src/ui";

type OnboardingStep = "role" | "base" | "decision" | "details" | "complete";

type CareerEntryForm = {
  appearances: string;
  assists: string;
  awards: string;
  clubName: string;
  competitionName: string;
  goals: string;
  minutesPlayed: string;
  seasonLabel: string;
};

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
  { label: "Non binario", value: "non_binary" },
  { label: "Preferisco non specificarlo", value: "prefer_not_to_say" },
];

const positionOptions: { label: string; value: PlayerPosition }[] = [
  { label: "Portiere", value: "goalkeeper" },
  { label: "Difensore", value: "defender" },
  { label: "Centrocampista", value: "midfielder" },
  { label: "Attaccante", value: "forward" },
];

const preferredFootOptions: { label: string; value: "right" | "left" | "both" }[] = [
  { label: "Destro", value: "right" },
  { label: "Sinistro", value: "left" },
  { label: "Ambidestro", value: "both" },
];

const staffSpecializationOptions: { label: string; value: StaffSpecialization }[] = [
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

function parseStatNumber(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return 0;
  }

  const parsed = Number(trimmed);

  if (Number.isNaN(parsed)) {
    throw new Error("Inserisci solo numeri validi nelle statistiche stagionali.");
  }

  return parsed;
}

function fromDelimitedString(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasCareerEntryContent(entry: CareerEntryForm) {
  return !!(
    entry.seasonLabel.trim() ||
    entry.clubName.trim() ||
    entry.competitionName.trim() ||
    entry.appearances.trim() ||
    entry.goals.trim() ||
    entry.assists.trim() ||
    entry.minutesPlayed.trim() ||
    entry.awards.trim()
  );
}

function StepChip({
  isActive,
  label,
}: {
  isActive: boolean;
  label: string;
}) {
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

export default function OnboardingProfileScreen() {
  const router = useRouter();
  const { refreshProfile, session } = useSession();
  const [step, setStep] = useState<OnboardingStep>("role");
  const [role, setRole] = useState<AppRole>("player");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState<ProfileGender>("male");
  const [birthDate, setBirthDate] = useState("");
  const [nationality, setNationality] = useState("");
  const [residence, setResidence] = useState("");
  const [useResidenceForDomicile, setUseResidenceForDomicile] = useState(true);
  const [domicile, setDomicile] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [clubName, setClubName] = useState("");
  const [clubCity, setClubCity] = useState("");
  const [clubRegion, setClubRegion] = useState("");
  const [bio, setBio] = useState("");
  const [isAvailable, setIsAvailable] = useState(false);
  const [isOpenToTransfer, setIsOpenToTransfer] = useState(false);
  const [primaryPosition, setPrimaryPosition] = useState<PlayerPosition>("midfielder");
  const [secondaryPosition, setSecondaryPosition] = useState<PlayerPosition | "">("");
  const [preferredFoot, setPreferredFoot] = useState<"right" | "left" | "both" | "">(
    "",
  );
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [preferredCategories, setPreferredCategories] = useState("");
  const [transferRegions, setTransferRegions] = useState("");
  const [willingToChangeClub, setWillingToChangeClub] = useState(false);
  const [careerEntries, setCareerEntries] = useState<CareerEntryForm[]>([
    createEmptyCareerEntry(),
  ]);
  const [highlightVideoUrl, setHighlightVideoUrl] = useState("");
  const [playerMediaItems, setPlayerMediaItems] = useState<UploadedMediaItem[]>([]);
  const [licenses, setLicenses] = useState("");
  const [coachedClubs, setCoachedClubs] = useState("");
  const [coachedCategories, setCoachedCategories] = useState("");
  const [gamePhilosophy, setGamePhilosophy] = useState("");
  const [technicalVideoUrl, setTechnicalVideoUrl] = useState("");
  const [coachPreferredRegions, setCoachPreferredRegions] = useState("");
  const [openToNewRole, setOpenToNewRole] = useState(false);
  const [staffSpecialization, setStaffSpecialization] =
    useState<StaffSpecialization>("fitness_coach");
  const [certifications, setCertifications] = useState("");
  const [experienceSummary, setExperienceSummary] = useState("");
  const [staffPreferredRegions, setStaffPreferredRegions] = useState("");
  const [openToWork, setOpenToWork] = useState(false);
  const [clubCategory, setClubCategory] = useState("");
  const [clubLeague, setClubLeague] = useState("");
  const [clubDescription, setClubDescription] = useState("");
  const [clubLogoUrl, setClubLogoUrl] = useState("");
  const [clubGalleryItems, setClubGalleryItems] = useState<UploadedMediaItem[]>([]);
  const [hasCreatedProfile, setHasCreatedProfile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
  const effectiveDomicile = useResidenceForDomicile ? residence : domicile;

  const stepIndex = {
    base: 1,
    complete: 4,
    decision: 2,
    details: 3,
    role: 0,
  }[step];
  const isBusy = isSubmitting || uploadingField !== null;

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
      setUploadingField(field);

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
      const message =
        error instanceof Error
          ? error.message
          : "Errore inatteso durante il caricamento dei media.";
      Alert.alert("Caricamento non riuscito", message);
    } finally {
      setUploadingField(null);
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

    setHasCreatedProfile(true);
  }

  async function handleContinueToDecision() {
    try {
      setIsSubmitting(true);
      await ensureInitialProfileCreated();
      setStep("decision");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore inatteso durante il salvataggio dei dati base.";
      Alert.alert("Dati base non completi", message);
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

      setStep(mode === "now" ? "details" : "complete");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Errore inatteso durante l'onboarding.";
      Alert.alert("Operazione non completata", message);
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

      const normalizedCareerEntries = careerEntries
        .filter(hasCareerEntryContent)
        .map((entry, index) => {
          const seasonLabel = normalizeSeasonLabelInput(entry.seasonLabel);

          if (!isSeasonLabelValid(seasonLabel)) {
            throw new Error(
              `La stagione dell'esperienza ${index + 1} deve essere nel formato 24/25.`,
            );
          }

          if (!entry.clubName.trim()) {
            throw new Error(`Inserisci la squadra per l'esperienza ${index + 1}.`);
          }

          return {
            appearances: parseStatNumber(entry.appearances),
            assists: parseStatNumber(entry.assists),
            awards: parseOptionalText(entry.awards),
            club_name: entry.clubName.trim(),
            competition_name: parseOptionalText(entry.competitionName),
            goals: parseStatNumber(entry.goals),
            minutes_played: parseStatNumber(entry.minutesPlayed),
            season_label: seasonLabel,
            sort_order: index,
          };
        });

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
          avatar_url: withDefaultProfileAvatar(avatarUrl),
          bio: parseOptionalText(bio),
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

      setStep("complete");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Errore inatteso nel completamento profilo.";
      Alert.alert("Profilo sportivo non salvato", message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function finishOnboarding(destination: CompletionDestination) {
    await refreshProfile();

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

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: spacing[18], paddingBottom: 28 }}>
        <View
          style={{
            gap: spacing[10],
            padding: spacing[22],
            borderRadius: radius[24],
            backgroundColor: colors.textPrimary,
          }}
        >
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
            Un percorso guidato, rapido e flessibile: inserisci i dati essenziali ora e
            completa i dettagli quando vuoi.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[8] }}>
            <StepChip isActive={stepIndex >= 0} label="Ruolo" />
            <StepChip isActive={stepIndex >= 1} label="Dati base" />
            <StepChip isActive={stepIndex >= 2} label="Scelta" />
            <StepChip isActive={stepIndex >= 3} label="Profilo sportivo" />
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
                Questa scelta definisce il percorso di onboarding e le informazioni sportive
                che ti chiederemo in seguito.
              </Text>
            </View>

            {roleOptions.map((entry) => {
              const isActive = role === entry.value;

              return (
                <Pressable
                  key={entry.value}
                  accessibilityRole="button"
                  onPress={() => setRole(entry.value)}
                  style={{
                    gap: spacing[8],
                    borderRadius: radius[20],
                    borderWidth: 1,
                    borderColor: isActive ? colors.hero : colors.border,
                    backgroundColor: isActive ? colors.heroSoft : colors.surface,
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

            <Button label="Continua" onPress={() => setStep("base")} variant="primary" />
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
                Completa il minimo necessario per attivare il profilo e farti trovare in
                piattaforma.
              </Text>
            </View>

            <View style={{ flexDirection: "row", gap: spacing[12] }}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Nome"
                  onChangeText={setFirstName}
                  placeholder="Es. Marco"
                  value={firstName}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Cognome"
                  onChangeText={setLastName}
                  placeholder="Es. Rossi"
                  value={lastName}
                />
              </View>
            </View>

            <View style={{ gap: spacing[8] }}>
              <Text style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.bold }}>
                Sesso
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[8] }}>
                {genderOptions.map((entry) => (
                  <OptionPill
                    key={entry.value}
                    active={gender === entry.value}
                    label={entry.label}
                    onPress={() => setGender(entry.value)}
                  />
                ))}
              </View>
            </View>

            <DatePickerField
              label="Data di nascita"
              onChange={setBirthDate}
              placeholder="Apri il calendario e seleziona la data"
              value={birthDate}
            />

            <SelectField
              label="Nazionalita'"
              onChange={(value) => setNationality(value)}
              options={NATIONALITY_OPTIONS}
              placeholder="Seleziona la nazionalita'"
              value={nationality}
            />

            <Input
              label="Residenza"
              onChangeText={setResidence}
              placeholder="Citta' e provincia di residenza"
              value={residence}
            />

            <View style={{ gap: spacing[8] }}>
              <Text style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.bold }}>
                Domicilio
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[8] }}>
                <OptionPill
                  active={useResidenceForDomicile}
                  label="Uguale alla residenza"
                  onPress={() => setUseResidenceForDomicile(true)}
                />
                <OptionPill
                  active={!useResidenceForDomicile}
                  label="Diverso dalla residenza"
                  onPress={() => setUseResidenceForDomicile(false)}
                />
              </View>
            </View>

            {!useResidenceForDomicile ? (
              <Input
                label="Domicilio effettivo"
                onChangeText={setDomicile}
                placeholder="Inserisci il domicilio"
                value={domicile}
              />
            ) : null}

            <Input
              keyboardType="phone-pad"
              label="Numero di telefono (facoltativo)"
              onChangeText={setPhoneNumber}
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
                  onUploaded: (items) => setAvatarUrl(items[0]?.url ?? ""),
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
                  Dati iniziali della societa'
                </Text>
                <Input
                  label="Nome societa'"
                  onChangeText={setClubName}
                  placeholder="Es. ASD Example"
                  value={clubName}
                />
                <Input
                  label="Citta'"
                  onChangeText={setClubCity}
                  placeholder="Es. Perugia"
                  value={clubCity}
                />
                <SelectField
                  label="Regione"
                  onChange={(value) => setClubRegion(value)}
                  options={REGION_OPTIONS}
                  placeholder="Seleziona la regione"
                  value={clubRegion}
                />
              </View>
            ) : null}

            <View style={{ flexDirection: "row", gap: spacing[12] }}>
              <View style={{ flex: 1 }}>
                <Button label="Indietro" onPress={() => setStep("role")} variant="secondary" />
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
                Un profilo completo aumenta la tua visibilita' verso squadre, allenatori
                e dirigenti.
              </Text>
            </View>

            <Card style={{ gap: spacing[8], backgroundColor: colors.surfaceMuted }}>
              <Text style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.heavy }}>
                Profilo selezionato
              </Text>
              <Text style={{ color: colors.textSecondary, lineHeight: 22 }}>
                {roleOptions.find((entry) => entry.value === role)?.label} · {fullName}
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
                Aggiungi dettagli professionali, esperienze e contenuti media. Puoi sempre
                aggiornare tutto in seguito.
              </Text>
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
                  <SelectField
                    label="Ruolo principale"
                    onChange={(value) => setPrimaryPosition(value as PlayerPosition)}
                    options={positionOptions}
                    placeholder="Seleziona il ruolo"
                    value={primaryPosition}
                  />
                  <SelectField
                    allowClear
                    clearLabel="Rimuovi ruolo secondario"
                    label="Ruolo secondario"
                    onChange={(value) => setSecondaryPosition(value as PlayerPosition | "")}
                    options={positionOptions}
                    placeholder="Seleziona il ruolo secondario"
                    value={secondaryPosition}
                  />
                  <SelectField
                    allowClear
                    clearLabel="Rimuovi piede preferito"
                    label="Piede preferito"
                    onChange={(value) =>
                      setPreferredFoot(value as "right" | "left" | "both" | "")
                    }
                    options={preferredFootOptions}
                    placeholder="Seleziona il piede preferito"
                    value={preferredFoot}
                  />
                  <View style={{ flexDirection: "row", gap: spacing[12] }}>
                    <View style={{ flex: 1 }}>
                      <Input
                        keyboardType="number-pad"
                        label="Altezza (cm)"
                        onChangeText={setHeightCm}
                        placeholder="Es. 182"
                        value={heightCm}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Input
                        keyboardType="number-pad"
                        label="Peso (kg)"
                        onChangeText={setWeightKg}
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
                      style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.bold }}
                    >
                      Disponibile per una nuova squadra?
                    </Text>
                    <View style={{ flexDirection: "row", gap: spacing[8] }}>
                      <OptionPill
                        active={isAvailable}
                        label="Si'"
                        onPress={() => setIsAvailable(true)}
                      />
                      <OptionPill
                        active={!isAvailable}
                        label="No"
                        onPress={() => setIsAvailable(false)}
                      />
                    </View>
                  </View>
                  <Input
                    label="Regioni in cui sei disponibile a giocare"
                    onChangeText={setTransferRegions}
                    placeholder="Es. Lombardia, Veneto"
                    value={transferRegions}
                  />
                  <Input
                    label="Categorie di interesse"
                    onChangeText={setPreferredCategories}
                    placeholder="Es. Promozione, Eccellenza"
                    value={preferredCategories}
                  />
                  <View style={{ gap: spacing[8] }}>
                    <Text
                      style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.bold }}
                    >
                      Disponibile al trasferimento?
                    </Text>
                    <View style={{ flexDirection: "row", gap: spacing[8] }}>
                      <OptionPill
                        active={isOpenToTransfer}
                        label="Si'"
                        onPress={() => setIsOpenToTransfer(true)}
                      />
                      <OptionPill
                        active={!isOpenToTransfer}
                        label="No"
                        onPress={() => setIsOpenToTransfer(false)}
                      />
                    </View>
                  </View>
                  <View style={{ gap: spacing[8] }}>
                    <Text
                      style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.bold }}
                    >
                      Disponibile a cambiare club subito?
                    </Text>
                    <View style={{ flexDirection: "row", gap: spacing[8] }}>
                      <OptionPill
                        active={willingToChangeClub}
                        label="Si'"
                        onPress={() => setWillingToChangeClub(true)}
                      />
                      <OptionPill
                        active={!willingToChangeClub}
                        label="No"
                        onPress={() => setWillingToChangeClub(false)}
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
                    Aggiungi una stagione per volta, in stile esperienze LinkedIn.
                  </Text>
                  {careerEntries.map((entry, index) => (
                    <Card key={`career-${index}`} style={{ gap: spacing[10] }}>
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontSize: typography.fontSize[16],
                          fontWeight: typography.fontWeight.heavy,
                        }}
                      >
                        Stagione {index + 1}
                      </Text>
                      <Input
                        label="Stagione"
                        onChangeText={(value) =>
                          setCareerEntries((current) =>
                            current.map((item, currentIndex) =>
                              currentIndex === index
                                ? {
                                    ...item,
                                    seasonLabel: normalizeSeasonLabelInput(value),
                                  }
                                : item,
                            ),
                          )
                        }
                        placeholder="Es. 24/25"
                        value={entry.seasonLabel}
                      />
                      <Input
                        label="Squadra"
                        onChangeText={(value) =>
                          setCareerEntries((current) =>
                            current.map((item, currentIndex) =>
                              currentIndex === index ? { ...item, clubName: value } : item,
                            ),
                          )
                        }
                        placeholder="Es. ASD Example"
                        value={entry.clubName}
                      />
                      <Input
                        label="Campionato / categoria"
                        onChangeText={(value) =>
                          setCareerEntries((current) =>
                            current.map((item, currentIndex) =>
                              currentIndex === index
                                ? { ...item, competitionName: value }
                                : item,
                            ),
                          )
                        }
                        placeholder="Es. Promozione"
                        value={entry.competitionName}
                      />
                      <View
                        style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[12] }}
                      >
                        <View style={{ flexBasis: "47%", flexGrow: 1 }}>
                          <Input
                            keyboardType="number-pad"
                            label="Presenze"
                            onChangeText={(value) =>
                              setCareerEntries((current) =>
                                current.map((item, currentIndex) =>
                                  currentIndex === index
                                    ? { ...item, appearances: value }
                                    : item,
                                ),
                              )
                            }
                            value={entry.appearances}
                          />
                        </View>
                        <View style={{ flexBasis: "47%", flexGrow: 1 }}>
                          <Input
                            keyboardType="number-pad"
                            label="Gol"
                            onChangeText={(value) =>
                              setCareerEntries((current) =>
                                current.map((item, currentIndex) =>
                                  currentIndex === index ? { ...item, goals: value } : item,
                                ),
                              )
                            }
                            value={entry.goals}
                          />
                        </View>
                        <View style={{ flexBasis: "47%", flexGrow: 1 }}>
                          <Input
                            keyboardType="number-pad"
                            label="Assist"
                            onChangeText={(value) =>
                              setCareerEntries((current) =>
                                current.map((item, currentIndex) =>
                                  currentIndex === index ? { ...item, assists: value } : item,
                                ),
                              )
                            }
                            value={entry.assists}
                          />
                        </View>
                        <View style={{ flexBasis: "47%", flexGrow: 1 }}>
                          <Input
                            keyboardType="number-pad"
                            label="Minuti giocati"
                            onChangeText={(value) =>
                              setCareerEntries((current) =>
                                current.map((item, currentIndex) =>
                                  currentIndex === index
                                    ? { ...item, minutesPlayed: value }
                                    : item,
                                ),
                              )
                            }
                            value={entry.minutesPlayed}
                          />
                        </View>
                      </View>
                      <Input
                        label="Premi o risultati"
                        multiline
                        onChangeText={(value) =>
                          setCareerEntries((current) =>
                            current.map((item, currentIndex) =>
                              currentIndex === index ? { ...item, awards: value } : item,
                            ),
                          )
                        }
                        placeholder="Es. playoff vinti, premio miglior giocatore"
                        value={entry.awards}
                      />
                    </Card>
                  ))}
                  <Button
                    label="Aggiungi esperienza"
                    onPress={() =>
                      setCareerEntries((current) => [...current, createEmptyCareerEntry()])
                    }
                    variant="secondary"
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
                        onUploaded: (items) => setHighlightVideoUrl(items[0]?.url ?? ""),
                      })
                    }
                    selectedLabel={
                      highlightVideoUrl ? "Video highlights caricato correttamente" : undefined
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
                          setPlayerMediaItems((current) => [...current, ...items]),
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
                  onChangeText={setLicenses}
                  placeholder="UEFA C, UEFA B"
                  value={licenses}
                />
                <Input
                  label="Squadre allenate"
                  onChangeText={setCoachedClubs}
                  placeholder="ASD Example, FC Training"
                  value={coachedClubs}
                />
                <Input
                  label="Categorie allenate"
                  onChangeText={setCoachedCategories}
                  placeholder="Juniores, Promozione"
                  value={coachedCategories}
                />
                <Input
                  label="Filosofia di gioco"
                  multiline
                  onChangeText={setGamePhilosophy}
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
                      onUploaded: (items) => setTechnicalVideoUrl(items[0]?.url ?? ""),
                    })
                  }
                  selectedLabel={
                    technicalVideoUrl ? "Video tecnico caricato correttamente" : undefined
                  }
                />
                <Input
                  label="Regioni preferite"
                  onChangeText={setCoachPreferredRegions}
                  placeholder="Es. Lazio, Toscana"
                  value={coachPreferredRegions}
                />
                <View style={{ gap: spacing[8] }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.bold }}>
                    Disponibile a un nuovo incarico?
                  </Text>
                  <View style={{ flexDirection: "row", gap: spacing[8] }}>
                    <OptionPill
                      active={openToNewRole}
                      label="Si'"
                      onPress={() => setOpenToNewRole(true)}
                    />
                    <OptionPill
                      active={!openToNewRole}
                      label="No"
                      onPress={() => setOpenToNewRole(false)}
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
                  onChange={(value) => setStaffSpecialization(value as StaffSpecialization)}
                  options={staffSpecializationOptions}
                  placeholder="Seleziona la specializzazione"
                  value={staffSpecialization}
                />
                <Input
                  label="Certificazioni"
                  onChangeText={setCertifications}
                  placeholder="Es. UEFA Fitness, FMS"
                  value={certifications}
                />
                <Input
                  label="Esperienza"
                  multiline
                  onChangeText={setExperienceSummary}
                  placeholder="Ruoli, staff e contesti in cui hai lavorato"
                  value={experienceSummary}
                />
                <Input
                  label="Regioni preferite"
                  onChangeText={setStaffPreferredRegions}
                  placeholder="Es. Lombardia, Emilia-Romagna"
                  value={staffPreferredRegions}
                />
                <View style={{ gap: spacing[8] }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.bold }}>
                    Disponibile a collaborare subito?
                  </Text>
                  <View style={{ flexDirection: "row", gap: spacing[8] }}>
                    <OptionPill
                      active={openToWork}
                      label="Si'"
                      onPress={() => setOpenToWork(true)}
                    />
                    <OptionPill
                      active={!openToWork}
                      label="No"
                      onPress={() => setOpenToWork(false)}
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
                  onChangeText={setClubCategory}
                  placeholder="Es. Eccellenza"
                  value={clubCategory}
                />
                <Input
                  label="Campionato / lega"
                  onChangeText={setClubLeague}
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
                      onUploaded: (items) => setClubLogoUrl(items[0]?.url ?? ""),
                    })
                  }
                  previewUrl={clubLogoUrl}
                  selectedLabel={
                    clubLogoUrl ? "Logo societa' caricato correttamente" : undefined
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
                        setClubGalleryItems((current) => [...current, ...items]),
                    })
                  }
                  selectedCount={clubGalleryItems.length}
                />
                <Input
                  label="Descrizione"
                  multiline
                  onChangeText={setClubDescription}
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
                multiline
                onChangeText={setBio}
                placeholder="Obiettivi sportivi, caratteristiche di gioco, mentalita' e attitudine"
                value={bio}
              />
            </View>

            <View style={{ flexDirection: "row", gap: spacing[12] }}>
              <View style={{ flex: 1 }}>
                <Button label="Piu' tardi" onPress={() => setStep("complete")} variant="secondary" />
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
              Ora puoi iniziare a connetterti con squadre, allenatori e giocatori. Se
              vuoi, potrai aggiungere altri dettagli in qualsiasi momento.
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
      </ScrollView>
    </Screen>
  );
}
