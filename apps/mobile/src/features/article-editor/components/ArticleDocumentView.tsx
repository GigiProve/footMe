/**
 * Renderer unico del documento Articolo (HOM-06.2 §73–§74, §49–§51, §59–§70).
 *
 * Lo usano l'Anteprima dell'editor e il dettaglio pubblico: la stessa
 * componente, così ciò che si vede prima di pubblicare è ciò che si pubblica
 * (§73). Nessun HTML in nessun punto (§48, §51): i blocchi sono dati e il
 * testo è testo.
 *
 *  • paragraph, heading (sezione), liste puntate e numerate (numerazione per
 *    lista), marks bold/italic;
 *  • inline_link: testo in accent, ruolo `link`, apre solo https (§67);
 *  • rich_link: card editoriale con miniatura, titolo, descrizione e dominio;
 *    nessuna CTA pubblicitaria (§65). Senza anteprima, fallback «dominio» +
 *    «Apri link» (§69).
 *
 * Dynamic Type: nessuna altezza fissa sul testo; da `fontScale` ≥ 1,3 la
 * miniatura del rich link passa sopra al testo (stessa soglia della preview
 * Feed). I font non si riducono mai.
 */

import { Fragment, useState, type ReactNode } from "react";
import { Image, Pressable, StyleSheet, useWindowDimensions, View, type StyleProp, type TextStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import type { TextVariant } from "../../../styles";
import { colors, radius, spacing, typography } from "../../../theme/tokens";
import { AppText, type AppTextColor } from "../../../ui";
import { articleLayoutFor } from "../../feed/feed-video-presentation";
import { safeLinkUrl } from "../article-document";
import { openExternalUrl } from "../article-links";
import { listMarker, markFlags, richLinkModel, type RichLinkBlock } from "../article-render";
import type { ArticleBlock, ArticleDocument, ArticleInline } from "../article-types";

type ArticleDocumentViewProps = {
  document: ArticleDocument | null;
  testID?: string;
};

const BODY_VARIANT: TextVariant = "feedBody";

export function ArticleDocumentView({ document, testID }: ArticleDocumentViewProps) {
  const blocks = document && Array.isArray(document.blocks) ? document.blocks : [];
  if (blocks.length === 0) {
    return null;
  }

  return (
    <View style={styles.root} testID={testID ?? "article-document"}>
      {blocks.map((block, index) => (
        <ArticleBlockView block={block} key={block.id ?? index} />
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Inline                                                              */
/* ------------------------------------------------------------------ */

function markStyle(marks: Parameters<typeof markFlags>[0]): StyleProp<TextStyle> {
  const { bold, italic } = markFlags(marks);
  if (!bold && !italic) {
    return undefined;
  }
  return [bold ? styles.bold : null, italic ? styles.italic : null];
}

/**
 * Gli inline sono Text annidati: il colore e la variante vanno ripetuti sui
 * figli, altrimenti AppText riapplica i suoi default (e il link perderebbe
 * l'accent).
 */
function renderInlines(inlines: readonly ArticleInline[] | undefined, variant: TextVariant, color: AppTextColor): ReactNode[] {
  return (inlines ?? []).map((inline, index) => {
    if (inline.type === "inline_link") {
      const label = (inline.content ?? []).map((child) => child.text ?? "").join("");
      const href = safeLinkUrl(inline.url ?? "");
      if (!href) {
        // URL non sicuro: il testo resta, il link no (§67).
        return <Fragment key={index}>{label}</Fragment>;
      }
      return (
        <AppText
          accessibilityLabel={label}
          accessibilityRole="link"
          color="accent"
          key={index}
          onPress={() => {
            void openExternalUrl(href);
          }}
          variant={variant}
        >
          {renderInlines(inline.content, variant, "accent")}
        </AppText>
      );
    }

    const style = markStyle(inline.marks);
    if (!style) {
      return <Fragment key={index}>{inline.text}</Fragment>;
    }
    return (
      <AppText color={color} key={index} style={style} variant={variant}>
        {inline.text}
      </AppText>
    );
  });
}

function hasInlineText(inlines: readonly ArticleInline[] | undefined): boolean {
  return (inlines ?? []).some((inline) =>
    inline.type === "text" ? inline.text.length > 0 : (inline.content ?? []).some((child) => child.text.length > 0),
  );
}

/* ------------------------------------------------------------------ */
/* Blocchi                                                             */
/* ------------------------------------------------------------------ */

function ArticleBlockView({ block }: { block: ArticleBlock }) {
  switch (block.type) {
    case "paragraph":
      return hasInlineText(block.content) ? (
        <AppText testID="article-paragraph" variant={BODY_VARIANT}>
          {renderInlines(block.content, BODY_VARIANT, "primary")}
        </AppText>
      ) : null;

    case "heading":
      return hasInlineText(block.content) ? (
        <AppText accessibilityRole="header" style={styles.heading} testID="article-heading" variant="headingSm">
          {renderInlines(block.content, "headingSm", "primary")}
        </AppText>
      ) : null;

    case "unordered_list":
    case "ordered_list":
      return (
        <View accessibilityRole="list" style={styles.list} testID={`article-${block.type}`}>
          {(block.items ?? []).map((item, index) => {
            const bullet = block.type === "unordered_list";
            return (
              <View key={item.id ?? index} style={styles.listItem}>
                <AppText
                  accessibilityElementsHidden={bullet}
                  importantForAccessibility={bullet ? "no-hide-descendants" : "auto"}
                  style={styles.marker}
                  variant={BODY_VARIANT}
                >
                  {listMarker(block.type, index)}
                </AppText>
                <AppText style={styles.itemText} variant={BODY_VARIANT}>
                  {renderInlines(item.content, BODY_VARIANT, "primary")}
                </AppText>
              </View>
            );
          })}
        </View>
      );

    case "rich_link":
      return <RichLinkCard block={block} />;

    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Rich link                                                           */
/* ------------------------------------------------------------------ */

function RichLinkCard({ block }: { block: RichLinkBlock }) {
  const { fontScale } = useWindowDimensions();
  const [imageFailed, setImageFailed] = useState(false);
  const [faviconFailed, setFaviconFailed] = useState(false);

  const model = richLinkModel(block);
  if (!model) {
    return null;
  }

  const open = () => {
    void openExternalUrl(model.href);
  };

  if (model.variant === "fallback") {
    return (
      <Pressable
        accessibilityLabel={model.accessibilityLabel}
        accessibilityRole="link"
        onPress={open}
        style={({ pressed }) => [styles.card, styles.fallbackCard, pressed ? styles.pressed : null]}
        testID="article-rich-link-fallback"
      >
        <Ionicons color={colors.textSecondary} name="link-outline" size={18} />
        <AppText color="secondary" numberOfLines={1} style={styles.flex} variant="meta">
          {model.domain ?? model.href}
        </AppText>
        <AppText color="accent" variant="actionLabel">
          Apri link
        </AppText>
      </Pressable>
    );
  }

  const stacked = articleLayoutFor(fontScale) === "stacked";
  const imageUrl = imageFailed ? null : model.imageUrl;
  const faviconUrl = faviconFailed ? null : model.faviconUrl;

  return (
    <Pressable
      accessibilityLabel={model.accessibilityLabel}
      accessibilityRole="link"
      onPress={open}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
      testID="article-rich-link"
    >
      <View style={stacked ? styles.cardColumn : styles.cardRow}>
        {imageUrl ? (
          <Image
            accessibilityIgnoresInvertColors
            accessible={false}
            onError={() => setImageFailed(true)}
            resizeMode="cover"
            source={{ uri: imageUrl }}
            style={stacked ? styles.thumbnailStacked : styles.thumbnail}
            testID="article-rich-link-image"
          />
        ) : null}
        <View style={styles.cardText}>
          {model.title ? (
            <AppText numberOfLines={3} variant="titleSm">
              {model.title}
            </AppText>
          ) : null}
          {model.description ? (
            <AppText color="secondary" numberOfLines={3} variant="meta">
              {model.description}
            </AppText>
          ) : null}
          {model.domain ? (
            <View style={styles.domainRow}>
              {faviconUrl ? (
                <Image
                  accessibilityIgnoresInvertColors
                  accessible={false}
                  onError={() => setFaviconFailed(true)}
                  source={{ uri: faviconUrl }}
                  style={styles.favicon}
                />
              ) : null}
              <AppText color="muted" numberOfLines={1} style={styles.flex} variant="caption">
                {model.domain}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const THUMBNAIL_SIZE = 76;
const FAVICON_SIZE = 14;

const styles = StyleSheet.create({
  bold: {
    fontWeight: typography.fontWeight.bold,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    overflow: "hidden",
    padding: spacing[10],
  },
  cardColumn: {
    gap: spacing[10],
  },
  cardRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[12],
  },
  cardText: {
    flex: 1,
    gap: spacing[4],
  },
  domainRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
    marginTop: spacing[4],
  },
  fallbackCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[10],
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[12],
  },
  favicon: {
    borderRadius: radius[4],
    height: FAVICON_SIZE,
    width: FAVICON_SIZE,
  },
  flex: {
    flex: 1,
  },
  heading: {
    marginTop: spacing[4],
  },
  italic: {
    fontStyle: "italic",
  },
  itemText: {
    flex: 1,
  },
  list: {
    gap: spacing[6],
  },
  listItem: {
    flexDirection: "row",
    gap: spacing[8],
  },
  marker: {
    minWidth: spacing[24],
  },
  pressed: {
    opacity: 0.7,
  },
  root: {
    gap: spacing[16],
  },
  thumbnail: {
    backgroundColor: colors.surfacePlaceholder,
    borderRadius: radius[10],
    height: THUMBNAIL_SIZE,
    width: THUMBNAIL_SIZE,
  },
  thumbnailStacked: {
    aspectRatio: 2,
    backgroundColor: colors.surfacePlaceholder,
    borderRadius: radius[10],
    width: "100%",
  },
});
