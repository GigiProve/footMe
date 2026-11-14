/**
 * Svuota lo stato di interazione dell'utente che esce (HOM-07 §70, §103, §141;
 * HOM-08 conteggi e commenti).
 *
 * Mi piace, Salvati, commenti e conteggi vivono in store di modulo, non nella cache
 * di React Query: `queryClient.clear()` del logout non li tocca. Senza questo reset
 * il prossimo account sullo stesso dispositivo vedrebbe — e al primo tap
 * invertirebbe — i segnalibri e i cuori del precedente, e leggerebbe i suoi commenti
 * (visibilità, blocchi e capability sono per utente) o il testo che stava scrivendo.
 *
 * Chiamato in modo SINCRONO da `logout()` e dal SessionProvider quando la
 * sessione cambia utente (o si chiude), prima che la nuova sessione renderizzi.
 * Gli store incrementano la propria generazione: le risposte ancora in volo
 * dell'utente di prima non scrivono più nulla.
 */

import { queryClient } from "../../lib/query-client";
import { commentCountStore } from "../comments/comment-count-store";
import { resetCommentDrafts } from "../comments/comment-draft-store";
import { COMMENTS_QK } from "../comments/comment-keys";
import { commentStore } from "../comments/comment-store";
import { resetLikeEngine } from "../feed/use-feed-post-like";
import { resetSavedCommands } from "../saved/saved-commands";
import { resetSavedStore } from "../saved/saved-store";
import { likeStore } from "./like-store";

export function resetUserInteractions(): void {
  likeStore.clear();
  resetLikeEngine();
  resetSavedStore();
  resetSavedCommands();
  commentStore.clear();
  commentCountStore.clear();
  resetCommentDrafts();
  // Le liste in cache portano solo gli id: contro lo store appena svuotato darebbero un
  // thread bianco (A → B → A entro lo staleTime). Si buttano insieme agli store.
  queryClient.removeQueries({ queryKey: COMMENTS_QK.all });
}
