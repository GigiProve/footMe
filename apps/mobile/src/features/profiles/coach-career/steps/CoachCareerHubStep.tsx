/**
 * Schermata 1 — Hub carriera (REV-PROF-04).
 *
 * È il punto di arrivo di tutti gli entry point: CTA "Aggiungi esperienza" del
 * Master Profile, empty state della tab Carriera, modifica di un gruppo. Non
 * esiste una seconda gestione carriera altrove.
 */
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText, Badge, Button } from "../../../../ui";
import { CoachExperienceGroupCard } from "../CoachExperienceGroupCard";
import type { CoachExperienceGroup } from "../coach-assignment-model";

type CoachCareerHubStepProps = {
  groups: readonly CoachExperienceGroup[];
  onAddExperience: () => void;
  onEditGroup: (groupId: string) => void;
  onOpenPlayerCareer: () => void;
  playerExperienceCount: number;
};

function formatPlayerCareerSummary(count: number): string {
  if (count === 0) {
    return "Nessuna esperienza aggiunta";
  }

  return count === 1 ? "1 esperienza aggiunta" : `${count} esperienze aggiunte`;
}

export function CoachCareerHubStep({
  groups,
  onAddExperience,
  onEditGroup,
  onOpenPlayerCareer,
  playerExperienceCount,
}: CoachCareerHubStepProps) {
  const playerSummary = formatPlayerCareerSummary(playerExperienceCount);

  return (
    <>
      <View style={styles.section}>
        <AppText accessibilityRole="header" variant="eyebrow">
          Carriera da allenatore
        </AppText>

        {groups.length === 0 ? (
          <View style={styles.empty} testID="coach-career-hub-empty">
            <AppText variant="titleMd">Completa la tua carriera</AppText>
            <AppText color="secondary" variant="bodySm">
              Aggiungi le tue esperienze per raccontare il tuo percorso
              professionale.
            </AppText>
          </View>
        ) : (
          groups.map((group) => (
            <CoachExperienceGroupCard
              group={group}
              key={group.groupId}
              onEdit={() => onEditGroup(group.groupId)}
              testID={`coach-career-group-${group.groupId}`}
            />
          ))
        )}

        <Button
          label="Aggiungi esperienza"
          leftIcon={
            <Ionicons color={colors.accent} name="add-outline" size={20} />
          }
          onPress={onAddExperience}
          testID="coach-career-add"
          variant="secondary"
        />
      </View>

      <View style={styles.section}>
        <AppText accessibilityRole="header" variant="eyebrow">
          Carriera da calciatore
        </AppText>

        <Pressable
          accessibilityHint="Apre la gestione della carriera da calciatore"
          accessibilityLabel={`Carriera da calciatore, ${playerSummary}, facoltativa`}
          accessibilityRole="button"
          onPress={onOpenPlayerCareer}
          style={({ pressed }) => [
            styles.playerRow,
            pressed ? styles.playerRowPressed : null,
          ]}
          testID="coach-career-player-entry"
        >
          <View style={styles.playerIcon}>
            <Ionicons
              color={colors.textSecondary}
              name="person-outline"
              size={20}
            />
          </View>

          <View style={styles.playerText}>
            <AppText variant="titleSm">{playerSummary}</AppText>
            <Badge label="Facoltativa" size="sm" variant="default" />
          </View>

          <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
        </Pressable>
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
  playerRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 64,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  playerRowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  playerIcon: {
    alignItems: "center",
    width: 28,
  },
  playerText: {
    alignItems: "flex-start",
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
});
