/**
 * Intestazione di una card: avatar/logo, nome, verifica, tempo dalla
 * pubblicazione, menu ⋯ (§10).
 *
 * `formatRelativeTime` è già in src/lib: non si reimplementa il calcolo del
 * tempo relativo.
 */

import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { formatRelativeTime } from "../../../../lib/relative-time";
import { colors, spacing } from "../../../../theme/tokens";
import { AppText, Avatar } from "../../../../ui";
import type { FeedItem } from "../../feed-types";

type FeedItemHeaderProps = {
  item: FeedItem;
  onPressAuthor?: () => void;
  right?: React.ReactNode;
};

export function FeedItemHeader({ item, onPressAuthor, right }: FeedItemHeaderProps) {
  const author = item.author;

  if (!author) {
    return null;
  }

  const meta = [
    item.publishedAt ? formatRelativeTime(item.publishedAt) : null,
    item.reasonLabel,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityLabel={`Apri ${author.name}`}
        accessibilityRole="button"
        disabled={!onPressAuthor}
        onPress={onPressAuthor}
        style={styles.identity}
      >
        <Avatar
          name={author.name}
          size="sm"
          square={author.kind === "club"}
          uri={author.avatarUrl ?? undefined}
        />
        <View style={styles.identityText}>
          <View style={styles.nameRow}>
            <AppText numberOfLines={1} style={styles.name} variant="titleSm">
              {author.name}
            </AppText>
            {author.isVerified ? (
              <Ionicons
                accessibilityLabel="Profilo verificato"
                color={colors.accent}
                name="checkmark-circle"
                size={14}
              />
            ) : null}
          </View>
          {meta ? (
            <AppText color="muted" numberOfLines={1} variant="caption">
              {meta}
            </AppText>
          ) : null}
        </View>
      </Pressable>

      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  identity: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing[10],
  },
  identityText: {
    flex: 1,
  },
  name: {
    flexShrink: 1,
  },
  nameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
  },
  row: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[8],
  },
});
