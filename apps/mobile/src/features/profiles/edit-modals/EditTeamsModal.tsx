import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { SelectField } from "../../../components/ui/select-field";
import {
  SENIOR_CATEGORY_OPTIONS,
  YOUTH_CATEGORY_OPTIONS,
} from "../player-sports";
import { spacing } from "../../../theme/tokens";
import { AppText, Button, SectionCard } from "../../../ui";
import {
  deleteClubTeam,
  insertClubTeams,
  upsertClubTeam,
  type ClubTeam,
} from "../../clubs/team-service";
import { EditModalShell } from "./EditModalShell";

type YouthDraft = {
  category: string;
  existingId: string | null;
};

type EditTeamsModalProps = {
  clubId: string;
  clubName: string;
  onClose: () => void;
  onSaved: () => void;
  teams: ClubTeam[];
  visible: boolean;
};

export function EditTeamsModal({
  clubId,
  clubName,
  onClose,
  onSaved,
  teams,
  visible,
}: EditTeamsModalProps) {
  const seniorTeam = teams.find((t) => t.team_type === "senior");
  const youthTeams = teams.filter((t) => t.team_type === "youth");

  const [seniorCategory, setSeniorCategory] = useState(
    seniorTeam?.category ?? "",
  );
  const [youthDrafts, setYouthDrafts] = useState<YouthDraft[]>(
    youthTeams.map((t) => ({ category: t.category, existingId: t.id })),
  );
  const [isSaving, setIsSaving] = useState(false);

  function handleAddYouth() {
    setYouthDrafts((prev) => [...prev, { category: "", existingId: null }]);
  }

  function handleRemoveYouth(index: number) {
    setYouthDrafts((prev) => prev.filter((_, i) => i !== index));
  }

  function handleYouthCategoryChange(index: number, value: string) {
    setYouthDrafts((prev) =>
      prev.map((draft, i) =>
        i === index ? { ...draft, category: value } : draft,
      ),
    );
  }

  async function handleSave() {
    if (!seniorCategory.trim()) {
      Alert.alert("Errore", "Seleziona la categoria della prima squadra");
      return;
    }

    const invalidYouth = youthDrafts.some((d) => !d.category.trim());
    if (invalidYouth) {
      Alert.alert(
        "Errore",
        "Seleziona la categoria per ogni squadra giovanile",
      );
      return;
    }

    setIsSaving(true);

    try {
      // Upsert senior team
      if (seniorTeam) {
        await upsertClubTeam({
          ...seniorTeam,
          category: seniorCategory.trim(),
        });
      } else {
        await upsertClubTeam({
          category: seniorCategory.trim(),
          city: null,
          club_id: clubId,
          inherited: false,
          logo_url: null,
          name: clubName,
          parent_team_id: null,
          region: null,
          sort_order: 0,
          team_type: "senior",
        });
      }

      // Fetch updated senior ID for parent reference
      const updatedSeniorId = seniorTeam?.id;

      // Delete removed youth teams
      const keptIds = new Set(
        youthDrafts.filter((d) => d.existingId).map((d) => d.existingId!),
      );
      const removedYouth = youthTeams.filter((t) => !keptIds.has(t.id));
      for (const removed of removedYouth) {
        await deleteClubTeam(removed.id);
      }

      // Update existing youth teams
      for (const draft of youthDrafts) {
        if (draft.existingId) {
          const existing = youthTeams.find((t) => t.id === draft.existingId);
          if (existing && existing.category !== draft.category) {
            await upsertClubTeam({
              ...existing,
              category: draft.category.trim(),
            });
          }
        }
      }

      // Insert new youth teams
      const newYouth = youthDrafts
        .filter((d) => !d.existingId)
        .map((d, index) => ({
          category: d.category.trim(),
          city: seniorTeam?.city ?? null,
          club_id: clubId,
          inherited: true,
          logo_url: seniorTeam?.logo_url ?? null,
          name: clubName,
          parent_team_id: updatedSeniorId ?? null,
          region: seniorTeam?.region ?? null,
          sort_order: youthTeams.length + index + 1,
          team_type: "youth" as const,
        }));

      if (newYouth.length > 0) {
        await insertClubTeams(newYouth);
      }

      onSaved();
    } catch {
      Alert.alert("Errore", "Impossibile salvare le squadre");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <EditModalShell
      isSaving={isSaving}
      onClose={onClose}
      onSave={handleSave}
      title="Gestisci squadre"
      visible={visible}
    >
      <SectionCard title="Prima squadra">
        <SelectField
          label="Categoria *"
          onChange={setSeniorCategory}
          options={SENIOR_CATEGORY_OPTIONS}
          placeholder="Seleziona la categoria"
          value={seniorCategory}
        />
      </SectionCard>

      <SectionCard title="Settore giovanile">
        {youthDrafts.length === 0 ? (
          <AppText variant="bodySm" color="muted">
            Nessuna squadra giovanile
          </AppText>
        ) : (
          youthDrafts.map((draft, index) => (
            <View
              key={draft.existingId ?? `new-${index}`}
              style={styles.youthRow}
            >
              <View style={styles.youthFieldContainer}>
                <SelectField
                  label={`Squadra giovanile ${index + 1}`}
                  onChange={(value) => handleYouthCategoryChange(index, value)}
                  options={YOUTH_CATEGORY_OPTIONS}
                  placeholder="Seleziona categoria"
                  value={draft.category}
                />
              </View>
              <Button
                label="Rimuovi"
                onPress={() => handleRemoveYouth(index)}
                size="sm"
                variant="danger"
              />
            </View>
          ))
        )}
        <Button
          label="Aggiungi squadra giovanile"
          onPress={handleAddYouth}
          size="sm"
          variant="secondary"
        />
      </SectionCard>
    </EditModalShell>
  );
}

const styles = StyleSheet.create({
  youthFieldContainer: {
    flex: 1,
  },
  youthRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: spacing[10],
  },
});
