/**
 * Chiave di idempotenza del Block (HOM-12 §206). Una chiave per ogni tap che parte;
 * il server risponde `already_blocked` se la coppia è già bloccata (doppio tap,
 * retry, timeout). Stessa sorgente UUID v4 del resto dell'app.
 */

import { newComposerOperationKey } from "../post-composer/operation-key";

export function newBlockOperationKey(): string {
  return newComposerOperationKey();
}
