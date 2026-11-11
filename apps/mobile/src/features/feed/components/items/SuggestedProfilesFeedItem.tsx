/**
 * Modulo "Persone che potresti conoscere" (HOM-01.1 §19–§21).
 *
 * Alleggerito: niente card attorno, intestazione testuale con "Vedi tutte" e
 * al massimo tre righe compatte senza card individuali. Le entità arrivano da
 * una query propria: se fallisce, lo slot mostra la riga di retry locale e il
 * resto della Home non se ne accorge (§57).
 */

import {
  FEED_SEE_ALL,
  FEED_SUGGESTED_PROFILES_TITLE,
  suggestedProfileMetaLine,
} from "../../feed-labels";
import { FEED_SUGGESTION_ROWS } from "../../feed-suggestions-service";
import type { FeedSuggestedProfileRow } from "../../feed-types";
import { FeedModuleError } from "../modules/FeedModuleError";
import { SuggestedProfilesSkeleton } from "../skeletons/FeedSkeleton";
import { FeedItemFrame } from "./FeedItemFrame";
import { FeedSectionHeader } from "./FeedSectionHeader";
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
    return (
      <FeedItemFrame>
        <FeedModuleError onRetry={onRetry} title={FEED_SUGGESTED_PROFILES_TITLE} />
      </FeedItemFrame>
    );
  }

  const visible = (rows ?? []).slice(0, FEED_SUGGESTION_ROWS);

  // Nessuna riga: lo slot sparisce del tutto, cornice compresa (§57).
  if (visible.length === 0) {
    return null;
  }

  return (
    <FeedItemFrame testID="feed-suggested-profiles">
      <FeedSectionHeader
        actionLabel={FEED_SEE_ALL}
        onAction={onSeeAll}
        title={FEED_SUGGESTED_PROFILES_TITLE}
      />

      {visible.map((row) => (
        <SuggestedEntityRow
          avatarUrl={row.avatar_url}
          isBusy={pendingId === row.entity_id}
          isFollowing={row.is_following}
          key={row.entity_id}
          metaLine={suggestedProfileMetaLine(row)}
          name={row.full_name}
          onPress={() => onPressProfile(row)}
          onToggleFollow={() => onToggleFollow(row)}
        />
      ))}
    </FeedItemFrame>
  );
}
