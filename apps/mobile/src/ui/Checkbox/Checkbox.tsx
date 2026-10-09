import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../styles";
import { AppText } from "../AppText/AppText";

type CheckboxProps = {
  checked: boolean;
  /**
   * Metadato sotto l'etichetta — "Bergamo" con "Lombardia" a disambiguare
   * (DAS-REV-06 §13). Entra anche nell'etichetta annunciata dal lettore di
   * schermo, altrimenti la disambiguazione varrebbe solo per chi vede.
   */
  description?: string;
  disabled?: boolean;
  label: string;
  onValueChange: (value: boolean) => void;
  testID?: string;
};

export function Checkbox({
  checked,
  description,
  disabled = false,
  label,
  onValueChange,
  testID,
}: CheckboxProps) {
  return (
    <Pressable
      accessibilityLabel={description ? `${label}, ${description}` : label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!checked)}
      style={[styles.container, disabled ? styles.disabled : null]}
      testID={testID}
    >
      <View style={[styles.box, checked ? styles.boxChecked : null]}>
        {checked ? (
          <Ionicons color={colors.inkInvert} name="checkmark" size={14} />
        ) : null}
      </View>
      <View style={styles.text}>
        <AppText variant="bodyLg" style={styles.label}>
          {label}
        </AppText>
        {description ? (
          <AppText color="secondary" variant="bodySm">
            {description}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
    // WCAG: la riga è il bersaglio, non il solo quadratino da 22px.
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[6],
  },
  disabled: {
    opacity: 0.5,
  },
  box: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius[4],
    backgroundColor: colors.inputBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  boxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  text: {
    flex: 1,
    gap: spacing[4],
  },
  label: {
    fontSize: 15,
    fontWeight: "500",
  },
});
