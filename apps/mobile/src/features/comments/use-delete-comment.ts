/**
 * Eliminazione di un proprio commento o risposta (HOM-08 §160–§170, §199, §213, §221).
 *
 * Conferma obbligatoria (§160–§162, «Eliminare questo commento?»): il dialogo resta
 * aperto e occupato finché il server non risponde, e non si chiude a metà. Il server
 * decide l'esito (A5.6) e il client lo mostra:
 *  • `removed` — nessuna risposta attiva: la riga sparisce (§163);
 *  • `tombstoned` — il root ha risposte: resta «Commento eliminato», senza autore,
 *    testo né Mi piace, e le risposte restano (§164–§168);
 *  • una risposta eliminata sparisce da sola e toglie 1 dal conteggio globale e dal
 *    root (§169–§170); se era l'ultima di un root già «eliminato», sparisce anche il
 *    segnaposto (A1).
 * Il conteggio del contenuto è quello della risposta del server (§213); il segnaposto
 * non si conta (§90). Nessuna eliminazione ottimistica: l'esito dipende dal server.
 */

import { useState } from "react";

import { commentCountStore } from "./comment-count-store";
import { trackComment } from "./comment-analytics";
import { COMMENT_DELETE_ERROR, COMMENT_TARGET_UNAVAILABLE } from "./comment-labels";
import { classifyCommentError, deleteComment } from "./comment-service";
import { commentStore } from "./comment-store";
import type { Comment } from "./comment-types";

export type DeleteCommentTarget = Pick<Comment, "id" | "rootCommentId" | "replyToCommentId">;

export function useDeleteComment({
  contentType,
  contentId,
  contentKey,
  onMessage,
}: {
  contentType: string;
  contentId: string;
  contentKey: string;
  /** Un messaggio leggero (toast) per un'eliminazione non riuscita. */
  onMessage: (message: string) => void;
}) {
  const [target, setTarget] = useState<DeleteCommentTarget | null>(null);
  const [isBusy, setBusy] = useState(false);

  /** §160: «Elimina» dal menu apre la conferma, non elimina. */
  function request(comment: DeleteCommentTarget) {
    setTarget({
      id: comment.id,
      replyToCommentId: comment.replyToCommentId,
      rootCommentId: comment.rootCommentId,
    });
  }

  function cancel() {
    if (!isBusy) {
      setTarget(null);
    }
  }

  async function confirm() {
    if (!target || isBusy) {
      return;
    }

    const base = { commentId: target.id, contentId, contentType };
    const epoch = commentStore.epoch();

    setBusy(true);
    trackComment({ ...base, name: "comment_delete_attempt" });

    try {
      const result = await deleteComment(target.id);

      if (commentStore.epoch() !== epoch) {
        return;
      }

      const at = Date.now();
      if (result.outcome === "removed") {
        commentStore.remove(target.id);
      } else {
        commentStore.tombstone(target.id, at);
      }

      if (target.replyToCommentId !== null) {
        commentStore.setReplies(result.rootCommentId, result.rootRepliesCount);
        const root = commentStore.get(result.rootCommentId);
        if (root?.status === "deleted" && result.rootRepliesCount === 0) {
          commentStore.remove(result.rootCommentId);
        }
      }

      commentCountStore.apply(contentKey, result.commentsCount, at);
      trackComment({ ...base, name: "comment_delete_success", outcome: result.outcome });
      setTarget(null);
    } catch (error) {
      if (commentStore.epoch() !== epoch) {
        return;
      }

      const kind = classifyCommentError(error);
      // Già eliminato altrove: non c'è più nulla da eliminare, la riga esce.
      if (kind === "comment_unavailable") {
        commentStore.remove(target.id);
        onMessage(COMMENT_TARGET_UNAVAILABLE);
      } else {
        onMessage(COMMENT_DELETE_ERROR);
      }
      setTarget(null);
    } finally {
      setBusy(false);
    }
  }

  return { cancel, confirm, isBusy, request, target };
}
