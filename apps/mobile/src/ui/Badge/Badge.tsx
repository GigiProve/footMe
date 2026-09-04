import { StyleSheet, View, type TextStyle, type ViewStyle } from "react-native";

import { colors, radius, typography } from "../../styles";
import { AppText } from "../AppText/AppText";

/**
 * Chip statica (§1a). Sempre pill, mai rettangolo: nel design ProLink la
 * forma pill significa "attributo", la forma squadrata significa "azione".
 *
 * Tre altezze: 22 dentro una riga di lista, 26 dentro un modulo, 30 in una
 * barra di filtri.
 */
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

type BadgeSize = "sm" | "md" | "lg";

const sizeStyles: Record<BadgeSize, ViewStyle> = {
  sm: { height: 22, paddingHorizontal: 8 },
  md: { height: 26, paddingHorizontal: 10 },
  lg: { height: 30, paddingHorizontal: 12 },
};

const sizeTextStyles: Record<BadgeSize, TextStyle> = {
  sm: { fontSize: typography.fontSize[10.5] },
  md: { fontSize: typography.fontSize[11.5] },
  lg: { fontSize: typography.fontSize[12] },
};

export function Badge({
  label,
  size = "md",
  variant = "default",
}: {
  label: string;
  size?: BadgeSize;
  variant?: BadgeVariant;
}) {
  return (
    <View style={[styles.base, sizeStyles[size], variantStyles[variant]]}>
      <AppText
        numberOfLines={1}
        style={[styles.label, sizeTextStyles[size], textVariantStyles[variant]]}
        variant="chipLabel"
      >
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: radius.full,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "center",
  },
  label: {
    fontWeight: typography.fontWeight.semibold,
  },
});

const variantStyles = StyleSheet.create({
  accent: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentSoftBorder,
  },
  default: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  error: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerSoft,
  },
  /** Overlay scuro sopra un media (§1b: "Serie D · Giornata 3"). */
  hero: {
    backgroundColor: "rgba(12,27,42,0.82)",
    borderColor: "transparent",
  },
  info: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentSoftBorder,
  },
  inverse: {
    backgroundColor: colors.surfaceOverlay,
    borderColor: "rgba(255,255,255,0.24)",
  },
  selected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  success: {
    backgroundColor: colors.successSoft,
    borderColor: colors.successBorder,
  },
  warning: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningSoft,
  },
});

const textVariantStyles = StyleSheet.create({
  accent: { color: colors.accent },
  default: { color: colors.textSecondary },
  error: { color: colors.dangerStrong },
  hero: { color: colors.inkInvert },
  info: { color: colors.accent },
  inverse: { color: colors.inkInvert },
  selected: { color: colors.inkInvert },
  success: { color: colors.successForeground },
  warning: { color: colors.warningStrong },
});

export type { BadgeSize, BadgeVariant };
