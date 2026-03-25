import { StyleSheet, View } from "react-native";

import { colors, radius, spacing, typography } from "../../styles";
import { AppText } from "../AppText/AppText";

type BadgeVariant = "default" | "info" | "success" | "warning" | "error" | "inverse" | "accent" | "hero" | "selected";

export function Badge({
  label,
  variant = "default",
}: {
  label: string;
  variant?: BadgeVariant;
}) {
  return (
    <View style={[styles.base, variantStyles[variant]]}>
      <AppText
        variant="caption"
        style={[styles.label, textVariantStyles[variant]]}
      >
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[4],
    borderRadius: radius[4],
  },
  label: {
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});

const variantStyles = StyleSheet.create({
  accent: {
    backgroundColor: colors.accentSoft,
  },
  default: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderWidth: 1,
  },
  error: {
    backgroundColor: colors.danger,
  },
  hero: {
    backgroundColor: colors.heroSoft,
  },
  info: {
    backgroundColor: colors.accentSoft,
  },
  inverse: {
    backgroundColor: colors.surfaceOverlay,
  },
  selected: {
    backgroundColor: colors.surfaceInverse,
    borderColor: colors.surfaceInverse,
    borderWidth: 1,
  },
  success: {
    backgroundColor: colors.successSoft,
  },
  warning: {
    backgroundColor: colors.warningSoft,
  },
});

const textVariantStyles = StyleSheet.create({
  accent: {
    color: colors.textPrimary,
  },
  default: {
    color: colors.textPrimary,
  },
  error: {
    color: colors.destructiveForeground,
  },
  hero: {
    color: colors.hero,
  },
  info: {
    color: colors.accentStrong,
  },
  inverse: {
    color: colors.inkInvert,
  },
  selected: {
    color: colors.inkInvert,
  },
  success: {
    color: colors.successForeground,
  },
  warning: {
    color: colors.warningForeground,
  },
});
