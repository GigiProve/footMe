import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import type { PlayerExperienceForm, TeamAutocompleteOption } from "../../profiles/player-sports";
import { OnboardingInfoCard, OnboardingSectionCard } from "../onboarding-ui";
import type { PlayerCareerEntry } from "./player-career-types";
import {
  formsToPlayerEntries,
  generatePlayerEntryId,
  playerEntriesToForms,
  splitPlayerEntryBySeasonDetails,
} from "./player-career-utils";
import { PlayerCareerExperienceCard } from "./PlayerCareerExperienceCard";
import { PlayerExperienceForm as PlayerExperienceFormComponent } from "./PlayerExperienceForm";
import { PlayerExperienceTypeSelector } from "./PlayerExperienceTypeSelector";

// ---------------------------------------------------------------------------
// Internal flow screens
// ---------------------------------------------------------------------------

type FlowScreen =
  | { type: "list" }
  | { type: "select-type" }
  | { type: "form"; entry: PlayerCareerEntry; editIndex: number | null };

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type CareerExperienceStepProps = {
  addButtonLabel?: string;
  careerEntries: PlayerExperienceForm[];
  emptyMessage?: string;
  isBusy: boolean;
  onSaveAndContinue: () => void;
  onSkip: () => void;
  onUpdateEntries: (entries: PlayerExperienceForm[]) => void;
  searchTeams: (query: string) => Promise<TeamAutocompleteOption[]>;
  subtitle?: string;
  title?: string;
};

// ---------------------------------------------------------------------------
// CareerExperienceStep
// ---------------------------------------------------------------------------

export function CareerExperienceStep({
  addButtonLabel = "Aggiungi esperienza",
  careerEntries,
  emptyMessage = "Puoi aggiungere le tue esperienze calcistiche ora oppure farlo in seguito dal tuo profilo.",
  isBusy,
  onSaveAndContinue,
  onSkip,
  onUpdateEntries,
  searchTeams,
  subtitle = "Aggiungi le tue esperienze calcistiche per completare il tuo profilo.",
  title = "La tua carriera",
}: CareerExperienceStepProps) {
  const [screen, setScreen] = useState<FlowScreen>({ type: "list" });

  // Reconstruct PlayerCareerEntry[] from existing form entries
  const entries = formsToPlayerEntries(careerEntries);
  const hasEntries = entries.length > 0;

  // ----------------------------------
  // Handlers
  // ----------------------------------

  function handleSelectType(type: PlayerCareerEntry["type"]) {
    setScreen({
      type: "form",
      entry: {
        id: generatePlayerEntryId(),
        teamName: "",
        category: "",
        type,
        seasons: [],
        period: null,
        seasonDetails: {},
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

  function handleFormSave(saved: PlayerCareerEntry) {
    const editIndex = screen.type === "form" ? screen.editIndex : null;
    const splitEntries = splitPlayerEntryBySeasonDetails(saved);
    let updated: PlayerCareerEntry[];

    if (editIndex !== null) {
      updated = [
        ...entries.slice(0, editIndex),
        ...splitEntries,
        ...entries.slice(editIndex + 1),
      ];
    } else {
      updated = [...entries, ...splitEntries];
    }

    onUpdateEntries(playerEntriesToForms(updated));
    setScreen({ type: "list" });
  }

  function handleFormCancel() {
    setScreen({ type: "list" });
  }

  // ----------------------------------
  // Render: Type Selector
  // ----------------------------------

  if (screen.type === "select-type") {
    return (
      <View style={stepStyles.container}>
        <OnboardingSectionCard>
          <PlayerExperienceTypeSelector onSelect={handleSelectType} />
        </OnboardingSectionCard>
      </View>
    );
  }

  // ----------------------------------
  // Render: Form
  // ----------------------------------

  if (screen.type === "form") {
    const typeLabels: Record<PlayerCareerEntry["type"], string> = {
      MULTI_SEASON: "Più stagioni",
      SINGLE_SEASON: "Singola stagione",
      CUSTOM_PERIOD: "Periodo personalizzato",
    };
    const typeBadge = typeLabels[screen.entry.type];

    return (
      <View style={stepStyles.container}>
        <OnboardingSectionCard>
          <View style={stepStyles.formBadgeRow}>
            <View style={stepStyles.typeBadge}>
              <AppText variant="caption" style={stepStyles.typeBadgeText}>
                {typeBadge}
              </AppText>
            </View>
          </View>

          <PlayerExperienceFormComponent
            entry={screen.entry}
            isEditing={screen.editIndex !== null}
            onCancel={handleFormCancel}
            onSave={handleFormSave}
            searchTeams={searchTeams}
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
      <OnboardingSectionCard title={title} subtitle={subtitle}>
        {!hasEntries ? (
          <View style={stepStyles.emptyIcon}>
            <Ionicons name="trophy-outline" size={48} color={colors.accent} />
          </View>
        ) : null}

        {!hasEntries ? (
          <OnboardingInfoCard message={emptyMessage} />
        ) : null}

        {entries.map((entry, index) => (
          <PlayerCareerExperienceCard
            entry={entry}
            key={entry.id}
            onEdit={() => handleEdit(index)}
          />
        ))}

        <Button
          label={addButtonLabel}
          leftIcon={
            <Ionicons name="add-outline" size={20} color={colors.accent} />
          }
          onPress={() => setScreen({ type: "select-type" })}
          variant="secondary"
        />
      </OnboardingSectionCard>

      <Button
        disabled={isBusy}
        label={isBusy ? "Salvataggio..." : "Continua"}
        onPress={hasEntries ? onSaveAndContinue : onSkip}
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
  formBadgeRow: {
    flexDirection: "row",
  },
  typeBadge: {
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[4],
    borderRadius: radius.full,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  typeBadgeText: {
    color: colors.accentStrong,
  },
});
