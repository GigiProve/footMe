/**
 * Pubblicazione di un commento o di una risposta (HOM-08 §42–§46, §86–§88, §92–§101,
 * §189–§194, §211–§212, §219, §223).
 *
 * Flusso (ottimistico, §92):
 *  1. Pubblica → l'elemento entra SUBITO nella lista con id temporaneo e data «adesso»,
 *     il conteggio del contenuto sale di 1 (§211–§212) e il composer si svuota;
 *  2. `create_comment` con la `operationKey` del commento: il doppio tap e il Riprova
 *     rilanciano LA STESSA chiave, il server risponde con lo stesso commento (§95, §99);
 *  3. a successo l'id temporaneo diventa quello del server nella stessa posizione
 *     (§94) e il conteggio è quello del server; nessun toast di successo (§96);
 *  4. a errore di RETE l'elemento resta con «Invio non riuscito · Riprova» (§97–§98) e
 *     il conteggio ottimistico si ritira (§100);
 *  5. a errore DEFINITIVO del server (permesso perso, risposta a un commento sparito,
 *     contenuto non disponibile, commenti disattivati…) l'elemento esce dalla lista e il
 *     TESTO TORNA nel composer con il motivo (§43–§44, §191, §193–§194): nessuna perdita.
 *     Se nel frattempo l'utente ha già scritto altro, l'elemento resta come fallito.
 *
 * La guardia anti doppio invio è sincrona (`inFlight` per chiave, §95): un secondo tap
 * prima della risposta non parte. Le risposte dell'utente di prima (cambio account) non
 * scrivono più (`epoch`).
 */

import { useEffect, useRef } from "react";

import { commentCountStore } from "./comment-count-store";
import { trackComment, type CommentAnalyticsEvent } from "./comment-analytics";
import type { CommentDraftStore } from "./comment-draft-store";
import { COMMENT_REOPEN_BLOCKED } from "./comment-labels";
import { newCommentOperationKey } from "./comment-operation-key";
import {
  buildOptimisticComment,
  commentMentionsForSubmit,
  commentableIdentities,
  extractCommentLinks,
  failureReasonOf,
  identityFromAuthor,
  publishBlockReason,
  publishErrorCopy,
  resolveCommentIdentity,
} from "./comment-presentation";
import { seedLikesFromComments } from "./comment-seed";
import { classifyCommentError, createComment } from "./comment-service";
import { commentStore } from "./comment-store";
import type { CommentContext, CommentEntity, CommentErrorKind } from "./comment-types";

export type PublishCommentDeps = {
  contentType: string;
  contentId: string;
  /** `likeItemKey(contentType, contentId)`: la cella del conteggio. */
  contentKey: string;
  draftStore: CommentDraftStore;
  /** Il contesto più recente: letto al momento dell'invio, mai catturato in un render passato (§42). */
  getContext: () => CommentContext | null;
  /** §43, §177: permesso perso o commenti disattivati — il contesto si rilegge dal server. */
  onPermissionLost: () => void;
  /** Un messaggio leggero (toast) quando un'azione non può partire. */
  onNotice: (message: string) => void;
  /** §188–§190: il contenuto non c'è più. */
  onContentUnavailable: () => void;
};

/** Il testo di un errore definitivo torna al composer; la rete fallita resta in lista (§98). */
function isDefinitive(kind: CommentErrorKind): boolean {
  return kind !== "network";
}

