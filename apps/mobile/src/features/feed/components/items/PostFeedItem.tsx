/**
 * Post nel Feed (HOM-01.1 §10, §17, §18).
 *
 * Contenuto aperto, non una card: autore/contesto → testo → media →
 * interazioni → divider. Persona e Società condividono questo componente;
 * cambiano solo logo, nome e metadata.
 *
 * Il testo arriva già troncato dal server (280 caratteri per i post): qui si
 * limita solo il numero di righe visibili, a 15px (§12).
 */

import { Pressable, StyleSheet } from "react-native";

import { spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import type { FeedPostItem } from "../../feed-types";
import { FeedItemActionRow } from "./FeedItemActionRow";
import { FeedItemFrame } from "./FeedItemFrame";
import { FeedItemHeader } from "./FeedItemHeader";
import { FeedItemMenu } from "./FeedItemMenu";
import { FeedMedia } from "./FeedMedia";

type PostFeedItemProps = {
  item: FeedPostItem;
  onPress: () => void;
  onPressAuthor: () => void;
  onToggleSaved: () => void;
};

export function PostFeedItem({
  item,
  onPress,
  onPressAuthor,
  onToggleSaved,
}: PostFeedItemProps) {
  const { imageUrl, mediaType, text } = item.payload;
  const hasText = !!item.title || !!text;

  return (
    <FeedItemFrame testID="feed-post">
      <FeedItemHeader
        item={item}
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

      {hasText ? (
        <Pressable accessibilityRole="button" onPress={onPress} style={styles.body}>
          {item.title ? (
            <AppText numberOfLines={2} variant="titleMd">
              {item.title}
            </AppText>
          ) : null}

          {text ? (
            <AppText numberOfLines={5} variant="feedBody">
              {text}
            </AppText>
          ) : null}
        </Pressable>
      ) : null}

      {imageUrl ? (
        <FeedMedia
          accessibilityLabel={`Apri il contenuto di ${item.author?.name ?? "questo autore"}`}
          isVideo={mediaType === "video"}
          onPress={onPress}
          uri={imageUrl}
        />
      ) : null}

      <FeedItemActionRow isSaved={item.isSaved} onToggleSaved={onToggleSaved} />
    </FeedItemFrame>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing[4],
    marginTop: spacing[12],
  },
});
