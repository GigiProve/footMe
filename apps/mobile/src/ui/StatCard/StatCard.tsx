import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, radius, spacing, typography } from "../../styles";
import { AppText, type AppTextColor } from "../AppText/AppText";

/**
 * Cella statistica (§1c, "Stagione 2025/26"): numero in Mulish 900 sopra,
 * etichetta piccola sotto. Di default non ha superficie propria — vive dentro
 * un modulo, in fila con le altre celle. I toni restano per i punti che
 * la usano ancora come riquadro isolato.
 */
type StatCardTone = "default" | "accent" | "hero" | "muted";

const toneStyles: Record<StatCardTone, ViewStyle> = {
  default: {},
  accent: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius[12],
    padding: spacing[14],
  },
  hero: {
    backgroundColor: colors.heroSoft,
    borderRadius: radius[12],
    padding: spacing[14],
  },
  muted: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[12],
    padding: spacing[14],
  },
};

const valueToneColors: Record<StatCardTone, AppTextColor> = {
  default: "primary",
  accent: "accent",
  hero: "primary",
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
      <AppText color={valueToneColors[tone]} variant="statValue">
        {value}
      </AppText>
      <AppText color="muted" numberOfLines={2} style={styles.label}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    gap: spacing[4],
  },
  label: {
    fontSize: typography.fontSize[11],
    fontWeight: typography.fontWeight.semibold,
    lineHeight: typography.lineHeight[14],
  },
});
