import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import type { TeamAutocompleteOption } from "../../profiles/player-sports";
import { OnboardingInfoCard, OnboardingSectionCard } from "../onboarding-ui";
import type { CoachCareerEntry, CoachExperienceType } from "./coach-career-types";
import { generateCoachEntryId } from "./coach-career-utils";
import { CoachCareerExperienceCard } from "./CoachCareerExperienceCard";
import { CoachExperienceForm } from "./CoachExperienceForm";
import { CoachExperienceTypeSelector } from "./CoachExperienceTypeSelector";

// ---------------------------------------------------------------------------
// Internal flow screens
// ---------------------------------------------------------------------------

type FlowScreen =
  | { type: "list" }
  | { type: "select-type" }
  | { type: "form"; entry: CoachCareerEntry; editIndex: number | null };

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type CoachCareerStepProps = {
  entries: CoachCareerEntry[];
  isBusy: boolean;
  onContinue: () => void;
  onRegisterBack?: (fn: (() => void) | null) => void;
  onSkip: () => void;
  onUpdateEntries: (entries: CoachCareerEntry[]) => void;
  searchTeams: (query: string) => Promise<TeamAutocompleteOption[]>;
};

// ---------------------------------------------------------------------------
// CoachCareerStep
// ---------------------------------------------------------------------------

export function CoachCareerStep({
  entries,
  isBusy,
  onContinue,
  onRegisterBack,
  onSkip,
  onUpdateEntries,
  searchTeams,
}: CoachCareerStepProps) {
  const [screen, setScreen] = useState<FlowScreen>({ type: "list" });

  const hasEntries = entries.length > 0;

  useEffect(() => {
    if (screen.type !== "list") {
      onRegisterBack?.(() => setScreen({ type: "list" }));
      return () => {
        onRegisterBack?.(null);
      };
    }
    onRegisterBack?.(null);
  }, [screen.type, onRegisterBack]);

  function handleSelectType(type: CoachExperienceType) {
    setScreen({
      type: "form",
      entry: {
        id: generateCoachEntryId(),
        teamName: "",
        category: "",
        role: "",
        type,
        seasons: [],
        period: null,
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

  function handleFormSave(saved: CoachCareerEntry) {
    const editIndex = screen.type === "form" ? screen.editIndex : null;
    let updated: CoachCareerEntry[];

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
  // Render: Type Selector
  // ----------------------------------

  if (screen.type === "select-type") {
    return (
      <View style={stepStyles.container}>
        <OnboardingSectionCard>
          <CoachExperienceTypeSelector onSelect={handleSelectType} />
        </OnboardingSectionCard>
      </View>
    );
  }

  // ----------------------------------
  // Render: Form
  // ----------------------------------

  if (screen.type === "form") {
    const typeLabels: Record<CoachExperienceType, string> = {
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

          <CoachExperienceForm
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
      <OnboardingSectionCard
        title="Carriera da allenatore"
        subtitle="Aggiungi le tue esperienze come allenatore per completare il tuo profilo."
      >
        {!hasEntries ? (
          <View style={stepStyles.emptyIcon}>
            <Ionicons
              name="clipboard-outline"
              size={48}
              color={colors.accent}
            />
          </View>
        ) : null}

        {!hasEntries ? (
          <OnboardingInfoCard message="Puoi aggiungere le tue esperienze da allenatore ora oppure farlo in seguito dal tuo profilo." />
        ) : null}

        {entries.map((entry, index) => (
          <CoachCareerExperienceCard
            entry={entry}
            key={entry.id}
            onEdit={() => handleEdit(index)}
          />
        ))}

        <Button
          label="Aggiungi esperienza"
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
        onPress={hasEntries ? onContinue : onSkip}
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
