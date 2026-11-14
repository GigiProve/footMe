/**
 * Modifica di un proprio commento (HOM-08 §149–§159, §199, §220).
 *
 * Stesso editor del composer (§152), precaricato con testo, mention e link (§150).
 * Il salvataggio è un controllo di versione (§154–§155): `update_comment` con la
 * versione letta all'apertura; se nel frattempo il commento è cambiato il server
 * risponde `comment_version_conflict` e NON sovrascrive in silenzio. Il client allora
 * rilegge il commento e MOSTRA il testo attuale accanto a quello dell'utente, che
 * resta nell'editor (§155, §158–§159); non riprova mai da solo. Sovrascrive solo se
 * l'utente preme di nuovo «Salva», e a quel punto sulla versione nuova.
 *
 * A successo si aggiorna SOLO il commento interessato (§156): una scrittura nello
 * store, nessuna rilettura della lista. La capability `can_edit` è del server (§153,
 * §198): qui non si decide chi può modificare.
 */

import { useEffect, useRef } from "react";

import { trackComment } from "./comment-analytics";
import type { CommentDraftStore } from "./comment-draft-store";
import {
  commentMentionsForSubmit,
  editErrorCopy,
  extractCommentLinks,
  isCommentMeaningful,
  isOverLimit,
} from "./comment-presentation";
import {
  classifyCommentError,
  currentVersionFromConflict,
  updateComment,
} from "./comment-service";
import { commentStore } from "./comment-store";
import type { Comment, CommentLimits, CommentMentionRef } from "./comment-types";

export type EditCommentDeps = {
  contentType: string;
  contentId: string;
  draftStore: CommentDraftStore;
  getLimits: () => CommentLimits;
  onContentUnavailable: () => void;
  /** Rilegge il commento dal server (liste), per mostrare il testo corrente dopo un conflitto (§155). */
  reloadComment: () => Promise<void>;
};

export function useEditComment(deps: EditCommentDeps) {
  const savingRef = useRef(false);
  const depsRef = useRef(deps);
  // Le funzioni sotto girano dopo il render (eventi): leggono le deps dell'ultimo render committato.
  useEffect(() => {
    depsRef.current = deps;
  });

  /** §149–§150: apre l'editor con ciò che il commento ha ora. */
  function start(comment: Pick<Comment, "id" | "version" | "body" | "mentions">) {
    const { contentId, contentType, draftStore } = depsRef.current;

    draftStore.set({
      edit: {
        body: comment.body,
        commentId: comment.id,
        expectedVersion: comment.version,
        mentions: [...comment.mentions],
        notice: null,
        originalBody: comment.body,
        serverBody: null,
        status: "idle",
      },
    });
    trackComment({ commentId: comment.id, contentId, contentType, name: "comment_edit_open" });
  }

  function change(body: string, mentions: CommentMentionRef[]) {
    depsRef.current.draftStore.set((draft) => {
      const edit = draft.edit;
      if (!edit) {
        return {};
      }
      // Il conflitto resta visibile finché non si salva: scrivere non lo nasconde (§155).
      if (edit.status === "conflict") {
        return { edit: { ...edit, body, mentions } };
      }
      return { edit: { ...edit, body, mentions, notice: null, status: edit.status === "saving" ? "saving" : "idle" } };
    });
  }

  function cancel() {
    // Durante il salvataggio Annulla non interrompe la richiesta: l'editor resta.
    if (savingRef.current) {
      return;
    }
    depsRef.current.draftStore.set({ edit: null });
  }

  async function save() {
    const { contentId, contentType, draftStore, getLimits, onContentUnavailable } = depsRef.current;
    const edit = draftStore.getState().edit;

    if (!edit || savingRef.current) {
      return;
    }

    const limits = getLimits();
    const body = edit.body.trimEnd();

    if (!isCommentMeaningful(body, edit.mentions) || isOverLimit(body.length, limits.maxBodyLength)) {
      return;
    }

    const mentions = commentMentionsForSubmit(body, edit.mentions, limits.maxMentions);
    const links = extractCommentLinks(body, limits.maxLinks);
    const epoch = commentStore.epoch();

    savingRef.current = true;
    draftStore.set({ edit: { ...edit, notice: null, status: "saving" } });

    try {
      const updated = await updateComment({
        body,
        commentId: edit.commentId,
        expectedVersion: edit.expectedVersion,
        links,
        mentions,
      });

      if (commentStore.epoch() !== epoch) {
        return;
      }

      commentStore.write(updated, Date.now());
      draftStore.set({ edit: null });
      trackComment({
        commentId: edit.commentId,
        contentId,
        contentType,
        linkCount: links.length,
        mentionCount: mentions.length,
        name: "comment_edit_success",
      });
    } catch (error) {
      if (commentStore.epoch() !== epoch) {
        return;
      }

      const kind = classifyCommentError(error);

      if (kind === "content_unavailable") {
        onContentUnavailable();
      }

      if (kind === "version_conflict") {
        // §155: il commento è cambiato. Si rilegge il testo attuale e lo si mostra accanto a
        // quello dell'utente, che resta nell'editor. Niente riprova automatico: un nuovo
        // «Salva» esplicito sovrascrive, e solo sulla versione nuova.
        const detailVersion = currentVersionFromConflict(error);
        try {
          await depsRef.current.reloadComment();
        } catch {
          // Senza rete si resta sul messaggio: il testo dell'utente non si perde.
        }
        const fresh = commentStore.get(edit.commentId);
        const latest = draftStore.getState().edit;

        if (latest && latest.commentId === edit.commentId && commentStore.epoch() === epoch) {
          const hasFresh = fresh !== undefined && fresh.version !== edit.expectedVersion;
          draftStore.set({
            edit: {
              ...latest,
              expectedVersion: hasFresh ? fresh.version : (detailVersion ?? latest.expectedVersion),
              notice: editErrorCopy(kind),
              serverBody: hasFresh ? fresh.body : null,
              status: "conflict",
            },
          });
        }
        return;
      }

      // §158: il nuovo testo resta; messaggio leggero + Riprova (§159).
      const latest = draftStore.getState().edit;
      if (latest && latest.commentId === edit.commentId) {
        draftStore.set({
          edit: { ...latest, notice: editErrorCopy(kind), status: "failed" },
        });
      }
    } finally {
      savingRef.current = false;
    }
  }

  return { cancel, change, save, start };
}
