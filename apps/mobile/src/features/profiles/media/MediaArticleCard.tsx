/**
 * Card articolo della tab Articoli (REV-PROF-21, Screen 1 e 2).
 *
 * Gerarchia fissa: categoria, titolo, estratto, metadati, profilo collegato.
 * La categoria fa da eyebrow del modulo e non viene ripetuta come badge; la
 * thumbnail è reale o non c'è, e quando non c'è il layout resta editoriale
 * invece di mostrare un riquadro rotto. Nessuna icona Salvati sopra
 * l'immagine: Salva vive nel dettaglio (REV-PROF-12).
 */
import { Image, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Avatar } from "../../../ui";
import type { MediaProfilePostTaggedTarget } from "../media-profile-post-service";
import {
  buildMediaArticleAccessibilityLabel,
  type MediaArticleViewModel,
} from "./media-article-view-model";

const THUMBNAIL_SIZE = 84;
/** Oltre due chip la riga diventa una fila infinita: si passa al riepilogo. */
const MAX_VISIBLE_TAGS = 2;

export type MediaArticleCardProps = {
  article: MediaArticleViewModel;
  onOpen: (articleId: string) => void;
  onOpenTarget?: (target: MediaProfilePostTaggedTarget) => void;
};

export function MediaArticleCard({
  article,
  onOpen,
  onOpenTarget,
}: MediaArticleCardProps) {
  const metaLine = [article.dateLabel, article.tagline]
    .filter(Boolean)
    .join(" · ");
  const visibleTags = article.taggedTargets.slice(0, MAX_VISIBLE_TAGS);
  const hiddenTagCount = article.taggedTargets.length - visibleTags.length;

  return (
    <View style={styles.card} testID={`media-article-card-${article.id}`}>
      <Pressable
        accessibilityLabel={buildMediaArticleAccessibilityLabel(article)}
        accessibilityRole="button"
        onPress={() => onOpen(article.id)}
        style={({ pressed }) => [styles.body, pressed ? styles.pressed : null]}
      >
        {article.coverUrl ? (
          <Image
            /*
              La copertina è decorativa: il nome accessibile della card
              contiene già titolo, categoria e firma.
            */
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            resizeMode="cover"
            source={{ uri: article.coverUrl }}
            style={styles.thumbnail}
          />
        ) : null}

        <View style={styles.text}>
          {article.category ? (
            <AppText color="accent" variant="eyebrow">
              {article.category.toUpperCase()}
            </AppText>
          ) : null}

          <AppText numberOfLines={2} variant="titleSm">
            {article.title}
          </AppText>

          {article.excerpt ? (
            <AppText color="secondary" numberOfLines={2} variant="bodySm">
              {article.excerpt}
            </AppText>
          ) : null}

          {article.primaryAttribution || metaLine ? (
            <AppText color="muted" numberOfLines={1} variant="caption">
              {[article.primaryAttribution, metaLine]
                .filter(Boolean)
                .join(" · ")}
            </AppText>
          ) : null}

          {article.sourceAttribution ? (
            <View style={styles.sourceRow}>
              <Ionicons
                color={colors.textMuted}
                name="open-outline"
                size={12}
              />
              <AppText color="muted" numberOfLines={1} variant="caption">
                {article.sourceAttribution}
              </AppText>
            </View>
          ) : null}
        </View>
      </Pressable>

      {visibleTags.length > 0 ? (
        <View style={styles.tagRow}>
          {visibleTags.map((target) => (
            <Pressable
              accessibilityLabel={`Apri ${target.display_name}`}
              accessibilityRole="link"
              disabled={!onOpenTarget}
              key={`${target.target_type}:${target.target_id}`}
              onPress={() => onOpenTarget?.(target)}
              style={({ pressed }) => [
                styles.tagChip,
                pressed ? styles.pressed : null,
              ]}
            >
              <Avatar
                name={target.display_name}
                size="sm"
                uri={target.avatar_url ?? undefined}
              />
              <AppText numberOfLines={1} style={styles.tagLabel} variant="meta">
                {target.display_name}
              </AppText>
            </Pressable>
          ))}

          {hiddenTagCount > 0 ? (
            <View
              accessible
              accessibilityLabel={`E altri ${hiddenTagCount} profili collegati`}
              style={styles.tagChip}
            >
              <AppText color="secondary" variant="meta">
                {`+${hiddenTagCount}`}
              </AppText>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flexDirection: "row",
    gap: spacing[12],
    padding: spacing[12],
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.7,
  },
  sourceRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
  },
  tagChip: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    flexShrink: 1,
    gap: spacing[6],
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[4],
  },
  tagLabel: {
    flexShrink: 1,
    minWidth: 0,
  },
  tagRow: {
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[6],
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
  },
  text: {
    flexShrink: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  thumbnail: {
    backgroundColor: colors.surfacePlaceholder,
    borderRadius: radius[12],
    height: THUMBNAIL_SIZE,
    width: THUMBNAIL_SIZE,
  },
});
