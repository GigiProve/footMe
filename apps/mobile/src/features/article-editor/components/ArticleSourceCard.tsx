/**
 * Card di una fonte esterna — Articolo EXTERNAL_LINK (HOM-06.2 §7D, §7J, §7K,
 * §54, §72).
 *
 * Mostra ciò che la fonte dichiara, mai di più: «Condiviso da [publisher]»
 * (l'identity PROLINK non è l'autrice del testo esterno, §7D), immagine solo
 * se esiste (nessun placeholder artificiale, §7J), titolo, descrizione solo se
 * presente (mai inventata, §54), «Fonte originale · dominio» e la CTA «Leggi sul
 * sito originale». Il corpo esterno non viene mai riprodotto (§7K).
 *
 * Il tap sulla card da Feed, Profilo, Cerca e Salvati apre il dettaglio
 * PROLINK, non il browser (§7K): è questa CTA, dal dettaglio, ad aprire l'URL
 * validato. In anteprima di una bozza senza URL la CTA è disabilitata.
 *
 * Modulo standard del design system: eyebrow → corpo → rail da 44px.
 */

import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, ContentModule } from "../../../ui";
import { openExternalUrl } from "../article-links";
import { sourceCardModel, type ArticleSourceInput } from "../article-render";

type ArticleSourceCardProps = {
  publisherName: string;
  source: ArticleSourceInput;
  /** Chiamata prima dell'apertura (analytics): non riceve né l'URL né il dominio. */
  onOpen?: () => void;
};

export function ArticleSourceCard({ publisherName, source, onOpen }: ArticleSourceCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [faviconFailed, setFaviconFailed] = useState(false);

  const model = sourceCardModel(source, publisherName);
  const imageUrl = imageFailed ? null : model.imageUrl;
  const faviconUrl = faviconFailed ? null : model.faviconUrl;
  const href = model.href;

  return (
    <ContentModule
      actions={[
        {
          accessibilityLabel: model.ctaAccessibilityLabel,
          icon: "open-outline",
          label: model.ctaLabel,
          onPress: href
            ? () => {
                onOpen?.();
                void openExternalUrl(href);
              }
            : undefined,
        },
      ]}
      eyebrow={model.eyebrow}
      testID="article-source-card"
    >
      <View style={styles.body}>
        {imageUrl ? (
          <Image
            accessibilityIgnoresInvertColors
            accessible={false}
            onError={() => setImageFailed(true)}
            resizeMode="cover"
            source={{ uri: imageUrl }}
            style={styles.image}
            testID="article-source-image"
          />
        ) : null}

        {model.title ? (
          <AppText variant="titleMd">{model.title}</AppText>
        ) : null}

        {model.description ? (
          <AppText color="secondary" variant="bodyLg">
            {model.description}
          </AppText>
        ) : null}

        {model.sourceLine ? (
          <View style={styles.sourceRow}>
            {faviconUrl ? (
              <Image
                accessibilityIgnoresInvertColors
                accessible={false}
                onError={() => setFaviconFailed(true)}
                source={{ uri: faviconUrl }}
                style={styles.favicon}
              />
            ) : null}
            <AppText color="muted" style={styles.sourceText} variant="meta">
              {model.sourceLine}
            </AppText>
          </View>
        ) : null}
      </View>
    </ContentModule>
  );
}

const FAVICON_SIZE = 14;

const styles = StyleSheet.create({
  body: {
    gap: spacing[8],
  },
  favicon: {
    borderRadius: radius[4],
    height: FAVICON_SIZE,
    width: FAVICON_SIZE,
  },
  image: {
    aspectRatio: 16 / 9,
    backgroundColor: colors.surfacePlaceholder,
    borderRadius: radius[10],
    width: "100%",
  },
  sourceRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  sourceText: {
    flex: 1,
  },
});
