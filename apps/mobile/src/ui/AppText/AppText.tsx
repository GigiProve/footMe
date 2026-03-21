import { Text, type TextProps } from "react-native";

import { colors, textVariants, type TextVariant } from "../../styles";

type AppTextColor = keyof typeof colorMap;

const colorMap = {
  primary: colors.textPrimary,
  secondary: colors.textSecondary,
  muted: colors.textMuted,
  accent: colors.accent,
  accentStrong: colors.accentStrong,
  hero: colors.hero,
  danger: colors.danger,
  success: colors.success,
  warning: colors.warning,
  inverse: colors.inkInvert,
  inverseMuted: colors.textInverseMuted,
  inverseSoft: colors.textInverseSoft,
} as const;

type AppTextProps = TextProps & {
  variant?: TextVariant;
  color?: AppTextColor;
  align?: "left" | "center" | "right";
};

export function AppText({
  variant = "bodyLg",
  color = "primary",
  align,
  style,
  ...rest
}: AppTextProps) {
  return (
    <Text
      style={[
        textVariants[variant],
        { color: colorMap[color] },
        align ? { textAlign: align } : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

export type { AppTextProps, AppTextColor };
