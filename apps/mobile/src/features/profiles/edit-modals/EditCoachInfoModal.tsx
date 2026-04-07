import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";

import { MediaPickerField } from "../../../components/ui/media-picker-field";

import type { AvailabilityType } from "../../onboarding/onboarding-form";
import { WhereToPlaySection } from "../../onboarding/where-to-play-section";
import {
  pickAndUploadMedia,
  ProfileMediaUploadError,
  removeMediaFromStorage,
  type UploadedMediaItem,
} from "../media-upload-service";
import {
  buildFullUpdatePayload,
  buildInitialState,
  fromDelimitedString,
} from "../profile-edit-helpers";
import { validateBirthDateInput } from "../profile-form-utils";
import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { ProfileField as Field } from "../profile-screen-components";
import type { CompleteProfessionalProfile } from "../profile-service";
import { updateCompleteProfessionalProfile } from "../profile-service";
import { EditModalShell } from "./EditModalShell";

const FORMATION_OPTIONS = [
  "4-3-3", "4-4-2", "4-2-3-1", "3-5-2", "3-4-3", "5-3-2", "4-1-4-1", "4-3-1-2",
] as const;

const PLAY_STYLE_OPTIONS = [
  "Costruzione dal basso", "Pressing alto", "Contropiede",
  "Possesso palla", "Gioco diretto", "Misto", "Valorizzazione giovani",
] as const;

const PREFERRED_CATEGORY_OPTIONS = [
  "Serie A", "Serie B", "Serie C", "Serie D",
  "Eccellenza", "Promozione", "Prima Categoria",
  "Seconda Categoria", "Juniores", "Allievi", "Giovanissimi",
] as const;

type CoachFormState = {
  coachedCategories: string;
  coachedClubs: string;
  contractEnd: string;
  currentClub: string;
  gamePhilosophy: string;
  licenses: string;
  openToNewRole: boolean;
  preferredFormation: string;
  technicalVideoUrl: string;
};

type EditCoachInfoModalProps = {
  completeProfile: CompleteProfessionalProfile;
  onClose: () => void;
  onSaved: () => void;
  userId: string;
  visible: boolean;
};

function getInitialFormState(
  completeProfile: CompleteProfessionalProfile,
): CoachFormState {
  const base = buildInitialState(completeProfile);
  return {
    coachedCategories: base.coachedCategories,
    coachedClubs: base.coachedClubs,
    contractEnd: completeProfile.coachProfile?.contract_end ?? "",
    currentClub: completeProfile.coachProfile?.current_club ?? "",
    gamePhilosophy: base.gamePhilosophy,
    licenses: base.licenses,
    openToNewRole: base.openToNewRole,
    preferredFormation: completeProfile.coachProfile?.preferred_formation ?? "",
    technicalVideoUrl: base.technicalVideoUrl,
  };
}

