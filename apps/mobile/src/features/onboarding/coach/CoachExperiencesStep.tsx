import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors } from "../../../styles";
import { AppText, Button } from "../../../ui";
import type { TeamAutocompleteOption } from "../../profiles/player-sports";
import { OnboardingEmptyState, OnboardingPage } from "../ui";
import {
  onboardingBorderWidth,
  onboardingRadius,
  onboardingSpacing,
} from "../ui/onboarding-tokens";
import type { CoachCareerEntry } from "./coach-career-types";
import { CoachExperienceForm } from "./CoachExperienceForm";
import { CoachExperienceRow } from "./CoachExperienceRow";
import { CoachExperienceTypeSelector } from "./CoachExperienceTypeSelector";
import { useCoachExperienceFlow } from "./use-coach-experience-flow";

const TYPE_BADGE_LABELS = {
  CUSTOM_PERIOD: "Periodo personalizzato",
  MULTI_SEASON: "Più stagioni complete",
  SINGLE_SEASON: "Singola stagione",
} as const;

type CoachExperiencesStepProps = {
  currentStep: number;
  /** Ruolo principale del profilo: default delle nuove esperienze (§T). */
  defaultRole: string;
  entries: CoachCareerEntry[];
  isBusy: boolean;
  onBack: () => void;
  onContinue: () => void;
  onRegisterBack?: (handler: (() => void) | null) => void;
  onUpdateEntries: (entries: CoachCareerEntry[]) => void;
  searchTeams: (query: string) => Promise<TeamAutocompleteOption[]>;
  stepLabel: string;
  totalSteps: number;
};

/**
 * Step "Carriera da allenatore" (REV-ONB-03 §O–§AD).
 *
 * Tre schermate dentro lo stesso passo — riepilogo, scelta della tipologia,
 * editor — esattamente come nel Calciatore. Nessuna CTA "Salta": chi non ha
 * ancora esperienze prosegue con Continua (§AQ).
 */
export function CoachExperiencesStep({
  currentStep,
  defaultRole,
  entries,
  isBusy,
  onBack,
  onContinue,
  onRegisterBack,
  onUpdateEntries,
  searchTeams,
  stepLabel,
  totalSteps,
}: CoachExperiencesStepProps) {
  const flow = useCoachExperienceFlow({
    defaultRole,
    entries,
    onUpdateEntries,
  });
  const hasEntries = flow.entries.length > 0;
  const isOnInnerScreen = flow.screen.type !== "list";
  const { cancel } = flow;

  useEffect(() => {
    if (!isOnInnerScreen) {
      onRegisterBack?.(null);
      return undefined;
    }

    onRegisterBack?.(cancel);

    return () => onRegisterBack?.(null);
  }, [cancel, isOnInnerScreen, onRegisterBack]);

  if (flow.screen.type === "select-type") {
    return (
      <OnboardingPage
        currentStep={currentStep}
        onBack={flow.cancel}
        stepLabel={stepLabel}
        subtitle="Scegli come vuoi inserire le tue esperienze da allenatore."
        testID="coach-experience-type-screen"
        title="Aggiungi esperienza"
        totalSteps={totalSteps}
      >
        <CoachExperienceTypeSelector onSelect={flow.selectType} />
      </OnboardingPage>
    );
  }

  if (flow.screen.type === "form") {
    const isEditing = flow.screen.editIndex !== null;

    return (
      <OnboardingPage
        currentStep={currentStep}
        onBack={flow.cancel}
        stepLabel={stepLabel}
        subtitle={
          flow.screen.entry.type === "CUSTOM_PERIOD"
            ? "Inserisci i dati per subentri, esoneri o incarichi brevi."
            : "Inserisci i dettagli dell'esperienza."
        }
        testID="coach-experience-form-screen"
        title={isEditing ? "Modifica esperienza" : "Dettagli esperienza"}
        totalSteps={totalSteps}
      >
        <View style={styles.typeBadge}>
          <AppText color="accent" variant="chipLabel">
            {TYPE_BADGE_LABELS[flow.screen.entry.type]}
          </AppText>
        </View>

        <CoachExperienceForm
          entry={flow.screen.entry}
          existingEntries={flow.entries}
          isEditing={isEditing}
          onCancel={flow.cancel}
          onSave={flow.save}
          searchTeams={searchTeams}
        />
      </OnboardingPage>
    );
  }

  return (
    <OnboardingPage
      currentStep={currentStep}
      footer={{
        onPrimaryPress: onContinue,
        primaryLabel: "Continua",
        primaryLoading: isBusy,
        primaryTestID: "coach-career-continue",
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle={
        hasEntries
          ? "Riepilogo delle esperienze aggiunte."
          : "Aggiungi le tappe della tua carriera in panchina."
      }
      testID="coach-career-step"
      title={
        hasEntries ? "Le tue esperienze da allenatore" : "Carriera da allenatore"
      }
      totalSteps={totalSteps}
    >
      {hasEntries ? (
        <View style={styles.list}>
          {flow.entries.map((entry, index) => (
            <CoachExperienceRow
              entry={entry}
              key={entry.id}
              onEdit={() => flow.edit(index)}
              onRemove={() => flow.remove(index)}
              testID={`coach-career-row-${entry.id}`}
            />
          ))}
        </View>
      ) : (
        <OnboardingEmptyState
          description="Aggiungi la tua prima esperienza per completare il profilo."
          testID="coach-career-empty-state"
          title="Nessuna esperienza aggiunta"
        />
      )}

      <Button
        fullWidth
        label="Aggiungi esperienza"
        leftIcon={<Ionicons color={colors.accent} name="add" size={18} />}
        onPress={flow.startAdding}
        size="md"
        style={styles.addButton}
        testID="coach-career-add-experience"
        variant="secondary"
      />
    </OnboardingPage>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: onboardingSpacing.s + 4,
  },
  addButton: {
    marginTop: onboardingSpacing.m,
  },
  typeBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentSoftBorder,
    borderRadius: onboardingRadius.pill,
    borderWidth: onboardingBorderWidth.hairline,
    marginBottom: onboardingSpacing.m,
    paddingHorizontal: onboardingSpacing.s + 2,
    paddingVertical: onboardingSpacing.xs + 1,
  },
});
