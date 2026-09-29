/**
 * Riga dell'hub (§F.1): icona lineare, titolo, riepilogo dinamico, chevron.
 *
 * Non è una card: l'hub è una lista con hairline fra le righe. Il touch target
 * copre l'intera riga, non il solo chevron.
 */
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

type ProfileEditSectionRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  summary: string;
  testID?: string;
  title: string;
};

export function ProfileEditSectionRow({
  icon,
  onPress,
  summary,
  testID,
  title,
}: ProfileEditSectionRowProps) {
  return (
    <Pressable
      accessibilityHint={summary}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      testID={testID}
    >
      <View style={styles.iconWrapper}>
        <Ionicons color={colors.textSecondary} name={icon} size={20} />
      </View>
      <View style={styles.textBlock}>
        <AppText variant="titleSm">{title}</AppText>
        <AppText color="secondary" numberOfLines={1} variant="bodySm">
          {summary}
        </AppText>
      </View>
      <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
    minHeight: 56,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
    backgroundColor: colors.surface,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  iconWrapper: {
    width: 28,
    alignItems: "center",
  },
  textBlock: {
    flex: 1,
    gap: spacing[4],
  },
});
