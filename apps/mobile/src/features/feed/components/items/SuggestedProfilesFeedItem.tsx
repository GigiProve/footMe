/**
 * Modulo "Persone che potresti conoscere" (§11).
 *
 * Massimo tre righe compatte, titolo con azione "Vedi tutti". Le entità arrivano
 * da una query propria: se quella fallisce, questo slot mostra la sua riga di
 * errore con "Riprova" e il resto della Home non se ne accorge (§23).
 */

import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import {
  FEED_SEE_ALL,
  FEED_SUGGESTED_PROFILES_TITLE,
  suggestedProfileMetaLine,
} from "../../feed-labels";
import { FEED_SUGGESTION_ROWS } from "../../feed-suggestions-service";
import type { FeedSuggestedProfileRow } from "../../feed-types";
import { FeedModuleError } from "../modules/FeedModuleError";
import { SuggestedProfilesSkeleton } from "../skeletons/FeedSkeleton";
import { SuggestedEntityRow } from "./SuggestedEntityRow";

type SuggestedProfilesFeedItemProps = {
  rows: FeedSuggestedProfileRow[] | undefined;
  isLoading: boolean;
  isError: boolean;
  pendingId: string | null;
  onRetry: () => void;
  onSeeAll: () => void;
  onPressProfile: (row: FeedSuggestedProfileRow) => void;
  onToggleFollow: (row: FeedSuggestedProfileRow) => void;
};

export function SuggestedProfilesFeedItem({
  rows,
  isLoading,
  isError,
  pendingId,
  onRetry,
  onSeeAll,
  onPressProfile,
  onToggleFollow,
}: SuggestedProfilesFeedItemProps) {
  if (isLoading) {
    return <SuggestedProfilesSkeleton />;
  }

  if (isError) {
    return <FeedModuleError onRetry={onRetry} title={FEED_SUGGESTED_PROFILES_TITLE} />;
  }

  const visible = (rows ?? []).slice(0, FEED_SUGGESTION_ROWS);

  if (visible.length === 0) {
    return null;
  }

  return (
    <View style={styles.card} testID="feed-suggested-profiles">
      <View style={styles.header}>
        <AppText style={styles.title} variant="titleSm">
          {FEED_SUGGESTED_PROFILES_TITLE}
        </AppText>
        <Button label={FEED_SEE_ALL} onPress={onSeeAll} size="sm" variant="link" />
      </View>

      {visible.map((row, index) => (
        <SuggestedEntityRow
          avatarUrl={row.avatar_url}
          isBusy={pendingId === row.entity_id}
          isFollowing={row.is_following}
          key={row.entity_id}
          metaLine={suggestedProfileMetaLine(row)}
          name={row.full_name}
          onPress={() => onPressProfile(row)}
          onToggleFollow={() => onToggleFollow(row)}
          showDivider={index < visible.length - 1}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[10],
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  title: {
    flex: 1,
  },
});
