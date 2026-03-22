import { useEffect, useState } from "react";
import { Alert } from "react-native";

import type { PlayerExperienceForm } from "../player-sports";
import {
  PlayerExperiencesSection,
} from "../player-sports-section";
import {
  buildFullUpdatePayload,
  buildInitialState,
} from "../profile-edit-helpers";
import { validateBirthDateInput } from "../profile-form-utils";
import type { CompleteProfessionalProfile } from "../profile-service";
import {
  searchTeams,
  updateCompleteProfessionalProfile,
} from "../profile-service";
import { EditModalShell } from "./EditModalShell";

type EditPlayerExperiencesModalProps = {
  completeProfile: CompleteProfessionalProfile;
  onClose: () => void;
  onSaved: () => void;
  visible: boolean;
};

export function EditPlayerExperiencesModal({
  completeProfile,
  onClose,
  onSaved,
  visible,
}: EditPlayerExperiencesModalProps) {
  const [careerEntries, setCareerEntries] = useState<PlayerExperienceForm[]>(
    () => buildInitialState(completeProfile).careerEntries,
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setCareerEntries(buildInitialState(completeProfile).careerEntries);
    }
  }, [visible, completeProfile]);

  async function handleSave() {
    setIsSaving(true);

    try {
      const baseState = buildInitialState(completeProfile);
      const mergedState = {
        ...baseState,
        careerEntries,
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
      title="Esperienze calcistiche"
      visible={visible}
    >
      <PlayerExperiencesSection
        editable
        experiences={careerEntries}
        onChange={setCareerEntries}
        searchTeams={searchTeams}
        showHeader={false}
      />
    </EditModalShell>
  );
}
