import { Pressable, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../styles";
import { AppText } from "../AppText/AppText";

type ToggleProps = {
  disabled?: boolean;
  label: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
};

export function Toggle({
  disabled = false,
  label,
  onValueChange,
  value,
}: ToggleProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={[styles.container, disabled ? styles.disabled : null]}
    >
      <AppText
        variant="bodyLg"
        color={disabled ? "muted" : "primary"}
        style={styles.label}
      >
        {label}
      </AppText>
      <View style={[styles.track, value ? styles.trackOn : null]}>
        <View style={[styles.knob, value ? styles.knobOn : null]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius[6],
    backgroundColor: colors.inputBackground,
    paddingLeft: spacing[16],
    paddingRight: spacing[12],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[12],
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
  },
  track: {
    width: 46,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  trackOn: {
    backgroundColor: colors.accent,
  },
  knob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.surface,
  },
  knobOn: {
    alignSelf: "flex-end",
  },
});
