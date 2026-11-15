/**
 * Riga azioni nel dettaglio di Articolo e video editoriale (HOM-08 §13, §266;
 * sostituisce `ContentLikeControl`, HOM-03 §104, §52–55).
 *
 * §13: anche qui le tre celle ♡ | ◯ | ↗ del Post, la stessa `PostActionRow`
 * del Feed — nessun secondo componente. Lo stato Mi piace è la stessa cella
 * dello store (`useContentInteraction` legge `fetch_content_interaction_state`
 * e la semina, insieme al conteggio commenti); Condividi apre il pannello
 * HOM-09 (`onShare` lo decide la superficie); Commenta porta alla sezione commenti o al composer
 * (decide il controller dei commenti dal numero corrente).
 *
 * Durante il caricamento riserva lo spazio: niente salto di layout. Senza
 * `can_like` la riga resta (Commenta e Condividi non dipendono dal Mi piace);
 * il motore del Mi piace spiega perché l'icona non scrive.
 *
 * I contenuti senza entità Mi piace (`fan_tribuna`, `media_tribuna`, HOM-03
 * §104) hanno comunque i commenti (dominio unico, contratto HOM-08): per loro
 * la riga è la sola cella Commenta, col conteggio della cella dello store che
 * il controller dei commenti semina dal contesto. Nessun cuore finto.
 */

import { StyleSheet, View } from "react-native";

import { sizes } from "../../../../styles";
import { useCommentsCount } from "../../../comments/comment-count-store";
import { likeItemKey } from "../../../interactions/like-store";
import { useOpenLikes } from "../../../likes/use-open-likes";
import { buildPostActionModel } from "../../feed-post-presentation";
import type { FeedContentType } from "../../feed-types";
import { useContentInteraction } from "../../use-content-interaction";
import { PostActionButton, PostActionRow } from "../post/PostActionRow";

type ContentActionRowProps = {
  contentType: FeedContentType;
  postId: string;
  profileId: string;
  /** HOM-03 §104: il tipo ha l'entità Mi piace. Falso = solo Commenta. */
  likeable: boolean;
  onComment: () => void;
  onShare: () => void;
};

export function ContentActionRow({ likeable, ...props }: ContentActionRowProps) {
  return likeable ? <LikeableActionRow {...props} /> : <CommentOnlyRow {...props} />;
}

type RowProps = Omit<ContentActionRowProps, "likeable">;

function LikeableActionRow({ contentType, postId, profileId, onComment, onShare }: RowProps) {
  const openLikes = useOpenLikes();
  const interaction = useContentInteraction(contentType, postId, {
    enabled: Boolean(postId && profileId),
    profileId,
  });

  if (interaction.isLoading) {
    return <View style={styles.placeholder} />;
  }

  return (
    <PostActionRow
      commentsCount={interaction.commentsCount}
      like={{
        contentType,
        postId,
        seed: { likedAs: interaction.likedAs, likesCount: interaction.likesCount },
      }}
      onComment={onComment}
      onLike={interaction.toggleLike}
      onOpenLikes={() => openLikes({ contentType, likesCount: interaction.likesCount, postId })}
      onShare={onShare}
    />
  );
}

function CommentOnlyRow({ contentType, postId, onComment }: RowProps) {
  const count = useCommentsCount(likeItemKey(contentType, postId), 0);
  const { comment } = buildPostActionModel({ commentsCount: count, isLiked: false, likesCount: 0 });

  return (
    <View style={styles.single}>
      <PostActionButton
        accessibilityLabel={comment.accessibilityLabel}
        icon="chatbubble-outline"
        onPress={onComment}
        testID="feed-post-action-comment"
        text={comment.text}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    minHeight: sizes.touchTarget,
  },
  single: {
    flexDirection: "row",
    width: "33%",
  },
});
