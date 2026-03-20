import { TextStyle } from "react-native";

import { colors } from "./colors";
import { typography } from "./typography";

/**
 * Semantic text-style presets used throughout FootMe.
 *
 * Every preset specifies font-size, line-height, font-weight, and a default
 * color so that each screen can produce consistent hierarchy without ad-hoc
 * style objects.
 *
 * Scale (roughly modelled on LinkedIn mobile):
 *  display  – hero headlines (onboarding, splash)
 *  h1       – page titles
 *  h2       – section titles
 *  h3       – card titles, prominent list names
 *  title    – section headers inside cards
 *  body     – default body copy
 *  bodySmall – dense info lines, metadata
 *  caption  – field labels, timestamps, chip text
 *  meta     – micro labels (all-caps field hints, tab bar labels)
 */
export const textPresets = {
  display: {
    fontSize: typography.fontSize[34],
    lineHeight: typography.lineHeight[38],
    fontWeight: typography.fontWeight.heavy,
    color: colors.textPrimary,
  },
  h1: {
    fontSize: typography.fontSize[28],
    lineHeight: typography.lineHeight[34],
    fontWeight: typography.fontWeight.heavy,
    color: colors.textPrimary,
  },
  h2: {
    fontSize: typography.fontSize[24],
    lineHeight: typography.lineHeight[32],
    fontWeight: typography.fontWeight.heavy,
    color: colors.textPrimary,
  },
  h3: {
    fontSize: typography.fontSize[20],
    lineHeight: typography.lineHeight[28],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  title: {
    fontSize: typography.fontSize[17],
    lineHeight: typography.lineHeight[24],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  body: {
    fontSize: typography.fontSize[16],
    lineHeight: typography.lineHeight[24],
    fontWeight: typography.fontWeight.regular,
    color: colors.textPrimary,
  },
  bodySmall: {
    fontSize: typography.fontSize[14],
    lineHeight: typography.lineHeight[22],
    fontWeight: typography.fontWeight.regular,
    color: colors.textSecondary,
  },
  caption: {
    fontSize: typography.fontSize[12],
    lineHeight: typography.lineHeight[22],
    fontWeight: typography.fontWeight.bold,
    color: colors.textSecondary,
  },
  meta: {
    fontSize: typography.fontSize[12],
    lineHeight: typography.lineHeight[22],
    fontWeight: typography.fontWeight.bold,
    color: colors.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: typography.letterSpacing.md,
  },
} as const satisfies Record<string, TextStyle>;

export type TextPreset = keyof typeof textPresets;
