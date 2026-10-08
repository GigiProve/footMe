/**
 * Card della Tribuna editoriale (REV-PROF-21, Screen 3).
 *
 * È un'anteprima, non un dettaglio: etichetta del tipo, domanda, testo
 * sintetico, opzioni con percentuali e la riga dei conteggi. Commenti, Q&A e
 * Salva vivono nel dettaglio contenuto condiviso, che il tap apre — non in un
 * composer inline per ogni card.
 *
 * Il voto resta qui, perché è il gesto che il mockup mostra sulla card e
 * perché il risultato si legge sul posto.
 */
import { Image, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Avatar } from "../../../ui";
import type {
  MediaTribunaOption,
  MediaTribunaPost,
} from "../media-tribuna-service";
import {
  formatMediaTribunaCounts,
  formatMediaTribunaLabel,
  getMediaTribunaIcon,
  hasVotedMediaTribuna,
  isMediaTribunaVotable,
} from "./media-tribuna-model";

export type MediaTribunaCardProps = {
  canVote: boolean;
  onOpen: (post: MediaTribunaPost) => void;
  onOpenLinkedArticle?: (articleId: string) => void;
  onVote?: (post: MediaTribunaPost, optionId: string) => void;
  post: MediaTribunaPost;
};

export function MediaTribunaCard({
  canVote,
  onOpen,
  onOpenLinkedArticle,
  onVote,
  post,
}: MediaTribunaCardProps) {
  const typeLabel = formatMediaTribunaLabel(post.kind);
  const counts = formatMediaTribunaCounts(post);
  const isVotable = isMediaTribunaVotable(post.kind);
  const hasVoted = hasVotedMediaTribuna(post);
  /*
    Prima del voto le percentuali restano nascoste: mostrarle trasformerebbe
    la scelta in un sondaggio già deciso. Dopo il voto si vedono, insieme
    all'opzione scelta.
  */
  const showResults = hasVoted || !canVote;

  return (
    <View style={styles.card} testID={`media-tribuna-card-${post.kind}`}>
      <Pressable
        accessibilityHint="Apre il contenuto con commenti e dettagli"
        accessibilityLabel={buildAccessibilityLabel(typeLabel, post, counts)}
        accessibilityRole="button"
        onPress={() => onOpen(post)}
        style={({ pressed }) => [styles.head, pressed ? styles.pressed : null]}
      >
        <View style={styles.headText}>
          <View style={styles.eyebrowRow}>
            <Ionicons
              color={colors.accent}
              name={getMediaTribunaIcon(post.kind)}
              size={13}
            />
            <AppText color="accent" variant="eyebrow">
              {typeLabel.toUpperCase()}
            </AppText>
          </View>

          <AppText variant="titleMd">{post.title}</AppText>

          {post.body ? (
            <AppText color="secondary" numberOfLines={3} variant="bodySm">
              {post.body}
            </AppText>
          ) : null}
        </View>

        <Ionicons
          color={colors.textMuted}
          name="chevron-forward"
          size={18}
          style={styles.chevron}
        />
      </Pressable>

      {post.linked_article && onOpenLinkedArticle ? (
        <Pressable
          accessibilityLabel={`Apri l'articolo collegato: ${post.linked_article.title}`}
          accessibilityRole="link"
          onPress={() => onOpenLinkedArticle(post.linked_article!.id)}
          style={({ pressed }) => [
            styles.linkedArticle,
            pressed ? styles.pressed : null,
          ]}
          testID={`media-tribuna-linked-article-${post.linked_article.id}`}
        >
          {post.linked_article.cover_url ? (
            <Image
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              resizeMode="cover"
              source={{ uri: post.linked_article.cover_url }}
              style={styles.linkedArticleImage}
            />
          ) : (
            <View
              style={[styles.linkedArticleImage, styles.linkedArticleFallback]}
            >
              <Ionicons
                color={colors.accent}
                name="newspaper-outline"
                size={16}
              />
            </View>
          )}
          <View style={styles.linkedArticleText}>
            <AppText color="accent" variant="eyebrow">
              {post.linked_article.category.toUpperCase()}
            </AppText>
            <AppText numberOfLines={2} variant="titleSm">
              {post.linked_article.title}
            </AppText>
          </View>
        </Pressable>
      ) : null}

      {isVotable && post.options.length > 0 ? (
        <View style={styles.options}>
          {post.options.map((option) => (
            <TribunaOptionRow
              canVote={canVote && !hasVoted}
              key={option.id}
              onVote={() => onVote?.(post, option.id)}
              option={option}
              showPlayer={post.kind === "player_vote"}
              showResult={showResults}
            />
          ))}
        </View>
      ) : null}

      {counts.length > 0 ? (
        <View style={styles.footer}>
          {isVotable ? (
            <FooterCount
              icon="people-outline"
              label={counts[0] ?? ""}
              testID={`media-tribuna-votes-${post.id}`}
            />
          ) : null}
          {post.kind === "community_qa" && post.question_count > 0 ? (
            <FooterCount
              icon="help-circle-outline"
              label={`${post.question_count} ${
                post.question_count === 1 ? "domanda" : "domande"
              }`}
            />
          ) : null}
          {post.comment_count > 0 ? (
            <FooterCount
              icon="chatbubble-outline"
              label={`${post.comment_count} ${
                post.comment_count === 1 ? "commento" : "commenti"
              }`}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function FooterCount({
  icon,
  label,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  testID?: string;
}) {
  return (
    <View accessible accessibilityLabel={label} style={styles.footerCount} testID={testID}>
      <Ionicons color={colors.textMuted} name={icon} size={14} />
      <AppText color="secondary" variant="caption">
        {label}
      </AppText>
    </View>
  );
}

function TribunaOptionRow({
  canVote,
  onVote,
  option,
  showPlayer,
  showResult,
}: {
  canVote: boolean;
  onVote: () => void;
  option: MediaTribunaOption;
  showPlayer: boolean;
  showResult: boolean;
}) {
  const label = showPlayer
    ? option.player_display_name || option.label
    : option.label;
  const percentage = Math.max(0, Math.min(100, option.percentage));

  return (
    <Pressable
      accessibilityLabel={
        showResult ? `${label}, ${percentage} per cento` : `Vota ${label}`
      }
      accessibilityRole="button"
      accessibilityState={{ disabled: !canVote, selected: option.is_voted }}
      disabled={!canVote}
      onPress={onVote}
      style={({ pressed }) => [
        styles.option,
        option.is_voted ? styles.optionVoted : null,
        pressed ? styles.pressed : null,
      ]}
      testID={`media-tribuna-option-${option.id}`}
    >
      <View style={styles.optionRow}>
        {showPlayer ? (
          <Avatar
            name={label}
            size="sm"
            uri={option.player_avatar_url ?? undefined}
          />
        ) : null}
        <AppText numberOfLines={1} style={styles.optionLabel} variant="bodyLg">
          {label}
        </AppText>
        {showResult ? (
          <AppText variant="numeric">{`${percentage}%`}</AppText>
        ) : null}
      </View>

      {/*
        La barra è un rinforzo visivo della percentuale già scritta accanto
        all'etichetta: lo screen reader legge il numero, non la larghezza.
      */}
      {showResult ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.track}
        >
          <View
            style={[
              styles.trackFill,
              { width: `${percentage}%` },
              option.is_voted ? styles.trackFillVoted : null,
            ]}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

function buildAccessibilityLabel(
  typeLabel: string,
  post: MediaTribunaPost,
  counts: readonly string[],
): string {
  const parts = [`${typeLabel}: ${post.title}`, ...counts];

  return `${parts.join(", ")}.`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: StyleSheet.hairlineWidth,
  },
  chevron: {
    marginTop: spacing[4],
  },
  eyebrowRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  footer: {
    alignItems: "center",
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[16],
    // Il rail azioni del design system misura 44 px, sempre nella stessa
    // posizione in fondo al modulo.
    minHeight: 44,
    paddingHorizontal: spacing[16],
  },
  footerCount: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  head: {
    flexDirection: "row",
    gap: spacing[8],
    paddingHorizontal: spacing[16],
    paddingTop: spacing[16],
  },
  headText: {
    flexShrink: 1,
    gap: spacing[6],
    minWidth: 0,
  },
  linkedArticle: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[12],
    flexDirection: "row",
    gap: spacing[10],
    marginHorizontal: spacing[16],
    marginTop: spacing[12],
    padding: spacing[8],
  },
  linkedArticleFallback: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    justifyContent: "center",
  },
  linkedArticleImage: {
    backgroundColor: colors.surfacePlaceholder,
    borderRadius: radius[8],
    height: 44,
    width: 44,
  },
  linkedArticleText: {
    flexShrink: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  option: {
    gap: spacing[6],
    paddingVertical: spacing[6],
  },
  optionLabel: {
    flexShrink: 1,
    minWidth: 0,
  },
  optionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    // 44 pt di area toccabile per ogni opzione votabile.
    minHeight: 32,
  },
  optionVoted: {},
  options: {
    gap: spacing[4],
    paddingHorizontal: spacing[16],
    paddingTop: spacing[12],
  },
  pressed: {
    opacity: 0.7,
  },
  track: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 6,
    overflow: "hidden",
  },
  trackFill: {
    backgroundColor: colors.accentSoftBorder,
    borderRadius: radius.full,
    height: "100%",
  },
  trackFillVoted: {
    backgroundColor: colors.accent,
  },
});
