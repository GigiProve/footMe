/**
 * Schermata 1 — Hub carriera Procuratore (REV-PROF-15).
 *
 * È il punto di arrivo di tutti gli entry point: CTA del Master Profile, empty
 * state della tab Carriera, modifica di un gruppo. Non esiste una seconda
 * gestione carriera altrove.
 *
 * La seconda sezione riassume i percorsi professionali degli altri ruoli: una
 * riga per percorso con il proprio conteggio, non una seconda copia delle loro
 * card. Il tap apre il flusso già approvato di quel ruolo.
 */
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import {
  formatPathSummary,
  type CareerPathCopy,
  type CareerPathKey,
} from "../../career-manager/career-manager-config";
import { CareerPathRow } from "../../career-manager/steps/CareerPathRow";
import { AgentExperienceGroupCard } from "../AgentExperienceGroupCard";
import type { AgentExperienceGroup } from "../agent-assignment-model";

type AgentCareerHubStepProps = {
  groups: readonly AgentExperienceGroup[];
  onAddExperience: () => void;
  onEditGroup: (groupId: string) => void;
  onOpenPath: (path: CareerPathKey) => void;
  paths: readonly { copy: CareerPathCopy; count: number }[];
};

export function AgentCareerHubStep({
  groups,
  onAddExperience,
  onEditGroup,
  onOpenPath,
  paths,
}: AgentCareerHubStepProps) {
  return (
    <>
      <View style={styles.section}>
        <AppText accessibilityRole="header" variant="eyebrow">
          Carriera da procuratore
        </AppText>

        {groups.length === 0 ? (
          <View style={styles.empty} testID="agent-career-hub-empty">
            <AppText variant="titleMd">Completa la tua carriera</AppText>
            <AppText color="secondary" variant="bodySm">
              Aggiungi le tue esperienze professionali per raccontare il tuo
              percorso da procuratore.
            </AppText>
          </View>
        ) : (
          groups.map((group) => (
            <AgentExperienceGroupCard
              group={group}
              key={group.groupId}
              onEdit={() => onEditGroup(group.groupId)}
              testID={`agent-career-group-${group.groupId}`}
            />
          ))
        )}

        <Button
          label="Aggiungi esperienza"
          leftIcon={
            <Ionicons color={colors.accent} name="add-outline" size={20} />
          }
          onPress={onAddExperience}
          testID="agent-career-add"
          variant="secondary"
        />
      </View>

      <View style={styles.section}>
        <AppText accessibilityRole="header" variant="eyebrow">
          Percorsi aggiuntivi
        </AppText>

        {paths.map(({ copy, count }) => (
          <CareerPathRow
            icon={copy.icon}
            key={copy.key}
            onPress={() => onOpenPath(copy.key)}
            summary={formatPathSummary(count)}
            testID={`agent-career-${copy.key}-entry`}
            title={copy.title}
          />
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing[12],
  },
  empty: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    gap: spacing[8],
    padding: spacing[16],
  },
});
