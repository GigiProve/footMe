/**
 * Sheet «Filtra shortlist» (DAS-REV-25 §13, screen 03).
 *
 * Due gruppi di **checkbox multiple** e nient'altro: «Non aggiungere
 * ricerca, filtro origine/ruolo/età, preset, filtri salvati, ordinamento
 * manuale o contatori per singola opzione.»
 *
 * Il comportamento che §13 descrive e che qui è strutturale:
 *
 *   · il **draft** vive nello sheet, non nel genitore. «Separa filtri
 *     applicati e draft dello sheet. Aprendo lo sheet, inizializza il draft
 *     dai filtri applicati» — se lo stato vivesse fuori, ogni tocco sarebbe
 *     già applicato;
 *   · «X, swipe e back lo chiudono senza applicarlo»;
 *   · «Azzera dentro lo sheet pulisce il draft; il commit resta Applica
 *     filtri.» Azzera non chiude e non ricarica niente.
 *
 * «Senza priorità» è una casella come le altre e seleziona `null`: §13 —
 * «Senza priorità seleziona null, non Bassa.»
 */
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText, BottomSheet, Button, Checkbox } from "../../../../ui";
import {
  ALL_EVALUATION_STATUSES,
  ALL_PRIORITY_FILTERS,
  EMPTY_FILTERS,
  EVALUATION_LABELS,
  PRIORITY_FILTER_LABELS,
  SHORTLIST_COPY,
} from "../shortlist-presentation";
import type {
  ShortlistEvaluationStatus,
  ShortlistFilters,
  ShortlistPriorityFilter,
} from "../shortlist-types";

type Props = {
  applied: ShortlistFilters;
  onApply: (filters: ShortlistFilters) => void;
  onClose: () => void;
  visible: boolean;
};

function toggle<T extends string>(values: readonly T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}

export function ShortlistFilterSheet({
  applied,
  onApply,
  onClose,
  visible,
}: Props) {
  const [draft, setDraft] = useState<ShortlistFilters>(applied);

  /* §13: «Aprendo lo sheet, inizializza il draft dai filtri applicati.» Una
     chiusura senza conferma non deve lasciare dietro una selezione mai
     confermata. */
  useEffect(() => {
    if (visible) {
      setDraft(applied);
    }
  }, [applied, visible]);

  return (
    <BottomSheet
      onClose={onClose}
      title={SHORTLIST_COPY.filterTitle}
      visible={visible}
    >
      <ScrollView style={styles.list}>
        <AppText style={styles.section} variant="eyebrow">
          {SHORTLIST_COPY.filterPriority}
        </AppText>

        {ALL_PRIORITY_FILTERS.map((option: ShortlistPriorityFilter) => (
          <Checkbox
            checked={draft.priorities.includes(option)}
            key={option}
            label={PRIORITY_FILTER_LABELS[option]}
            onValueChange={() =>
              setDraft((current) => ({
                ...current,
                priorities: toggle(current.priorities, option),
              }))
            }
            testID={`shortlist-filter-priority-${option}`}
          />
        ))}

        <AppText style={styles.section} variant="eyebrow">
          {SHORTLIST_COPY.filterStatus}
        </AppText>

        {ALL_EVALUATION_STATUSES.map((option: ShortlistEvaluationStatus) => (
          <Checkbox
            checked={draft.statuses.includes(option)}
            key={option}
            label={EVALUATION_LABELS[option]}
            onValueChange={() =>
              setDraft((current) => ({
                ...current,
                statuses: toggle(current.statuses, option),
              }))
            }
            testID={`shortlist-filter-status-${option}`}
          />
        ))}
      </ScrollView>

      <View style={styles.footer}>
        {/* §13: Azzera agisce sul draft e **non** chiude. Non è una seconda
            primaria: la superficie ne ha una sola. */}
        <Button
          label={SHORTLIST_COPY.filterReset}
          onPress={() => setDraft(EMPTY_FILTERS)}
          size="lg"
          style={styles.action}
          testID="shortlist-filter-reset"
          variant="secondary"
        />

        <Button
          label={SHORTLIST_COPY.filterApply}
          onPress={() => onApply(draft)}
          size="lg"
          style={styles.action}
          testID="shortlist-filter-apply"
          variant="primary"
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    maxHeight: 420,
  },
  section: {
    paddingBottom: spacing[4],
    paddingTop: spacing[16],
  },
  footer: {
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    marginTop: spacing[16],
    paddingTop: spacing[16],
  },
  action: {
    flexBasis: 140,
    flexGrow: 1,
  },
});
