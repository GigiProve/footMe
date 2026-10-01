/**
 * Schermata 1 — Hub carriera (REV-PROF-04, REV-PROF-07).
 *
 * È il punto di arrivo di tutti gli entry point: CTA del Master Profile, empty
 * state della tab Carriera, modifica di un gruppo. Non esiste una seconda
 * gestione carriera altrove.
 *
 * La seconda sezione elenca i percorsi aggiuntivi che quel profilo può avere:
 * uno solo per l'Allenatore (Calciatore), due per lo Staff tecnico
 * (Allenatore e Calciatore). Il tap su una riga apre direttamente quel
 * percorso, senza passaggi intermedi.
 */
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import { CoachExperienceGroupCard } from "../../coach-career/CoachExperienceGroupCard";
import type { CoachExperienceGroup } from "../../coach-career/coach-assignment-model";
import {
  formatPathSummary,
  type CareerPathCopy,
  type CareerPathKey,
} from "../career-manager-config";
import { CareerPathRow } from "./CareerPathRow";

type CareerHubStepProps = {
  /** Eyebrow della sezione dei percorsi aggiuntivi. */
  additionalEyebrow: string;
  emptyText: string;
  emptyTitle: string;
  eyebrow: string;
  groups: readonly CoachExperienceGroup[];
  onAddExperience: () => void;
  onEditGroup: (groupId: string) => void;
  onOpenPath: (path: CareerPathKey) => void;
  /** Percorsi disponibili con il loro conteggio, nell'ordine di visualizzazione. */
  paths: readonly { copy: CareerPathCopy; count: number }[];
  testIDPrefix: string;
};

export function CareerHubStep({
  additionalEyebrow,
  emptyText,
  emptyTitle,
  eyebrow,
  groups,
  onAddExperience,
  onEditGroup,
  onOpenPath,
  paths,
  testIDPrefix,
}: CareerHubStepProps) {
  return (
    <>
      <View style={styles.section}>
        <AppText accessibilityRole="header" variant="eyebrow">
          {eyebrow}
        </AppText>

        {groups.length === 0 ? (
          <View style={styles.empty} testID={`${testIDPrefix}-career-hub-empty`}>
            <AppText variant="titleMd">{emptyTitle}</AppText>
            <AppText color="secondary" variant="bodySm">
              {emptyText}
            </AppText>
          </View>
        ) : (
          groups.map((group) => (
            <CoachExperienceGroupCard
              group={group}
              key={group.groupId}
              onEdit={() => onEditGroup(group.groupId)}
              testID={`${testIDPrefix}-career-group-${group.groupId}`}
            />
          ))
        )}

        <Button
          label="Aggiungi esperienza"
          leftIcon={
            <Ionicons color={colors.accent} name="add-outline" size={20} />
          }
          onPress={onAddExperience}
          testID={`${testIDPrefix}-career-add`}
          variant="secondary"
        />
      </View>

      <View style={styles.section}>
        <AppText accessibilityRole="header" variant="eyebrow">
          {additionalEyebrow}
        </AppText>

        {paths.map(({ copy, count }) => (
          <CareerPathRow
            icon={copy.icon}
            key={copy.key}
            onPress={() => onOpenPath(copy.key)}
            summary={formatPathSummary(count)}
            testID={`${testIDPrefix}-career-${copy.key}-entry`}
            // L'Allenatore ha una sola riga e la sezione la nomina già: il
            // titolo comparirebbe due volte.
            title={paths.length > 1 ? copy.title : undefined}
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
