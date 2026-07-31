import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing, typography } from "../../../theme/tokens";
import { Avatar, AppText } from "../../../ui";
import type { PositionSearchRow } from "../search-types";
import {
  distanceLabel,
  locationMetaLine,
  roleHeadline,
  teamMetaLine,
} from "./positions-labels";

type PositionPreviewRowProps = {
  row: PositionSearchRow;
  onPress: () => void;
  onToggleSaved: () => void;
};

export function PositionPreviewRow({
  row,
  onPress,
  onToggleSaved,
}: PositionPreviewRowProps) {
  const distance = distanceLabel(row.distance_km);
  const team = teamMetaLine(row);
  const location = locationMetaLine(row);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <Avatar name={row.club_name} size="md" square uri={row.club_logo_url} />

      <View style={styles.body}>
        <AppText numberOfLines={1} style={styles.role} variant="titleSm">
          {roleHeadline(row)}
        </AppText>
        {team ? (
          <AppText color="secondary" numberOfLines={1} variant="bodySm">
            {team}
          </AppText>
        ) : null}
        {location ? (
          <AppText color="muted" numberOfLines={1} variant="bodySm">
            {location}
          </AppText>
        ) : null}
        {distance ? (
          <AppText color="accent" numberOfLines={1} variant="caption">
            {distance}
          </AppText>
        ) : null}
      </View>

      <View style={styles.actions}>
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
  body: {
    flex: 1,
    gap: spacing[4],
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[12],
  },
  role: {
    fontWeight: typography.fontWeight.semibold,
  },
  row: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    paddingVertical: spacing[12],
  },
});
