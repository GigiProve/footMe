/**
 * Card della Tribuna (REV-PROF-19, Screen 1 e 2).
 *
 * È un'anteprima, non il contenuto: tipo, tempo, titolo, un estratto breve,
 * l'anteprima specifica del formato e i due conteggi. Il testo integrale, i
 * commenti, le reazioni, il salvataggio e le azioni owner vivono nel dettaglio
 * condiviso — qui non c'è nessun campo "Scrivi un commento" e nessun thread.
 */
import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing, typography } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import type { FanTribunaPost } from "../fan-tribuna-service";
import { FootballPitchPreview } from "./FootballPitchPreview";
import {
  formatFanCount,
  formatFanRelativeDate,
  getFanContentIcon,
  getFanContentLabel,
} from "./fan-content-labels";

/** L'estratto resta un estratto: il contenuto intero è nel dettaglio. */
const EXCERPT_LINES = 2;

type FanTribunaCardProps = {
  onOpen: () => void;
  post: FanTribunaPost;
};

function FanTribunaCardComponent({ onOpen, post }: FanTribunaCardProps) {
  const typeLabel = getFanContentLabel(post.kind);
  const relativeDate = formatFanRelativeDate(post.published_at ?? post.created_at);

  return (
    <Pressable
      accessibilityHint="Apre il contenuto"
      accessibilityLabel={buildCardAccessibilityLabel(post, typeLabel)}
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
      testID={`fan-tribuna-card-${post.kind}`}
    >
      <View style={styles.header}>
        <View style={styles.typeChip}>
          <Ionicons
            color={colors.accent}
            name={getFanContentIcon(post.kind)}
            size={13}
          />
          <AppText color="accent" variant="metaStrong">
            {typeLabel}
          </AppText>
        </View>
        {relativeDate ? (
          <AppText color="muted" variant="meta">
            {relativeDate}
          </AppText>
        ) : null}
      </View>

      {post.title ? (
        <AppText numberOfLines={2} style={styles.title} variant="titleSm">
          {post.title}
        </AppText>
      ) : null}

      {post.body ? (
        <AppText
          color="secondary"
          numberOfLines={EXCERPT_LINES}
          style={styles.excerpt}
          variant="bodySm"
        >
          {post.body}
        </AppText>
      ) : null}

      {post.kind === "poll" ? <PollPreview post={post} /> : null}
      {post.kind === "formation" ? <FormationPreview post={post} /> : null}

      <View style={styles.footer}>
        <View style={styles.metric}>
          <Ionicons
            color={colors.textSecondary}
            name="thumbs-up-outline"
            size={15}
          />
          <AppText color="secondary" variant="numeric">
            {formatFanCount(post.support_count)}
          </AppText>
        </View>
        <View style={styles.metric}>
          <Ionicons
            color={colors.textSecondary}
            name="chatbubble-outline"
            size={15}
          />
          <AppText color="secondary" variant="numeric">
            {formatFanCount(post.comment_count)}
          </AppText>
        </View>
        <View style={styles.footerSpacer} />
        <Ionicons color={colors.textMuted} name="chevron-forward" size={16} />
      </View>
    </Pressable>
  );
}

export const FanTribunaCard = memo(FanTribunaCardComponent);

/**
 * Anteprima del sondaggio: opzioni e percentuali arrivano dal backend, mai da
 * un valore dimostrativo. Qui non si vota — il voto vive nel dettaglio, dove
 * c'è il rollback — quindi la riga mostra lo stato senza promettere un'azione.
 */
function PollPreview({ post }: { post: FanTribunaPost }) {
  const hasResults = post.total_vote_count > 0;

  return (
    <View style={styles.pollList}>
      {post.poll_options.map((option) => (
        <View
          accessibilityLabel={buildPollOptionAccessibilityLabel(
            option.label,
            hasResults ? option.percentage : null,
            option.is_voted,
          )}
          accessible
          key={option.id}
          style={[
            styles.pollOption,
            option.is_voted ? styles.pollOptionVoted : null,
          ]}
        >
          {hasResults ? (
            <View
              pointerEvents="none"
              style={[styles.pollFill, { width: `${option.percentage}%` }]}
            />
          ) : null}
          <AppText numberOfLines={1} style={styles.pollLabel} variant="bodySm">
            {option.label}
          </AppText>
          {/*
            Lo stato votato non è comunicato solo dal colore: la spunta lo dice
            anche a chi non distingue il riempimento.
          */}
          {option.is_voted ? (
            <Ionicons color={colors.accent} name="checkmark" size={14} />
          ) : null}
          {hasResults ? (
            <AppText color="secondary" variant="numeric">
              {`${option.percentage}%`}
            </AppText>
          ) : null}
        </View>
      ))}
      <AppText color="muted" variant="meta">
        {hasResults
          ? `${formatFanCount(post.total_vote_count)} voti`
          : "Nessun voto"}
      </AppText>
    </View>
  );
}

/**
 * Anteprima della formazione: lo stesso renderer del dominio, in formato
 * ridotto. Il campo è decorativo per gli screen reader — l'alternativa
 * testuale è il modulo, che è l'informazione vera dell'anteprima.
 */
function FormationPreview({ post }: { post: FanTribunaPost }) {
  const formation = post.formation ?? "4-3-3";

  return (
    <View style={styles.formationBlock}>
      <AppText
        accessibilityLabel={`Modulo ${formation}, ${post.lineup_players.length} giocatori schierati`}
        color="secondary"
        variant="metaStrong"
      >
        {formation}
      </AppText>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.formationPitch}
      >
        <FootballPitchPreview
          formation={formation}
          players={post.lineup_players}
        />
      </View>
    </View>
  );
}

function buildCardAccessibilityLabel(
  post: FanTribunaPost,
  typeLabel: string,
): string {
  return [
    typeLabel,
    post.title,
    `${formatFanCount(post.support_count)} reazioni`,
    `${formatFanCount(post.comment_count)} commenti`,
  ]
    .filter(Boolean)
    .join(", ");
}

function buildPollOptionAccessibilityLabel(
  label: string,
  percentage: number | null,
  isVoted: boolean,
): string {
  return [
    label,
    percentage != null ? `${percentage} percento` : null,
    isVoted ? "la tua scelta" : null,
  ]
    .filter(Boolean)
    .join(", ");
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing[8],
    padding: spacing[16],
  },
  cardPressed: {
    opacity: 0.75,
  },
  excerpt: {
    lineHeight: 19,
  },
  footer: {
    alignItems: "center",
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[16],
    paddingTop: spacing[10],
  },
  footerSpacer: {
    flex: 1,
  },
  formationBlock: {
    gap: spacing[6],
  },
  formationPitch: {
    // L'anteprima è una miniatura: il campo intero vive nel dettaglio.
    maxWidth: 220,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    justifyContent: "space-between",
  },
  metric: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  pollFill: {
    backgroundColor: colors.accentSoft,
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
  },
  pollLabel: {
    flex: 1,
  },
  pollList: {
    gap: spacing[6],
  },
  pollOption: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[8],
    overflow: "hidden",
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
  },
  pollOptionVoted: {
    borderColor: colors.accent,
  },
  title: {
    fontWeight: typography.fontWeight.bold,
  },
  typeChip: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    flexDirection: "row",
    gap: spacing[6],
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[4],
  },
});
