/**
 * Articolo o video nel Feed (HOM-01.1 §13, §17, §18).
 *
 * Stesso linguaggio del post: autore → testo → media → interazioni. In HOM-01
 * era una card con miniatura laterale e un bottone "Leggi articolo"; il visual
 * master lo tratta come qualunque altro contenuto, con il media grande (§64) e
 * nessun bottone in più (§60). L'intero elemento apre il dettaglio, e la
 * tipologia resta detta a parole nella riga meta (§61) e, per i video, dal
 * segno play.
 *
 * L'introduzione compare solo quando manca il titolo: il titolo è già la riga
 * di testo che il visual master mostra, e ripeterla con l'intro allungherebbe
 * l'elemento senza dire di più.
 *
 * Non si riusa `MediaContentPreview` (CER-05): è una riga di risultato, non un
 * elemento di Feed. Si condivide invece `formatVideoDuration`.
 */

import { Pressable, StyleSheet } from "react-native";

import { spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import { formatVideoDuration } from "../../../search/media/media-labels";
import { editorialCta } from "../../feed-labels";
import type { FeedEditorialItem } from "../../feed-types";
import { FeedItemActionRow } from "./FeedItemActionRow";
import { FeedItemFrame } from "./FeedItemFrame";
import { FeedItemHeader } from "./FeedItemHeader";
import { FeedItemMenu } from "./FeedItemMenu";
import { FeedMedia } from "./FeedMedia";

type EditorialFeedItemProps = {
  item: FeedEditorialItem;
  onPress: () => void;
  onPressAuthor: () => void;
  onToggleSaved: () => void;
};

export function EditorialFeedItem({
  item,
  onPress,
  onPressAuthor,
  onToggleSaved,
}: EditorialFeedItemProps) {
  const { intro, kindLabel, thumbnailUrl, durationSeconds } = item.payload;
  const isVideo = item.type === "video";
  const text = item.title ?? intro;
  const cta = editorialCta(item);

  return (
    <FeedItemFrame testID="feed-editorial">
      <FeedItemHeader
        item={item}
        kindLabel={kindLabel ?? (isVideo ? "Video" : "Articolo")}
        onPressAuthor={onPressAuthor}
        right={
          <FeedItemMenu
            authorName={item.author?.name}
            canSave
            isSaved={item.isSaved}
            itemType={item.type}
            onToggleSaved={onToggleSaved}
          />
        }
      />

      {text ? (
        <Pressable
          accessibilityHint={cta}
          accessibilityRole="button"
          onPress={onPress}
          style={styles.body}
        >
          <AppText numberOfLines={3} variant="feedBody">
            {text}
          </AppText>
        </Pressable>
      ) : null}

      {thumbnailUrl ? (
        <FeedMedia
          accessibilityLabel={cta}
          duration={isVideo ? formatVideoDuration(durationSeconds) : null}
          isVideo={isVideo}
          onPress={onPress}
          uri={thumbnailUrl}
        />
      ) : null}

      <FeedItemActionRow isSaved={item.isSaved} onToggleSaved={onToggleSaved} />
    </FeedItemFrame>
  );
}

const styles = StyleSheet.create({
  body: {
    marginTop: spacing[12],
  },
});
