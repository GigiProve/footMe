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
      <View style={styles.content}>
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
            <AppText numberOfLines={2} variant="titleMd">
              {item.title}
            </AppText>
          ) : null}

          {text ? (
            <AppText color="primary" numberOfLines={4} variant="bodyLg">
              {text}
            </AppText>
          ) : null}
        </Pressable>
      </View>

      {/* Il media esce dal padding: nel design occupa tutta la larghezza del
          modulo, fra il corpo e il rail azioni (§1b). */}
      {imageUrl ? (
        <Pressable accessibilityRole="button" onPress={onPress}>
          <Image
            accessibilityIgnoresInvertColors
            resizeMode="cover"
            source={{ uri: imageUrl }}
            style={styles.media}
          />
        </Pressable>
      ) : null}

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
    borderRadius: radius[16],
    borderWidth: 1,
    overflow: "hidden",
  },
  content: {
    paddingHorizontal: spacing[16],
    paddingTop: spacing[14],
    paddingBottom: spacing[12],
  },
  media: {
    backgroundColor: colors.surfacePlaceholder,
    height: 186,
    width: "100%",
  },
});
