/**
 * Il composer sticky dei commenti (HOM-08 §17–§27, §30–§46, §81–§86, §94–§101, §179,
 * §191, §194, §244).
 *
 * Va FUORI dallo ScrollView, dentro il KeyboardAvoidingView del dettaglio: resta
 * raggiungibile in fondo e segue la tastiera.
 *
 *  • Inattivo (§18–§20): una riga compatta «[avatar] Scrivi un commento…» che non
 *    copre il contenuto (§19). Il tap lo attiva e mette il focus.
 *  • Attivo (§21): identità, banner «Rispondi a …» con X (§82–§83), editor multilinea
 *    con mention (§26, §102), controlli — «@», contatore «n/1000» e «Pubblica» — e
 *    nessun allegato né media (§27). «Pubblica» è disabilitato se il testo è vuoto o
 *    non significativo (§24), o se non c'è un'identità che possa commentare (§46).
 *  • Identità (§30–§34): una sola autorizzata = solo avatar, nome e check, NESSUNA
 *    freccia né «Commenta come» (§30); più identità = ⌄ e il foglio (§31). Cambiare
 *    identità non cancella testo, mention né risposta (§40); se l'identità perde il
 *    permesso il testo resta, si dice perché e si può passare a un'altra (§43–§45).
 *  • Con i commenti disattivati o il contenuto non disponibile il composer NON c'è
 *    (§179, §189): niente campo, niente submit. Il testo già scritto non sparisce prima
 *    di aver comunicato l'errore (§191).
 * Scrivere non rirenderizza il thread: il testo vive in `comment-draft-store`.
 */

import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../theme/tokens";
import { AppText, Button, VerifiedCheck } from "../../../ui";
import { ComposerAvatar } from "../../post-composer/components/ComposerAvatar";
import { useCommentDraft } from "../comment-draft-store";
import {
  COMMENT_PERMISSION_LOST,
  COMMENT_PLACEHOLDER,
  COMMENT_PUBLISH,
  COMMENT_REPLY_CANCEL,
  COMMENT_REPLYING_TO,
} from "../comment-labels";
import {
  commentCounter,
  hasCommentIdentityChoice,
  isOverLimit,
  publishBlockReason,
  resolveCommentIdentity,
} from "../comment-presentation";
import type { CommentIdentity } from "../comment-types";
import type { CommentsController } from "../use-comments-controller";
import { CommentEditor } from "./CommentEditor";

