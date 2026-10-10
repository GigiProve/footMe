import { Pressable, StyleSheet, View } from "react-native";

import { colors, sizes, spacing } from "../../styles";
import { AppText } from "../AppText/AppText";

type RadioProps = {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
  testID?: string;
  /**
   * `neutral` disegna etichetta e indicatore in nero neutro invece che
   * nell'ink e nel blu della palette ProLink (DAS-REV-10 §4, che estende il
   * vincolo cromatico anche a «sheet, form, selector»).
   */
  tone?: "brand" | "neutral";
};

export function Radio({
  checked,
  disabled = false,
  label,
  onPress,
  testID,
  tone = "brand",
}: RadioProps) {
  const neutral = tone === "neutral";

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.container, disabled ? styles.disabled : null]}
      testID={testID}
    >
      <View
        style={[
          styles.circle,
          checked ? styles.circleChecked : null,
          checked && neutral ? styles.circleCheckedNeutral : null,
        ]}
      />
      <AppText
        color={neutral ? "neutral" : "primary"}
        variant="bodyLg"
        style={styles.label}
      >
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
    // WCAG: la riga è il bersaglio, non il solo cerchio da 22px.
    minHeight: sizes.touchTarget,
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
  circleCheckedNeutral: {
    borderColor: colors.borderNeutralStrong,
  },
  label: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
  },
});
