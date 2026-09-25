import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors } from "../../../styles";
import { AppText, Button } from "../../../ui";
import type {
  PlayerExperienceForm,
  TeamAutocompleteOption,
} from "../../profiles/player-sports";
import { CareerExperienceRow } from "../career/CareerExperienceRow";
import { PlayerExperienceForm as PlayerExperienceFormComponent } from "../career/PlayerExperienceForm";
import { PlayerExperienceTypeSelector } from "../career/PlayerExperienceTypeSelector";
import { useCareerExperienceFlow } from "../career/use-career-experience-flow";
import { OnboardingEmptyState, OnboardingPage } from "../ui";
import {
  onboardingBorderWidth,
  onboardingRadius,
  onboardingSpacing,
} from "../ui/onboarding-tokens";

const TYPE_BADGE_LABELS = {
  CUSTOM_PERIOD: "Periodo personalizzato",
  MULTI_SEASON: "Più stagioni complete",
  SINGLE_SEASON: "Singola stagione",
} as const;

type PlayerCareerStepProps = {
  careerEntries: PlayerExperienceForm[];
  currentStep: number;
  isBusy: boolean;
  onBack: () => void;
  onContinue: () => void;
  onExperienceAddStarted?: () => void;
  onExperienceSaved?: (isEditing: boolean) => void;
  onExperienceTypeSelected?: (type: string) => void;
  /**
   * Registra il back di sistema mentre siamo dentro una schermata interna:
   * il tasto Indietro di Android deve tornare al riepilogo, non saltare allo
   * step precedente del wizard (§DB).
   */
  onRegisterBack?: (handler: (() => void) | null) => void;
  onUpdateEntries: (entries: PlayerExperienceForm[]) => void;
  searchTeams: (query: string) => Promise<TeamAutocompleteOption[]>;
  stepLabel: string;
  totalSteps: number;
};

/**
 * Step "La tua carriera" del Calciatore (REV-ONB-02 §AA–§BI).
 *
 * Tre schermate intere dentro lo stesso passo: riepilogo, scelta della
 * tipologia, editor. Nessuna CTA "Salta" nel flusso normale (§AC).
 */
export function PlayerCareerStep({
  careerEntries,
  currentStep,
  isBusy,
  onBack,
  onContinue,
  onExperienceAddStarted,
  onExperienceSaved,
  onExperienceTypeSelected,
  onRegisterBack,
  onUpdateEntries,
  searchTeams,
  stepLabel,
  totalSteps,
}: PlayerCareerStepProps) {
  const flow = useCareerExperienceFlow({ careerEntries, onUpdateEntries });
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
        testID="experience-type-screen"
        title="Aggiungi esperienza"
        totalSteps={totalSteps}
      >
        <PlayerExperienceTypeSelector
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
            ? "Inserisci i dati per periodi brevi o prestiti."
            : "Completa i dati dell'esperienza."
        }
        testID="experience-form-screen"
        title={isEditing ? "Modifica esperienza" : "Dettagli esperienza"}
        totalSteps={totalSteps}
      >
        <View style={styles.typeBadge}>
          <AppText color="accent" variant="chipLabel">
            {TYPE_BADGE_LABELS[flow.screen.entry.type]}
          </AppText>
        </View>

        <PlayerExperienceFormComponent
          entry={flow.screen.entry}
          existingEntries={flow.entries}
          isEditing={isEditing}
          onCancel={flow.cancel}
          onSave={(entry) => {
            flow.save(entry);
            onExperienceSaved?.(isEditing);
          }}
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
        primaryTestID: "career-continue",
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle="Raccontaci la tua esperienza calcistica."
      testID="player-career-step"
      title={hasEntries ? "Le tue esperienze" : "La tua carriera"}
      totalSteps={totalSteps}
    >
      {hasEntries ? (
        <View style={styles.list}>
          {flow.entries.map((entry, index) => (
            <CareerExperienceRow
              entry={entry}
              key={entry.id}
              onEdit={() => flow.edit(index)}
              onRemove={() => flow.remove(index)}
              testID={`career-row-${entry.id}`}
            />
          ))}
        </View>
      ) : (
        <OnboardingEmptyState
          description="Aggiungi la tua prima esperienza per completare il profilo."
          testID="career-empty-state"
          title="Nessuna esperienza aggiunta"
        />
      )}

      <Button
        fullWidth
        label="Aggiungi esperienza"
        leftIcon={<Ionicons color={colors.accent} name="add" size={18} />}
        onPress={() => {
          onExperienceAddStarted?.();
          flow.startAdding();
        }}
        size="md"
        style={styles.addButton}
        testID="career-add-experience"
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
