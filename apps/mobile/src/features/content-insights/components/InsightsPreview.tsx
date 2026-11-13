/**
 * Preview compatta del contenuto in testa a Dettagli e statistiche (HOM-05
 * §20–27).
 *
 * Non è il Post HOM-02 (§20): thumbnail, titolo o prime righe, «tipo · data»,
 * autore con verifica. Il video mostra thumbnail, un piccolo Play e la durata,
 * mai un player (§23). «Visualizza contenuto →» è il rail del `ContentModule`:
 * un'azione leggera da 44px, non un bottone pieno (§25). Con font grandi la
 * thumbnail passa sopra al testo invece di comprimerlo (§167).
 */

import { Image, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, ContentModule, VerifiedCheck } from "../../../ui";
import {
  INSIGHTS_VIEW_CONTENT,
  INSIGHTS_VIEW_CONTENT_A11Y,
  type InsightsLayout,
  type PreviewModel,
} from "../insights-presentation";

const THUMBNAIL_SIZE = 92;

export function InsightsPreview({
  layout,
  model,
  onOpenContent,
}: {
  layout: InsightsLayout;
  model: PreviewModel;
  onOpenContent: () => void;
}) {
  return (
    <ContentModule
      actions={[
        {
          accessibilityLabel: INSIGHTS_VIEW_CONTENT_A11Y,
          label: INSIGHTS_VIEW_CONTENT,
          onPress: onOpenContent,
        },
      ]}
      testID="insights-preview"
    >
      <View style={layout === "stacked" ? styles.stacked : styles.row}>
        <View style={styles.thumbnail}>
          {model.thumbnailUrl ? (
            <Image
              accessibilityLabel={model.isVideo ? "Anteprima video" : "Anteprima del contenuto"}
              source={{ uri: model.thumbnailUrl }}
              style={styles.image}
            />
          ) : (
            <View style={styles.fallback}>
              <Ionicons
                color={colors.textMuted}
                name={model.isVideo ? "videocam-outline" : "image-outline"}
                size={26}
              />
            </View>
          )}
          {model.isVideo ? (
            <>
              <View style={styles.playBadge} testID="insights-preview-play">
                <Ionicons color={colors.inkInvert} name="play" size={13} />
              </View>
              {model.durationLabel ? (
                <View style={styles.durationBadge}>
                  <AppText color="inverse" variant="caption">
                    {model.durationLabel}
                  </AppText>
                </View>
              ) : null}
            </>
          ) : null}
        </View>

        <View style={styles.info}>
          {model.title ? (
            <AppText numberOfLines={3} variant="titleSm">
              {model.title}
            </AppText>
          ) : null}
          <AppText color="secondary" variant="meta">
            {model.meta}
          </AppText>
          <View
            accessible
            accessibilityLabel={model.authorAccessibilityLabel}
            style={styles.author}
          >
            <AppText numberOfLines={1} style={styles.authorName} variant="metaStrong">
              {model.authorName}
            </AppText>
            {model.isVerified ? <VerifiedCheck size={14} /> : null}
          </View>
        </View>
      </View>
    </ContentModule>
  );
}

const styles = StyleSheet.create({
  author: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
  },
  authorName: {
    flexShrink: 1,
  },
  durationBadge: {
    backgroundColor: colors.mediaBadgeSurface,
    borderRadius: radius.full,
    bottom: spacing[6],
    left: spacing[6],
    paddingHorizontal: spacing[6],
    position: "absolute",
  },
  fallback: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    height: "100%",
    justifyContent: "center",
    width: "100%",
  },
  image: {
    height: "100%",
    width: "100%",
  },
  info: {
    flex: 1,
    gap: spacing[4],
  },
  playBadge: {
    alignItems: "center",
    backgroundColor: colors.mediaControlSurface,
    borderRadius: radius.full,
    height: 28,
    justifyContent: "center",
    left: THUMBNAIL_SIZE / 2 - 14,
    position: "absolute",
    top: THUMBNAIL_SIZE / 2 - 14,
    width: 28,
  },
  row: {
    flexDirection: "row",
    gap: spacing[12],
  },
  stacked: {
    gap: spacing[12],
  },
  thumbnail: {
    borderRadius: radius[10],
    height: THUMBNAIL_SIZE,
    overflow: "hidden",
    width: THUMBNAIL_SIZE,
  },
});
