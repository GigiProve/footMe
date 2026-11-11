/**
 * Rich link preview del Post (HOM-02 §42–46).
 *
 * Blocco opzionale del Post, non un tipo di Feed. Compatta e meno dominante di
 * un media (§44): miniatura piccola a sinistra, titolo, descrizione breve e
 * dominio. Mai l'URL lungo (§43). Una hairline `border` la separa dal testo,
 * nessun fondo colorato e nessuna CTA, così non somiglia a una pubblicità. La
 * validazione del target appartiene a HOM-06.1: il tap chiama solo
 * `onPress` (§45).
 */

import { useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import { linkPreviewDomain } from "../../feed-post-presentation";
import type { FeedLinkPreview } from "../../feed-types";

type PostLinkPreviewProps = {
  preview: FeedLinkPreview;
  onPress: () => void;
};

export function PostLinkPreview({ preview, onPress }: PostLinkPreviewProps) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const domain = linkPreviewDomain(preview);
  const title = preview.title?.trim() || domain;
  const showDomainLine = Boolean(preview.title?.trim()) && domain.length > 0;
  const showThumb = Boolean(preview.thumbnailUrl) && !thumbFailed;

  return (
    <Pressable
      accessibilityLabel={[title, showDomainLine ? domain : null].filter(Boolean).join(", ")}
      accessibilityRole="link"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
      testID="feed-post-link-preview"
    >
      {showThumb ? (
        <Image
          accessibilityIgnoresInvertColors
          onError={() => setThumbFailed(true)}
          resizeMode="cover"
          source={{ uri: preview.thumbnailUrl ?? undefined }}
          style={styles.thumb}
        />
      ) : null}

      <View style={styles.text}>
        <AppText numberOfLines={2} variant="titleSm">
          {title}
        </AppText>
        {preview.description ? (
          <AppText color="secondary" numberOfLines={2} variant="feedMeta">
            {preview.description}
          </AppText>
        ) : null}
        {showDomainLine ? (
          <AppText color="muted" numberOfLines={1} variant="caption">
            {domain}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Contorno `border`, quindi è un modulo: radius 16 come ogni card del design
  // system (CLAUDE.md), non la curva dei media.
  card: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    marginTop: spacing[12],
    minHeight: 44,
    overflow: "hidden",
    padding: spacing[10],
  },
  pressed: {
    opacity: 0.7,
  },
  text: {
    flex: 1,
    gap: spacing[4],
  },
  thumb: {
    backgroundColor: colors.surfacePlaceholder,
    // La miniatura è un media: stessa curva dei media del Post (§26).
    borderRadius: radius[8],
    height: 64,
    width: 64,
  },
});
