import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

type Props = {
  label: string;
  onPress?: () => void;
  placeholder?: string;
  testID?: string;
  value: string | null;
};

/**
 * Campo di un form della rete (screen 04, 06).
 *
 * §11: «Il campo ha chevron; le opzioni finali single-select hanno un solo
 * indicatore di selezione, senza chevron/check duplicati.» Il chevron sta
 * quindi qui e **non** nelle righe della sheet.
 *
 * Senza `onPress` il campo è read-only: è la forma dello screen 05, dove
 * «tipo e ruoli sono read-only» (§13) e un campo tappabile suggerirebbe una
 * modifica unilaterale dei termini.
 */
export function NetworkFieldRow({
  label,
  onPress,
  placeholder,
  testID,
  value,
}: Props) {
  const display = value ?? placeholder ?? "";

  const body = (
    <View style={styles.field}>
      <AppText
        color={value ? "neutral" : "neutralSoft"}
        numberOfLines={2}
        style={styles.value}
        variant="bodyLg"
      >
        {display}
      </AppText>

      {onPress ? (
        <Ionicons color={colors.textNeutralMuted} name="chevron-forward" size={18} />
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
          accessibilityLabel={`${label}: ${display}`}
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [pressed ? styles.pressed : null]}
          testID={testID}
        >
          {body}
        </Pressable>
      ) : (
        <View accessibilityLabel={`${label}: ${display}`} testID={testID}>
          {body}
        </View>
      )}
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
    gap: spacing[12],
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[10],
  },
  value: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
