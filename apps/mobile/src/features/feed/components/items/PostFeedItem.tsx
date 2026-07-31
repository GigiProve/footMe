/**
 * Contenitore base "Post" (§10).
 *
 * Mostra: avatar/logo, nome, verifica, tempo dalla pubblicazione, menu ⋯,
 * testo, immagine opzionale, riga azioni. NON mostra grandi contatori né
 * reazioni multiple, che il §10 vieta esplicitamente per questo blocco.
 *
 * Il testo arriva già troncato dal server (280 caratteri per i post): qui si
 * limita solo il numero di righe visibili.
 */

import { Image, Pressable, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import type { FeedPostItem } from "../../feed-types";
import { FeedItemActionRow } from "./FeedItemActionRow";
import { FeedItemHeader } from "./FeedItemHeader";
import { FeedItemMenu } from "./FeedItemMenu";

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
  const { imageUrl, text } = item.payload;

  return (
    <View style={styles.card} testID="feed-post">
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

      <Pressable accessibilityRole="button" onPress={onPress} style={styles.body}>
        {item.title ? (
          <AppText numberOfLines={2} variant="titleSm">
            {item.title}
          </AppText>
        ) : null}

        {text ? (
          <AppText color="secondary" numberOfLines={4} variant="bodySm">
            {text}
          </AppText>
        ) : null}

        {imageUrl ? (
          <Image
            accessibilityIgnoresInvertColors
            resizeMode="cover"
            source={{ uri: imageUrl }}
            style={styles.media}
          />
        ) : null}
      </Pressable>

      <FeedItemActionRow isSaved={item.isSaved} onToggleSaved={onToggleSaved} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing[6],
    marginTop: spacing[10],
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    padding: spacing[14],
  },
  media: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    height: 200,
    marginTop: spacing[4],
    width: "100%",
  },
});
