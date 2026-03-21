import { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { MediaPickerField } from "../../../components/ui/media-picker-field";
import { colors, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import {
  pickAndUploadMedia,
  ProfileMediaUploadError,
  removeMediaFromStorage,
  type UploadedMediaItem,
} from "../media-upload-service";
import { buildFullUpdatePayload, buildInitialState } from "../profile-edit-helpers";
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
  preferredRegions: string;
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
    preferredRegions: base.preferredRegions,
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
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setForm(getInitialFormState(completeProfile));
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
        preferredRegions: form.preferredRegions,
        openToNewRole: form.openToNewRole,
      };

      const payload = buildFullUpdatePayload(completeProfile, mergedState);
      payload.profile.birth_date = validateBirthDateInput(baseState.birthDate).isoValue;

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

      <Field
        editable
        label="Aree di interesse"
        onChangeText={(value) => updateField("preferredRegions", value)}
        placeholder="Lombardia, Piemonte..."
        value={form.preferredRegions}
      />

      <View style={styles.booleanField}>
        <AppText variant="titleSm">
          Disponibile per nuove panchine
        </AppText>
        <View style={styles.booleanRow}>
          <Button
            label="Si"
            onPress={() => updateField("openToNewRole", true)}
            selected={form.openToNewRole}
            variant="chipAction"
          />
          <Button
            label="No"
            onPress={() => updateField("openToNewRole", false)}
            selected={!form.openToNewRole}
            variant="chipAction"
          />
        </View>
      </View>
    </EditModalShell>
  );
}

const styles = StyleSheet.create({
  booleanField: {
    gap: spacing[8],
  },
  booleanRow: {
    flexDirection: "row",
    gap: spacing[10],
  },
});
