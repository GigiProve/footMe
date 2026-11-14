/**
 * Contesto dei commenti di UN contenuto (HOM-08 §34, §177–§180, §186–§191, A5.1).
 *
 * Una query leggera, indipendente dal contenuto e dalla lista: dice se i commenti
 * sono abilitati/visibili, con quali identità si può commentare (`can_comment`), i
 * limiti del server e il conteggio. Un fallimento qui non nasconde il Post (§187):
 * la sezione mostra il suo errore e il contenuto resta.
 *
 * Il conteggio semina la cella di `comment-count-store` con l'istante in cui la
 * richiesta è PARTITA, come ogni altro seed (HOM-07 §141): una risposta lenta non
 * cancella un commento pubblicato nel frattempo.
 *
 * `content_unavailable` è una risposta DEFINITIVA (§188–§190): niente composer,
 * niente «Riprova».
 */

import { useQuery } from "@tanstack/react-query";

import { likeItemKey } from "../interactions/like-store";
import { commentCountStore } from "./comment-count-store";
import { COMMENTS_QK } from "./comment-keys";
import { classifyCommentError, fetchCommentContext } from "./comment-service";
import type { CommentContext, CommentErrorKind } from "./comment-types";

/** Le identità autorizzate cambiano di rado, ma il permesso si rivalida alla riapertura. */
const CONTEXT_STALE_MS = 30_000;

export type CommentContextState =
  | { status: "loading" }
  | { status: "error"; kind: CommentErrorKind; retry: () => void }
  | { status: "ready"; data: CommentContext; refresh: () => void };

export function useCommentContext({
  contentType,
  contentId,
  viewerId,
}: {
  contentType: string;
  contentId: string;
  viewerId: string;
}): CommentContextState {
  const query = useQuery({
    enabled: contentId.length > 0 && viewerId.length > 0,
    queryFn: async () => {
      const fetchedAt = Date.now();
      const epoch = commentCountStore.epoch();
      const context = await fetchCommentContext(contentType, contentId);
      // Un cambio account a richiesta in volo: il conteggio dell'utente di prima non semina.
      if (commentCountStore.epoch() === epoch) {
        commentCountStore.seed(likeItemKey(contentType, contentId), context.commentsCount, fetchedAt);
      }
      return context;
    },
    queryKey: COMMENTS_QK.context(contentType, contentId, viewerId),
    // Un errore definitivo (contenuto non disponibile) non migliora al secondo tentativo.
    retry: (count, error) => count < 1 && classifyCommentError(error) === "network",
    staleTime: CONTEXT_STALE_MS,
  });

  if (query.data) {
    return {
      data: query.data,
      refresh: () => {
        void query.refetch();
      },
      status: "ready",
    };
  }

  if (query.isError) {
    return {
      kind: classifyCommentError(query.error),
      retry: () => {
        void query.refetch();
      },
      status: "error",
    };
  }

  return { status: "loading" };
}
