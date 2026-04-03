import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import type { TeamAutocompleteOption } from "../../profiles/player-sports";
import { OnboardingInfoCard, OnboardingSectionCard } from "../onboarding-ui";
import type { CoachCareerEntry, CoachExperienceType } from "./coach-career-types";
import { generateCoachEntryId, splitCoachEntryBySeasonDetails } from "./coach-career-utils";
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
  addButtonLabel?: string;
  defaultRole?: string;
  emptyMessage?: string;
  entries: CoachCareerEntry[];
  subtitle?: string;
  isBusy: boolean;
  onContinue: () => void;
  onRegisterBack?: (fn: (() => void) | null) => void;
  onSkip: () => void;
  onUpdateEntries: (entries: CoachCareerEntry[]) => void;
  roleOptions?: { label: string; value: string }[];
  searchTeams: (query: string) => Promise<TeamAutocompleteOption[]>;
  selectorSubtitle?: string;
  selectorTitle?: string;
  title?: string;
  typeOptions?: {
    icon: keyof typeof Ionicons.glyphMap;
    subtitle: string;
    title: string;
    type: CoachExperienceType;
  }[];
};

// ---------------------------------------------------------------------------
// CoachCareerStep
// ---------------------------------------------------------------------------

export function CoachCareerStep({
  addButtonLabel = "Aggiungi esperienza",
  defaultRole = "",
  emptyMessage = "Puoi aggiungere le tue esperienze ora oppure farlo in seguito dal tuo profilo.",
  entries,
  subtitle = "Aggiungi le tue esperienze come allenatore per completare il tuo profilo.",
  isBusy,
  onContinue,
  onRegisterBack,
  onSkip,
  onUpdateEntries,
  roleOptions,
  searchTeams,
  selectorSubtitle,
  selectorTitle,
  title = "Carriera da allenatore",
  typeOptions,
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
        role: defaultRole,
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

  function handleFormSave(saved: CoachCareerEntry) {
    const editIndex = screen.type === "form" ? screen.editIndex : null;
    const splitEntries = splitCoachEntryBySeasonDetails(saved);
    let updated: CoachCareerEntry[];

    if (editIndex !== null) {
      updated = [
        ...entries.slice(0, editIndex),
        ...splitEntries,
        ...entries.slice(editIndex + 1),
      ];
    } else {
      updated = [...entries, ...splitEntries];
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
          <CoachExperienceTypeSelector
            onSelect={handleSelectType}
            options={typeOptions}
            subtitle={selectorSubtitle}
            title={selectorTitle}
          />
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
            roleOptions={roleOptions}
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
        title={title}
        subtitle={subtitle}
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
          <OnboardingInfoCard message={emptyMessage} />
        ) : null}

        {entries.map((entry, index) => (
          <CoachCareerExperienceCard
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
