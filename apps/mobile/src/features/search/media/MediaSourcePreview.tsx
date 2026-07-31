import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Avatar, Button } from "../../../ui";
import { formatSourceFocus, formatSourceMeta } from "./media-labels";
import type { MediaSourceRowData } from "./media-search-types";

/**
 * Anteprima di un profilo Media (CER-05 §12), visivamente distinta
 * dall'anteprima contenuto: avatar tondo (quadrato per le società), nome,
 * tipologia + territorio, specializzazione su una riga, CTA Segui/Seguito e
 * freccia di apertura.
 *
 * Nessun bookmark: il salvataggio riguarda i singoli contenuti, il Follow le
 * fonti, e i due restano distinti anche visivamente (CER-05 §13).
 */

type MediaSourcePreviewProps = {
  onPress: () => void;
  onToggleFollow?: () => void;
  row: Pick<
    MediaSourceRowData,
    | "avatar_url"
    | "categories"
    | "description"
    | "is_following"
    | "is_verified"
    | "name"
    | "regions"
    | "source_kind"
    | "source_type"
    | "topics"
  >;
  showDivider?: boolean;
};

export function MediaSourcePreview({
  onPress,
  onToggleFollow,
  row,
  showDivider = true,
}: MediaSourcePreviewProps) {
  const focus = formatSourceFocus(row);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed ? styles.pressed : null]}
    >
      <Avatar
        name={row.name}
        size="sm"
        square={row.source_type === "club"}
        uri={row.avatar_url}
      />

      <View style={styles.body}>
        <View style={styles.nameRow}>
          <AppText numberOfLines={1} style={styles.name} variant="titleSm">
            {row.name}
          </AppText>
          {row.is_verified ? (
            <Ionicons color={colors.accent} name="checkmark-circle" size={14} />
          ) : null}
        </View>

        <AppText color="muted" numberOfLines={1} variant="caption">
          {formatSourceMeta(row)}
        </AppText>

        {focus ? (
          <AppText color="muted" numberOfLines={1} variant="caption">
            {focus}
          </AppText>
        ) : null}
      </View>

      <View style={styles.actions}>
        {onToggleFollow ? (
          <Button
            label={row.is_following ? "Seguito" : "Segui"}
            onPress={onToggleFollow}
            size="sm"
            variant={row.is_following ? "secondary" : "primary"}
          />
        ) : null}
        <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
      </View>

      {showDivider ? <View style={styles.divider} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 0,
    gap: spacing[8],
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
  name: {
    flexShrink: 1,
  },
  nameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
  },
  pressed: {
    opacity: 0.82,
  },
});
