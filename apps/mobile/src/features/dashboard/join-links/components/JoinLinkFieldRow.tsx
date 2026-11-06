/**
 * Riga di campo del dettaglio Link di invito (§27, §30).
 *
 * Un campo di sola lettura è testo leggibile, non un input disabilitato: la
 * variante con `onPress` aggiunge soltanto lo chevron, non cambia il
 * trattamento visivo del valore. L'errore inline (§29/§41) è opzionale e
 * annunciato come `alert`.
 */
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { AppText } from "../../../../ui";
import { colors, spacing } from "../../../../theme/tokens";

type JoinLinkFieldRowProps = {
  error?: string | null;
  label: string;
  onPress?: () => void;
  secondLine?: string | null;
  testID?: string;
  value: string;
};

export function JoinLinkFieldRow({
  error,
  label,
  onPress,
  secondLine,
  testID,
  value,
}: JoinLinkFieldRowProps) {
  const body = (
    <View style={styles.row}>
      <View style={styles.text}>
        <AppText color="neutralMuted" variant="meta">
          {label}
        </AppText>
        <AppText color="neutral" style={styles.value} variant="bodyLg">
          {value}
        </AppText>
        {secondLine ? (
          <AppText color="neutralMuted" style={styles.secondLine} variant="meta">
            {secondLine}
          </AppText>
        ) : null}
        {error ? (
          <AppText
            accessibilityRole="alert"
            color="danger"
            style={styles.error}
            variant="meta"
          >
            {error}
          </AppText>
        ) : null}
      </View>
      {onPress ? (
        <Ionicons color={colors.textNeutralSoft} name="chevron-forward" size={18} />
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        accessibilityRole="button"
        onPress={onPress}
        style={styles.container}
        testID={testID}
      >
        {body}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container} testID={testID}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomColor: colors.dividerNeutral,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing[14],
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  text: {
    flex: 1,
    paddingRight: spacing[12],
  },
  value: {
    marginTop: spacing[4],
  },
  secondLine: {
    marginTop: spacing[4],
  },
  error: {
    marginTop: spacing[6],
  },
});
