import { StyleSheet } from "react-native";

import { colors, radius, spacing, typography } from "../../../theme/tokens";

/**
 * Shared auth screen constants aligned with Banani mockup.
 */
export const AUTH_BUTTON_HEIGHT = 56;
export const AUTH_BUTTON_RADIUS = radius[12];
export const AUTH_CONTENT_PADDING_H = spacing[24];

export const authStyles = StyleSheet.create({
  /** Full-screen white background container */
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },

  /** Navigation bar with back button — 56px height */
  headerNav: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing[16],
  },

  /** Back button — 40px round touch target */
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
    marginLeft: -spacing[8],
  },

  /** Main content area with horizontal padding */
  contentPad: {
    flex: 1,
    paddingHorizontal: AUTH_CONTENT_PADDING_H,
    paddingBottom: spacing[40],
  },

  /** Page title — 28px bold */
  pageTitle: {
    marginBottom: spacing[12],
  },

  /** Page description — 15px muted, below title */
  pageDesc: {
    fontSize: typography.fontSize[15],
    lineHeight: typography.lineHeight[22],
    color: colors.textSecondary,
    marginBottom: spacing[32],
  },

  /** Input group wrapper — 20px bottom margin */
  inputGroup: {
    marginBottom: spacing[20],
  },

  /** Input label — 13px semibold */
  inputLabel: {
    fontSize: typography.fontSize[13],
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing[8],
  },

  /** Primary CTA button overrides for auth screens */
  primaryButton: {
    minHeight: AUTH_BUTTON_HEIGHT,
    borderRadius: AUTH_BUTTON_RADIUS,
  },

  /** Outline CTA button for auth screens */
  outlineButton: {
    minHeight: AUTH_BUTTON_HEIGHT,
    borderRadius: AUTH_BUTTON_RADIUS,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: "transparent",
  },

  /** Social login button — bordered, white bg */
  socialButton: {
    minHeight: AUTH_BUTTON_HEIGHT,
    borderRadius: AUTH_BUTTON_RADIUS,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  /** Social login button — dark variant (Apple) */
  socialButtonDark: {
    minHeight: AUTH_BUTTON_HEIGHT,
    borderRadius: AUTH_BUTTON_RADIUS,
    backgroundColor: colors.surfaceInverse,
    borderColor: colors.surfaceInverse,
  },

  /** "oppure" divider row */
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing[24],
  },

  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },

  dividerText: {
    paddingHorizontal: spacing[16],
  },

  /** Bottom link text — centered, 14px */
  bottomLink: {
    textAlign: "center",
    marginTop: spacing[32],
  },

  /** Inline link text */
  textLink: {
    color: colors.accent,
    fontWeight: typography.fontWeight.semibold,
  },
});
