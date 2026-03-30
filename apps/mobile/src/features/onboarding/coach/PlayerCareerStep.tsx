import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../theme/tokens";
import { Button } from "../../../ui";
import { OnboardingInfoCard, OnboardingSectionCard } from "../onboarding-ui";
import type { SimplePlayerCareerEntry } from "./coach-career-types";
import { generateCoachEntryId } from "./coach-career-utils";
import { SimplePlayerCareerCard } from "./SimplePlayerCareerCard";
import { SimplePlayerCareerForm } from "./SimplePlayerCareerForm";

// ---------------------------------------------------------------------------
// Internal flow screens
// ---------------------------------------------------------------------------

type FlowScreen =
  | { type: "list" }
  | { type: "form"; entry: SimplePlayerCareerEntry; editIndex: number | null };

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type PlayerCareerStepProps = {
  entries: SimplePlayerCareerEntry[];
  isBusy: boolean;
  onContinue: () => void;
  onUpdateEntries: (entries: SimplePlayerCareerEntry[]) => void;
};

// ---------------------------------------------------------------------------
// PlayerCareerStep
// ---------------------------------------------------------------------------

export function PlayerCareerStep({
  entries,
  isBusy,
  onContinue,
  onUpdateEntries,
}: PlayerCareerStepProps) {
  const [screen, setScreen] = useState<FlowScreen>({ type: "list" });

  const hasEntries = entries.length > 0;

  function handleAdd() {
    setScreen({
      type: "form",
      entry: {
        id: generateCoachEntryId(),
        teamName: "",
        season: "",
        category: "",
        position: "",
      },
      editIndex: null,
    });
  }

  function handleEdit(index: number) {
    setScreen({
      type: "form",
      entry: { ...entries[index] },
      editIndex: index,
    });
  }

  function handleFormSave(saved: SimplePlayerCareerEntry) {
    const editIndex = screen.type === "form" ? screen.editIndex : null;
    let updated: SimplePlayerCareerEntry[];

    if (editIndex !== null) {
      updated = entries.map((e, i) => (i === editIndex ? saved : e));
    } else {
      updated = [...entries, saved];
    }

    onUpdateEntries(updated);
    setScreen({ type: "list" });
  }

  function handleFormCancel() {
    setScreen({ type: "list" });
  }

  // ----------------------------------
  // Render: Form
  // ----------------------------------

  if (screen.type === "form") {
    return (
      <View style={stepStyles.container}>
        <OnboardingSectionCard>
          <SimplePlayerCareerForm
            entry={screen.entry}
            isEditing={screen.editIndex !== null}
            onCancel={handleFormCancel}
            onSave={handleFormSave}
          />
        </OnboardingSectionCard>
      </View>
    );
  }

  // ----------------------------------
  // Render: List
  // ----------------------------------

  return (
    <View style={stepStyles.container}>
      <OnboardingSectionCard
        title="Carriera da giocatore"
        subtitle="Aggiungi i tuoi trascorsi sul campo."
      >
        {!hasEntries ? (
          <View style={stepStyles.emptyIcon}>
            <Ionicons name="football-outline" size={48} color={colors.accent} />
          </View>
        ) : null}

        {!hasEntries ? (
          <OnboardingInfoCard message="Puoi aggiungere la tua carriera da giocatore ora oppure farlo in seguito dal tuo profilo." />
        ) : null}

        {entries.map((entry, index) => (
          <SimplePlayerCareerCard
            entry={entry}
            key={entry.id}
            onEdit={() => handleEdit(index)}
          />
        ))}

        <Button
          label="Aggiungi carriera"
          leftIcon={
            <Ionicons name="add-outline" size={20} color={colors.accent} />
          }
          onPress={handleAdd}
          variant="secondary"
        />
      </OnboardingSectionCard>

      <Button
        disabled={isBusy}
        label="Continua"
        onPress={onContinue}
        variant="primary"
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const stepStyles = StyleSheet.create({
  container: {
    gap: spacing[16],
  },
  emptyIcon: {
    alignItems: "center",
    paddingVertical: spacing[16],
  },
});
