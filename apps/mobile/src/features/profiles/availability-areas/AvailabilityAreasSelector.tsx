/**
 * Selector condiviso della disponibilità geografica (DAS-REV-06 §12–§15).
 *
 * Tre modalità in verticale, selezione singola, **una sola espansa**; le altre
 * restano visibili e compatte. Non è un wizard e non è una lista di
 * destinazioni:
 *
 *   · nessun chevron sui titoli delle modalità — §3 e §12 sono espliciti, si
 *     sceglie qui, non altrove, e un chevron prometterebbe una pagina che non
 *     esiste. È anche la ragione per cui il radio non viene annunciato come
 *     link (§27);
 *   · nessuna tab Province / Regioni / Italia e nessuna mappa (§12);
 *   · nessun massimo arbitrario di tre selezioni (§13, §14).
 *
 * Il componente è **controllato e senza effetti**: non carica, non salva, non
 * naviga. È quello che permette di usarlo nei tre contesti di §19 — editor
 * focalizzato della Dashboard, modulo Modifica profilo, onboarding — senza
 * duplicare punti di conferma. Chi lo monta decide dove si persiste.
 *
 * Il filtro testuale non è virtualizzato di proposito: le liste sono 107
 * province e 20 regioni, e una FlatList qui vivrebbe dentro la ScrollView del
 * contenitore, cioè in nested virtualization. Le righe sono statiche e il
 * costo è un render lineare, non uno scroll a scatti.
 */
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button, Checkbox, Radio, SearchField } from "../../../ui";
import {
  AVAILABILITY_AREAS_MODES,
  listAreaOptions,
  orderAreasByTaxonomy,
  searchAreaOptions,
  toggleArea,
  type AvailabilityAreasDraft,
  type AvailabilityAreasMode,
  type AvailabilityAreasValidationError,
} from "./availability-areas-model";

export type AvailabilityAreasSelectorProps = {
  draft: AvailabilityAreasDraft;
  /** Errore di validazione, mostrato accanto al controllo interessato (§17). */
  error?: AvailabilityAreasValidationError | null;
  onChange: (draft: AvailabilityAreasDraft) => void;
  /** Notifica il cambio di modalità a chi fa analytics (§25). */
  onModeChange?: (mode: AvailabilityAreasMode) => void;
  testIDPrefix?: string;
};

