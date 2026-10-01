/**
 * Schermata 7 — Riepilogo carriera (REV-PROF-04).
 *
 * Mostra quello che è già sul server: "Salva esperienza" ha persistito prima
 * di arrivare qui, quindi "Conferma carriera" non ha nessuna mutation da
 * eseguire — chiude la sessione di gestione e basta. È questa separazione che
 * impedisce il doppio salvataggio.
 */
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import { CoachExperienceGroupCard } from "../CoachExperienceGroupCard";
import type { CoachExperienceGroup } from "../coach-assignment-model";

type CoachCareerSummaryStepProps = {
  /** Copy dell'empty state: cambia fra carriera del profilo e percorso. */
  emptyCtaLabel?: string;
  emptyText?: string;
  emptyTitle?: string;
  groups: readonly CoachExperienceGroup[];
  onAddAnother: () => void;
  onEditGroup: (groupId: string) => void;
  /** "Controlla il tuo percorso da allenatore." o l'equivalente Staff. */
  subtitle?: string;
  testIDPrefix?: string;
};

export function CoachCareerSummaryStep({
  emptyCtaLabel,
  emptyText,
  emptyTitle,
  groups,
  onAddAnother,
  onEditGroup,
  subtitle = "Controlla il tuo percorso da allenatore.",
  testIDPrefix = "coach",
}: CoachCareerSummaryStepProps) {
  return (
    <View style={styles.container}>
      <AppText color="secondary" variant="bodyLg">
        {subtitle}
      </AppText>

      {groups.length === 0 ? (
        <View style={styles.empty} testID={`${testIDPrefix}-career-summary-empty`}>
          {emptyTitle ? <AppText variant="titleMd">{emptyTitle}</AppText> : null}
          <AppText color="secondary" variant="bodySm">
            {emptyText ?? "Non hai ancora esperienze salvate."}
          </AppText>
        </View>
      ) : (
        groups.map((group) => (
          <CoachExperienceGroupCard
            group={group}
            key={group.groupId}
            onEdit={() => onEditGroup(group.groupId)}
            showSeasons
            testID={`${testIDPrefix}-career-summary-${group.groupId}`}
          />
        ))
      )}

      <Button
        label={
          groups.length === 0 && emptyCtaLabel
            ? emptyCtaLabel
            : "Aggiungi un'altra esperienza"
        }
        leftIcon={
          <Ionicons color={colors.accent} name="add-outline" size={20} />
        }
        onPress={onAddAnother}
        testID={`${testIDPrefix}-career-summary-add`}
        variant="secondary"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
