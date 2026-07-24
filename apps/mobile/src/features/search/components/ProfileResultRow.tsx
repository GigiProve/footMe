import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Avatar } from "../../../ui";
import { buildProfileMetaLines } from "../search-format";
import type { ProfileSearchRow } from "../search-types";

export type ProfileResultRowShortlistState = {
  actionable: boolean;
  inShortlist: boolean;
  onPress: () => void;
};

type ProfileResultRowProps = {
  onPress: () => void;
  onToggleSave: () => void;
  row: ProfileSearchRow;
  saved: boolean;
  shortlist: ProfileResultRowShortlistState | null;
};

export function ProfileResultRow({
  onPress,
  onToggleSave,
  row,
  saved,
  shortlist,
}: ProfileResultRowProps) {
  const { lines, note } = buildProfileMetaLines(row);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed ? styles.pressed : null]}
    >
      <Avatar name={row.full_name} size="md" uri={row.avatar_url} />

      <View style={styles.body}>
        <AppText numberOfLines={1} variant="titleSm">
          {row.full_name}
        </AppText>
        {lines.map((line, index) => (
          <AppText color="muted" key={index} numberOfLines={1} variant="caption">
            {line}
          </AppText>
        ))}
        {note ? (
          <AppText color="accent" numberOfLines={1} variant="caption">
            {note}
          </AppText>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityLabel="Salva profilo"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onToggleSave}
          style={styles.actionButton}
        >
          <Ionicons
            color={saved ? colors.accent : colors.textMuted}
            name={saved ? "bookmark" : "bookmark-outline"}
            size={20}
          />
        </Pressable>

        {shortlist ? (
          <Pressable
            accessibilityLabel="Shortlist"
            accessibilityRole="button"
            hitSlop={8}
            onPress={shortlist.onPress}
            style={[styles.actionButton, shortlist.actionable ? null : styles.actionMuted]}
          >
            <Ionicons
              color={shortlist.inShortlist ? colors.accent : colors.textMuted}
              name={shortlist.inShortlist ? "star" : "star-outline"}
              size={20}
            />
          </Pressable>
        ) : null}

        <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
      </View>

      <View style={styles.divider} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  actionMuted: {
    opacity: 0.5,
  },
  actions: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 0,
    gap: spacing[10],
  },
  body: {
    flex: 1,
    gap: spacing[4],
  },
  container: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    paddingVertical: spacing[12],
  },
  divider: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    bottom: 0,
    left: 56,
    position: "absolute",
    right: 0,
  },
  pressed: {
    opacity: 0.82,
  },
});
