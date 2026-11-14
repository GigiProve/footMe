/**
 * Svuota lo stato di interazione dell'utente che esce (HOM-07 §70, §103, §141).
 *
 * Mi piace e Salvati vivono in store di modulo, non nella cache di React Query:
 * `queryClient.clear()` del logout non li tocca. Senza questo reset il prossimo
 * account sullo stesso dispositivo vedrebbe — e al primo tap invertirebbe — i
 * segnalibri e i cuori del precedente.
 *
 * Chiamato in modo SINCRONO da `logout()` e dal SessionProvider quando la
 * sessione cambia utente (o si chiude), prima che la nuova sessione renderizzi.
 * Gli store incrementano la propria generazione: le risposte ancora in volo
 * dell'utente di prima non scrivono più nulla.
 */

import { resetLikeEngine } from "../feed/use-feed-post-like";
import { resetSavedCommands } from "../saved/saved-commands";
import { resetSavedStore } from "../saved/saved-store";
import { likeStore } from "./like-store";

export function resetUserInteractions(): void {
  likeStore.clear();
  resetLikeEngine();
  resetSavedStore();
  resetSavedCommands();
}
