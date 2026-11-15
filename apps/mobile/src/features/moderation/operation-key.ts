/**
 * Chiave di idempotenza di una segnalazione (HOM-11 §100–§101, §158, §179).
 *
 * Una chiave per BOZZA, non per tap: doppio tap, «Riprova» e timeout ambiguo
 * riusano la stessa chiave, così `create_moderation_report` risponde con lo stesso
 * report invece di crearne un secondo (§101). Cambia solo se il contenuto inviato
 * cambia (vedi `nextOperationKey` in `moderation-presentation.ts`). UUID v4 dalla
 * stessa sorgente dei Post e dei Commenti: un solo generatore nell'app.
 */

import { newComposerOperationKey } from "../post-composer/operation-key";

export function newReportOperationKey(): string {
  return newComposerOperationKey();
}
