/**
 * Rich link nel corpo, in editing (HOM-06.2 §63–§71; mockup 3).
 *
 * Un URL isolato seguito da Invio diventa un blocco con thumbnail, titolo,
 * descrizione, dominio e favicon quando ci sono (§64). Aspetto editoriale, nessuna
 * CTA pubblicitaria (§65). Se i metadata mancano o falliscono resta il fallback
 * leggero «🔗 dominio» con «Apri link» (§69) e questo non impedisce di pubblicare
 * (§70). La X toglie SOLO questo blocco e mai altri paragrafi (§71).
 *
 * Il rendering pubblico è del renderer dell'Articolo (`ArticleDocumentView`): qui
 * serve la versione con la X, dentro l'editor.
 */

import Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../styles";
import { AppText } from "../../../ui";
import { urlDomain } from "../article-document";
import { openExternalUrl } from "../article-links";
import type { RichLinkLine } from "../article-types";

type Props = {
  line: RichLinkLine;
  onRemove: () => void;
};

export function EditorRichLink({ line, onRemove }: Props) {
  const preview = line.preview;
  const domain = preview?.domain ?? urlDomain(line.url) ?? line.url;
  const hasCard = line.status === "ready" && preview !== null && (preview.title || preview.description || preview.image_url);

  return (
    <View style={styles.wrapper}>
      <View style={styles.card} testID={`article-rich-link-${line.id}`}>
        {line.status === "loading" ? (
          <View accessibilityLabel="Caricamento anteprima del link" style={styles.loading}>
            <ActivityIndicator color={colors.textSecondary} size="small" />
            <AppText color="secondary" variant="bodySm">
              Caricamento anteprima…
            </AppText>
          </View>
        ) : hasCard && preview ? (
          <View style={styles.preview}>
            {preview.image_url ? <Image accessibilityIgnoresInvertColors source={{ uri: preview.image_url }} style={styles.thumb} /> : null}
            <View style={styles.text}>
              {preview.title ? (
                <AppText numberOfLines={2} variant="titleSm">
                  {preview.title}
                </AppText>
              ) : null}
              {preview.description ? (
                <AppText color="secondary" numberOfLines={2} variant="bodySm">
                  {preview.description}
                </AppText>
              ) : null}
              <View style={styles.domainRow}>
                {preview.favicon_url ? <Image accessibilityIgnoresInvertColors source={{ uri: preview.favicon_url }} style={styles.favicon} /> : null}
                <AppText color="muted" numberOfLines={1} variant="caption">
                  {domain}
                </AppText>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.fallback}>
            <Ionicons color={colors.textSecondary} name="link-outline" size={18} />
            <AppText color="secondary" numberOfLines={1} style={styles.fallbackDomain} variant="bodyLg">
              {domain}
            </AppText>
            <Pressable
              accessibilityLabel={`Apri link ${domain}`}
              accessibilityRole="link"
              hitSlop={8}
              onPress={() => {
                void openExternalUrl(line.url);
              }}
            >
              <AppText color="accent" variant="actionLabel">
                Apri link
              </AppText>
            </Pressable>
          </View>
        )}

        <Pressable
          accessibilityLabel={`Rimuovi anteprima del link ${domain}`}
          accessibilityRole="button"
          hitSlop={9}
          onPress={onRemove}
          style={styles.remove}
          testID={`article-rich-link-remove-${line.id}`}
        >
          <Ionicons color={colors.textSecondary} name="close" size={16} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    overflow: "hidden",
  },
  domainRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  favicon: {
    borderRadius: radius[4],
    height: 14,
    width: 14,
  },
  fallback: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    minHeight: 52,
    paddingLeft: spacing[14],
    paddingRight: spacing[48],
  },
  fallbackDomain: {
    flex: 1,
  },
  loading: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    minHeight: 52,
    paddingHorizontal: spacing[14],
  },
  preview: {
    flexDirection: "row",
  },
  remove: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    position: "absolute",
    right: spacing[8],
    top: spacing[8],
    width: 28,
  },
  text: {
    flex: 1,
    gap: spacing[4],
    justifyContent: "center",
    paddingLeft: spacing[12],
    paddingRight: spacing[48],
    paddingVertical: spacing[12],
  },
  thumb: {
    backgroundColor: colors.surfacePlaceholder,
    // minHeight: con i font grandi il testo cresce e la miniatura lo segue (riga con stretch), senza bande bianche.
    minHeight: 96,
    width: 96,
  },
  wrapper: {
    paddingVertical: spacing[8],
  },
});
