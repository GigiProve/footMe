/**
 * Schermata 8 — Carriera da calciatore (REV-PROF-04).
 *
 * Non è una seconda gestione carriera: monta il flusso già approvato del
 * Calciatore (scelta della tipologia, editor, statistiche per stagione) sugli
 * stessi `PlayerExperienceForm` che l'onboarding Allenatore usa già. Le due
 * carriere restano separate dal tipo, non da una copia dei dati.
 */
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText, Badge, Button } from "../../../../ui";
import { PlayerCareerExperienceCard } from "../../../onboarding/career/PlayerCareerExperienceCard";
import { PlayerExperienceForm as PlayerExperienceFormEditor } from "../../../onboarding/career/PlayerExperienceForm";
import { PlayerExperienceTypeSelector } from "../../../onboarding/career/PlayerExperienceTypeSelector";
import type { PlayerCareerEntry } from "../../../onboarding/career/player-career-types";
import type { TeamAutocompleteOption } from "../../player-sports";

export type CoachPlayerCareerScreen =
  | { type: "list" }
  | { type: "select-type" }
  | { type: "form"; editIndex: number | null; entry: PlayerCareerEntry };

type CoachPlayerCareerStepProps = {
  entries: readonly PlayerCareerEntry[];
  onAdd: () => void;
  onCancelForm: () => void;
  onDelete: (index: number) => void;
  onEdit: (index: number) => void;
  onSaveForm: (entry: PlayerCareerEntry) => void;
  onSelectType: (type: PlayerCareerEntry["type"]) => void;
  screen: CoachPlayerCareerScreen;
  searchTeams: (query: string) => Promise<TeamAutocompleteOption[]>;
  emptyCtaLabel?: string;
  emptyText?: string;
  emptyTitle?: string;
  /** Da quale carriera resta separata: cambia fra Allenatore e Staff tecnico. */
  separationNote?: string;
  testIDPrefix?: string;
};

export function CoachPlayerCareerStep({
  emptyCtaLabel = "Aggiungi carriera da calciatore",
  emptyText = "Puoi aggiungere il tuo percorso da calciatore anche in seguito.",
  emptyTitle = "Nessuna esperienza aggiunta",
  entries,
  onAdd,
  onCancelForm,
  onDelete,
  onEdit,
  onSaveForm,
  onSelectType,
  screen,
  searchTeams,
  separationNote = "Aggiungi le esperienze vissute da calciatore. Rimarranno separate dalla carriera da allenatore.",
  testIDPrefix = "coach",
}: CoachPlayerCareerStepProps) {
  if (screen.type === "select-type") {
    return (
      <PlayerExperienceTypeSelector
        onSelect={onSelectType}
        subtitle="Scegli come vuoi inserire questa esperienza."
        title="Aggiungi esperienza da calciatore"
      />
    );
  }

  if (screen.type === "form") {
    return (
      <PlayerExperienceFormEditor
        entry={screen.entry}
        existingEntries={[...entries]}
        isEditing={screen.editIndex !== null}
        onCancel={onCancelForm}
        onSave={onSaveForm}
        searchTeams={searchTeams}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.intro}>
        <Badge label="Facoltativa" size="sm" variant="default" />
        <AppText color="secondary" variant="bodySm">
          {separationNote}
        </AppText>
      </View>

      {entries.length === 0 ? (
        <View style={styles.empty} testID={`${testIDPrefix}-player-career-empty`}>
          <AppText variant="titleMd">{emptyTitle}</AppText>
          <AppText color="secondary" variant="bodySm">
            {emptyText}
          </AppText>
        </View>
      ) : (
        entries.map((entry, index) => (
          <PlayerCareerExperienceCard
            entry={entry}
            key={entry.id}
            onDelete={() => onDelete(index)}
            onEdit={() => onEdit(index)}
          />
        ))
      )}

      <Button
        label={
          entries.length === 0 ? emptyCtaLabel : "Aggiungi esperienza da calciatore"
        }
        leftIcon={
          <Ionicons color={colors.accent} name="add-outline" size={20} />
        }
        onPress={onAdd}
        testID={`${testIDPrefix}-player-career-add`}
        variant="secondary"
      />

      <AppText color="muted" style={styles.hint} variant="meta">
        Puoi completarla anche in seguito.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[12],
  },
  intro: {
    alignItems: "flex-start",
    gap: spacing[8],
  },
  empty: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    gap: spacing[8],
    padding: spacing[16],
  },
  hint: {
    textAlign: "center",
  },
});
