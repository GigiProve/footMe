import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { ExperienceFlowScreen } from "../../profiles/experience-flow-section";
import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import type { CareerExperience } from "./career-types";
import {
  experiencesToForms,
  formsToExperiences,
  getExperienceTypeLabel,
} from "./career-utils";
import { ExperienceCard } from "./ExperienceCard";
import { ExperienceForm } from "./ExperienceForm";
import { OnboardingInfoCard, OnboardingSectionCard } from "../onboarding-ui";
import type {
  PlayerExperienceForm,
  TeamAutocompleteOption,
} from "../../profiles/player-sports";

// ---------------------------------------------------------------------------
// Internal screen states
// ---------------------------------------------------------------------------

type FlowScreen =
  | { type: "list" }
  | { type: "form"; experience: CareerExperience; editIndex: number | null };

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
  subtitle = "Aggiungi le tue esperienze calcistiche per completare il tuo profilo in modo accurato.",
  title = "La tua carriera",
}: CareerExperienceStepProps) {
  const [screen, setScreen] = useState<FlowScreen>({ type: "list" });
  const [flowOpen, setFlowOpen] = useState(false);

  // Reconstruct CareerExperience[] from existing form entries
  const experiences = formsToExperiences(careerEntries);

  // Group experiences by type for the list display
  const firstTeamExperiences = experiences.filter(
    (e) => e.type === "FIRST_TEAM",
  );
  const youthExperiences = experiences.filter((e) => e.type === "YOUTH");
  const hasExperiences = experiences.length > 0;

  // ----------------------------------
  // Handlers
  // ----------------------------------

  function handleEdit(index: number) {
    setScreen({
      type: "form",
      experience: { ...experiences[index] },
      editIndex: index,
    });
  }

  function handleFormSave(saved: CareerExperience) {
    const editIndex = screen.type === "form" ? screen.editIndex : null;

    let updated: CareerExperience[];

    if (editIndex !== null) {
      updated = experiences.map((e, i) => (i === editIndex ? saved : e));
    } else {
      updated = [...experiences, saved];
    }

    // Convert to PlayerExperienceForm[] and sync to parent
    onUpdateEntries(experiencesToForms(updated));
    setScreen({ type: "list" });
  }

  function handleFormCancel() {
    setScreen({ type: "list" });
  }

  function handleFlowSave(newEntries: PlayerExperienceForm[]) {
    onUpdateEntries([...careerEntries, ...newEntries]);
    setFlowOpen(false);
  }

  function handleContinue() {
    if (hasExperiences) {
      onSaveAndContinue();
    }
  }

  // ----------------------------------
  // Render: Form (add / edit)
  // ----------------------------------

  if (screen.type === "form") {
    const typeBadge = getExperienceTypeLabel(screen.experience.type);

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

          <ExperienceForm
            experience={screen.experience}
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
        title={title}
        subtitle={subtitle}
      >
        {!hasExperiences ? (
          <>
            <View style={stepStyles.emptyIcon}>
              <Ionicons name="trophy-outline" size={48} color={colors.accent} />
            </View>
            <OnboardingInfoCard message={emptyMessage} />
          </>
        ) : null}

        {/* First team section */}
        {firstTeamExperiences.length > 0 ? (
          <View style={stepStyles.typeSection}>
            <AppText variant="headingSm">Prima Squadra</AppText>
            {firstTeamExperiences.map((exp) => {
              const globalIndex = experiences.indexOf(exp);

              return (
                <ExperienceCard
                  experience={exp}
                  key={exp.id}
                  onEdit={() => handleEdit(globalIndex)}
                />
              );
            })}
          </View>
        ) : null}

        {/* Youth section */}
        {youthExperiences.length > 0 ? (
          <View style={stepStyles.typeSection}>
            <AppText variant="headingSm">Settore Giovanile</AppText>
            {youthExperiences.map((exp) => {
              const globalIndex = experiences.indexOf(exp);

              return (
                <ExperienceCard
                  experience={exp}
                  key={exp.id}
                  onEdit={() => handleEdit(globalIndex)}
                />
              );
            })}
          </View>
        ) : null}
        {/* Add experience button */}
        <Button
          label={addButtonLabel}
          fullWidth
          leftIcon={
            <Ionicons name="add-outline" size={20} color={colors.accent} />
          }
          onPress={() => setFlowOpen(true)}
          variant="secondary"
        />
      </OnboardingSectionCard>

      {/* Bottom CTA */}
      <Button
        disabled={isBusy}
        fullWidth
        label={isBusy ? "Salvataggio..." : "Continua"}
        onPress={hasExperiences ? handleContinue : onSkip}
        variant="primary"
      />

      <ExperienceFlowScreen
        existingExperiences={careerEntries}
        onClose={() => setFlowOpen(false)}
        onSave={handleFlowSave}
        searchTeams={searchTeams}
        visible={flowOpen}
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
  typeSection: {
    gap: spacing[12],
  },
  formBadgeRow: {
    flexDirection: "row",
  },
  typeBadge: {
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[4],
    borderRadius: radius.full,
    backgroundColor: colors.heroSoft,
    borderWidth: 1,
    borderColor: colors.hero,
  },
  typeBadgeText: {
    color: colors.hero,
  },
});
