/**
 * «↑ Nuovi commenti» mentre la schermata è aperta (HOM-08 §141–§145, §311).
 *
 * Lo stesso principio di «Nuovi contenuti» del Feed (HOM-01.1 §19, §40): NON si
 * inserisce mai niente sopra e non si tocca lo scroll. Questo hook interroga solo un
 * CONTEGGIO (`fetch_comment_updates`: commenti e risposte di altre identità, dopo il
 * watermark della lista) e restituisce lo stato della pill; chi decide di
 * aggiornare è l'utente, con un tap. Nessun Realtime: la tabella è chiusa ai client
 * (A1), quindi polling, e solo con la schermata a fuoco.
 *
 * Il polling si spegne al blur (una schermata in secondo piano non consuma) e un
 * errore è silenzioso: nessuna pill è preferibile a un errore per un'informazione
 * accessoria. Il conteggio del contenuto, che la stessa risposta porta, aggiorna la
 * cella condivisa (§214) con l'istante di partenza della richiesta.
 */

import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { likeItemKey } from "../interactions/like-store";
import { commentCountStore } from "./comment-count-store";
import { COMMENTS_QK } from "./comment-keys";
import { fetchCommentUpdates } from "./comment-service";

/** Un minuto (contratto B1): abbastanza raro da non pesare, abbastanza spesso da restare utile. */
export const COMMENT_UPDATES_INTERVAL_MS = 60_000;

/** Il conteggio dalla RPC; semina la cella condivisa con l'istante di PARTENZA della richiesta. */
export async function loadCommentUpdates(contentType: string, contentId: string, since: string) {
  const startedAt = Date.now();
  const epoch = commentCountStore.epoch();
  const updates = await fetchCommentUpdates(contentType, contentId, since);
  // Un cambio account a richiesta in volo: il conteggio dell'utente di prima non semina.
  if (commentCountStore.epoch() === epoch) {
    commentCountStore.seed(likeItemKey(contentType, contentId), updates.commentsCount, startedAt);
  }
  return updates;
}

export function useCommentUpdates({
  contentType,
  contentId,
  viewerId,
  /**
   * `as_of` del SERVER della prima pagina (o del contesto se è vuota): mai l'orologio del
   * dispositivo, che sfasato conterebbe come nuovi commenti già in lista o ne perderebbe
   * di veri. `null` = lista non ancora caricata.
   */
  watermark,
  enabled,
}: {
  contentType: string;
  contentId: string;
  viewerId: string;
  watermark: string | null;
  enabled: boolean;
}) {
  const [isFocused, setFocused] = useState(false);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  // `dismissedFor` è il watermark chiuso: con un nuovo watermark (lista riletta) la pill
  // chiusa torna disponibile da sola, senza un effetto di reset.
  const since = watermark;

  const query = useQuery({
    enabled: enabled && since !== null && isFocused && contentId.length > 0 && viewerId.length > 0,
    queryFn: () => loadCommentUpdates(contentType, contentId, since as string),
    queryKey: COMMENTS_QK.updates(contentType, contentId, viewerId, since ?? ""),
    refetchInterval: isFocused ? COMMENT_UPDATES_INTERVAL_MS : false,
    retry: false,
  });

  const count = query.data?.newCount ?? 0;

  return {
    count,
    dismiss: () => setDismissedFor(watermark),
    isVisible: count > 0 && dismissedFor !== watermark,
  };
}
