import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

type Props = {
  disabled?: boolean;
  label: string;
  onPress?: () => void;
  placeholder: string;
  testID?: string;
  value: string | null;
};

/**
 * Campo che apre un selector (master 02, 03, 04).
 *
 * Disabilitato è uno stato reale e non una finzione visuale: in creazione il
 * Livello mostra "Seleziona prima il tipo" e **non è interattivo** (§13).
 */
export function TeamFieldRow({
  disabled = false,
  label,
  onPress,
  placeholder,
  testID,
  value,
}: Props) {
  return (
    <View style={styles.block}>
      <AppText color="secondary" variant="meta">
        {label}
      </AppText>

      <Pressable
        accessibilityLabel={`${label}: ${value ?? placeholder}`}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled || !onPress}
        onPress={onPress}
        style={({ pressed }) => [
          styles.field,
          disabled ? styles.fieldDisabled : null,
          pressed && !disabled ? styles.pressed : null,
        ]}
        testID={testID}
      >
        <AppText
          color={value ? "primary" : "muted"}
          numberOfLines={1}
          style={styles.value}
          variant="bodyLg"
        >
          {value ?? placeholder}
        </AppText>

        {disabled ? null : (
          <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing[6],
  },
  field: {
    alignItems: "center",
    backgroundColor: colors.inputBackground,
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[8],
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[14],
  },
  fieldDisabled: {
    backgroundColor: colors.surfaceMuted,
    opacity: 0.7,
  },
  value: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
