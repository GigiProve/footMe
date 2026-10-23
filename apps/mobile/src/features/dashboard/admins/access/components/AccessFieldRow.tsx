/**
 * Riga label/valore riusabile per i campi di un accesso amministrativo
 * (Ruolo, Ambito, Visualizza permessi — screen 06).
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View } from "react-native";

import { colors, sizes, spacing } from "../../../../../theme/tokens";
import { AppText } from "../../../../../ui";

type AccessFieldRowProps = {
  label: string;
  onPress?: () => void;
  testID?: string;
  /**
   * `undefined` → riga di sola navigazione: nessun valore a destra, solo il
   * chevron ("Visualizza permessi" dello screen 06).
   * `null`      → campo che un valore dovrebbe avere e non ha ancora
   *                ("Ruolo" del ramo B dello screen 12).
   */
  value?: string | null;
};

export function AccessFieldRow(props: AccessFieldRowProps) {
  const { label, onPress, testID, value } = props;

  const isNavigation = value === undefined;
  const displayValue = value ?? "Non impostato";

  const content = (
    <View style={styles.row}>
      <AppText color="neutral" variant="bodyLg">
        {label}
      </AppText>
      <View style={styles.valueGroup}>
        {isNavigation ? null : (
          <AppText
            color="neutralMuted"
            numberOfLines={2}
            style={styles.value}
            variant="bodySm"
          >
            {displayValue}
          </AppText>
        )}
        {onPress ? (
          <Ionicons
            color={colors.textNeutralSoft}
            name="chevron-forward"
            size={18}
          />
        ) : null}
      </View>
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      accessibilityLabel={isNavigation ? label : `${label}: ${displayValue}`}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.pressable}
      testID={testID}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    minHeight: sizes.touchTarget,
    justifyContent: "center",
  },
  row: {
    alignItems: "center",
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[12],
  },
  value: {
    flexShrink: 1,
    textAlign: "right",
  },
  valueGroup: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 1,
    gap: spacing[8],
    justifyContent: "flex-end",
  },
});
