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
  warning: colors.warningForeground,
  inverse: colors.inkInvert,
  inverseMuted: colors.textInverseMuted,
  inverseSoft: colors.textInverseSoft,
  // Su superficie ink il blu e il verde della palette non reggono il contrasto:
  // il design usa due varianti schiarite (§1c).
  inverseAccent: colors.accentOnInverse,
  inverseSuccess: colors.successOnInverse,
  // DAS-REV-10 §4: testo nero neutro e metadati grigi neutri. Tre colori in
  // più, non una ridefinizione di `primary`/`secondary`: il resto dell'app
  // continua a leggere l'ink blu della palette ProLink.
  neutral: colors.textNeutral,
  neutralMuted: colors.textNeutralMuted,
  neutralSoft: colors.textNeutralSoft,
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
