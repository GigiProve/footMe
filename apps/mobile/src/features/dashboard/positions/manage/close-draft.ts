/**
 * La scelta del motivo, in viaggio fra lo sheet e la schermata dedicata
 * (DAS-REV-18 §19, §20; screen 07 ↔ 08).
 *
 * Il problema è di navigazione, non di dominio: lo sheet di conferma vive
 * nel dettaglio dentro la tab Dashboard, la scelta del motivo è un flusso
 * focalizzato in un'altra pila, ed expo-router non restituisce valori al
 * ritorno. §38 chiede però che «Il selector motivo torna allo sheet finale
 * preservando lo stato».
 *
 * Il trasporto è la cache di TanStack Query, che è già lo store condiviso
 * dell'app: nessun contesto nuovo, nessuno store globale nuovo, e il
 * dettaglio si ri-renderizza da solo quando la schermata del motivo scrive.
 * La bozza è effimera — non ha `queryFn` e non viene mai rifetchata — ed è
 * per Position, così due chiusure aperte su posizioni diverse non si
 * confondono.
 *
 * Niente di tutto questo è persistito: §19 — «Aprire/chiudere lo sheet,
 * selezionare un motivo e toccare Annulla non modificano il lifecycle.» La
 * chiusura scrive stato e motivo **insieme**, solo al commit finale (§20).
 */
import type { QueryClient } from "@tanstack/react-query";

import type { PositionCloseReason } from "../positions-types";

export type CloseDraft = {
  reason: PositionCloseReason | null;
  /** Il dettaglio di «Altro». Sempre `null` con un motivo diverso (§20). */
  reasonText: string | null;
};

export const EMPTY_CLOSE_DRAFT: CloseDraft = { reason: null, reasonText: null };

export const CLOSE_DRAFT_QK = {
  draft: (positionId: string) => ["position-close-draft", positionId] as const,
};

export function readCloseDraft(
  client: QueryClient,
  positionId: string,
): CloseDraft {
  return (
    client.getQueryData<CloseDraft>(CLOSE_DRAFT_QK.draft(positionId)) ??
    EMPTY_CLOSE_DRAFT
  );
}

export function writeCloseDraft(
  client: QueryClient,
  positionId: string,
  draft: CloseDraft,
): void {
  client.setQueryData(CLOSE_DRAFT_QK.draft(positionId), draft);
}

export function clearCloseDraft(
  client: QueryClient,
  positionId: string,
): void {
  client.removeQueries({ queryKey: CLOSE_DRAFT_QK.draft(positionId) });
}

/**
 * La normalizzazione di §20, in un posto solo.
 *
 * «Passando da Altro a un motivo standard, rimuovi dal buffer l'eventuale
 * testo Altro incompatibile; non conservarlo in un payload nascosto.
 * Rimuovendo il motivo cancella anche il relativo dettaglio.»
 *
 * Da qui discende anche che «Un testo senza OTHER non è un payload valido»:
 * un payload simile non può nemmeno essere costruito, perché passa di qui.
 */
export function withReason(
  draft: CloseDraft,
  reason: PositionCloseReason | null,
): CloseDraft {
  return {
    reason,
    reasonText: reason === "other" ? draft.reasonText : null,
  };
}
