import { useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import type { PlayerExperienceForm } from "../player-sports";
import { sortPlayerExperiencesBySeason } from "../player-sports";
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
import { colors } from "../../../theme/tokens";
import { AppText, Button, Card } from "../../../ui";
import { PlayerCareerExperienceCard } from "../../onboarding/career/PlayerCareerExperienceCard";
import { PlayerExperienceForm as PlayerExperienceFormComponent } from "../../onboarding/career/PlayerExperienceForm";
import { PlayerExperienceTypeSelector } from "../../onboarding/career/PlayerExperienceTypeSelector";
import type { PlayerCareerEntry } from "../../onboarding/career/player-career-types";
import {
  formsToPlayerEntries,
  generatePlayerEntryId,
  playerEntriesToForms,
  splitPlayerEntryBySeasonDetails,
} from "../../onboarding/career/player-career-utils";
import { EditModalShell } from "./EditModalShell";

type FlowScreen =
  | { type: "list" }
  | { type: "select-type" }
  | { type: "form"; editIndex: number | null; entry: PlayerCareerEntry };

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
  const [screen, setScreen] = useState<FlowScreen>({ type: "list" });

  const groupedEntries = useMemo(
    () => formsToPlayerEntries(sortPlayerExperiencesBySeason(careerEntries)),
    [careerEntries],
  );

  useEffect(() => {
    if (visible) {
      setCareerEntries(buildInitialState(completeProfile).careerEntries);
      setScreen({ type: "list" });
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

  function handleSelectType(type: PlayerCareerEntry["type"]) {
    setScreen({
      type: "form",
      editIndex: null,
      entry: {
        clubId: null,
        id: generatePlayerEntryId(),
        teamName: "",
        teamCity: "",
        teamLogoUrl: "",
        category: "",
        type,
        seasons: [],
        period: null,
        seasonDetails: {},
      },
    });
  }

  function handleEdit(index: number) {
    setScreen({
      type: "form",
      editIndex: index,
      entry: { ...groupedEntries[index] },
    });
  }

  function handleDelete(index: number) {
    const nextEntries = groupedEntries.filter((_, currentIndex) => currentIndex !== index);
    setCareerEntries(sortPlayerExperiencesBySeason(playerEntriesToForms(nextEntries)));
  }

  function handleFormSave(saved: PlayerCareerEntry) {
    const splitEntries = splitPlayerEntryBySeasonDetails(saved);
    const editIndex = screen.type === "form" ? screen.editIndex : null;
    const nextEntries =
      editIndex === null
        ? [...groupedEntries, ...splitEntries]
        : [
            ...groupedEntries.slice(0, editIndex),
            ...splitEntries,
            ...groupedEntries.slice(editIndex + 1),
          ];

    setCareerEntries(sortPlayerExperiencesBySeason(playerEntriesToForms(nextEntries)));
    setScreen({ type: "list" });
  }

  return (
    <EditModalShell
      isSaving={isSaving}
      onClose={onClose}
      onSave={handleSave}
      saveDisabled={screen.type !== "list"}
      title="Esperienze calcistiche"
      visible={visible}
    >
      {screen.type === "select-type" ? (
        <PlayerExperienceTypeSelector
          onSelect={handleSelectType}
          subtitle="Scegli come vuoi inserire questa esperienza."
          title="Aggiungi esperienza"
        />
      ) : null}

      {screen.type === "form" ? (
        <>
          <Card variant="muted">
            <AppText variant="caption" color="secondary">
              {screen.entry.type === "MULTI_SEASON"
                ? "PIU' STAGIONI"
                : screen.entry.type === "SINGLE_SEASON"
                  ? "SINGOLA STAGIONE"
                  : "PERIODO PERSONALIZZATO"}
            </AppText>
          </Card>
          <PlayerExperienceFormComponent
            entry={screen.entry}
            existingEntries={groupedEntries}
            isEditing={screen.editIndex !== null}
            onCancel={() => setScreen({ type: "list" })}
            onSave={handleFormSave}
            searchTeams={searchTeams}
          />
        </>
      ) : null}

      {screen.type === "list" ? (
        <>
          {groupedEntries.length === 0 ? (
            <Card variant="muted">
              <AppText color="secondary">
                Aggiungi le tue esperienze calcistiche. Puoi inserirle come più
                stagioni complete, singola stagione o periodo personalizzato.
              </AppText>
            </Card>
          ) : null}

          {groupedEntries.map((entry, index) => (
            <PlayerCareerExperienceCard
              entry={entry}
              key={entry.id}
              onDelete={() => handleDelete(index)}
              onEdit={() => handleEdit(index)}
            />
          ))}

          <Button
            label="Aggiungi esperienza"
            leftIcon={<Ionicons color={colors.accent} name="add-outline" size={20} />}
            onPress={() => setScreen({ type: "select-type" })}
            variant="secondary"
          />
        </>
      ) : null}
    </EditModalShell>
  );
}
