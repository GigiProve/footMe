import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../styles";
import { AppText } from "../AppText/AppText";

type CheckboxProps = {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onValueChange: (value: boolean) => void;
};

export function Checkbox({
  checked,
  disabled = false,
  label,
  onValueChange,
}: CheckboxProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!checked)}
      style={[styles.container, disabled ? styles.disabled : null]}
    >
      <View style={[styles.box, checked ? styles.boxChecked : null]}>
        {checked ? (
          <Ionicons color={colors.inkInvert} name="checkmark" size={14} />
        ) : null}
      </View>
      <AppText variant="bodyLg" style={styles.label}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
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
  label: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
  },
});