export function usePublishComment(deps: PublishCommentDeps) {
  const inFlight = useRef(new Set<string>());
  // Le funzioni sotto girano dopo il render (eventi): leggono le deps dell'ultimo render committato.
  const depsRef = useRef(deps);
  useEffect(() => {
    depsRef.current = deps;
  });

  function track(event: CommentAnalyticsEvent) {
    trackComment(event);
  }

  /** Il testo fallito torna nel composer, con il motivo (§44, §101, §194). */
  function restoreToComposer(tempId: string, notice: string | null, kind: CommentErrorKind | null): boolean {
    const { draftStore } = depsRef.current;
    const entity = commentStore.get(tempId);
    const send = entity?.send;

    // Non si scrive sopra a ciò che l'utente ha già digitato nel frattempo.
    if (!entity || !send || draftStore.getState().body.length > 0) {
      return false;
    }

    commentStore.discardOptimistic(tempId);
    const targetGone = kind === "target_unavailable" || kind === "comment_unavailable";

    draftStore.set({
      active: true,
      body: send.body,
      identity: entity.author ? identityFromAuthor(entity.author) : null,
      mentions: send.mentions,
      notice,
      // Una chiave con un payload diverso è un conflitto (§101): se il server lo ha
      // detto, si riparte con una chiave nuova; altrimenti vale la stessa.
      operationKey: kind === "operation_conflict" ? newCommentOperationKey() : send.operationKey,
      replyTo:
        send.replyToCommentId && !targetGone
          ? {
              commentId: send.replyToCommentId,
              identityId: entity.replyTo?.identityId ?? "",
              identityType: entity.replyTo?.identityType ?? "person",
              name: entity.replyTo?.name ?? "",
              rootCommentId: send.rootCommentId ?? entity.rootCommentId,
            }
          : null,
    });

    return true;
  }

  async function run(tempId: string) {
    const current = depsRef.current;
    const entity: CommentEntity | undefined = commentStore.get(tempId);
    const send = entity?.send;

    if (!entity || !send || inFlight.current.has(send.operationKey)) {
      return;
    }

    inFlight.current.add(send.operationKey);
    const epoch = commentStore.epoch();
    const isReply = send.replyToCommentId !== null;
    const rootId = entity.rootCommentId;
    const identityType = send.identity.type;
    const base = { contentId: current.contentId, contentType: current.contentType };

    // §211–§212: +1 subito, per commenti e risposte; il fallimento lo ritira (§100).
    commentCountStore.adjust(current.contentKey, 1, current.getContext()?.commentsCount);
    if (isReply) {
      commentStore.adjustReplies(rootId, 1);
    }

    track(
      isReply
        ? { ...base, commentId: send.replyToCommentId ?? "", identityType, name: "reply_publish_attempt" }
        : {
            ...base,
            identityType,
            linkCount: send.links.length,
            mentionCount: send.mentions.length,
            name: "comment_publish_attempt",
          },
    );

    try {
      const result = await createComment({
        body: send.body,
        contentId: current.contentId,
        contentType: current.contentType,
        identity: send.identity,
        links: send.links,
        mentions: send.mentions,
        operationKey: send.operationKey,
        replyToCommentId: send.replyToCommentId,
      });

      if (commentStore.epoch() !== epoch) {
        return;
      }

      const at = Date.now();
      commentStore.reconcile(tempId, result.comment, at);
      seedLikesFromComments([result.comment], at);
      commentCountStore.confirm(current.contentKey, 1, result.commentsCount, at);
      if (isReply) {
        commentStore.setReplies(result.comment.rootCommentId, result.rootRepliesCount);
      }

      track(
        isReply
          ? { ...base, commentId: send.replyToCommentId ?? "", identityType, name: "reply_publish_success" }
          : {
              ...base,
              identityType,
              linkCount: send.links.length,
              mentionCount: send.mentions.length,
              name: "comment_publish_success",
            },
      );
    } catch (error) {
      if (commentStore.epoch() !== epoch) {
        return;
      }

      const kind = classifyCommentError(error);
      commentCountStore.rollback(current.contentKey, 1);
      if (isReply) {
        commentStore.adjustReplies(rootId, -1);
      }

      track({
        ...base,
        identityType,
        name: "comment_publish_failure",
        reason: failureReasonOf(kind),
      });

      // Permesso perso (§43) o commenti disattivati (§177–§179): il contesto si rilegge, così il
      // composer cambia identità o sparisce invece di fallire a ogni Pubblica. Il testo torna
      // comunque nella bozza e resta recuperabile.
      if (kind === "identity_forbidden" || kind === "comments_disabled") {
        current.onPermissionLost();
      } else if (kind === "content_unavailable") {
        current.onContentUnavailable();
      }

      const restored = isDefinitive(kind) && restoreToComposer(tempId, publishErrorCopy(kind), kind);
      if (!restored) {
        commentStore.markFailed(tempId, kind);
      }
    } finally {
      inFlight.current.delete(send.operationKey);
    }
  }

  /** Pubblica (§23–§25, §86): dal composer, con l'identità e il testo di adesso. */
  function publish() {
    const { draftStore, getContext, contentType, contentId, contentKey } = depsRef.current;
    const draft = draftStore.getState();
    const context = getContext();

    // §95: la chiave è in volo → un secondo tap non produce nulla (guardia sincrona).
    if (!context || inFlight.current.has(draft.operationKey)) {
      return;
    }

    const available = commentableIdentities(context.identities);
    const resolved = resolveCommentIdentity(available, draft.identity);
    const body = draft.body.trimEnd();

    const block = publishBlockReason({
      body,
      commentsEnabled: context.commentsEnabled,
      contentAvailable: true,
      hasIdentity: resolved.identity !== null,
      identityLost: resolved.lost,
      isSending: false,
      limits: context.limits,
      mentions: draft.mentions,
    });

    if (block || !resolved.identity) {
      return;
    }

    const mentions = commentMentionsForSubmit(body, draft.mentions, context.limits.maxMentions);
    const links = extractCommentLinks(body, context.limits.maxLinks);
    const reply = draft.replyTo;

    const entity = buildOptimisticComment({
      body,
      contentAuthor: context.contentAuthor,
      contentId,
      contentType,
      identity: resolved.identity,
      links,
      mentions,
      operationKey: draft.operationKey,
      replyTo: reply
        ? {
            author: { identityId: reply.identityId, identityType: reply.identityType, name: reply.name },
            id: reply.commentId,
            rootCommentId: reply.rootCommentId,
          }
        : null,
    });

    commentStore.insertOptimistic(entity, contentKey);
    // §94: il composer si svuota e si richiude; il testo vive nell'elemento in lista.
    draftStore.clearComposer();
    draftStore.set({ active: false });
    void run(entity.id);
  }

  /** §99: «Riprova» rilancia lo stesso invio con la stessa chiave. */
  function retry(tempId: string) {
    const send = commentStore.get(tempId)?.send;

    if (!send || send.state !== "failed") {
      return;
    }

    const { contentId, contentType } = depsRef.current;
    track({ contentId, contentType, identityType: send.identity.type, name: "comment_retry" });
    commentStore.markSending(tempId);
    void run(tempId);
  }

  /** §101: riapre il testo fallito nel composer per correggerlo prima di riprovare. */
  function reopen(tempId: string) {
    // Il composer ha già altro testo: non si scrive sopra, ma si dice perché non succede nulla.
    if (!restoreToComposer(tempId, null, null)) {
      depsRef.current.onNotice(COMMENT_REOPEN_BLOCKED);
    }
  }

  return { publish, reopen, retry };
}
