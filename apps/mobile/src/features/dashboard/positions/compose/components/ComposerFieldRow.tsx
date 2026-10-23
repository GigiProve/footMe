import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../../theme/tokens";
import { AppText } from "../../../../../ui";

type Props = {
  /** Secondo rigo sotto il valore: «Lo stesso allenatore seguirà anche …». */
  helper?: string | null;
  error?: string | null;
  label: string;
  /**
   * DAS-REV-17 §31: «righe fisse annunciate come non modificabili».
   *
   * Cambia solo l'annuncio allo screen reader, non il colore: §19 vieta
   * per le righe bloccate «chevron, cursore di modifica o trattamento
   * disabled a basso contrasto». Si legge come le altre, si annuncia per
   * quello che è.
   */
  locked?: boolean;
  onPress?: () => void;
  /** `true` aggiunge « · Opzionale» grigio accanto alla label (§4). */
  optional?: boolean;
  /** Default: «Aggiungi» su un campo opzionale, «Seleziona» sugli altri. */
  placeholder?: string;
  testID?: string;
  /** Il valore scelto. `null` mostra il placeholder, mai "null" o un id. */
  value: string | null;
};

/**
 * Riga di campo a selezione (DAS-REV-16 §4, screen 01, 05, 06, 08, 09, 10).
 *
 * «I campi sono righe leggere, input e textarea, con bordi/divider sottili.
 * Non racchiudere ogni campo in una grande card.» Da qui la hairline
 * inferiore invece di una cornice, e nessuna superficie propria.
 *
 * Senza `onPress` la riga è informativa: niente chevron e niente ruolo di
 * pulsante — §34 vieta di annunciare come interattivo ciò che non lo è, ed
 * è la forma che §10 chiede per il riepilogo «Posizioni da creare».
 */
export function ComposerFieldRow({
  error,
  helper,
  label,
  locked = false,
  onPress,
  optional = false,
  placeholder,
  testID,
  value,
}: Props) {
  /* Il mockup distingue i due inviti: un campo obbligatorio vuoto chiede di
     scegliere, uno facoltativo propone di aggiungere (screen 05,
     «Situazione del calciatore · Opzionale / Aggiungi»). */
  const emptyLabel = placeholder ?? (optional ? "Aggiungi" : "Seleziona");
  const body = (
    <View style={styles.row}>
      <View style={styles.text}>
        <View style={styles.labelRow}>
          <AppText color="neutralMuted" variant="meta">
            {label}
          </AppText>

          {optional ? (
            <AppText color="neutralMuted" variant="meta">
              {" · Opzionale"}
            </AppText>
          ) : null}
        </View>

        <AppText
          color={value ? "neutral" : "neutralSoft"}
          variant="bodyLg"
        >
          {value ?? emptyLabel}
        </AppText>

        {helper ? (
          <AppText color="neutralMuted" variant="meta">
            {helper}
          </AppText>
        ) : null}
      </View>

      {onPress ? (
        <Ionicons color={colors.textNeutralSoft} name="chevron-forward" size={18} />
      ) : null}
    </View>
  );

  return (
    <View style={styles.block}>
      {onPress ? (
        <Pressable
          accessibilityHint="Apre l'elenco delle opzioni"
          accessibilityLabel={`${label}${optional ? ", opzionale" : ""}: ${value ?? emptyLabel}`}
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => (pressed ? styles.pressed : null)}
          testID={testID}
        >
          {body}
        </Pressable>
      ) : (
        <View
          accessible
          accessibilityLabel={`${label}: ${value ?? emptyLabel}${
            locked ? ", non modificabile" : ""
          }`}
          testID={testID}
        >
          {body}
        </View>
      )}

      {error ? (
        <AppText accessibilityRole="alert" color="danger" style={styles.error} variant="meta">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing[12],
  },
  error: {
    marginTop: spacing[4],
  },
  labelRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  pressed: {
    opacity: 0.7,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    minHeight: sizes.touchTarget - spacing[12],
  },
  text: {
    flex: 1,
    gap: spacing[4],
  },
});
