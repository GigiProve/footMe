/**
 * Una riga di commento o risposta (HOM-08 §54–§73, §92–§101, §137–§140, §228–§232,
 * §236–§243).
 *
 * Riga APERTA, senza card né balloon (§54, §238): avatar, poi una colonna con
 * intestazione (nome + check standard + «· Autore» discreto, §64–§66; meta
 * «Allenatore · AC Como · 2 h», §56–§58; ••• solo se esistono azioni, §146), testo e
 * azioni «♡ Mi piace | ♡ 12» + «Rispondi» (§68–§74). Un solo accent, nessun colore per
 * ruolo (§240–§241), nessun avatar di chi ha messo Mi piace (§73).
 *
 *  • Il Mi piace è la cella HOM-07 (`LikeAction compact`): icona = toggle, numero =
 *    lista (§74–§76); a zero «Mi piace» e basta, mai «Mi piace · 12 Mi piace» (§72). Si
 *    abbona alla propria cella nello store: un Mi piace non rirenderizza il thread (§225).
 *  • Una risposta è indentata UNA volta sola, mai un terzo livello (§50–§51, §137–§138);
 *    per lo screen reader è «risposta a …» e non solo un rientro (§229).
 *  • Elemento ottimistico (§92): appena inviato, «sending»; se l'invio fallisce la riga
 *    resta con «Invio non riuscito · Riprova» (§98) e toccare il testo lo riapre nel
 *    composer per correggerlo (§101). Senza capability non ci sono Mi piace né Rispondi.
 *  • Avatar a 32pt anche nelle risposte: il design system non ha una taglia da 24.
 *  • HOM-11 §134–§140: un commento segnalato dal viewer si ripiega in «Commento segnalato»
 *    (`CommentReportedRow`), senza azioni; le risposte restano. Il ••• compare anche sul
 *    commento altrui quando c'è almeno un'azione (Non seguire, Segnala; §69–§72).
 */

import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../theme/tokens";
import { AppText, VerifiedCheck } from "../../../ui";
import { LikeAction } from "../../feed/components/post/PostActionRow";
import { followSourceKey, followSourceOfIdentity } from "../../following/follow-source";
import { useIsSourceUnfollowed } from "../../following/unfollowed-sources-store";
import { useIsReported } from "../../moderation/reported-store";
import { ComposerAvatar } from "../../post-composer/components/ComposerAvatar";
import {
  COMMENT_ACTIONS_LABEL,
  COMMENT_AUTHOR_LABEL,
  COMMENT_REPLY,
  COMMENT_SEND_FAILED,
  COMMENTS_RETRY,
} from "../comment-labels";
import {
  buildCommentActions,
  commentAuthorAccessibilityLabel,
  commentMetaLine,
  commentReportKey,
  isCommentCollapsed,
  replyAccessibilityLabel,
} from "../comment-presentation";
import type { CommentEntity } from "../comment-types";
import type { CommentsController } from "../use-comments-controller";
import { CommentBody } from "./CommentBody";
import { CommentReportedRow } from "./CommentReportedRow";

const AVATAR_HIT_SLOP = { bottom: spacing[6], left: spacing[6], right: spacing[6], top: spacing[6] };

type CommentRowProps = {
  comment: CommentEntity;
  isReply: boolean;
  controller: CommentsController;
};

