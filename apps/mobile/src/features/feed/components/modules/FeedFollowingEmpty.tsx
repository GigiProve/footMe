/**
 * Stato vuoto della tab Seguiti (§14).
 *
 * Il §14 contiene una correzione grafica esplicita: "non utilizzare un grande
 * campo illustrato o un'area vuota eccessiva", il pulsante "Scopri profili da
 * seguire" deve essere l'elemento principale e "il resto della schermata deve
 * lasciare spazio ai suggerimenti".
 *
 * Da qui: nessuna illustrazione, nessuna icona grande, nessun `EmptyState` (che
 * porta un cerchio con icona e centratura verticale). Solo titolo, CTA e poi i
 * suggerimenti, che occupano la maggior parte dello spazio.
 *
 * Due varianti: chi non segue nessuno vede i suggerimenti; chi segue profili che
 * non hanno pubblicato NON li vede, perché il §5 vale ancora e le sue scelte
 * sono già state fatte.
 */

import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import {
  FEED_FOLLOWING_EMPTY_CTA,
  FEED_FOLLOWING_EMPTY_TITLE,
  FEED_FOLLOWING_QUIET_TITLE,
  FEED_SUGGESTIONS_TITLE,
  suggestedProfileMetaLine,
} from "../../feed-labels";
import { FEED_SUGGESTION_ROWS } from "../../feed-suggestions-service";
import type { FeedSuggestedProfileRow } from "../../feed-types";
import { SuggestedEntityRow } from "../items/SuggestedEntityRow";

type FeedFollowingEmptyProps = {
  reason: "no_follows" | "no_content";
  suggestions: FeedSuggestedProfileRow[] | undefined;
  pendingId: string | null;
  onDiscover: () => void;
  onPressProfile: (row: FeedSuggestedProfileRow) => void;
  onToggleFollow: (row: FeedSuggestedProfileRow) => void;
};

export function FeedFollowingEmpty({
  reason,
  suggestions,
  pendingId,
  onDiscover,
  onPressProfile,
  onToggleFollow,
}: FeedFollowingEmptyProps) {
  const showSuggestions = reason === "no_follows";
  const visible = showSuggestions
    ? (suggestions ?? []).slice(0, FEED_SUGGESTION_ROWS)
    : [];

  return (
    <View style={styles.container} testID="feed-following-empty">
      <View style={styles.intro}>
        <AppText variant="titleMd">
          {reason === "no_follows"
            ? FEED_FOLLOWING_EMPTY_TITLE
            : FEED_FOLLOWING_QUIET_TITLE}
        </AppText>
        <Button fullWidth label={FEED_FOLLOWING_EMPTY_CTA} onPress={onDiscover} />
      </View>

      {visible.length > 0 ? (
        <View style={styles.suggestions}>
          <AppText color="muted" variant="overline">
            {FEED_SUGGESTIONS_TITLE}
          </AppText>
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
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[16],
    paddingTop: spacing[16],
  },
  intro: {
    // Spazio contenuto, non un'area vuota: il §14 lo chiede esplicitamente.
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    gap: spacing[12],
    padding: spacing[16],
  },
  suggestions: {
    gap: spacing[4],
  },
});
