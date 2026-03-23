import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, radius, spacing } from "../../styles";
import { AppText, type AppTextColor } from "../AppText/AppText";

type StatCardTone = "default" | "accent" | "hero" | "muted";

const toneStyles: Record<StatCardTone, ViewStyle> = {
  default: {
    backgroundColor: colors.surface,
  },
  accent: {
    backgroundColor: colors.accentSoft,
  },
  hero: {
    backgroundColor: colors.heroSoft,
  },
  muted: {
    backgroundColor: colors.surfaceMuted,
  },
};

const valueToneColors: Record<StatCardTone, AppTextColor> = {
  default: "primary",
  accent: "primary",
  hero: "hero",
  muted: "primary",
};

type StatCardProps = {
  label: string;
  style?: StyleProp<ViewStyle>;
  tone?: StatCardTone;
  value: string;
};

export function StatCard({
  label,
  style,
  tone = "default",
  value,
}: StatCardProps) {
  return (
    <View style={[styles.card, toneStyles[tone], style]}>
      <AppText variant="overline" color="muted">
        {label}
      </AppText>
      <AppText variant="displaySm" color={valueToneColors[tone]}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: spacing[16],
    borderRadius: radius[8],
    gap: spacing[10],
  },
});
