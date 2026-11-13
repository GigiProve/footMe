/**
 * Articolo nel Feed: l'unica preview (HOM-03 §39–51, §85, §89–90, §126–127).
 *
 * Esiste una sola rappresentazione dell'Articolo — niente large/compact, né
 * scelta dell'autore (§39–40) — e Media e Società la usano identica (§89–90):
 * cambiano identità e riga meta, mai il renderer. Compatta per costruzione
 * (§41, §43): testo a sinistra, miniatura di ~96pt a destra, titolo fino a tre
 * righe, sommario facoltativo fino a due, nessuna hero cover.
 *
 * Ordine e linguaggio sono quelli del Post: header (con il segnalibro) →
 * preview → riga Mi piace · Commenta · Condividi (§52–59). L'intera preview è un
 * solo bersaglio di tocco (§47–48): titolo, sommario e miniatura aprono il
 * dettaglio. La micro-CTA «Leggi articolo» è una piccola pill outline come nel
 * visual master 4 (§47): non è un controllo a sé, il tocco è della preview; nessun
 * grande CTA blu.
 *
 * Dynamic Type (§127): da `fontScale` ≥ 1,3 la miniatura passa sotto al testo
 * (layout verticale, cover bassa) invece di schiacciarlo; il font non si
 * riduce e la CTA non si taglia. Senza cover la preview resta solo testo.
 */

import { useState } from "react";
import { Image, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import { ARTICLE_CTA } from "../../feed-labels";
import {
  ARTICLE_STACKED_COVER_RATIO,
  ARTICLE_THUMBNAIL_RATIO,
  ARTICLE_THUMBNAIL_WIDTH,
  EDITORIAL_SUMMARY_MAX_LINES,
  EDITORIAL_TITLE_MAX_LINES,
  articleAccessibilityLabel,
  articleCoverAltText,
  articleCoverUri,
  articleLayoutFor,
} from "../../feed-video-presentation";
import type { FeedArticleItem } from "../../feed-types";
import { PostActionRow } from "../post/PostActionRow";
import type { ContentManagement } from "../../content-management-types";
import { EditorialHeader } from "./EditorialHeader";
import { FeedItemFrame } from "./FeedItemFrame";

type ArticleFeedPreviewProps = {
  item: FeedArticleItem;
  onPress: () => void;
  onPressAuthor: () => void;
  onToggleSaved: () => void;
  onToggleLike: () => void;
  onComment: () => void;
  onShare: () => void;
  management?: ContentManagement;
};

export function ArticleFeedPreview({
  item,
  management,
  onPress,
  onPressAuthor,
  onToggleSaved,
  onToggleLike,
  onComment,
  onShare,
}: ArticleFeedPreviewProps) {
  const { payload } = item;
  const { fontScale } = useWindowDimensions();
  const stacked = articleLayoutFor(fontScale) === "stacked";
  const [coverFailed, setCoverFailed] = useState(false);

  const coverUri = coverFailed ? null : articleCoverUri(payload);
  const summary = payload.summary?.trim() ? payload.summary : null;

  const cover = coverUri ? (
    <Image
      accessibilityIgnoresInvertColors
      accessibilityLabel={articleCoverAltText(payload, item.title)}
      onError={() => setCoverFailed(true)}
      resizeMode="cover"
      source={{ uri: coverUri }}
      style={stacked ? styles.coverStacked : styles.coverSide}
      testID="feed-article-cover"
    />
  ) : null;

  return (
    <FeedItemFrame testID="feed-article">
      <EditorialHeader
        item={item}
        management={management}
        onPressAuthor={onPressAuthor}
        onToggleSaved={onToggleSaved}
      />

      <Pressable
        accessibilityHint={ARTICLE_CTA}
        accessibilityLabel={articleAccessibilityLabel(item.title, summary)}
        accessibilityRole="button"
        onPress={onPress}
        style={styles.body}
        testID="feed-article-body"
      >
        <View style={stacked ? styles.column : styles.row} testID="feed-article-layout">
          <View style={styles.text}>
            {item.title ? (
              <AppText
                numberOfLines={EDITORIAL_TITLE_MAX_LINES}
                testID="feed-article-title"
                variant="titleMd"
              >
                {item.title}
              </AppText>
            ) : null}

            {summary ? (
              <AppText
                color="secondary"
                numberOfLines={EDITORIAL_SUMMARY_MAX_LINES}
                testID="feed-article-summary"
                variant="feedMeta"
              >
                {summary}
              </AppText>
            ) : null}

            <View style={styles.cta} testID="feed-article-cta">
              <AppText numberOfLines={1} variant="actionLabel">
                {ARTICLE_CTA}
              </AppText>
            </View>
          </View>

          {cover}
        </View>
      </Pressable>

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
  body: {
    marginTop: spacing[12],
  },
  column: {
    gap: spacing[12],
  },
  // Cover bassa sotto il testo: compatta, non una hero (§43).
  coverStacked: {
    aspectRatio: ARTICLE_STACKED_COVER_RATIO,
    backgroundColor: colors.surfacePlaceholder,
    borderRadius: radius[8],
    width: "100%",
  },
  // Larghezza fissa e rapporto noto: spazio riservato prima del download (§108).
  coverSide: {
    aspectRatio: ARTICLE_THUMBNAIL_RATIO,
    backgroundColor: colors.surfacePlaceholder,
    borderRadius: radius[8],
    width: ARTICLE_THUMBNAIL_WIDTH,
  },
  // Pill piccola, hairline: è un segno, non un bottone (§47).
  cta: {
    alignSelf: "flex-start",
    borderColor: colors.borderStrong,
    borderRadius: radius.full,
    borderWidth: 1,
    marginTop: spacing[4],
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[6],
  },
  row: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[12],
  },
  text: {
    flex: 1,
    gap: spacing[6],
  },
});
