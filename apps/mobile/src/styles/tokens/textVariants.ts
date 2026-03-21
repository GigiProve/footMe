import { TextStyle } from "react-native";

import { typography } from "./typography";

export const textVariants = {
  displayLg: {
    fontSize: typography.fontSize[34],
    fontWeight: typography.fontWeight.heavy,
    lineHeight: typography.lineHeight[38],
  },
  displaySm: {
    fontSize: typography.fontSize[28],
    fontWeight: typography.fontWeight.heavy,
    lineHeight: typography.lineHeight[32],
  },
  headingLg: {
    fontSize: typography.fontSize[24],
    fontWeight: typography.fontWeight.heavy,
    lineHeight: typography.lineHeight[28],
  },
  headingMd: {
    fontSize: typography.fontSize[20],
    fontWeight: typography.fontWeight.heavy,
    lineHeight: typography.lineHeight[28],
  },
  headingSm: {
    fontSize: typography.fontSize[18],
    fontWeight: typography.fontWeight.heavy,
    lineHeight: typography.lineHeight[24],
  },
  titleMd: {
    fontSize: typography.fontSize[17],
    fontWeight: typography.fontWeight.bold,
    lineHeight: typography.lineHeight[24],
  },
  titleSm: {
    fontSize: typography.fontSize[16],
    fontWeight: typography.fontWeight.bold,
    lineHeight: typography.lineHeight[22],
  },
  bodyLg: {
    fontSize: typography.fontSize[16],
    fontWeight: typography.fontWeight.regular,
    lineHeight: typography.lineHeight[24],
  },
  bodySm: {
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.regular,
    lineHeight: typography.lineHeight[22],
  },
  caption: {
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
    lineHeight: typography.lineHeight[22],
  },
  overline: {
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
    lineHeight: typography.lineHeight[22],
    textTransform: "uppercase" as const,
    letterSpacing: typography.letterSpacing.md,
  },
} as const satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof textVariants;
