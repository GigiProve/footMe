/**
 * Schermata 4 — Ruolo per stagione, passo 2 di 2 (REV-PROF-04).
 *
 * È la schermata che rende vero il requisito principale della task: ogni
 * stagione ha il proprio ruolo e la propria categoria, e sono indipendenti.
 *
 * Il prefill copia il valore della riga precedente per non far ricompilare tre
 * volte la stessa cosa, ma **non lega le righe**: cambiare il ruolo di 2023/24
 * non tocca 2024/25. È per questo che la modifica scrive sempre la riga
 * toccata in `seasonDetails` invece di propagare un valore di testata.
 */
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import {
  InfoMessage,
  InlineError,
  OnboardingSelectField,
} from "../../../onboarding/ui";
import {
  SENIOR_CATEGORY_OPTIONS,
  YOUTH_CATEGORY_OPTIONS,
} from "../../player-sports";
import { COACH_ROLE_OPTIONS } from "../../../onboarding/coach/coach-options";
import { formatSeasonLabel } from "../coach-assignment-model";
import {
  resolveSeasonDetail,
  sortedDraftSeasons,
  type CoachDraftErrors,
  type CoachExperienceDraft,
  type CoachSeasonDraftDetail,
} from "../coach-career-draft";

export const COACH_CATEGORY_OPTIONS = [
  ...SENIOR_CATEGORY_OPTIONS,
  ...YOUTH_CATEGORY_OPTIONS,
];

type CoachSeasonRolesStepProps = {
  draft: CoachExperienceDraft;
  errors: CoachDraftErrors;
  /**
   * Tassonomia dei ruoli della carriera in corso: Allenatore di default,
   * Staff tecnico quando la stessa schermata serve quel percorso
   * (REV-PROF-07). La schermata non sa quale sia, e non deve saperlo.
   */
  roleOptions?: { label: string; value: string }[];
  /** Prefisso dei testID: "coach" per l'Allenatore, "staff" per lo Staff. */
  testIDPrefix?: string;
  onChangeSeasonDetail: (
    seasonKey: string,
    patch: Partial<CoachSeasonDraftDetail>,
  ) => void;
  /**
   * Presente solo in modifica: togliere una stagione da un gruppo già salvato
   * è un'azione distruttiva e passa da una conferma, quindi la decide il
   * modulo e non questa schermata.
   */
  onRemoveSeason?: (seasonKey: string) => void;
};

export function CoachSeasonRolesStep({
  draft,
  errors,
  onChangeSeasonDetail,
  onRemoveSeason,
  roleOptions = COACH_ROLE_OPTIONS,
  testIDPrefix = "coach",
}: CoachSeasonRolesStepProps) {
  const seasons = sortedDraftSeasons(draft);
  // L'ultima stagione non si rimuove: un gruppo senza stagioni non esiste, e
  // svuotarlo sarebbe un'eliminazione mascherata da modifica.
  const canRemoveSeasons = Boolean(onRemoveSeason) && seasons.length > 1;

  return (
    <View style={styles.container}>
      <AppText color="secondary" variant="bodyLg">
        Controlla ruolo e categoria di ogni stagione.
      </AppText>

      <InfoMessage message="I valori sono precompilati. Puoi modificarli singolarmente." />

      {seasons.map((seasonKey, index) => {
        const detail = resolveSeasonDetail(draft, seasonKey, seasons[index - 1]);
        const rowError = errors.seasonRows?.[seasonKey];
        const seasonLabel = formatSeasonLabel(seasonKey);

        return (
          <View
            key={seasonKey}
            style={[styles.card, rowError ? styles.cardInvalid : null]}
            testID={`${testIDPrefix}-season-role-card-${seasonKey}`}
          >
            <View style={styles.cardHeader}>
              <AppText
                accessibilityRole="header"
                style={styles.cardTitle}
                variant="titleSm"
              >
                {seasonLabel}
              </AppText>

              {canRemoveSeasons ? (
                <Pressable
                  accessibilityLabel={`Rimuovi la stagione ${seasonLabel}`}
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => onRemoveSeason?.(seasonKey)}
                  style={styles.removeButton}
                  testID={`${testIDPrefix}-season-remove-${seasonKey}`}
                >
                  <Ionicons
                    color={colors.danger}
                    name="close-outline"
                    size={20}
                  />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.fields}>
              <View style={styles.field}>
                <OnboardingSelectField
                  label="Ruolo"
                  onChange={(value) =>
                    onChangeSeasonDetail(seasonKey, { role: value })
                  }
                  options={roleOptions}
                  placeholder="Seleziona ruolo"
                  sheetTitle={`Ruolo ${seasonLabel}`}
                  testID={`${testIDPrefix}-season-role-${seasonKey}`}
                  value={detail.role}
                />
              </View>

              <View style={styles.field}>
                <OnboardingSelectField
                  label="Categoria"
                  onChange={(value) =>
                    onChangeSeasonDetail(seasonKey, { category: value })
                  }
                  options={COACH_CATEGORY_OPTIONS}
                  placeholder="Seleziona categoria"
                  searchable
                  sheetTitle={`Categoria ${seasonLabel}`}
                  testID={`${testIDPrefix}-season-category-${seasonKey}`}
                  value={detail.category}
                />
              </View>
            </View>

            {rowError ? <InlineError message={rowError} /> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[12],
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    gap: spacing[12],
    padding: spacing[16],
  },
  cardInvalid: {
    borderColor: colors.danger,
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    minHeight: 24,
  },
  cardTitle: {
    flex: 1,
    minWidth: 0,
  },
  removeButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    marginVertical: -10,
    width: 44,
  },
  fields: {
    flexDirection: "row",
    gap: spacing[12],
  },
  field: {
    flex: 1,
    minWidth: 0,
  },
});
