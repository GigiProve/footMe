import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";

type Props = {
  /** Messaggio di validazione, sotto il campo a cui appartiene (§33). */
  errorMessage?: string | null;
  helperText?: string | null;
  label: string;
  onPress?: () => void;
  placeholder?: string;
  /**
   * Campo di sola lettura: la stagione target (§12 — «read-only, senza
   * picker o chevron»). Non è `disabled`: §35 chiede che i due stati siano
   * distinguibili in modo accessibile, e lo sono perché uno non è un
   * pulsante affatto.
   */
  readOnly?: boolean;
  testID?: string;
  value: string | null;
};

/**
 * Campo di una schermata stagionale: read-only oppure apertura di un
 * selector.
 *
 * Non riusa `TeamFieldRow` di DAS-REV-08 per due motivi che si sommano: non
 * conosce lo stato read-only — un campo "disabled" avrebbe detto una cosa
 * diversa alla voice over, e §12 vuole la stagione **non modificabile**, non
 * temporaneamente spenta — e disegna in `textPrimary`, l'ink blu che §4
 * esclude da queste schermate.
 *
 * La chevron compare **solo** dove c'è un selector (§19: «I campi che aprono
 * un selector hanno chevron»).
 */
export function SeasonFieldRow({
  errorMessage,
  helperText,
  label,
  onPress,
  placeholder,
  readOnly = false,
  testID,
  value,
}: Props) {
  const body = (
    <>
      <AppText
        color={value ? "neutral" : "neutralMuted"}
        numberOfLines={2}
        style={styles.value}
        variant="bodyLg"
      >
        {value ?? placeholder ?? ""}
      </AppText>

      {readOnly ? null : (
        <Ionicons color={colors.textNeutralMuted} name="chevron-forward" size={18} />
      )}
    </>
  );

  return (
    <View style={styles.block}>
      <AppText color="neutralMuted" variant="meta">
        {label}
      </AppText>

      {readOnly || !onPress ? (
        <View
          accessibilityLabel={`${label}: ${value ?? placeholder ?? ""}`}
          style={[styles.field, styles.fieldReadOnly]}
          testID={testID}
        >
          {body}
        </View>
      ) : (
        <Pressable
          accessibilityLabel={`${label}: ${value ?? placeholder ?? ""}`}
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [styles.field, pressed ? styles.pressed : null]}
          testID={testID}
        >
          {body}
        </Pressable>
      )}

      {errorMessage ? (
        <AppText accessibilityRole="alert" color="danger" variant="caption">
          {errorMessage}
        </AppText>
      ) : helperText ? (
        <AppText color="neutralMuted" variant="caption">
          {helperText}
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
    backgroundColor: colors.surface,
    borderColor: colors.borderNeutral,
    borderRadius: radius[12],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[8],
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[8],
  },
  fieldReadOnly: {
    backgroundColor: colors.surfaceNeutral,
  },
  value: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
