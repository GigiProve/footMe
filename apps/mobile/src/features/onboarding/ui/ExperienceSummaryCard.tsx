import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors } from "../../../styles";
import { AppText, Avatar } from "../../../ui";
import {
  onboardingBorderWidth,
  onboardingRadius,
  onboardingSpacing,
} from "./onboarding-tokens";

type ExperienceSummaryCardProps = {
  /** Società o club dell'esperienza. */
  title: string;
  /** Ruolo, categoria o campionato. Una riga. */
  subtitle?: string;
  /** Periodo già formattato: "2023/24", "Gen 2024 - In corso". */
  period?: string;
  /** Riepilogo statistiche già formattato: "28 presenze · 12 gol · 7 assist". */
  stats?: string;
  logoUrl?: string | null;
  onEdit?: () => void;
  onRemove?: () => void;
  testID?: string;
};

/**
 * Riepilogo compatto di un'esperienza salvata (§AB). È una scheda, non un
 * mini-cruscotto: i contenuti specifici li definisce REV-ONB-09.
 */
export function ExperienceSummaryCard({
  logoUrl,
  onEdit,
  onRemove,
  period,
  stats,
  subtitle,
  testID,
  title,
}: ExperienceSummaryCardProps) {
  return (
    <View style={styles.card} testID={testID}>
      <Avatar name={title} size="md" square uri={logoUrl ?? undefined} />

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <AppText numberOfLines={1} style={styles.title} variant="titleSm">
            {title}
          </AppText>
          {period ? (
            <AppText color="secondary" variant="metaStrong">
              {period}
            </AppText>
          ) : null}
        </View>

        {subtitle ? (
          <AppText color="secondary" numberOfLines={1} variant="meta">
            {subtitle}
          </AppText>
        ) : null}

        {stats ? (
          <AppText color="muted" numberOfLines={1} variant="meta">
            {stats}
          </AppText>
        ) : null}
      </View>

      {onEdit ? (
        <Pressable
          accessibilityLabel={`Modifica ${title}`}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onEdit}
          style={styles.action}
        >
          <Ionicons color={colors.textSecondary} name="create-outline" size={18} />
        </Pressable>
      ) : null}

      {onRemove ? (
        <Pressable
          accessibilityLabel={`Rimuovi ${title}`}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onRemove}
          style={styles.action}
        >
          <Ionicons color={colors.textMuted} name="close" size={18} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: onboardingRadius.card,
    borderWidth: onboardingBorderWidth.hairline,
    flexDirection: "row",
    gap: onboardingSpacing.s + 4,
    paddingHorizontal: onboardingSpacing.m - 2,
    paddingVertical: onboardingSpacing.s + 4,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: onboardingSpacing.s,
  },
  title: {
    flex: 1,
  },
  action: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    width: 32,
  },
});
