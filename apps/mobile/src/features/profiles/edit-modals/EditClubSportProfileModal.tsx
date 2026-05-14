import { useEffect, useState } from "react";
import { Alert } from "react-native";

import { Input, SectionCard } from "../../../ui";
import type { CompleteProfessionalProfile } from "../profile-service";
import { updateClubSportProfile } from "../../clubs/club-service";
import { fromDelimitedString, toDelimitedString } from "../profile-edit-helpers";
import { EditModalShell } from "./EditModalShell";

type EditClubSportProfileModalProps = {
  completeProfile: CompleteProfessionalProfile;
  onClose: () => void;
  onSaved: () => void;
  userId: string;
  visible: boolean;
};

export function EditClubSportProfileModal({
  completeProfile,
  onClose,
  onSaved,
  userId,
  visible,
}: EditClubSportProfileModalProps) {
  const club = completeProfile.club;
  const [sportsFocus, setSportsFocus] = useState(club?.sports_focus ?? "");
  const [topLevelReached, setTopLevelReached] = useState(
    club?.top_level_reached ?? "",
  );
  const [keyResults, setKeyResults] = useState(
    toDelimitedString(club?.key_results ?? []),
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setSportsFocus(club?.sports_focus ?? "");
    setTopLevelReached(club?.top_level_reached ?? "");
    setKeyResults(toDelimitedString(club?.key_results ?? []));
    setIsSaving(false);
  }, [club?.key_results, club?.sports_focus, club?.top_level_reached, visible]);

  async function handleSave() {
    if (!club) {
      return;
    }

    setIsSaving(true);

    try {
      await updateClubSportProfile({
        clubId: club.id,
        keyResults: fromDelimitedString(keyResults),
        ownerProfileId: userId,
        sportsFocus: sportsFocus.trim() || null,
        topLevelReached: topLevelReached.trim() || null,
      });
      onSaved();
    } catch (error) {
      Alert.alert(
        "Errore",
        error instanceof Error
          ? error.message
          : "Impossibile salvare il profilo sportivo.",
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
      title="Profilo sportivo"
      visible={visible}
    >
      <SectionCard
        description="Informazioni stabili, sintetiche e non live."
        title="Identità sportiva"
      >
        <Input
          label="Focus sportivo"
          multiline
          onChangeText={setSportsFocus}
          placeholder="Es. Valorizzazione giovani e continuità tra vivaio e prima squadra"
          value={sportsFocus}
        />
        <Input
          label="Massimo livello raggiunto"
          onChangeText={setTopLevelReached}
          placeholder="Es. Serie C"
          value={topLevelReached}
        />
        <Input
          label="Risultati stabili"
          multiline
          onChangeText={setKeyResults}
          placeholder="Uno o più risultati separati da virgola"
          value={keyResults}
        />
      </SectionCard>
    </EditModalShell>
  );
}
