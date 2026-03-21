import { useEffect, useState } from "react";
import { Alert } from "react-native";

import type { CompleteProfessionalProfile } from "../profile-service";

import type { ClubSeasonForm } from "../club-season-section";
import { ClubSeasonsSection } from "../club-season-section";
import { buildFullUpdatePayload, buildInitialState } from "../profile-edit-helpers";
import { validateBirthDateInput } from "../profile-form-utils";
import { updateCompleteProfessionalProfile } from "../profile-service";
import { EditModalShell } from "./EditModalShell";

type ClubSeasonsFormState = {
  clubSeasonEntries: ClubSeasonForm[];
};

type EditClubSeasonsModalProps = {
  completeProfile: CompleteProfessionalProfile;
  onClose: () => void;
  onSaved: () => void;
  userId: string;
  visible: boolean;
};

function getInitialFormState(
  completeProfile: CompleteProfessionalProfile,
): ClubSeasonsFormState {
  const base = buildInitialState(completeProfile);
  return {
    clubSeasonEntries: base.clubSeasonEntries,
  };
}

export function EditClubSeasonsModal({
  completeProfile,
  onClose,
  onSaved,
  userId,
  visible,
}: EditClubSeasonsModalProps) {
  const [formState, setFormState] = useState<ClubSeasonsFormState>(() =>
    getInitialFormState(completeProfile),
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setFormState(getInitialFormState(completeProfile));
    }
  }, [visible, completeProfile]);

  async function handleSave() {
    setIsSaving(true);

    try {
      const baseState = buildInitialState(completeProfile);
      const mergedState = {
        ...baseState,
        clubSeasonEntries: formState.clubSeasonEntries,
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
      title="Storico stagioni"
      visible={visible}
    >
      <ClubSeasonsSection
        editable
        onChange={(seasons) =>
          setFormState((prev) => ({ ...prev, clubSeasonEntries: seasons }))
        }
        seasons={formState.clubSeasonEntries}
      />
    </EditModalShell>
  );
}
