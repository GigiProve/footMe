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
import { BLOCK_QK } from "../blocking/blocking-keys";
import { resetBlockedIdentityStore } from "../blocking/blocked-identity-store";
import { commentCountStore } from "../comments/comment-count-store";
import { resetCommentDrafts } from "../comments/comment-draft-store";
import { COMMENTS_QK } from "../comments/comment-keys";
import { commentStore } from "../comments/comment-store";
import { resetHiddenContentStore } from "../feed-feedback/hidden-content-store";
import { resetFeedSessionSeen } from "../feed/use-feed-session-seen";
import { resetLikeEngine } from "../feed/use-feed-post-like";
import { resetUnfollowedSourcesStore } from "../following/unfollowed-sources-store";
import { MODERATION_QK } from "../moderation/moderation-keys";
import { resetReportDraftStore } from "../moderation/report-draft-store";
import { resetReportedStore } from "../moderation/reported-store";
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
  // HOM-11: gli insiemi di sessione di «Non mi interessa», Non seguire e Segnala sono per
  // utente (§176): un account nuovo non eredita contenuti nascosti, fonti lasciate, target
  // segnalati — né il testo di una segnalazione in corso (§184, input privato di moderazione).
  resetHiddenContentStore();
  resetUnfollowedSourcesStore();
  resetReportedStore();
  resetReportDraftStore();
  // HOM-12 §193–§194: i Block di sessione sono per utente; un account nuovo non eredita
  // celle «bloccato» né availability in cache del precedente.
  resetBlockedIdentityStore();
  queryClient.removeQueries({ queryKey: BLOCK_QK.all });
  // Lo stato «già segnalato» in cache è per viewer (§295): non si lascia leggere al prossimo.
  queryClient.removeQueries({ queryKey: MODERATION_QK.all });
  // Le liste in cache portano solo gli id: contro lo store appena svuotato darebbero un
  // thread bianco (A → B → A entro lo staleTime). Si buttano insieme agli store.
  queryClient.removeQueries({ queryKey: COMMENTS_QK.all });
  // HOM-15 §281, §387: il registro impression/«già visto» è per utente. Senza reset il
  // prossimo account non emetterebbe le impression delle card già viste dal precedente.
  resetFeedSessionSeen();
}
