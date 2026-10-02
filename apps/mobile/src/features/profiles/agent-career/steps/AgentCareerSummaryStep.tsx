/**
 * Schermata 6 — Riepilogo carriera (REV-PROF-15).
 *
 * "Conferma carriera" non è un salvataggio: quando questa schermata si apre i
 * record sono già sul server, scritti dal form. Qui si controlla il percorso e
 * si chiude la sessione — ripetere la mutation produrrebbe duplicati, ed è
 * esattamente l'errore che la task vieta.
 *
 * L'attività indipendente ha un gruppo autonomo: non viene mai accorpata a
 * un'agenzia perché condivide il ruolo.
 */
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import { AgentExperienceGroupCard } from "../AgentExperienceGroupCard";
import type { AgentExperienceGroup } from "../agent-assignment-model";

type AgentCareerSummaryStepProps = {
  groups: readonly AgentExperienceGroup[];
  onAddExperience: () => void;
  onEditGroup: (groupId: string) => void;
};

export function AgentCareerSummaryStep({
  groups,
  onAddExperience,
  onEditGroup,
}: AgentCareerSummaryStepProps) {
  return (
    <View style={styles.container} testID="agent-career-summary">
      <AppText color="secondary" variant="bodySm">
        Controlla il tuo percorso da procuratore.
      </AppText>

      {groups.length === 0 ? (
        <AppText color="secondary" variant="bodySm">
          Non hai ancora aggiunto esperienze.
        </AppText>
      ) : (
        groups.map((group) => (
          <AgentExperienceGroupCard
            group={group}
            key={group.groupId}
            onEdit={() => onEditGroup(group.groupId)}
            showTimeline
            testID={`agent-summary-group-${group.groupId}`}
          />
        ))
      )}

      <Button
        label="Aggiungi un'altra esperienza"
        leftIcon={<Ionicons color={colors.accent} name="add-outline" size={20} />}
        onPress={onAddExperience}
        testID="agent-career-summary-add"
        variant="secondary"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[12],
  },
});
