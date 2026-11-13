/**
 * Mi piace nel dettaglio storico (HOM-03 §104, §52–55).
 *
 * Lo stato è la stessa entity del Feed: `useContentInteraction` legge
 * `fetch_content_interaction_state` e il toggle passa dalla stessa coda del Mi
 * piace del Feed, che aggiorna anche le cache dei pane. Un solo controllo che
 * porta il conteggio (§53): a zero «Mi piace», mai «0» (§54), attivo = icona
 * piena e accent (§55). Commenta e Condividi non ci sono: i commenti vivono già
 * nella loro sezione del dettaglio e la condivisione è di HOM-09.
 *
 * Non si mostra finché il server non conferma che il viewer può mettere Mi
 * piace: niente controllo che poi non risponde.
 */

import { StyleSheet, View } from "react-native";

import { buildPostActionModel } from "../../feed-post-presentation";
import type { FeedContentType } from "../../feed-types";
import { useContentInteraction } from "../../use-content-interaction";
import { PostActionButton } from "../post/PostActionRow";

type ContentLikeControlProps = {
  contentType: FeedContentType;
  postId: string;
  profileId: string;
};

export function ContentLikeControl({ contentType, postId, profileId }: ContentLikeControlProps) {
  const interaction = useContentInteraction(contentType, postId, {
    enabled: Boolean(postId && profileId),
    profileId,
  });

  if (interaction.isLoading || !interaction.canLike) {
    return null;
  }

  const { like } = buildPostActionModel({
    commentsCount: 0,
    isLiked: interaction.isLiked,
    likesCount: interaction.likesCount,
  });

  return (
    <View style={styles.row}>
      <PostActionButton
        accessibilityLabel={like.accessibilityLabel}
        active={like.selected}
        icon={like.selected ? "thumbs-up" : "thumbs-up-outline"}
        onPress={interaction.toggleLike}
        testID="content-like"
        text={like.text}
      />
    </View>
  );
}

// `PostActionButton` si allarga all'area che trova: qui ne basta una sola.
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    width: "40%",
  },
});
