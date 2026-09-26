import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors } from "../../../styles";
import { Button } from "../../../ui";
import type {
  PlayerExperienceForm,
  TeamAutocompleteOption,
} from "../../profiles/player-sports";
import { OnboardingEmptyState, OnboardingSection } from "../ui";
import { onboardingSpacing } from "../ui/onboarding-tokens";
import { CareerExperienceRow } from "./CareerExperienceRow";
import { PlayerExperienceForm as PlayerExperienceFormComponent } from "./PlayerExperienceForm";
import { PlayerExperienceTypeSelector } from "./PlayerExperienceTypeSelector";
import { useCareerExperienceFlow } from "./use-career-experience-flow";

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

/**
 * Carriera calcistica come contenuto di uno step già incorniciato dalla
 * rotta. Il Calciatore usa invece `PlayerCareerStep`, che monta le stesse
 * parti su pagine intere: qui restano i flussi che non sono ancora passati
 * al Master (allenatore, staff, procuratore, dirigente).
 */
export function CareerExperienceStep({
  addButtonLabel = "Aggiungi esperienza",
  careerEntries,
  emptyMessage = "Aggiungi la tua prima esperienza per completare il profilo.",
  isBusy,
  onSaveAndContinue,
  onSkip,
  onUpdateEntries,
  searchTeams,
  subtitle = "Raccontaci la tua esperienza calcistica.",
  title = "La tua carriera",
}: CareerExperienceStepProps) {
  const flow = useCareerExperienceFlow({ careerEntries, onUpdateEntries });
  const hasEntries = flow.entries.length > 0;

  if (flow.screen.type === "select-type") {
    return (
      <View style={styles.container}>
        <PlayerExperienceTypeSelector
          onSelect={flow.selectType}
          title="Aggiungi esperienza"
        />
        <Button label="Annulla" onPress={flow.cancel} variant="tertiary" />
      </View>
    );
  }

  if (flow.screen.type === "form") {
    return (
      <View style={styles.container}>
        <PlayerExperienceFormComponent
          entry={flow.screen.entry}
          existingEntries={flow.entries}
          isEditing={flow.screen.editIndex !== null}
          onCancel={flow.cancel}
          onSave={flow.save}
          searchTeams={searchTeams}
          title="Dettagli esperienza"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <OnboardingSection description={subtitle} title={title}>
        {hasEntries ? (
          flow.entries.map((entry, index) => (
            <CareerExperienceRow
              entry={entry}
              key={entry.id}
              onEdit={() => flow.edit(index)}
            />
          ))
        ) : (
          <OnboardingEmptyState
            description={emptyMessage}
            title="Nessuna esperienza aggiunta"
          />
        )}

        <Button
          label={addButtonLabel}
          leftIcon={<Ionicons color={colors.accent} name="add" size={18} />}
          onPress={flow.startAdding}
          variant="secondary"
        />
      </OnboardingSection>

      <Button
        disabled={isBusy}
        label={isBusy ? "Salvataggio..." : "Continua"}
        onPress={hasEntries ? onSaveAndContinue : onSkip}
        variant="primary"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: onboardingSpacing.m,
  },
});
