import { Image, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import {
  formatContentSourceLine,
  formatMediaFormatLabel,
  formatVideoDuration,
} from "./media-labels";
import type { MediaContentFormat, MediaContentRow } from "./media-search-types";

/**
 * Anteprima compatta di un contenuto (CER-05 §10).
 *
 * Elementi mostrati: miniatura rettangolare, tipologia, titolo (max 2 righe),
 * fonte con logo, tempo dalla pubblicazione, bookmark. Per i video anche
 * icona Play e durata sulla miniatura.
 *
 * Volutamente assenti (CER-05 §11): descrizione, testo completo, hashtag,
 * elenco tag, like/commenti/condivisioni, CTA multiple.
 *
 * `variant="featured"` è l'unica anteprima leggermente più evidenziata della
 * schermata iniziale: miniatura e titolo più grandi, nessuna card, nessuna
 * hero image (CER-05 §25).
 */

type MediaContentPreviewProps = {
  onPress: () => void;
  onPressSource?: () => void;
  onToggleSave?: () => void;
  row: Pick<
    MediaContentRow,
    | "content_format"
    | "duration_seconds"
    | "is_saved"
    | "published_at"
    | "publisher_avatar_url"
    | "publisher_name"
    | "thumbnail_url"
    | "title"
  >;
  showDivider?: boolean;
  variant?: "default" | "featured";
};

const FORMAT_ICONS: Record<MediaContentFormat, keyof typeof Ionicons.glyphMap> = {
  articolo: "document-text-outline",
  foto: "image-outline",
  post: "chatbubble-ellipses-outline",
  video: "videocam-outline",
};

export function MediaContentPreview({
  onPress,
  onPressSource,
  onToggleSave,
  row,
  showDivider = true,
  variant = "default",
}: MediaContentPreviewProps) {
  const isFeatured = variant === "featured";
  const duration = formatVideoDuration(row.duration_seconds);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed ? styles.pressed : null]}
    >
      <View style={isFeatured ? styles.thumbFeatured : styles.thumb}>
        {row.thumbnail_url ? (
          <Image
            accessibilityIgnoresInvertColors
            resizeMode="cover"
            source={{ uri: row.thumbnail_url }}
            style={styles.thumbImage}
          />
        ) : (
          <View style={styles.thumbFallback}>
            <Ionicons
              color={colors.textMuted}
              name={FORMAT_ICONS[row.content_format]}
              size={isFeatured ? 24 : 20}
            />
          </View>
        )}

        {row.content_format === "video" ? (
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

      <View style={styles.body}>
        <AppText color="muted" variant="overline">
          {formatMediaFormatLabel(row.content_format)}
        </AppText>

        <AppText numberOfLines={2} variant={isFeatured ? "titleMd" : "titleSm"}>
          {row.title}
        </AppText>

        <Pressable
          accessibilityLabel={`Apri ${row.publisher_name}`}
          accessibilityRole="button"
          disabled={!onPressSource}
          hitSlop={4}
          onPress={onPressSource}
          style={styles.sourceRow}
        >
          {row.publisher_avatar_url ? (
            <Image
              accessibilityIgnoresInvertColors
              source={{ uri: row.publisher_avatar_url }}
              style={styles.sourceLogo}
            />
          ) : null}
          <AppText color="muted" numberOfLines={1} style={styles.sourceLabel} variant="caption">
            {formatContentSourceLine(row)}
          </AppText>
        </Pressable>
      </View>

      {onToggleSave ? (
        <Pressable
          accessibilityLabel={row.is_saved ? "Rimuovi dai salvati" : "Salva contenuto"}
          accessibilityRole="button"
          accessibilityState={{ selected: row.is_saved }}
          hitSlop={10}
          onPress={onToggleSave}
          style={styles.bookmark}
        >
          <Ionicons
            color={row.is_saved ? colors.accent : colors.textMuted}
            name={row.is_saved ? "bookmark" : "bookmark-outline"}
            size={20}
          />
        </Pressable>
      ) : null}

      {showDivider ? (
        <View style={isFeatured ? styles.dividerFeatured : styles.divider} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: spacing[4],
  },
  bookmark: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexShrink: 0,
    justifyContent: "center",
    paddingTop: spacing[4],
  },
  container: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[12],
    paddingVertical: spacing[12],
  },
  divider: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    bottom: 0,
    left: 96,
    position: "absolute",
    right: 0,
  },
  dividerFeatured: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
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
  pressed: {
    opacity: 0.82,
  },
  sourceLabel: {
    flex: 1,
  },
  sourceLogo: {
    borderRadius: radius[4],
    height: 16,
    width: 16,
  },
  sourceRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  thumb: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    height: 56,
    overflow: "hidden",
    width: 84,
  },
  thumbFallback: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  thumbFeatured: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    height: 74,
    overflow: "hidden",
    width: 112,
  },
  thumbImage: {
    height: "100%",
    width: "100%",
  },
});
