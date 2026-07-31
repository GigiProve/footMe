/**
 * Riga compatta di un'entità suggerita (§11).
 *
 * Il §11 è esplicito: "il modulo non deve utilizzare grandi card individuali".
 * Da qui la riga sottile con foto, nome, riga secondaria e CTA "Segui" — la
 * stessa densità di `ProfileResultRow` in Cerca, così le due superfici si
 * somigliano.
 */

import { Pressable, StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText, Avatar, Button } from "../../../../ui";
import { FEED_FOLLOW_CTA, FEED_FOLLOWING_LABEL } from "../../feed-labels";

type SuggestedEntityRowProps = {
  name: string;
  metaLine: string;
  avatarUrl: string | null;
  isClub?: boolean;
  isFollowing: boolean;
  isBusy?: boolean;
  onPress: () => void;
  onToggleFollow: () => void;
  showDivider?: boolean;
};

export function SuggestedEntityRow({
  name,
  metaLine,
  avatarUrl,
  isClub = false,
  isFollowing,
  isBusy = false,
  onPress,
  onToggleFollow,
  showDivider = true,
}: SuggestedEntityRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.row, showDivider ? styles.divided : null]}
    >
      <Avatar name={name} size="sm" square={isClub} uri={avatarUrl ?? undefined} />

      <View style={styles.body}>
        <AppText numberOfLines={1} variant="titleSm">
          {name}
        </AppText>
        {metaLine ? (
          <AppText color="muted" numberOfLines={1} variant="caption">
            {metaLine}
          </AppText>
        ) : null}
      </View>

      <Button
        label={isFollowing ? FEED_FOLLOWING_LABEL : FEED_FOLLOW_CTA}
        loading={isBusy}
        onPress={onToggleFollow}
        selected={isFollowing}
        size="sm"
        variant="chipAction"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: spacing[4],
  },
  divided: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[10],
    paddingVertical: spacing[10],
  },
});
