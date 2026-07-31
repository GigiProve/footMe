/**
 * Modulo "Società che potresti seguire" (§8, elenco dei tipi del §26).
 *
 * Stessa densità del modulo profili: righe compatte, nessuna grande card. Il
 * numero di posizioni aperte è l'unico dato "operativo" mostrato, ed è una
 * proprietà della società, non un KPI della Home (§22).
 */

import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import {
  FEED_SEE_ALL,
  FEED_SUGGESTED_CLUBS_TITLE,
  suggestedClubMetaLine,
} from "../../feed-labels";
import { FEED_SUGGESTION_ROWS } from "../../feed-suggestions-service";
import type { FeedSuggestedClubRow } from "../../feed-types";
import { FeedModuleError } from "../modules/FeedModuleError";
import { SuggestedProfilesSkeleton } from "../skeletons/FeedSkeleton";
import { SuggestedEntityRow } from "./SuggestedEntityRow";

type SuggestedClubsFeedItemProps = {
  rows: FeedSuggestedClubRow[] | undefined;
  isLoading: boolean;
  isError: boolean;
  pendingId: string | null;
  onRetry: () => void;
  onSeeAll: () => void;
  onPressClub: (row: FeedSuggestedClubRow) => void;
  onToggleFollow: (row: FeedSuggestedClubRow) => void;
};

export function SuggestedClubsFeedItem({
  rows,
  isLoading,
  isError,
  pendingId,
  onRetry,
  onSeeAll,
  onPressClub,
  onToggleFollow,
}: SuggestedClubsFeedItemProps) {
  if (isLoading) {
    return <SuggestedProfilesSkeleton />;
  }

  if (isError) {
    return <FeedModuleError onRetry={onRetry} title={FEED_SUGGESTED_CLUBS_TITLE} />;
  }

  const visible = (rows ?? []).slice(0, FEED_SUGGESTION_ROWS);

  if (visible.length === 0) {
    return null;
  }

  return (
    <View style={styles.card} testID="feed-suggested-clubs">
      <View style={styles.header}>
        <AppText style={styles.title} variant="titleSm">
          {FEED_SUGGESTED_CLUBS_TITLE}
        </AppText>
        <Button label={FEED_SEE_ALL} onPress={onSeeAll} size="sm" variant="link" />
      </View>

      {visible.map((row, index) => (
        <SuggestedEntityRow
          avatarUrl={row.logo_url}
          isBusy={pendingId === row.entity_id}
          isClub
          isFollowing={row.is_following}
          key={row.entity_id}
          metaLine={suggestedClubMetaLine(row)}
          name={row.name}
          onPress={() => onPressClub(row)}
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
