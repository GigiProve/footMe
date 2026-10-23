import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";

type Props = {
  /** Messaggio di validazione vicino al campo (§30). */
  error?: string | null;
  label: string;
  onPress?: () => void;
  /** Testo del valore. `null` mostra il placeholder, mai "null" o un id. */
  value: string | null;
  placeholder?: string;
  testID?: string;
};

/**
 * Campo a selezione del composer: etichetta sopra, valore dentro una cornice
 * sobria, chevron a destra.
 *
 * Senza `onPress` è il trattamento **read-only** della ricezione e della
 * landing (§13, §16): stessa forma, nessun chevron e nessun ruolo di
 * pulsante — §31 vieta di annunciare come interattivo ciò che non lo è.
 */
export function AdminFieldRow({
  error,
  label,
  onPress,
  placeholder = "Seleziona",
  testID,
  value,
}: Props) {
  const content = (
    <View style={[styles.field, error ? styles.fieldError : null]}>
      <AppText
        color={value ? "neutral" : "neutralSoft"}
        numberOfLines={2}
        style={styles.value}
        variant="bodyLg"
      >
        {value ?? placeholder}
      </AppText>

      {onPress ? (
        <Ionicons
          color={colors.textNeutralSoft}
          name="chevron-forward"
          size={18}
        />
      ) : null}
    </View>
  );

  return (
    <View style={styles.block}>
      <AppText color="neutralMuted" variant="meta">
        {label}
      </AppText>

      {onPress ? (
        <Pressable
          accessibilityHint="Apre l'elenco delle opzioni"
          accessibilityLabel={`${label}: ${value ?? placeholder}`}
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => (pressed ? styles.pressed : null)}
          testID={testID}
        >
          {content}
        </Pressable>
      ) : (
        <View accessible accessibilityLabel={`${label}: ${value ?? placeholder}`} testID={testID}>
          {content}
        </View>
      )}

      {error ? (
        <AppText accessibilityRole="alert" color="danger" variant="meta">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing[6],
  },
  field: {
    alignItems: "center",
    borderColor: colors.borderNeutral,
    borderRadius: radius[12],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[8],
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[10],
  },
  fieldError: {
    borderColor: colors.danger,
  },
  value: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