function IdentityRow({
  identity,
  selectable,
  onPress,
}: {
  identity: CommentIdentity;
  selectable: boolean;
  onPress: () => void;
}) {
  const content = (
    <>
      <ComposerAvatar name={identity.name} size="sm" square={identity.type !== "person"} uri={identity.avatarUrl} />
      <View style={styles.identityName}>
        <AppText numberOfLines={1} style={styles.name} variant="titleSm">
          {identity.name}
        </AppText>
        {identity.isVerified ? <VerifiedCheck size={14} /> : null}
      </View>
      {selectable ? <Ionicons color={colors.textSecondary} name="chevron-down" size={18} /> : null}
    </>
  );

  // §30: una sola identità → riga puramente informativa, senza freccia né «Commenta come».
  if (!selectable) {
    return (
      <View style={styles.identity} testID="comment-composer-identity">
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={`Commenta come ${identity.name}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.identity, pressed ? styles.pressed : null]}
      testID="comment-composer-identity"
    >
      {content}
    </Pressable>
  );
}

export function CommentComposerBar({ controller }: { controller: CommentsController }) {
  const { composer } = controller;
  const draft = useCommentDraft(composer.store);

  // §179, §189: niente campo con i commenti disattivati o il contenuto non disponibile.
  if (composer.mode === "hidden") {
    return null;
  }

  const resolved = resolveCommentIdentity(composer.identities, draft.identity);
  const identity = resolved.identity;

  // Inattivo (§18–§20): compatto, non domina la schermata (§19).
  if (!draft.active) {
    return (
      <View onLayout={composer.onBarLayout} style={styles.bar} testID="comment-composer-bar">
        {/* Finché non si sa chi commenta, un segnaposto visibile (non il fondo della schermata). */}
        {composer.mode === "loading" ? (
          <View style={styles.avatarPlaceholder} testID="comment-composer-avatar-placeholder" />
        ) : (
          <ComposerAvatar
            name={identity?.name ?? ""}
            size="sm"
            square={identity !== null && identity.type !== "person"}
            uri={identity?.avatarUrl ?? null}
          />
        )}
        <Pressable
          accessibilityLabel={COMMENT_PLACEHOLDER}
          accessibilityRole="button"
          accessibilityState={{ disabled: composer.mode === "loading" }}
          disabled={composer.mode === "loading"}
          onPress={composer.open}
          style={({ pressed }) => [styles.field, pressed ? styles.pressed : null]}
          testID="comment-composer-inactive"
        >
          <AppText color="muted" variant="bodyLg">
            {COMMENT_PLACEHOLDER}
          </AppText>
        </Pressable>
      </View>
    );
  }

  const limits = controller.limits;
  const block = publishBlockReason({
    body: draft.body,
    commentsEnabled: true,
    contentAvailable: true,
    hasIdentity: identity !== null,
    identityLost: resolved.lost,
    isSending: false,
    limits,
    mentions: draft.mentions,
  });
  const notice = resolved.lost ? COMMENT_PERMISSION_LOST : draft.notice;
  const over = isOverLimit(draft.body.length, limits.maxBodyLength);

  return (
    <View onLayout={composer.onBarLayout} style={styles.barActive} testID="comment-composer-bar">
      {draft.replyTo ? (
        <View style={styles.replyBanner} testID="comment-reply-banner">
          <AppText color="secondary" numberOfLines={1} style={styles.replyText} variant="feedMeta">
            {`${COMMENT_REPLYING_TO} ${draft.replyTo.name}`}
          </AppText>
          <Pressable
            accessibilityLabel={COMMENT_REPLY_CANCEL}
            accessibilityRole="button"
            onPress={composer.cancelReply}
            style={({ pressed }) => [styles.replyClose, pressed ? styles.pressed : null]}
            testID="comment-reply-cancel"
          >
            <Ionicons color={colors.textSecondary} name="close" size={18} />
          </Pressable>
        </View>
      ) : null}

      {identity ? (
        <IdentityRow
          identity={identity}
          onPress={() => controller.overlays.setAsOpen(true)}
          selectable={hasCommentIdentityChoice(composer.identities, resolved)}
        />
      ) : null}

      {notice ? (
        <AppText accessibilityRole="alert" color="danger" style={styles.notice} testID="comment-composer-notice" variant="feedMeta">
          {notice}
        </AppText>
      ) : null}

      <CommentEditor
        autoFocus
        focusToken={draft.focusToken}
        maxLength={limits.maxBodyLength}
        maxMentions={limits.maxMentions}
        mentions={draft.mentions}
        onBlur={composer.close}
        onChange={composer.setBody}
        onMentionAdded={composer.onMentionAdded}
        userId={controller.viewerId}
        value={draft.body}
      >
        <AppText color={over ? "danger" : "muted"} variant="caption">
          {commentCounter(draft.body.length, limits.maxBodyLength)}
        </AppText>
        <Button
          accessibilityLabel={COMMENT_PUBLISH}
          disabled={block !== null}
          label={COMMENT_PUBLISH}
          onPress={composer.publish}
          size="lg"
          testID="comment-publish"
          variant="primary"
        />
      </CommentEditor>
    </View>
  );
}

const styles = StyleSheet.create({
  // La hairline in alto è a tutta larghezza; il contenuto ha il suo margine di 16pt (mockup 3, 6, 10).
  avatarPlaceholder: {
    backgroundColor: colors.border,
    borderRadius: radius.full,
    height: 32,
    width: 32,
  },
  bar: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing[10],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[8],
  },
  barActive: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: spacing[16],
    paddingTop: spacing[4],
  },
  field: {
    backgroundColor: colors.inputBackground,
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[16],
  },
  identity: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[10],
    minHeight: sizes.touchTarget,
  },
  identityName: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 1,
    gap: spacing[6],
  },
  name: {
    flexShrink: 1,
  },
  notice: {
    paddingBottom: spacing[4],
  },
  pressed: {
    opacity: 0.6,
  },
  replyBanner: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: sizes.touchTarget,
  },
  replyClose: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: sizes.touchTarget,
    minWidth: sizes.touchTarget,
  },
  replyText: {
    flex: 1,
  },
});
