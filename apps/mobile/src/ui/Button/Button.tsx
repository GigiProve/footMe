import { ComponentProps } from "react";
import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from "react-native";

import { colors, radius, sizes, spacing, typography } from "../../styles";

type ButtonVariant = "primary" | "secondary" | "hero" | "ghost";

type ButtonProps = {
  label: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: ComponentProps<typeof Text>["style"];
  variant?: ButtonVariant;
} & Omit<ComponentProps<typeof Pressable>, "style" | "children">;

export function Button({
  disabled,
  label,
  style,
  textStyle,
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={[
        styles.base,
        variantStyles[variant],
        disabled ? styles.disabled : null,
        style,
      ]}
      {...props}
    >
      <Text
        style={[
          styles.label,
          textVariantStyles[variant],
          disabled ? styles.disabledLabel : null,
          textStyle,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: sizes.touchTarget,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[14],
    borderRadius: radius[16],
  },
  disabled: {
    backgroundColor: colors.buttonDisabled,
    borderColor: colors.buttonDisabled,
  },
  disabledLabel: {
    color: colors.inkInvert,
  },
  label: {
    fontSize: typography.fontSize[16],
    fontWeight: typography.fontWeight.heavy,
  },
});

const variantStyles = StyleSheet.create({
  ghost: {
    backgroundColor: "transparent",
  },
  hero: {
    backgroundColor: colors.hero,
  },
  primary: {
    backgroundColor: colors.accent,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
});

const textVariantStyles = StyleSheet.create({
  ghost: {
    color: colors.accentStrong,
    fontWeight: typography.fontWeight.bold,
  },
  hero: {
    color: colors.inkInvert,
  },
  primary: {
    color: colors.inkInvert,
  },
  secondary: {
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.bold,
  },
});
