import { Pressable, StyleSheet, View } from "react-native";

import { colors, spacing } from "../../styles";
import { AppText } from "../AppText/AppText";

type RadioProps = {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
};

export function Radio({
  checked,
  disabled = false,
  label,
  onPress,
}: RadioProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.container, disabled ? styles.disabled : null]}
    >
      <View style={[styles.circle, checked ? styles.circleChecked : null]} />
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
  circle: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    backgroundColor: colors.inputBackground,
  },
  circleChecked: {
    borderColor: colors.accent,
    borderWidth: 6,
  },
  label: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
  },
});
