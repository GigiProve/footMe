/**
 * Contenitore base "Articolo o video" (§12).
 *
 * Anteprima editoriale compatta: logo/avatar della fonte, nome fonte,
 * tipologia, tempo dalla pubblicazione, titolo, breve introduzione (poche
 * righe), miniatura e CTA coerente — "Leggi articolo" oppure "Guarda video".
 * Il tap apre il dettaglio contenuto già esistente; l'articolo intero non
 * compare mai nel Feed.
 *
 * Non si riusa `MediaContentPreview` (CER-05): quella anteprima esclude di
 * proposito l'introduzione e la CTA, che qui sono richieste. Si condividono
 * invece le proporzioni della miniatura, così le due superfici restano coerenti.
 */

import { Image, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import { formatVideoDuration } from "../../../search/media/media-labels";
import { editorialCta } from "../../feed-labels";
import type { FeedEditorialItem } from "../../feed-types";
import { FeedItemHeader } from "./FeedItemHeader";
import { FeedItemMenu } from "./FeedItemMenu";

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
  const duration = formatVideoDuration(durationSeconds);

  return (
    <View style={styles.card} testID="feed-editorial">
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
        <AppText color="muted" variant="overline">
          {kindLabel ?? (item.type === "video" ? "Video" : "Articolo")}
        </AppText>

        <View style={styles.preview}>
          <View style={styles.previewText}>
            {item.title ? (
              <AppText numberOfLines={2} variant="titleSm">
                {item.title}
              </AppText>
            ) : null}
            {intro ? (
              <AppText color="secondary" numberOfLines={3} variant="bodySm">
                {intro}
              </AppText>
            ) : null}
          </View>

          <View style={styles.thumb}>
            {thumbnailUrl ? (
              <Image
                accessibilityIgnoresInvertColors
                resizeMode="cover"
                source={{ uri: thumbnailUrl }}
                style={styles.thumbImage}
              />
            ) : (
              <View style={styles.thumbFallback}>
                <Ionicons
                  color={colors.textMuted}
                  name={item.type === "video" ? "videocam-outline" : "document-text-outline"}
                  size={20}
                />
              </View>
            )}

            {item.type === "video" ? (
              <View style={styles.playBadge}>
                <Ionicons color={colors.inkInvert} name="play" size={12} />
              </View>
            ) : null}

            {duration ? (
              <View style={styles.durationBadge}>
                <AppText color="inverse" variant="caption">
                  {duration}
                </AppText>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>

      <Button
        label={editorialCta(item)}
        onPress={onPress}
        size="sm"
        style={styles.cta}
        variant="secondary"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing[4],
    marginTop: spacing[10],
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    padding: spacing[14],
  },
  cta: {
    alignSelf: "flex-start",
    marginTop: spacing[10],
  },
  durationBadge: {
    backgroundColor: colors.surfaceOverlay,
    borderBottomRightRadius: radius[8],
    borderTopLeftRadius: radius[4],
    bottom: 0,
    paddingHorizontal: spacing[4],
    position: "absolute",
    right: 0,
  },
  playBadge: {
    alignItems: "center",
    backgroundColor: colors.surfaceOverlay,
    borderRadius: radius.full,
    height: 24,
    justifyContent: "center",
    left: "50%",
    marginLeft: -12,
    marginTop: -12,
    position: "absolute",
    top: "50%",
    width: 24,
  },
  preview: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[12],
  },
  previewText: {
    flex: 1,
    gap: spacing[4],
  },
  thumb: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    height: 74,
    overflow: "hidden",
    width: 112,
  },
  thumbFallback: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  thumbImage: {
    height: "100%",
    width: "100%",
  },
});
