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
import type {
  CoachCareerEntry,
  CoachExperienceType,
} from "./coach-career-types";
import { CoachExperienceForm } from "./CoachExperienceForm";
import { CoachExperienceRow } from "./CoachExperienceRow";
import { CoachExperienceTypeSelector } from "./CoachExperienceTypeSelector";
import { useCoachExperienceFlow } from "./use-coach-experience-flow";

const TYPE_BADGE_LABELS = {
  CUSTOM_PERIOD: "Periodo personalizzato",
  MULTI_SEASON: "Più stagioni complete",
  SINGLE_SEASON: "Singola stagione",
} as const;

/**
 * Testi che cambiano da un profilo professionale all'altro.
 *
 * Solo copy e tassonomia: il flusso, l'editor e il riepilogo restano gli
 * stessi per l'Allenatore e per lo Staff tecnico (REV-ONB-04 §P, §Q).
 */
export type ExperiencesStepCopy = {
  addButtonLabel: string;
  emptyDescription: string;
  emptyTitle: string;
  listSubtitle: string;
  listTitle: string;
  seasonRoleDescription: string;
  summarySubtitle: string;
  summaryTitle: string;
  typeSelectorSubtitle: string;
  typeSelectorTitle: string;
};

const COACH_COPY: ExperiencesStepCopy = {
  addButtonLabel: "Aggiungi esperienza",
  emptyDescription: "Aggiungi la tua prima esperienza per completare il profilo.",
  emptyTitle: "Nessuna esperienza aggiunta",
  listSubtitle: "Aggiungi le tappe della tua carriera in panchina.",
  listTitle: "Carriera da allenatore",
  seasonRoleDescription:
    "Un allenatore può avere ruoli diversi nelle diverse stagioni.",
  summarySubtitle: "Riepilogo delle esperienze aggiunte.",
  summaryTitle: "Le tue esperienze da allenatore",
  typeSelectorSubtitle:
    "Scegli come vuoi inserire le tue esperienze da allenatore.",
  typeSelectorTitle: "Aggiungi esperienza",
};

type CoachExperiencesStepProps = {
  /** Ammette esperienze senza data di fine (§Z). */
  allowOngoing?: boolean;
  /** Copy e tassonomia del profilo che usa lo step. Default: Allenatore. */
  copy?: ExperiencesStepCopy;
  currentStep: number;
  /** Ruolo principale del profilo: default delle nuove esperienze (§T). */
  defaultRole: string;
  entries: CoachCareerEntry[];
  isBusy: boolean;
  onBack: () => void;
  onContinue: () => void;
  onExperienceAddStarted?: () => void;
  onExperienceSaved?: (isEditing: boolean) => void;
  onExperienceTypeSelected?: (type: CoachExperienceType) => void;
  onRegisterBack?: (handler: (() => void) | null) => void;
  onUpdateEntries: (entries: CoachCareerEntry[]) => void;
  /** Ruoli selezionabili nell'esperienza. Default: ruoli tecnici allenatore. */
  roleOptions?: { label: string; value: string }[];
  searchTeams: (query: string) => Promise<TeamAutocompleteOption[]>;
  stepLabel: string;
  testIDPrefix?: string;
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
  allowOngoing = false,
  copy = COACH_COPY,
  currentStep,
  defaultRole,
  entries,
  isBusy,
  onBack,
  onContinue,
  onExperienceAddStarted,
  onExperienceSaved,
  onExperienceTypeSelected,
  onRegisterBack,
  onUpdateEntries,
  roleOptions,
  searchTeams,
  stepLabel,
  testIDPrefix = "coach",
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
        subtitle={copy.typeSelectorSubtitle}
        testID={`${testIDPrefix}-experience-type-screen`}
        title={copy.typeSelectorTitle}
        totalSteps={totalSteps}
      >
        <CoachExperienceTypeSelector
          onSelect={(type) => {
            onExperienceTypeSelected?.(type);
            flow.selectType(type);
          }}
        />
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
        testID={`${testIDPrefix}-experience-form-screen`}
        title={isEditing ? "Modifica esperienza" : "Dettagli esperienza"}
        totalSteps={totalSteps}
      >
        <View style={styles.typeBadge}>
          <AppText color="accent" variant="chipLabel">
            {TYPE_BADGE_LABELS[flow.screen.entry.type]}
          </AppText>
        </View>

        <CoachExperienceForm
          allowOngoing={allowOngoing}
          entry={flow.screen.entry}
          existingEntries={flow.entries}
          isEditing={isEditing}
          onCancel={flow.cancel}
          onSave={(saved) => {
            onExperienceSaved?.(isEditing);
            flow.save(saved);
          }}
          roleOptions={roleOptions}
          searchTeams={searchTeams}
          seasonRoleDescription={copy.seasonRoleDescription}
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
        primaryTestID: `${testIDPrefix}-career-continue`,
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle={hasEntries ? copy.summarySubtitle : copy.listSubtitle}
      testID={`${testIDPrefix}-career-step`}
      title={hasEntries ? copy.summaryTitle : copy.listTitle}
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
              testID={`${testIDPrefix}-career-row-${entry.id}`}
            />
          ))}
        </View>
      ) : (
        <OnboardingEmptyState
          description={copy.emptyDescription}
          testID={`${testIDPrefix}-career-empty-state`}
          title={copy.emptyTitle}
        />
      )}

      <Button
        fullWidth
        label={copy.addButtonLabel}
        leftIcon={<Ionicons color={colors.accent} name="add" size={18} />}
        onPress={() => {
          onExperienceAddStarted?.();
          flow.startAdding();
        }}
        size="md"
        style={styles.addButton}
        testID={`${testIDPrefix}-career-add-experience`}
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