export function CommentRow({ comment, isReply, controller }: CommentRowProps) {
  const { actions } = controller;
  const author = comment.author;
  const send = comment.send;
  // HOM-11 §62, §126: gli insiemi di sessione valgono prima del refetch. Store di modulo,
  // abbonati per cella: segnalare o lasciare un autore non rirenderizza il thread.
  const authorSource = author ? followSourceOfIdentity(author) : null;
  const unfollowedInSession = useIsSourceUnfollowed(authorSource ? followSourceKey(authorSource) : null);
  const reportedInSession = useIsReported(commentReportKey(comment.id));
  const menu = buildCommentActions(comment, {
    isSending: send !== null,
    reportedInSession,
    unfollowedInSession,
  });
  const canOpenAuthor = comment.capabilities.canOpenAuthor && author !== null && send === null;
  const headerLabel = commentAuthorAccessibilityLabel(comment);

  // HOM-11 §134–§140: il commento segnalato dal viewer si ripiega, senza azioni; le risposte restano.
  if (isCommentCollapsed(comment, reportedInSession)) {
    return <CommentReportedRow commentId={comment.id} isReply={isReply} />;
  }

  const identity = (
    <View style={styles.identity}>
      <View style={styles.nameRow}>
        <AppText numberOfLines={1} style={styles.name} variant="titleSm">
          {author?.name}
        </AppText>
        {author?.isVerified ? <VerifiedCheck size={14} /> : null}
        {comment.isContentAuthor ? (
          <AppText color="secondary" numberOfLines={1} style={styles.authorLabel} variant="feedMeta">
            {`· ${COMMENT_AUTHOR_LABEL}`}
          </AppText>
        ) : null}
      </View>
      {/* Va a capo: tempo e «· Modificato» devono restare sempre visibili, anche con font grandi. */}
      <AppText color="secondary" variant="feedMeta">
        {commentMetaLine(comment)}
      </AppText>
    </View>
  );

  return (
    <View
      style={[styles.row, isReply ? styles.reply : null, send?.state === "sending" ? styles.sending : null]}
      testID={`comment-row-${comment.id}`}
    >
      {author ? (
        // L'avatar è un'area di tocco in più, NON un secondo punto per lo screen reader: lo
        // stesso bersaglio lo annuncia il nome (§196). 32pt + 6pt di hitSlop per lato = 44.
        <Pressable
          accessible={false}
          disabled={!canOpenAuthor}
          hitSlop={AVATAR_HIT_SLOP}
          importantForAccessibility="no-hide-descendants"
          onPress={() => actions.openAuthor(author, comment.id, "avatar")}
          testID={`comment-avatar-${comment.id}`}
        >
          <ComposerAvatar
            name={author.name}
            size="sm"
            square={author.identityType !== "person"}
            uri={author.avatarUrl}
          />
        </Pressable>
      ) : null}

      <View style={styles.column}>
        <View style={styles.header}>
          <Pressable
            accessibilityHint={canOpenAuthor ? "Apre il profilo" : undefined}
            accessibilityLabel={headerLabel}
            accessibilityRole={canOpenAuthor ? "button" : "text"}
            disabled={!canOpenAuthor}
            onPress={() => author && actions.openAuthor(author, comment.id, "name")}
            style={styles.identityPress}
            testID={`comment-author-${comment.id}`}
          >
            {identity}
          </Pressable>
          {menu.length > 0 ? (
            <Pressable
              accessibilityLabel={COMMENT_ACTIONS_LABEL}
              accessibilityRole="button"
              hitSlop={4}
              onPress={() => actions.openMenu(comment)}
              style={({ pressed }) => [styles.menu, pressed ? styles.pressed : null]}
              testID={`comment-menu-${comment.id}`}
            >
              <Ionicons color={colors.textSecondary} name="ellipsis-horizontal" size={18} />
            </Pressable>
          ) : null}
        </View>

        {send?.state === "failed" ? (
          <Pressable
            accessibilityHint="Riapre il testo per correggerlo"
            accessibilityRole="button"
            onPress={() => actions.reopenFailed(comment.id)}
            testID={`comment-reopen-${comment.id}`}
          >
            <CommentBody
              body={comment.body}
              links={comment.links}
              mentions={comment.mentions}
              onPressLink={actions.openLink}
              onPressMention={(mention) => actions.openMention(mention, comment.id)}
            />
          </Pressable>
        ) : (
          <CommentBody
            body={comment.body}
            links={comment.links}
            mentions={comment.mentions}
            onPressLink={actions.openLink}
            onPressMention={(mention) => actions.openMention(mention, comment.id)}
            testID={`comment-body-${comment.id}`}
          />
        )}

        {send?.state === "failed" ? (
          <Pressable
            accessibilityLabel={`${COMMENT_SEND_FAILED}. ${COMMENTS_RETRY}`}
            accessibilityRole="button"
            onPress={() => actions.retrySend(comment.id)}
            style={({ pressed }) => [styles.failed, pressed ? styles.pressed : null]}
            testID={`comment-retry-${comment.id}`}
          >
            <Ionicons color={colors.danger} name="refresh" size={16} />
            <AppText color="danger" variant="feedMeta">
              {`${COMMENT_SEND_FAILED} · ${COMMENTS_RETRY}`}
            </AppText>
          </Pressable>
        ) : null}

        {send === null ? (
          <View style={styles.actions}>
            {comment.capabilities.canLike ? (
              <LikeAction
                compact
                contentType="comment"
                countTestID={`comment-likes-count-${comment.id}`}
                onOpenLikes={() => actions.openLikes(comment)}
                onToggle={() => actions.toggleLike(comment)}
                postId={comment.id}
                seed={{ likedAs: comment.likedAs, likesCount: comment.likesCount }}
                testID={`comment-like-${comment.id}`}
              />
            ) : comment.likesCount > 0 ? (
              // Senza capability (commenti disattivati) il numero resta, ma non è azionabile.
              <View style={styles.staticLikes} testID={`comment-likes-static-${comment.id}`}>
                <Ionicons color={colors.textSecondary} name="heart-outline" size={20} />
                <AppText color="secondary" variant="feedMeta">
                  {String(comment.likesCount)}
                </AppText>
              </View>
            ) : null}
            {comment.capabilities.canReply ? (
              <Pressable
                accessibilityLabel={replyAccessibilityLabel(author)}
                accessibilityRole="button"
                onPress={() => actions.reply(comment)}
                style={({ pressed }) => [styles.replyAction, pressed ? styles.pressed : null]}
                testID={`comment-reply-${comment.id}`}
              >
                <AppText color="secondary" variant="feedMeta">
                  {COMMENT_REPLY}
                </AppText>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[16],
    marginTop: spacing[4],
  },
  authorLabel: {
    flexShrink: 0,
  },
  column: {
    flex: 1,
    gap: spacing[4],
  },
  failed: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
    minHeight: sizes.touchTarget,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[8],
  },
  identity: {
    flexShrink: 1,
  },
  identityPress: {
    flex: 1,
  },
  menu: {
    alignItems: "center",
    justifyContent: "center",
    marginRight: -spacing[8],
    minHeight: sizes.touchTarget,
    minWidth: sizes.touchTarget,
  },
  name: {
    flexShrink: 1,
  },
  nameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  pressed: {
    opacity: 0.6,
  },
  // Un solo livello di indentazione (§50–§51, §137–§138); abbastanza piccola da non
  // schiacciare il testo con font grandi (§140, §235).
  reply: {
    paddingLeft: spacing[24],
  },
  replyAction: {
    justifyContent: "center",
    minHeight: sizes.touchTarget,
  },
  row: {
    flexDirection: "row",
    gap: spacing[10],
    paddingVertical: spacing[12],
  },
  sending: {
    opacity: 0.7,
  },
  staticLikes: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
    minHeight: sizes.touchTarget,
  },
});
