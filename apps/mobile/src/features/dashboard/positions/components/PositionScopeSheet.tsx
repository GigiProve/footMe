import { ScrollView, StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText, BottomSheet, Button, Radio, Skeleton } from "../../../../ui";
import {
  POSITIONS_COPY,
  filterOptionLabel,
  sameFilter,
  optionToFilter,
} from "../positions-presentation";
import type { PositionFilter, PositionFilterOption } from "../positions-types";

type Props = {
  error: boolean;
  loading: boolean;
  onClose: () => void;
  onRetry: () => void;
  onSelect: (filter: PositionFilter) => void;
  options: PositionFilterOption[];
  selected: PositionFilter;
  visible: boolean;
};

/**
 * Bottom sheet «Filtra per ambito» (screen 02, §14).
 *
 * «La scelta si applica al tap e chiude lo sheet. Non aggiungere Conferma,
 * Salva filtro o persistenza di preferenze globali.» Per questo non esiste
 * nessun pulsante di conferma e `onSelect` chiude da sé.
 *
 * «X, gesture di chiusura o back senza nuova scelta conservano il filtro
 * precedente»: lo sheet non possiede uno stato proprio di selezione — legge
 * `selected` dal chiamante — quindi chiudere senza scegliere non può
 * modificare nulla, nemmeno per errore.
 *
 * Il radio è blu PROLINK (§6) e comunica la selezione attraverso
 * `accessibilityState`, non solo con il colore (§30): se ne occupa il
 * componente condiviso.
 *
 * «Nel pannello Bozze/Chiuse distingui i Team non attivi con sezione leggera
 * Squadre non attive»: una sezione, non una tab e non un gestore Team.
 */
export function PositionScopeSheet({
  error,
  loading,
  onClose,
  onRetry,
  onSelect,
  options,
  selected,
  visible,
}: Props) {
  const active = options.filter(
    (option) => option.kind !== "team" || !option.isInactive,
  );
  const inactive = options.filter(
    (option) => option.kind === "team" && option.isInactive,
  );

  const renderOption = (option: PositionFilterOption, index: number) => {
    const filter = optionToFilter(option);
    const key =
      option.kind === "team" ? `team-${option.teamId}` : option.kind;

    return (
      <View key={key} style={index > 0 ? styles.optionDivided : null}>
        <Radio
          checked={sameFilter(filter, selected)}
          label={filterOptionLabel(option)}
          onPress={() => onSelect(filter)}
          testID={`position-filter-option-${key}`}
        />

        {/* §14: «Intera società … helper Solo incarichi per il club.» Serve a
            non confonderla con Tutte le posizioni. */}
        {option.kind === "society" ? (
          <AppText color="neutralMuted" style={styles.helper} variant="meta">
            {POSITIONS_COPY.societyScopeHelper}
          </AppText>
        ) : null}
      </View>
    );
  };

  return (
    <BottomSheet
      onClose={onClose}
      title={POSITIONS_COPY.filterSheetTitle}
      visible={visible}
    >
      <AppText color="neutralMuted" style={styles.sheetHelper} variant="meta">
        {POSITIONS_COPY.filterSheetHelper}
      </AppText>

      {loading && options.length === 0 ? (
        <View style={styles.loading}>
          <Skeleton.Row style={styles.skeletonRow} />
          <Skeleton.Row style={styles.skeletonRow} />
          <Skeleton.Row style={styles.skeletonRow} />
        </View>
      ) : null}

      {/* §26: «Un errore di opzioni non cambia il filtro già applicato o
          cancella la lista sottostante», e X/back restano utilizzabili. */}
      {error && options.length === 0 ? (
        <View style={styles.error}>
          <AppText color="neutral" variant="bodyLg">
            {POSITIONS_COPY.filterOptionsError}
          </AppText>

          <Button
            label={POSITIONS_COPY.retry}
            onPress={onRetry}
            size="sm"
            testID="position-filter-retry"
            variant="neutralOutline"
          />
        </View>
      ) : null}

      {/* §30: «Le opzioni scorrono con molte squadre; non comprimere i
          font.» */}
      <ScrollView
        accessibilityRole="radiogroup"
        showsVerticalScrollIndicator={false}
        style={styles.list}
      >
        {active.map(renderOption)}

        {inactive.length > 0 ? (
          <View style={styles.inactiveSection}>
            <AppText
              color="neutralMuted"
              style={styles.inactiveTitle}
              variant="eyebrow"
            >
              {POSITIONS_COPY.inactiveSection}
            </AppText>

            {inactive.map(renderOption)}
          </View>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetHelper: {
    marginBottom: spacing[8],
  },
  list: {
    maxHeight: 360,
  },
  optionDivided: {
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: 1,
  },
  helper: {
    marginBottom: spacing[6],
    marginLeft: spacing[32],
    marginTop: -spacing[4],
  },
  inactiveSection: {
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: 1,
    marginTop: spacing[8],
    paddingTop: spacing[8],
  },
  inactiveTitle: {
    marginBottom: spacing[4],
  },
  loading: {
    gap: spacing[8],
    paddingVertical: spacing[8],
  },
  skeletonRow: {
    height: 44,
    marginBottom: 0,
  },
  error: {
    alignItems: "flex-start",
    gap: spacing[10],
    paddingVertical: spacing[12],
  },
});
