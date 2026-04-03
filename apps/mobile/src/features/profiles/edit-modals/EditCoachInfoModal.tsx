import { useEffect, useState } from "react";
import { Alert } from "react-native";

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
import { ProfileField as Field } from "../profile-screen-components";
import type { CompleteProfessionalProfile } from "../profile-service";
import { updateCompleteProfessionalProfile } from "../profile-service";
import { EditModalShell } from "./EditModalShell";

type CoachFormState = {
  coachedCategories: string;
  coachedClubs: string;
  gamePhilosophy: string;
  licenses: string;
  openToNewRole: boolean;
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
    gamePhilosophy: base.gamePhilosophy,
    licenses: base.licenses,
    openToNewRole: base.openToNewRole,
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
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setForm(getInitialFormState(completeProfile));
      const base = buildInitialState(completeProfile);
      setPreferredRegionsArr(fromDelimitedString(base.preferredRegions));
      setAvailabilityType((base.coachAvailabilityType as AvailabilityType) || "ITALY");
      setPreferredProvincesArr(fromDelimitedString(base.coachPreferredProvinces));
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

