import { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { BioInput } from "../bio-section";
import { MediaPickerField } from "../../../components/ui/media-picker-field";
import {
  pickAndUploadMedia,
  ProfileMediaUploadError,
  removeMediaFromStorage,
  type UploadedMediaItem,
} from "../media-upload-service";
import { withDefaultProfileAvatar } from "../profile-avatar";
import {
  buildFullUpdatePayload,
  buildInitialState,
} from "../profile-edit-helpers";
import {
  normalizeProfileBioInput,
  validateBirthDateInput,
  validateProfileBio,
} from "../profile-form-utils";
import type { CompleteProfessionalProfile } from "../profile-service";
import { updateCompleteProfessionalProfile } from "../profile-service";
import { AppText, Button } from "../../../ui";
import { colors, spacing } from "../../../theme/tokens";
import { EditModalShell } from "./EditModalShell";

type BioFormState = {
  avatarUrl: string;
  bio: string;
  isOpenToTransfer: boolean;
};

type EditBioModalProps = {
  completeProfile: CompleteProfessionalProfile;
  onClose: () => void;
  onSaved: () => void;
  userId: string;
  visible: boolean;
};

function BooleanField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <View style={styles.booleanField}>
      <AppText style={styles.booleanLabel}>{label}</AppText>
      <View style={styles.booleanRow}>
        <Button
          label="Si"
          onPress={() => onChange(true)}
          variant={value ? "primary" : "chipAction"}
        />
        <Button
          label="No"
          onPress={() => onChange(false)}
          variant={!value ? "primary" : "chipAction"}
        />
      </View>
    </View>
  );
}

export function EditBioModal({
  completeProfile,
  onClose,
  onSaved,
  userId,
  visible,
}: EditBioModalProps) {
  const [form, setForm] = useState<BioFormState>({
    avatarUrl: "",
    bio: "",
    isOpenToTransfer: false,
  });
  const [isBioTouched, setIsBioTouched] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isPlayer = completeProfile.profile.role === "player";

  useEffect(() => {
    if (visible) {
      setForm({
        avatarUrl: completeProfile.profile.avatar_url ?? "",
        bio: completeProfile.profile.bio ?? "",
        isOpenToTransfer: completeProfile.profile.is_open_to_transfer,
      });
      setIsBioTouched(false);
      setUploadingField(null);
    }
  }, [visible, completeProfile]);

  const bioValidation = validateProfileBio(form.bio);
  const bioError = isBioTouched && !bioValidation.isValid ? bioValidation.message : null;

  function handleBioChange(value: string) {
    setIsBioTouched(true);
    setForm((prev) => ({ ...prev, bio: normalizeProfileBioInput(value) }));
  }

  async function handleAvatarPick() {
    setUploadingField("avatar");

    try {
      const results: UploadedMediaItem[] = await pickAndUploadMedia({
        folder: "avatars",
        mediaTypes: ["images"],
        userId,
      });

      if (results.length === 0) {
        setUploadingField(null);
        return;
      }

      const previousUrl = form.avatarUrl;
      setForm((prev) => ({ ...prev, avatarUrl: results[0].url }));

      if (previousUrl) {
        try {
          await removeMediaFromStorage(previousUrl);
        } catch {
          // Best-effort cleanup of old avatar
        }
      }
    } catch (error) {
      const message =
        error instanceof ProfileMediaUploadError
          ? error.message
          : "Caricamento immagine non riuscito.";
      Alert.alert("Errore", message);
    } finally {
      setUploadingField(null);
    }
  }

  async function handleAvatarRemove() {
    const previousUrl = form.avatarUrl;
    setForm((prev) => ({ ...prev, avatarUrl: "" }));

    if (previousUrl) {
      try {
        await removeMediaFromStorage(previousUrl);
      } catch {
        // Best-effort cleanup
      }
    }
  }

  async function handleSave() {
    const validation = validateProfileBio(form.bio);

    if (!validation.isValid) {
      setIsBioTouched(true);
      Alert.alert("Attenzione", validation.message ?? "Bio non valida.");
      return;
    }

    setIsSaving(true);

    try {
      const baseState = buildInitialState(completeProfile);
      const mergedState = {
        ...baseState,
        avatarUrl: form.avatarUrl,
        bio: form.bio,
        isOpenToTransfer: form.isOpenToTransfer,
      };
      const payload = buildFullUpdatePayload(completeProfile, mergedState);
      payload.profile.birth_date = validateBirthDateInput(baseState.birthDate).isoValue;

      await updateCompleteProfessionalProfile(payload);
      onSaved();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Salvataggio non riuscito.";
      Alert.alert("Errore", message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <EditModalShell
      isSaving={isSaving}
      onClose={onClose}
      onSave={handleSave}
      title="Presentazione"
      visible={visible}
    >
      <MediaPickerField
        buttonLabel="Carica foto"
        isUploading={uploadingField === "avatar"}
        label="Foto profilo"
        onPick={handleAvatarPick}
        onRemove={handleAvatarRemove}
        previewUrl={withDefaultProfileAvatar(form.avatarUrl || null)}
        removable={Boolean(form.avatarUrl)}
        removeLabel="Rimuovi foto"
      />

      <BioInput
        errorMessage={bioError}
        onChangeText={handleBioChange}
        value={form.bio}
      />

      {isPlayer && (
        <BooleanField
          label="Aperto al trasferimento"
          onChange={(value) =>
            setForm((prev) => ({ ...prev, isOpenToTransfer: value }))
          }
          value={form.isOpenToTransfer}
        />
      )}
    </EditModalShell>
  );
}

const styles = StyleSheet.create({
  booleanField: {
    gap: spacing[8],
  },
  booleanLabel: {
    color: colors.textPrimary,
    fontWeight: "600",
  },
  booleanRow: {
    flexDirection: "row",
    gap: spacing[8],
  },
});