export function EditCoachInfoModal({
  completeProfile,
  onClose,
  onSaved,
  userId,
  visible,
}: EditCoachInfoModalProps) {
  const [form, setForm] = useState<CoachFormState>(() =>
    getInitialFormState(completeProfile),
  );
  const [preferredRegionsArr, setPreferredRegionsArr] = useState<string[]>([]);
  const [availabilityType, setAvailabilityType] = useState<AvailabilityType>("ITALY");
  const [preferredProvincesArr, setPreferredProvincesArr] = useState<string[]>([]);
  const [secondaryFormations, setSecondaryFormations] = useState<string[]>([]);
  const [playStyles, setPlayStyles] = useState<string[]>([]);
  const [preferredCategories, setPreferredCategories] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setForm(getInitialFormState(completeProfile));
      const base = buildInitialState(completeProfile);
      setPreferredRegionsArr(fromDelimitedString(base.preferredRegions));
      setAvailabilityType((base.coachAvailabilityType as AvailabilityType) || "ITALY");
      setPreferredProvincesArr(fromDelimitedString(base.coachPreferredProvinces));
      setSecondaryFormations(completeProfile.coachProfile?.secondary_formations ?? []);
      setPlayStyles(completeProfile.coachProfile?.play_styles ?? []);
      setPreferredCategories(completeProfile.coachProfile?.preferred_categories ?? []);
    }
  }, [visible, completeProfile]);

  function updateField<K extends keyof CoachFormState>(
    key: K,
    value: CoachFormState[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handlePickTechnicalVideo() {
    setUploadingField("technicalVideoUrl");

    try {
      const oldUrl = form.technicalVideoUrl;
      const results: UploadedMediaItem[] = await pickAndUploadMedia({
        folder: "technical-video",
        mediaTypes: ["videos"],
        userId,
      });

      if (results.length === 0) {
        setUploadingField(null);
        return;
      }

      if (oldUrl) {
        try {
          await removeMediaFromStorage(oldUrl);
        } catch {
          // Best effort removal of previous file
        }
      }

      updateField("technicalVideoUrl", results[0].url);
    } catch (error) {
      Alert.alert(
        "Errore",
        error instanceof ProfileMediaUploadError
          ? error.message
          : "Caricamento del video non riuscito.",
      );
    } finally {
      setUploadingField(null);
    }
  }

  async function handleRemoveTechnicalVideo() {
    const url = form.technicalVideoUrl;

    if (!url) {
      return;
    }

    setUploadingField("technicalVideoUrl");

    try {
      await removeMediaFromStorage(url);
      updateField("technicalVideoUrl", "");
    } catch (error) {
      Alert.alert(
        "Errore",
        error instanceof ProfileMediaUploadError
          ? error.message
          : "Rimozione del video non riuscita.",
      );
    } finally {
      setUploadingField(null);
    }
  }

  async function handleSave() {
    setIsSaving(true);

    try {
      const baseState = buildInitialState(completeProfile);
      const mergedState = {
        ...baseState,
        licenses: form.licenses,
        coachedClubs: form.coachedClubs,
        coachedCategories: form.coachedCategories,
        gamePhilosophy: form.gamePhilosophy,
        technicalVideoUrl: form.technicalVideoUrl,
        preferredRegions: preferredRegionsArr.join(", "),
        coachAvailabilityType: availabilityType,
        coachPreferredProvinces: preferredProvincesArr.join(", "),
        openToNewRole: form.openToNewRole,
      };

      const payload = buildFullUpdatePayload(completeProfile, mergedState);
      payload.profile.birth_date = validateBirthDateInput(
        baseState.birthDate,
      ).isoValue;
      if (payload.coachProfile) {
        payload.coachProfile.preferred_formation = form.preferredFormation || null;
        payload.coachProfile.secondary_formations = secondaryFormations;
        payload.coachProfile.play_styles = playStyles;
        payload.coachProfile.current_club = form.currentClub || null;
        payload.coachProfile.contract_end = form.contractEnd || null;
        payload.coachProfile.preferred_categories = preferredCategories;
      }

      await updateCompleteProfessionalProfile(payload);
      onSaved();
    } catch (error) {
      Alert.alert(
        "Errore",
        error instanceof Error
          ? error.message
          : "Si è verificato un errore durante il salvataggio.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <EditModalShell
      isSaving={isSaving}
      onClose={onClose}
      onSave={handleSave}
      title="Informazioni sportive"
      visible={visible}
    >
      <Field
        editable
        label="Licenze"
        onChangeText={(value) => updateField("licenses", value)}
        placeholder="UEFA B, UEFA A..."
        value={form.licenses}
      />

      <Field
        editable
        label="Squadre allenate"
        onChangeText={(value) => updateField("coachedClubs", value)}
        placeholder="Nome squadra 1, Nome squadra 2..."
        value={form.coachedClubs}
      />

      <Field
        editable
        label="Categorie allenate"
        onChangeText={(value) => updateField("coachedCategories", value)}
        placeholder="Juniores, Promozione..."
        value={form.coachedCategories}
      />

      <Field
        editable
        label="Filosofia di gioco"
        multiline
        onChangeText={(value) => updateField("gamePhilosophy", value)}
        placeholder="Descrivi la tua filosofia di gioco..."
        value={form.gamePhilosophy}
      />

      <MediaPickerField
        buttonLabel="Carica video"
        helperText="Carica un video tecnico per arricchire il tuo profilo."
        isUploading={uploadingField === "technicalVideoUrl"}
        label="Video tecnico"
        mediaType="video"
        onPick={handlePickTechnicalVideo}
        onRemove={handleRemoveTechnicalVideo}
        previewUrl={form.technicalVideoUrl || null}
        removable={Boolean(form.technicalVideoUrl)}
      />

      {/* Situazione attuale */}
      <Field
        editable
        label="Club attuale"
        onChangeText={(value) => updateField("currentClub", value)}
        placeholder="Nome del club attuale..."
        value={form.currentClub}
      />

      <Field
        editable
        label="Scadenza contratto"
        onChangeText={(value) => updateField("contractEnd", value)}
        placeholder="es. Giugno 2026"
        value={form.contractEnd}
      />

      {/* Identità tecnica – modulo */}
      <View>
        <AppText style={styles.sectionLabel}>Modulo preferito</AppText>
        <View style={styles.chipsWrap}>
          {FORMATION_OPTIONS.map((opt) => (
            <Pressable
              key={opt}
              accessibilityRole="button"
              onPress={() => updateField("preferredFormation", form.preferredFormation === opt ? "" : opt)}
              style={[styles.chip, form.preferredFormation === opt && styles.chipSelected]}
            >
              <AppText
                variant="caption"
                style={[styles.chipText, form.preferredFormation === opt && styles.chipTextSelected]}
              >
                {opt}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>

      <View>
        <AppText style={styles.sectionLabel}>Moduli secondari</AppText>
        <View style={styles.chipsWrap}>
          {FORMATION_OPTIONS.filter((opt) => opt !== form.preferredFormation).map((opt) => (
            <Pressable
              key={opt}
              accessibilityRole="button"
              onPress={() =>
                setSecondaryFormations((prev) =>
                  prev.includes(opt) ? prev.filter((f) => f !== opt) : [...prev, opt],
                )
              }
              style={[styles.chip, secondaryFormations.includes(opt) && styles.chipSelected]}
            >
              <AppText
                variant="caption"
                style={[styles.chipText, secondaryFormations.includes(opt) && styles.chipTextSelected]}
              >
                {opt}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>

      <View>
        <AppText style={styles.sectionLabel}>Stile di gioco</AppText>
        <View style={styles.chipsWrap}>
          {PLAY_STYLE_OPTIONS.map((opt) => (
            <Pressable
              key={opt}
              accessibilityRole="button"
              onPress={() =>
                setPlayStyles((prev) =>
                  prev.includes(opt) ? prev.filter((s) => s !== opt) : [...prev, opt],
                )
              }
              style={[styles.chip, playStyles.includes(opt) && styles.chipSelected]}
            >
              <AppText
                variant="caption"
                style={[styles.chipText, playStyles.includes(opt) && styles.chipTextSelected]}
              >
                {opt}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Categorie target */}
      <View>
        <AppText style={styles.sectionLabel}>Categorie target</AppText>
        <View style={styles.chipsWrap}>
          {PREFERRED_CATEGORY_OPTIONS.map((opt) => (
            <Pressable
              key={opt}
              accessibilityRole="button"
              onPress={() =>
                setPreferredCategories((prev) =>
                  prev.includes(opt) ? prev.filter((c) => c !== opt) : [...prev, opt],
                )
              }
              style={[styles.chip, preferredCategories.includes(opt) && styles.chipSelected]}
            >
              <AppText
                variant="caption"
                style={[styles.chipText, preferredCategories.includes(opt) && styles.chipTextSelected]}
              >
                {opt}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Availability + geographic selection */}
      <WhereToPlaySection
        availabilityType={availabilityType}
        categories={[]}
        hideCategories
        infoMessages={{
          ITALY: "",
          REGIONS: "Indica una o più regioni in cui sei disponibile ad allenare.",
          PROVINCES: "Indica una o più province in cui sei disponibile ad allenare.",
        }}
        isAvailable={form.openToNewRole}
        onAvailabilityTypeChange={setAvailabilityType}
        onCategoriesChange={() => undefined}
        onIsAvailableChange={(value) => {
          updateField("openToNewRole", value);
          if (!value) {
            setPreferredRegionsArr([]);
            setPreferredProvincesArr([]);
            setAvailabilityType("ITALY");
          }
        }}
        onProvincesChange={setPreferredProvincesArr}
        onRegionsChange={setPreferredRegionsArr}
        provinces={preferredProvincesArr}
        provincesHelperText="Puoi selezionare più province in cui allenare."
        provincesLabel="Province di interesse"
        regions={preferredRegionsArr}
        regionsHelperText="Puoi selezionare più regioni in cui allenare."
        regionsLabel="Regioni di interesse"
        toggleLabel="Disponibile per nuove panchine"
        toggleSubtitle="Il tuo profilo può comparire tra gli allenatori disponibili."
      />
    </EditModalShell>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[6],
  },
  chipSelected: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  chipText: {
    color: colors.textPrimary,
    fontWeight: "500",
  },
  chipTextSelected: {
    color: colors.inkInvert,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: spacing[8],
  },
});

