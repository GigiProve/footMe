/**
 * Mi piace nel dettaglio storico (HOM-03 §104, §52–55; HOM-07 §1, §22–§26).
 *
 * Lo stato è la stessa cella dello store del Feed: `useContentInteraction` legge
 * `fetch_content_interaction_state`, lo semina e il toggle passa dallo stesso
 * motore. Un solo controllo che porta il conteggio (§53), lo stesso `LikeAction`
 * della riga azioni: a zero «Mi piace», mai «0» (§54); l'icona mette o toglie,
 * il numero apre la lista (HOM-07 §24); attivo = cuore pieno e accent (§55).
 * Commenta e Condividi non ci sono: i commenti vivono già nella loro sezione del
 * dettaglio e la condivisione è di HOM-09.
 *
 * Durante il caricamento riserva lo spazio. Senza `can_like` resta visibile se
 * ci sono Mi piace: il conteggio apre la lista pubblica (§62), l'icona non scrive.
 */

import { StyleSheet, View } from "react-native";

import { sizes } from "../../../../styles";
import { useOpenLikes } from "../../../likes/use-open-likes";
import type { FeedContentType } from "../../feed-types";
import { useContentInteraction } from "../../use-content-interaction";
import { LikeAction } from "../post/PostActionRow";

type ContentLikeControlProps = {
  contentType: FeedContentType;
  postId: string;
  profileId: string;
};

export function ContentLikeControl({ contentType, postId, profileId }: ContentLikeControlProps) {
  const openLikes = useOpenLikes();
  const interaction = useContentInteraction(contentType, postId, {
    enabled: Boolean(postId && profileId),
    profileId,
  });

  // Lo spazio resta riservato durante il caricamento: niente salto di layout.
  if (interaction.isLoading) {
    return <View style={styles.placeholder} />;
  }

  // Senza `can_like` il conteggio resta: la lista dei Mi piace è pubblica (§62)
  // e il numero ne è l'ingresso (§24). Il tap sull'icona passa dal motore, che
  // in quel caso non scrive e spiega perché.
  if (!interaction.canLike && interaction.likesCount === 0) {
    return null;
  }

  return (
    <View style={styles.row}>
      <LikeAction
        contentType={contentType}
        onOpenLikes={() =>
          openLikes({ contentType, likesCount: interaction.likesCount, postId })
        }
        onToggle={interaction.toggleLike}
        postId={postId}
        seed={{ likedAs: interaction.likedAs, likesCount: interaction.likesCount }}
        testID="content-like"
      />
    </View>
  );
}

// `LikeAction` si allarga all'area che trova: qui ne basta una sola.
const styles = StyleSheet.create({
  placeholder: {
    minHeight: sizes.touchTarget,
  },
  row: {
    flexDirection: "row",
    width: "40%",
  },
});
