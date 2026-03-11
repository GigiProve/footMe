import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, typography } from "../../styles";

type BadgeVariant = "default" | "inverse" | "accent" | "hero" | "selected";

export function Badge({
  label,
  variant = "default",
}: {
  label: string;
  variant?: BadgeVariant;
}) {
  return (
    <View style={[styles.base, variantStyles[variant]]}>
      <Text style={[styles.label, textVariantStyles[variant]]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
    borderRadius: radius.full,
  },
  label: {
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
  },
});

const variantStyles = StyleSheet.create({
  accent: {
    backgroundColor: colors.accentSoft,
  },
  default: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
  },
  hero: {
    backgroundColor: colors.heroSoft,
  },
  inverse: {
    backgroundColor: colors.surfaceOverlay,
  },
  selected: {
    backgroundColor: colors.surfaceInverse,
    borderColor: colors.surfaceInverse,
    borderWidth: 1,
  },
});

const textVariantStyles = StyleSheet.create({
  accent: {
    color: colors.textPrimary,
  },
  default: {
    color: colors.textPrimary,
  },
  hero: {
    color: colors.hero,
  },
  inverse: {
    color: colors.inkInvert,
  },
  selected: {
    color: colors.inkInvert,
  },
});