export function AvailabilityAreasSelector({
  draft,
  error = null,
  onChange,
  onModeChange,
  testIDPrefix = "availability-areas",
}: AvailabilityAreasSelectorProps) {
  /*
    Una query per modalità, non una sola condivisa: tornando su Province dopo
    un giro su Regioni la ricerca precedente è ancora quella giusta, e una
    query lasciata lì da un'altra tassonomia nasconderebbe l'intera lista.
  */
  const [queries, setQueries] = useState<Record<string, string>>({});

  function selectMode(mode: AvailabilityAreasMode) {
    if (draft.mode === mode) {
      return;
    }

    /*
      §16: «attivare ed espandere la nuova modalità, chiudere le altre,
      escludere dal payload attivo le selezioni delle altre modalità». Le
      selezioni restano nel draft — non nel payload — così tornare indietro
      durante la stessa sessione non costa una riselezione.
    */
    onChange({ ...draft, mode });
    onModeChange?.(mode);
  }

  function toggleValue(mode: AvailabilityAreasMode, value: string) {
    if (mode === "PROVINCES") {
      onChange({ ...draft, provinces: toggleArea(draft.provinces, value) });
      return;
    }

    if (mode === "REGIONS") {
      onChange({ ...draft, regions: toggleArea(draft.regions, value) });
    }
  }

  return (
    <View style={styles.container} testID={testIDPrefix}>
      {AVAILABILITY_AREAS_MODES.map((presentation) => {
        const { hint, mode, searchPlaceholder, title } = presentation;
        const isSelected = draft.mode === mode;
        const values = mode === "REGIONS" ? draft.regions : draft.provinces;
        const query = queries[mode] ?? "";
        const fieldError =
          error && isSelected && error.field !== "mode" ? error : null;

        return (
          <View
            key={mode}
            style={[styles.card, isSelected ? styles.cardSelected : null]}
          >
            <Radio
              checked={isSelected}
              label={title}
              onPress={() => selectMode(mode)}
              testID={`${testIDPrefix}-mode-${mode}`}
            />

            {isSelected && mode === "ITALY" ? (
              <AppText color="secondary" style={styles.hint} variant="bodySm">
                {hint}
              </AppText>
            ) : null}

            {isSelected && mode !== "ITALY" ? (
              <View style={styles.expanded}>
                {values.length > 0 ? (
                  <View style={styles.chips}>
                    {orderAreasByTaxonomy(mode, values).map((value) => (
                      <Button
                        accessibilityLabel={`Rimuovi ${value}`}
                        key={value}
                        label={value}
                        onPress={() => toggleValue(mode, value)}
                        rightIcon={
                          <Ionicons
                            color={colors.accent}
                            name="close"
                            size={14}
                          />
                        }
                        selected
                        testID={`${testIDPrefix}-chip-${value}`}
                        variant="chipAction"
                      />
                    ))}
                  </View>
                ) : null}

                <SearchField
                  onChangeText={(value) =>
                    setQueries((current) => ({ ...current, [mode]: value }))
                  }
                  placeholder={searchPlaceholder ?? ""}
                  testID={`${testIDPrefix}-search-${mode}`}
                  value={query}
                />

                <AreaOptionList
                  mode={mode}
                  onToggle={(value) => toggleValue(mode, value)}
                  query={query}
                  testIDPrefix={testIDPrefix}
                  values={values}
                />

                {fieldError ? (
                  <AppText color="danger" variant="bodySm">
                    {fieldError.message}
                  </AppText>
                ) : (
                  <AppText
                    color="secondary"
                    style={styles.hint}
                    variant="bodySm"
                  >
                    {hint}
                  </AppText>
                )}
              </View>
            ) : null}
          </View>
        );
      })}

      {error?.field === "mode" ? (
        <AppText color="danger" variant="bodySm">
          {error.message}
        </AppText>
      ) : null}
    </View>
  );
}

type AreaOptionListProps = {
  mode: AvailabilityAreasMode;
  onToggle: (value: string) => void;
  query: string;
  testIDPrefix: string;
  values: string[];
};

/**
 * Tassonomia della modalità, filtrata ma mai amputata.
 *
 * §13: «Se una provincia selezionata compare nei risultati, il suo checkbox
 * deve risultare selezionato» — per questo le voci già scelte restano nella
 * lista invece di sparire sotto i chip, e il checkbox è l'altra faccia dello
 * stesso draft.
 */
function AreaOptionList({
  mode,
  onToggle,
  query,
  testIDPrefix,
  values,
}: AreaOptionListProps) {
  const options = searchAreaOptions(mode, query);

  if (options.length === 0) {
    return (
      <AppText color="secondary" variant="bodySm">
        {mode === "PROVINCES"
          ? "Nessuna provincia trovata."
          : "Nessuna regione trovata."}
      </AppText>
    );
  }

  return (
    <View style={styles.options}>
      {options.map((option, index) => (
        <View
          key={option.value}
          style={index > 0 ? styles.optionDivider : undefined}
        >
          <Checkbox
            checked={values.includes(option.value)}
            description={option.metadata}
            label={option.label}
            onValueChange={() => onToggle(option.value)}
            testID={`${testIDPrefix}-option-${option.value}`}
          />
        </View>
      ))}
    </View>
  );
}

/** Numero di aree della tassonomia, per i test e per la diagnostica. */
export function countAreaOptions(mode: AvailabilityAreasMode): number {
  return listAreaOptions(mode).length;
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
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  cardSelected: {
    borderColor: colors.accent,
  },
  expanded: {
    gap: spacing[12],
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  options: {
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    paddingHorizontal: spacing[12],
  },
  optionDivider: {
    borderTopColor: colors.divider,
    borderTopWidth: 1,
  },
  hint: {
    lineHeight: 18,
  },
});
