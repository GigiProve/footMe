/**
 * Gruppo di chip a selezione singola (REV-PROF-01 §21, §23).
 *
 * È la forma che lo Screen Master usa sia per il selettore Gol/Presenze/Assist
 * sia per i filtri Tutti/Foto/Video: pill blu piena quando attiva, pill bianca
 * con bordo neutro quando no. Riusa la `Button` condivisa — nessuna chip nuova.
 */
import { StyleSheet, View } from "react-native";

import { spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";

export type ProfileFilterOption<T extends string> = {
  label: string;
  value: T;
};

type ProfileFilterChipsProps<T extends string> = {
  /** Etichetta del gruppo per screen reader: "Metrica", "Filtro contenuti". */
  accessibilityLabel: string;
  onChange: (value: T) => void;
  options: readonly ProfileFilterOption<T>[];
  testID?: string;
  value: T;
};

export function ProfileFilterChips<T extends string>({
  accessibilityLabel,
  onChange,
  options,
  testID,
  value,
}: ProfileFilterChipsProps<T>) {
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="radiogroup"
      style={styles.container}
      testID={testID}
    >
      {options.map((option) => {
        const isSelected = option.value === value;

        return (
          <Button
            // Lo stato selezionato non è affidato al solo colore: il ruolo
            // radio lo comunica anche allo screen reader (§39).
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected, selected: isSelected }}
            key={option.value}
            label={option.label}
            onPress={() => onChange(option.value)}
            size="sm"
            testID={testID ? `${testID}-${option.value}` : undefined}
            variant={isSelected ? "primary" : "chipAction"}
          />
        );
      })}
    </View>
  );
}

/** Riga di testo che accompagna un gruppo di chip, quando serve un contesto. */
export function ProfileFilterHint({ text }: { text: string }) {
  return (
    <AppText color="muted" variant="caption">
      {text}
    </AppText>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
});
