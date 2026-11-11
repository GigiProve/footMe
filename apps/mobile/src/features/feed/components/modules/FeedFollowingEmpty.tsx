/**
 * Stato vuoto della tab Seguiti (HOM-01.1 §34–§38).
 *
 * Compatto: nessun campo da calcio né illustrazione, solo un'icona in un
 * cerchio neutro, "Ancora nessun contenuto", una riga di testo e "Scopri chi
 * seguire", che apre Cerca → Profili (§36, nessuna discovery Home-specifica).
 * Subito sotto "Suggerimenti per iniziare", al massimo quattro righe fra
 * persone, Società e Media (§37), con il Follow globale (§38).
 *
 * Non si riusa `EmptyState`: disegna una cornice con bordo e un cerchio blu, e
 * il visual master vuole lo stato aperto sulla pagina e un cerchio neutro.
 *
 * Chi segue già qualcuno che non ha pubblicato vede lo stesso stato ma senza
 * suggerimenti: le sue scelte sono già fatte, e Seguiti non mostra moduli
 * discovery (§25).
 */

import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import {
  FEED_FOLLOWING_EMPTY_BODY,
  FEED_FOLLOWING_EMPTY_CTA,
  FEED_FOLLOWING_EMPTY_TITLE,
  FEED_FOLLOWING_SUGGESTION_ROWS,
  FEED_SUGGESTIONS_TITLE,
  suggestedClubMetaLine,
  suggestedProfileMetaLine,
} from "../../feed-labels";
import {
  mixFollowingSuggestions,
  type FollowingSuggestion,
} from "../../feed-suggestions-presentation";
import type { FeedSuggestedClubRow, FeedSuggestedProfileRow } from "../../feed-types";
import { FeedSectionHeader } from "../items/FeedSectionHeader";
import { SuggestedEntityRow } from "../items/SuggestedEntityRow";

type FeedFollowingEmptyProps = {
  reason: "no_follows" | "no_content";
  profiles: FeedSuggestedProfileRow[] | undefined;
  clubs: FeedSuggestedClubRow[] | undefined;
  pendingId: string | null;
  onDiscover: () => void;
  onPressProfile: (row: FeedSuggestedProfileRow) => void;
  onPressClub: (row: FeedSuggestedClubRow) => void;
  onToggleFollowProfile: (row: FeedSuggestedProfileRow) => void;
  onToggleFollowClub: (row: FeedSuggestedClubRow) => void;
};

export function FeedFollowingEmpty({
  reason,
  profiles,
  clubs,
  pendingId,
  onDiscover,
  onPressProfile,
  onPressClub,
  onToggleFollowProfile,
  onToggleFollowClub,
}: FeedFollowingEmptyProps) {
  const suggestions =
    reason === "no_follows"
      ? mixFollowingSuggestions(profiles, clubs, FEED_FOLLOWING_SUGGESTION_ROWS)
      : [];

  return (
    <View testID="feed-following-empty">
      <View style={styles.intro}>
        <View style={styles.iconCircle}>
          <Ionicons color={colors.textSecondary} name="people-outline" size={30} />
        </View>
        <AppText accessibilityRole="header" align="center" variant="headingSm">
          {FEED_FOLLOWING_EMPTY_TITLE}
        </AppText>
        <AppText align="center" color="secondary" variant="feedMeta">
          {FEED_FOLLOWING_EMPTY_BODY}
        </AppText>
        <Button label={FEED_FOLLOWING_EMPTY_CTA} onPress={onDiscover} style={styles.cta} />
      </View>

      {suggestions.length > 0 ? (
        <View style={styles.suggestions}>
          <FeedSectionHeader title={FEED_SUGGESTIONS_TITLE} />
          {suggestions.map((entry, index) => (
            <SuggestionRow
              entry={entry}
              isBusy={pendingId === entry.row.entity_id}
              key={`${entry.kind}:${entry.row.entity_id}`}
              onPressClub={onPressClub}
              onPressProfile={onPressProfile}
              onToggleFollowClub={onToggleFollowClub}
              onToggleFollowProfile={onToggleFollowProfile}
              showDivider={index < suggestions.length - 1}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SuggestionRow({
  entry,
  isBusy,
  showDivider,
  onPressProfile,
  onPressClub,
  onToggleFollowProfile,
  onToggleFollowClub,
}: {
  entry: FollowingSuggestion;
  isBusy: boolean;
  showDivider: boolean;
  onPressProfile: (row: FeedSuggestedProfileRow) => void;
  onPressClub: (row: FeedSuggestedClubRow) => void;
  onToggleFollowProfile: (row: FeedSuggestedProfileRow) => void;
  onToggleFollowClub: (row: FeedSuggestedClubRow) => void;
}) {
  if (entry.kind === "club") {
    const { row } = entry;
    return (
      <SuggestedEntityRow
        avatarUrl={row.logo_url}
        isBusy={isBusy}
        isClub
        isFollowing={row.is_following}
        metaLine={suggestedClubMetaLine(row)}
        name={row.name}
        onPress={() => onPressClub(row)}
        onToggleFollow={() => onToggleFollowClub(row)}
        showDivider={showDivider}
      />
    );
  }

  const { row } = entry;
  return (
    <SuggestedEntityRow
      avatarUrl={row.avatar_url}
      isBusy={isBusy}
      isFollowing={row.is_following}
      metaLine={suggestedProfileMetaLine(row)}
      name={row.full_name}
      onPress={() => onPressProfile(row)}
      onToggleFollow={() => onToggleFollowProfile(row)}
      showDivider={showDivider}
    />
  );
}

const styles = StyleSheet.create({
  cta: {
    marginTop: spacing[8],
  },
  iconCircle: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 72,
    justifyContent: "center",
    marginBottom: spacing[8],
    width: 72,
  },
  intro: {
    alignItems: "center",
    gap: spacing[8],
    paddingBottom: spacing[28],
    paddingHorizontal: spacing[8],
    paddingTop: spacing[36],
  },
  suggestions: {
    borderTopColor: colors.divider,
    borderTopWidth: 1,
    paddingTop: spacing[8],
  },
});
