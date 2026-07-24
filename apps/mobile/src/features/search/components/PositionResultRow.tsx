import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { ListItem } from "../../../ui";
import { formatDeadlineLabel } from "../search-format";
import type { PositionSearchRow } from "../search-types";

type PositionResultRowProps = {
  onPress?: () => void;
  onToggleSaved: () => void;
  row: PositionSearchRow;
};

export function PositionResultRow({
  onPress,
  onToggleSaved,
  row,
}: PositionResultRowProps) {
  const line1 = [row.club_name, row.team_name, row.category]
    .filter(Boolean)
    .join(" • ");
  const line2 = [row.region, row.deadline ? formatDeadlineLabel(row.deadline) : null]
    .filter(Boolean)
    .join(" • ");
  const subtitle = [line1, line2].filter(Boolean).join("\n");

  return (
    <ListItem
      left={
        <View style={styles.iconWrap}>
          <Ionicons color={colors.textMuted} name="briefcase-outline" size={18} />
        </View>
      }
      onPress={onPress}
      right={
        <View style={styles.right}>
          <Pressable
            accessibilityLabel={row.is_saved ? "Rimuovi dai salvati" : "Salva posizione"}
            accessibilityRole="button"
            hitSlop={12}
            onPress={onToggleSaved}
          >
            <Ionicons
              color={row.is_saved ? colors.accent : colors.textMuted}
              name={row.is_saved ? "bookmark" : "bookmark-outline"}
              size={20}
            />
          </Pressable>
          <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
        </View>
      }
      subtitle={subtitle}
      subtitleNumberOfLines={2}
      title={row.title}
    />
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  right: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
});
