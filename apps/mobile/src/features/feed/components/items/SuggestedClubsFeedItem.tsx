/**
 * Modulo "Società che potresti seguire" (HOM-01.1 §18, §22).
 *
 * Stesso linguaggio del modulo persone: una Società cambia solo logo, nome e
 * metadata (§18), nessun fondo o badge dedicato. Righe compatte sotto
 * un'intestazione testuale, nessuna card.
 */

import {
  FEED_SEE_ALL,
  FEED_SUGGESTED_CLUBS_TITLE,
  suggestedClubMetaLine,
} from "../../feed-labels";
import { FEED_SUGGESTION_ROWS } from "../../feed-suggestions-service";
import type { FeedSuggestedClubRow } from "../../feed-types";
import { FeedModuleError } from "../modules/FeedModuleError";
import { SuggestedProfilesSkeleton } from "../skeletons/FeedSkeleton";
import { FeedItemFrame } from "./FeedItemFrame";
import { FeedSectionHeader } from "./FeedSectionHeader";
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
    return (
      <FeedItemFrame>
        <FeedModuleError onRetry={onRetry} title={FEED_SUGGESTED_CLUBS_TITLE} />
      </FeedItemFrame>
    );
  }

  const visible = (rows ?? []).slice(0, FEED_SUGGESTION_ROWS);

  if (visible.length === 0) {
    return null;
  }

  return (
    <FeedItemFrame testID="feed-suggested-clubs">
      <FeedSectionHeader
        actionLabel={FEED_SEE_ALL}
        onAction={onSeeAll}
        title={FEED_SUGGESTED_CLUBS_TITLE}
      />

      {visible.map((row) => (
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
        />
      ))}
    </FeedItemFrame>
  );
}
