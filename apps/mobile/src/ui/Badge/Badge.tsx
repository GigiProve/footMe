import { StyleSheet, View } from "react-native";

import { colors, radius, typography } from "../../styles";
import { AppText } from "../AppText/AppText";

type BadgeVariant =
  | "default"
  | "info"
  | "success"
  | "warning"
  | "error"
  | "inverse"
  | "accent"
  | "hero"
  | "selected";

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
    height: 26,
    paddingHorizontal: 10,
    borderRadius: radius[4],
    justifyContent: "center",
  },
  label: {
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.semibold,
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
    backgroundColor: "rgba(239, 68, 68, 0.15)",
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
    backgroundColor: "rgba(34, 197, 94, 0.15)",
  },
  warning: {
    backgroundColor: "rgba(234, 179, 8, 0.15)",
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
    color: colors.danger,
  },
  hero: {
    color: colors.hero,
  },
  info: {
    color: colors.textPrimary,
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
    color: "#CA8A04",
  },
});
