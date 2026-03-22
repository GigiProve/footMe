import { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { AvailabilityRegionsSelector } from "../../../components/ui/availability-regions-selector";
import { InterestCategoriesSelector } from "../../../components/ui/interest-categories-selector";
import { MediaPickerField } from "../../../components/ui/media-picker-field";
import { WheelPicker } from "../../../components/ui/wheel-picker";
import { spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import {
  pickAndUploadMedia,
  ProfileMediaUploadError,
  removeMediaFromStorage,
  type UploadedMediaItem,
} from "../media-upload-service";
import {
  excludePrimaryFromSecondaryPositions,
  type PlayerPosition,
  type PreferredFoot,
} from "../player-sports";
import {
  PlayerCharacteristicsSection,
} from "../player-sports-section";
import {
  buildFullUpdatePayload,
  buildInitialState,
  fromDelimitedString,
  parseWheelValue,
} from "../profile-edit-helpers";
import { validateBirthDateInput } from "../profile-form-utils";
import type { CompleteProfessionalProfile } from "../profile-service";
import {
  updateCompleteProfessionalProfile,
} from "../profile-service";
import { EditModalShell } from "./EditModalShell";

type PlayerSportsFormState = {
  heightCm: string;
  highlightVideoUrl: string;
  preferredCategories: string;
  preferredFoot: PreferredFoot | "";
  primaryPosition: PlayerPosition;
  secondaryPositions: PlayerPosition[];
  transferRegions: string;
  weightKg: string;
  willingToChangeClub: boolean;
};

type EditPlayerSportsModalProps = {
  completeProfile: CompleteProfessionalProfile;
  onClose: () => void;
  onSaved: () => void;
  userId: string;
  visible: boolean;
};

function buildFormFromProfile(
  completeProfile: CompleteProfessionalProfile,
): PlayerSportsFormState {
  const state = buildInitialState(completeProfile);
  return {
    heightCm: state.heightCm,
    highlightVideoUrl: state.highlightVideoUrl,
    preferredCategories: state.preferredCategories,
    preferredFoot: state.preferredFoot,
    primaryPosition: state.primaryPosition,
    secondaryPositions: state.secondaryPositions,
    transferRegions: state.transferRegions,
    weightKg: state.weightKg,
    willingToChangeClub: state.willingToChangeClub,
  };
}

export function EditPlayerSportsModal({
  completeProfile,
  onClose,
  onSaved,
  userId,
  visible,
}: EditPlayerSportsModalProps) {
  const [form, setForm] = useState<PlayerSportsFormState>(
    buildFormFromProfile(completeProfile),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setForm(buildFormFromProfile(completeProfile));
      setUploadingField(null);
    }
  }, [visible, completeProfile]);

  function handlePrimaryPositionChange(value: PlayerPosition) {
    setForm((prev) => ({
      ...prev,
      primaryPosition: value,
      secondaryPositions: excludePrimaryFromSecondaryPositions(
        prev.secondaryPositions,
        value,
      ),
    }));
  }

  function handleSecondaryPositionsChange(value: PlayerPosition[]) {
    setForm((prev) => ({
      ...prev,
      secondaryPositions: excludePrimaryFromSecondaryPositions(
        value,
        prev.primaryPosition,
      ),
    }));
  }

  async function handleHighlightVideoPick() {
    setUploadingField("highlightVideo");

    try {
      const results: UploadedMediaItem[] = await pickAndUploadMedia({
        folder: "highlights",
        mediaTypes: ["videos"],
        userId,
      });

      if (results.length === 0) {
        setUploadingField(null);
        return;
      }

      const previousUrl = form.highlightVideoUrl;
      setForm((prev) => ({ ...prev, highlightVideoUrl: results[0].url }));

      if (previousUrl) {
        try {
          await removeMediaFromStorage(previousUrl);
        } catch {
          // Best-effort cleanup of old video
        }
      }
    } catch (error) {
      const message =
        error instanceof ProfileMediaUploadError
          ? error.message
          : "Caricamento video non riuscito.";
      Alert.alert("Errore", message);
    } finally {
      setUploadingField(null);
    }
  }

  async function handleHighlightVideoRemove() {
    const previousUrl = form.highlightVideoUrl;
    setForm((prev) => ({ ...prev, highlightVideoUrl: "" }));

    if (previousUrl) {
      try {
        await removeMediaFromStorage(previousUrl);
      } catch {
        // Best-effort cleanup
      }
    }
  }

  async function handleSave() {
    setIsSaving(true);

    try {
      const baseState = buildInitialState(completeProfile);
      const mergedState = {
        ...baseState,
        heightCm: form.heightCm,
        highlightVideoUrl: form.highlightVideoUrl,
        preferredCategories: form.preferredCategories,
        preferredFoot: form.preferredFoot,
        primaryPosition: form.primaryPosition,
        secondaryPositions: form.secondaryPositions,
        transferRegions: form.transferRegions,
        weightKg: form.weightKg,
        willingToChangeClub: form.willingToChangeClub,
      };
      const payload = buildFullUpdatePayload(completeProfile, mergedState);
      payload.profile.birth_date =
        validateBirthDateInput(baseState.birthDate).isoValue;

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
      title="Informazioni sportive"
      visible={visible}
    >
      <PlayerCharacteristicsSection
        editable
        onPreferredFootChange={(value) =>
          setForm((prev) => ({ ...prev, preferredFoot: value }))
        }
        onPrimaryPositionChange={handlePrimaryPositionChange}
        onSecondaryPositionsChange={handleSecondaryPositionsChange}
        preferredFoot={form.preferredFoot}
        primaryPosition={form.primaryPosition}
        secondaryPositions={form.secondaryPositions}
      />

      <InterestCategoriesSelector
        label="Categorie preferite"
        onChange={(value) =>
          setForm((prev) => ({
            ...prev,
            preferredCategories: value.join(", "),
          }))
        }
        value={fromDelimitedString(form.preferredCategories)}
      />

      <AvailabilityRegionsSelector
        label="Regioni di interesse"
        onChange={(value) =>
          setForm((prev) => ({
            ...prev,
            transferRegions: value.join(", "),
          }))
        }
        value={fromDelimitedString(form.transferRegions)}
      />

      <MediaPickerField
        buttonLabel="Carica video"
        isUploading={uploadingField === "highlightVideo"}
        label="Video highlights"
        mediaType="video"
        onPick={handleHighlightVideoPick}
        onRemove={handleHighlightVideoRemove}
        previewUrl={form.highlightVideoUrl || null}
        removable={Boolean(form.highlightVideoUrl)}
        removeLabel="Rimuovi video"
      />

      <View style={styles.booleanField}>
        <AppText style={styles.booleanLabel}>
          Disponibile a cambiare squadra
        </AppText>
        <View style={styles.booleanRow}>
          <Button
            label="Si"
            onPress={() =>
              setForm((prev) => ({ ...prev, willingToChangeClub: true }))
            }
            variant={form.willingToChangeClub ? "primary" : "chipAction"}
          />
          <Button
            label="No"
            onPress={() =>
              setForm((prev) => ({ ...prev, willingToChangeClub: false }))
            }
            variant={!form.willingToChangeClub ? "primary" : "chipAction"}
          />
        </View>
      </View>

      <View style={styles.physicalSection}>
        <AppText style={styles.physicalLabel}>Informazioni fisiche</AppText>
        <View style={styles.wheelRow}>
          <View style={styles.wheelCell}>
            <WheelPicker
              label="Altezza"
              max={220}
              min={140}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, heightCm: String(value) }))
              }
              unit="cm"
              value={parseWheelValue(form.heightCm)}
            />
          </View>
          <View style={styles.wheelCell}>
            <WheelPicker
              label="Peso"
              max={130}
              min={40}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, weightKg: String(value) }))
              }
              unit="kg"
              value={parseWheelValue(form.weightKg)}
            />
          </View>
        </View>
      </View>
    </EditModalShell>
  );
}

const styles = StyleSheet.create({
  booleanField: {
    gap: spacing[8],
  },
  booleanLabel: {
    fontWeight: "600",
  },
  booleanRow: {
    flexDirection: "row",
    gap: spacing[8],
  },
  physicalLabel: {
    fontWeight: "600",
  },
  physicalSection: {
    gap: spacing[12],
  },
  wheelCell: {
    flex: 1,
  },
  wheelRow: {
    flexDirection: "row",
    gap: spacing[12],
  },
});
