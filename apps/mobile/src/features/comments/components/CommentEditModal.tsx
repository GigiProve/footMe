/**
 * Modifica di un proprio commento, a schermo intero (HOM-08 §149–§159, §199, mockup 8).
 *
 * Header «Annulla | Modifica | Salva» (§151) con lo stesso `ComposerHeader` del
 * composer Post, e SOTTO lo stesso `CommentEditor` del composer in fondo (§152: nessun
 * editor separato), precaricato con testo, mention e link (§150) e con l'autore del
 * commento in sola lettura. La capability `can_edit` è del server (§153): questa
 * schermata si apre solo da un menu che l'ha già verificata, e il server la rivaluta al
 * salvataggio.
 *
 * Errori (§155, §158–§159): il nuovo testo NON si perde mai. Un fallimento o un
 * conflitto di versione mostra un messaggio leggero con «Riprova» e lascia l'editor com'è;
 * «Riprova» salva sopra la versione corrente, scelta dell'utente dopo aver letto il
 * messaggio. «Annulla» durante il salvataggio non interrompe la richiesta.
 */

import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radius, sizes, spacing } from "../../../theme/tokens";
import { AppText, ConfirmModal, VerifiedCheck } from "../../../ui";
import { ComposerAvatar } from "../../post-composer/components/ComposerAvatar";
import { ComposerHeader } from "../../post-composer/components/ComposerHeader";
import { useCommentDraft } from "../comment-draft-store";
import {
  COMMENT_EDIT_CANCEL,
  COMMENT_EDIT_CURRENT_VERSION,
  COMMENT_EDIT_DISCARD_CONFIRM,
  COMMENT_EDIT_DISCARD_CONTINUE,
  COMMENT_EDIT_DISCARD_TITLE,
  COMMENT_EDIT_HEADER_TITLE,
  COMMENT_EDIT_SAVE,
  COMMENTS_RETRY,
} from "../comment-labels";
import { commentCounter, commentMetaLine, isCommentMeaningful, isOverLimit } from "../comment-presentation";
import { useCommentEntity } from "../comment-store";
import type { CommentsController } from "../use-comments-controller";
import { CommentEditor } from "./CommentEditor";

export function CommentEditModal({ controller }: { controller: CommentsController }) {
  const draft = useCommentDraft(controller.composer.store);
  const edit = draft.edit;
  const comment = useCommentEntity(edit?.commentId ?? "");
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  if (!edit) {
    return null;
  }

  const limits = controller.edit.limits;
  const saving = edit.status === "saving";
  const dirty = edit.body !== edit.originalBody;

  /** Annulla e il tasto Indietro di Android: con modifiche si chiede, mai uno scarto silenzioso. */
  function handleCancel() {
    if (saving) {
      return;
    }
    if (dirty) {
      setConfirmingDiscard(true);
    } else {
      controller.edit.cancel();
    }
  }
  const canSave =
    !saving &&
    isCommentMeaningful(edit.body, edit.mentions) &&
    !isOverLimit(edit.body.length, limits.maxBodyLength);
  const author = comment?.author ?? null;

  return (
    <Modal animationType="slide" onRequestClose={handleCancel} visible>
      <SafeAreaView style={styles.root} testID="comment-edit-modal">
        <ComposerHeader
          cancelDisabled={saving}
          cancelLabel={COMMENT_EDIT_CANCEL}
          ctaLabel={COMMENT_EDIT_SAVE}
          ctaState={saving ? "loading" : canSave ? "enabled" : "disabled"}
          onCancel={handleCancel}
          onSubmit={controller.edit.save}
          title={COMMENT_EDIT_HEADER_TITLE}
        />

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" style={styles.flex}>
            {author && comment ? (
              <View style={styles.author}>
                <ComposerAvatar
                  name={author.name}
                  size="sm"
                  square={author.identityType !== "person"}
                  uri={author.avatarUrl}
                />
                <View style={styles.authorText}>
                  <View style={styles.nameRow}>
                    <AppText numberOfLines={1} style={styles.name} variant="titleSm">
                      {author.name}
                    </AppText>
                    {author.isVerified ? <VerifiedCheck size={14} /> : null}
                  </View>
                  <AppText color="secondary" numberOfLines={1} variant="feedMeta">
                    {commentMetaLine(comment)}
                  </AppText>
                </View>
              </View>
            ) : null}

            <CommentEditor
              autoFocus
              editable={!saving}
              expanded
              maxLength={limits.maxBodyLength}
              maxMentions={limits.maxMentions}
              mentions={edit.mentions}
              onChange={controller.edit.change}
              style={styles.box}
              testID="comment-edit-input"
              userId={controller.viewerId}
              value={edit.body}
            >
              <AppText
                color={isOverLimit(edit.body.length, limits.maxBodyLength) ? "danger" : "muted"}
                variant="caption"
              >
                {commentCounter(edit.body.length, limits.maxBodyLength)}
              </AppText>
            </CommentEditor>

            {edit.notice ? (
              <View accessibilityRole="alert" style={styles.notice} testID="comment-edit-notice">
                <AppText color="danger" style={styles.noticeText} variant="feedMeta">
                  {edit.notice}
                </AppText>
                {edit.status === "failed" ? (
                  <Pressable
                    accessibilityLabel={COMMENTS_RETRY}
                    accessibilityRole="button"
                    disabled={!canSave}
                    onPress={controller.edit.save}
                    style={({ pressed }) => [styles.retry, pressed ? styles.pressed : null]}
                    testID="comment-edit-retry"
                  >
                    <AppText color="accent" variant="titleSm">
                      {COMMENTS_RETRY}
                    </AppText>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {/* §155: dopo un conflitto si vede il testo ATTUALE; il proprio resta nell'editor e
                lo si sovrascrive solo premendo di nuovo «Salva». */}
            {edit.status === "conflict" && edit.serverBody !== null ? (
              <View style={styles.current} testID="comment-edit-current">
                <AppText color="secondary" variant="eyebrow">
                  {COMMENT_EDIT_CURRENT_VERSION}
                </AppText>
                <AppText variant="bodyLg">{edit.serverBody}</AppText>
              </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>

        <ConfirmModal
          cancelLabel={COMMENT_EDIT_DISCARD_CONTINUE}
          confirmLabel={COMMENT_EDIT_DISCARD_CONFIRM}
          destructive
          onCancel={() => setConfirmingDiscard(false)}
          onConfirm={() => {
            setConfirmingDiscard(false);
            controller.edit.cancel();
          }}
          title={COMMENT_EDIT_DISCARD_TITLE}
          visible={confirmingDiscard}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  author: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[10],
  },
  authorText: {
    flex: 1,
  },
  current: {
    borderTopColor: colors.divider,
    borderTopWidth: 1,
    gap: spacing[4],
    paddingTop: spacing[12],
  },
  box: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    paddingHorizontal: spacing[12],
    paddingTop: spacing[4],
  },
  content: {
    gap: spacing[16],
    padding: spacing[16],
  },
  flex: {
    flex: 1,
  },
  name: {
    flexShrink: 1,
  },
  nameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  notice: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    justifyContent: "space-between",
  },
  noticeText: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
  retry: {
    justifyContent: "center",
    minHeight: sizes.touchTarget,
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
});
