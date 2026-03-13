import { ComponentProps, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { colors, radius, sizes, spacing, typography } from "../../styles";

type InputProps = {
  label?: string;
} & ComponentProps<typeof TextInput>;

export function Input({
  label,
  multiline,
  onBlur,
  onFocus,
  style,
  value,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = typeof value === "string" && value.trim().length > 0;

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        multiline={multiline}
        onBlur={(event) => {
          setIsFocused(false);
          onBlur?.(event);
        }}
        onFocus={(event) => {
          setIsFocused(true);
          onFocus?.(event);
        }}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          multiline ? styles.multiline : null,
          hasValue && !isFocused ? styles.filledInput : null,
          isFocused ? styles.focusedInput : null,
          style,
        ]}
        value={value}
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
  focusedInput: {
    borderColor: colors.accentStrong,
    backgroundColor: colors.surface,
  },
  filledInput: {
    borderColor: colors.accentSoft,
    backgroundColor: colors.accentSoft,
  },
  multiline: {
    minHeight: sizes.multilineFieldMinHeight,
    textAlignVertical: "top",
  },
});
