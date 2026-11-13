/**
 * Video editoriale nel Feed (HOM-03 §30–38, §88, §131).
 *
 * Un Post con una gerarchia in più, non un componente video a parte (§38):
 * header con fonte e verifica (formato come riga meta «Video · 3 h», §32) →
 * titolo → sommario facoltativo → area video → Mi piace · Commenta · Condividi,
 * con il segnalibro nell'header. Lo stesso `VideoMedia` e lo stesso player del
 * Video social (§35): nessun player separato.
 *
 * Due azioni distinte (§36): il tocco su titolo e sommario apre il dettaglio, il
 * Play riproduce inline senza aprire nulla. Per questo il titolo è il suo
 * bersaglio e l'area video no: sono fratelli, non uno dentro l'altro.
 * Titolo fino a tre righe, sommario fino a due, nessuno spazio vuoto se manca (§33–34).
 */

import { Pressable, StyleSheet } from "react-native";

import { spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import {
  EDITORIAL_SUMMARY_MAX_LINES,
  EDITORIAL_TITLE_MAX_LINES,
  articleAccessibilityLabel,
  editorialVideoMedia,
} from "../../feed-video-presentation";
import type { FeedVideoItem } from "../../feed-types";
import { PostActionRow } from "../post/PostActionRow";
import { VideoMedia } from "../video/VideoMedia";
import { EditorialHeader } from "./EditorialHeader";
import { FeedItemFrame } from "./FeedItemFrame";

type EditorialVideoFeedItemProps = {
  item: FeedVideoItem;
  onPress: () => void;
  onPressAuthor: () => void;
  onToggleSaved: () => void;
  onToggleLike: () => void;
  onComment: () => void;
  onShare: () => void;
};

export function EditorialVideoFeedItem({
  item,
  onPress,
  onPressAuthor,
  onToggleSaved,
  onToggleLike,
  onComment,
  onShare,
}: EditorialVideoFeedItemProps) {
  const { payload } = item;
  const video = editorialVideoMedia(payload);
  const summary = payload.summary?.trim() ? payload.summary : null;
  const hasText = Boolean(item.title) || Boolean(summary);

  return (
    <FeedItemFrame testID="feed-editorial-video">
      <EditorialHeader
        item={item}
        onPressAuthor={onPressAuthor}
        onToggleSaved={onToggleSaved}
      />

      {hasText ? (
        <Pressable
          accessibilityLabel={articleAccessibilityLabel(item.title, summary)}
          accessibilityRole="button"
          onPress={onPress}
          style={styles.text}
          testID="feed-editorial-video-title"
        >
          {item.title ? (
            <AppText numberOfLines={EDITORIAL_TITLE_MAX_LINES} variant="titleMd">
              {item.title}
            </AppText>
          ) : null}

          {summary ? (
            <AppText
              color="secondary"
              numberOfLines={EDITORIAL_SUMMARY_MAX_LINES}
              style={styles.summary}
              variant="feedMeta"
            >
              {summary}
            </AppText>
          ) : null}
        </Pressable>
      ) : null}

      {video ? (
        <VideoMedia itemId={item.id} media={video} style={styles.media} surface="feed" />
      ) : null}

      <PostActionRow
        commentsCount={payload.commentsCount}
        isLiked={payload.isLiked}
        likesCount={payload.likesCount}
        onComment={onComment}
        onLike={onToggleLike}
        onShare={onShare}
      />
    </FeedItemFrame>
  );
}

const styles = StyleSheet.create({
  media: {
    marginTop: spacing[12],
  },
  summary: {
    marginTop: spacing[4],
  },
  text: {
    marginTop: spacing[12],
  },
});
