import { ComponentProps } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { colors, radius, sizes, spacing, typography } from "../../styles";

type InputProps = {
  label?: string;
} & ComponentProps<typeof TextInput>;

export function Input({ label, multiline, style, ...props }: InputProps) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        multiline={multiline}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          multiline ? styles.multiline : null,
          style,
        ]}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing[8],
  },
  label: {
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.bold,
  },
  input: {
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[14],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius[16],
    backgroundColor: colors.background,
  },
  multiline: {
    minHeight: sizes.multilineFieldMinHeight,
    textAlignVertical: "top",
  },
});
