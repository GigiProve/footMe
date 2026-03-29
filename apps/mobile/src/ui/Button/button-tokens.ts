import { colors, radius, sizes, spacing, typography } from "../../styles";

export const buttonHeights = {
  sm: sizes.touchTarget,
  md: 48,
  lg: 52,
} as const;

export const buttonHorizontalPadding = {
  sm: spacing[14],
  md: spacing[20],
  lg: spacing[20],
} as const;

export const buttonIconSizes = {
  sm: 16,
  md: 18,
  lg: 20,
} as const;

export const buttonTypography = {
  sm: {
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.semibold,
    lineHeight: typography.lineHeight[22],
  },
  md: {
    fontSize: typography.fontSize[15],
    fontWeight: typography.fontWeight.semibold,
    lineHeight: typography.lineHeight[22],
  },
  lg: {
    fontSize: typography.fontSize[15],
    fontWeight: typography.fontWeight.semibold,
    lineHeight: typography.lineHeight[22],
  },
} as const;

export const buttonRadius = {
  default: radius[12],
  chip: radius.full,
  icon: radius.full,
} as const;

export const buttonContentGap = spacing[8];

export const buttonStateOpacity = {
  disabled: 0.5,
  loading: 0.8,
  pressed: 0.88,
} as const;

export const buttonVariants = {
  chipAction: {
    backgroundColor: colors.surfaceMuted,
    borderColor: "transparent",
    borderWidth: 1,
    textColor: colors.textPrimary,
  },
  danger: {
    backgroundColor: colors.surface,
    borderColor: colors.danger,
    borderWidth: 1.5,
    textColor: colors.danger,
  },
  ghost: {
    backgroundColor: colors.accentSoft,
    borderColor: "transparent",
    borderWidth: 0,
    textColor: colors.textPrimary,
  },
  icon: {
    backgroundColor: colors.accentSoft,
    borderColor: "transparent",
    borderWidth: 0,
    textColor: colors.textPrimary,
  },
  link: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    borderWidth: 0,
    textColor: colors.accent,
  },
  outline: {
    backgroundColor: "transparent",
    borderColor: colors.border,
    borderWidth: 1,
    textColor: colors.textPrimary,
  },
  primary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
    borderWidth: 1,
    textColor: colors.inkInvert,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.accent,
    borderWidth: 1.5,
    textColor: colors.accent,
  },
  tertiary: {
    backgroundColor: colors.accentSoft,
    borderColor: "transparent",
    borderWidth: 0,
    textColor: colors.textPrimary,
  },
} as const;

export const destructiveOverrides = {
  chipAction: {
    activeBackgroundColor: colors.danger,
    activeBorderColor: colors.danger,
    activeTextColor: colors.inkInvert,
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
    textColor: colors.dangerStrong,
  },
  danger: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
    textColor: colors.destructiveForeground,
  },
  ghost: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    textColor: colors.dangerStrong,
  },
  icon: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerSoft,
    textColor: colors.dangerStrong,
  },
  link: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    textColor: colors.dangerStrong,
  },
  outline: {
    backgroundColor: "transparent",
    borderColor: colors.danger,
    textColor: colors.dangerStrong,
  },
  primary: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
    textColor: colors.destructiveForeground,
  },
  secondary: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
    textColor: colors.dangerStrong,
  },
  tertiary: {
    backgroundColor: "transparent",
    borderColor: colors.danger,
    textColor: colors.dangerStrong,
  },
} as const;

export const chipSelectedPalette = {
  backgroundColor: colors.accentSoft,
  borderColor: "rgba(10, 102, 194, 0.2)",
  textColor: colors.accent,
} as const;
