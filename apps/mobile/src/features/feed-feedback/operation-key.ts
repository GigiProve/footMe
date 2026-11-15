/**
 * Chiave di idempotenza di «Non mi interessa» (HOM-11 §177).
 *
 * Una chiave per ogni tap che parte; il server risponde `already_recorded` con lo
 * stesso `feedback_id` se la riga esiste già (doppio tap, retry, timeout). UUID v4
 * dalla stessa sorgente dei Post e dei Commenti: un solo generatore nell'app.
 */

import { newComposerOperationKey } from "../post-composer/operation-key";

export function newNotInterestedOperationKey(): string {
  return newComposerOperationKey();
}
