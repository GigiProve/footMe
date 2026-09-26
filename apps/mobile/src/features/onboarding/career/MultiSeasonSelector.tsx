import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors } from "../../../styles";
import { AppText } from "../../../ui";
import { FieldShell, OnboardingSelectField } from "../ui";
import {
  onboardingBorderWidth,
  onboardingLayout,
  onboardingRadius,
  onboardingSpacing,
} from "../ui/onboarding-tokens";
import {
  formatSeasonShort,
  getOlderPlayerSeasonSelectOptions,
  getPlayerSeasonSelectOptions,
} from "./player-career-utils";

type MultiSeasonSelectorProps = {
  /** Stagioni già occupate da un'altra esperienza: non riselezionabili (§BI). */
  disabledSeasons?: Set<string>;
  selectedSeasons: string[];
  onToggle: (season: string) => void;
  errorMessage?: string;
  label?: string;
  helperText?: string;
  testID?: string;
};

/**
 * Griglia di chip multi-select delle stagioni (REV-ONB-02 §AJ–§AK).
 *
 * L'elenco è generato dinamicamente dall'anno corrente: le stagioni più
 * vecchie non sono perdute, si recuperano dal selector in fondo. Nessun
 * limite tecnico fisso al 2010.
 */
export function MultiSeasonSelector({
  disabledSeasons,
  errorMessage,
  helperText = "Puoi selezionare più stagioni.",
  label = "Stagioni complete",
  onToggle,
  selectedSeasons,
  testID,
}: MultiSeasonSelectorProps) {
  const occupied = disabledSeasons ?? new Set<string>();
  const gridSeasons = getPlayerSeasonSelectOptions(occupied);
  const selectedSet = new Set(selectedSeasons);

  /** Stagioni scelte dal selector "precedenti": restano visibili come chip. */
  const olderSelected = selectedSeasons.filter(
    (season) => !gridSeasons.some((option) => option.value === season),
  );
  const olderOptions = getOlderPlayerSeasonSelectOptions(occupied).filter(
    (option) => !selectedSet.has(option.value),
  );

  return (
    <FieldShell
      errorMessage={errorMessage}
      helperText={helperText}
      label={label}
    >
      <View style={styles.grid} testID={testID}>
        {[
          ...gridSeasons,
          ...olderSelected.map((season) => ({
            disabled: false,
            label: formatSeasonShort(season),
            value: season,
          })),
        ].map((option) => {
          const selected = selectedSet.has(option.value);
          const disabled = option.disabled === true && !selected;

          return (
            <Pressable
              accessibilityLabel={`Stagione ${option.label}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              key={option.value}
              onPress={() => onToggle(option.value)}
              style={({ pressed }) => [
                styles.chip,
                selected ? styles.chipSelected : null,
                disabled ? styles.chipDisabled : null,
                pressed && !disabled ? styles.chipPressed : null,
              ]}
              testID={`season-chip-${option.value}`}
            >
              <AppText
                color={selected ? "inverse" : "primary"}
                variant="chipLabel"
              >
                {option.label}
              </AppText>
              {selected ? (
                <Ionicons color={colors.inkInvert} name="checkmark" size={13} />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {olderOptions.length > 0 ? (
        <OnboardingSelectField
          label="Stagioni precedenti"
          onChange={(value) => {
            if (value) {
              onToggle(value);
            }
          }}
          options={olderOptions}
          // REV-ONB-04 §T: copy definitiva, condivisa da tutti i flussi.
          placeholder="Seleziona stagioni"
          searchable
          sheetTitle="Stagioni precedenti"
          value=""
        />
      ) : null}
    </FieldShell>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: onboardingSpacing.s,
  },
  chip: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: onboardingRadius.pill,
    borderWidth: onboardingBorderWidth.hairline,
    flexDirection: "row",
    gap: onboardingSpacing.xs + 1,
    justifyContent: "center",
    minHeight: onboardingLayout.touchTarget - 8,
    minWidth: 92,
    paddingHorizontal: onboardingSpacing.m - 4,
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipDisabled: {
    backgroundColor: colors.surfaceMuted,
    opacity: 0.5,
  },
  chipPressed: {
    opacity: 0.75,
  },
});
