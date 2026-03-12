import { colors, radius, sizes, spacing, typography } from "../../styles";

export const buttonHeights = {
  sm: sizes.touchTarget,
  md: 48,
  lg: 52,
} as const;

export const buttonHorizontalPadding = {
  sm: spacing[12],
  md: spacing[16],
  lg: spacing[18],
} as const;

export const buttonIconSizes = {
  sm: 16,
  md: 18,
  lg: 20,
} as const;

export const buttonTypography = {
  sm: {
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.bold,
    lineHeight: typography.lineHeight[22],
  },
  md: {
    fontSize: typography.fontSize[16],
    fontWeight: typography.fontWeight.heavy,
    lineHeight: typography.lineHeight[24],
  },
  lg: {
    fontSize: typography.fontSize[17],
    fontWeight: typography.fontWeight.heavy,
    lineHeight: typography.lineHeight[24],
  },
} as const;

export const buttonRadius = {
  default: radius[16],
  chip: radius.full,
  icon: radius.full,
} as const;

export const buttonContentGap = spacing[8];

export const buttonStateOpacity = {
  disabled: 0.56,
  loading: 0.74,
  pressed: 0.88,
} as const;

export const buttonVariants = {
  chipAction: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    textColor: colors.textPrimary,
  },
  danger: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
    borderWidth: 1,
    textColor: colors.inkInvert,
  },
  icon: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    borderWidth: 1,
    textColor: colors.accentStrong,
  },
  link: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    borderWidth: 1,
    textColor: colors.accentStrong,
  },
  primary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
    borderWidth: 1,
    textColor: colors.inkInvert,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    textColor: colors.textPrimary,
  },
  tertiary: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    borderWidth: 1,
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
    textColor: colors.inkInvert,
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
  primary: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
    textColor: colors.inkInvert,
  },
  secondary: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
    textColor: colors.dangerStrong,
  },
  tertiary: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    textColor: colors.dangerStrong,
  },
} as const;

export const chipSelectedPalette = {
  backgroundColor: colors.accentStrong,
  borderColor: colors.accentStrong,
  textColor: colors.inkInvert,
} as const;
