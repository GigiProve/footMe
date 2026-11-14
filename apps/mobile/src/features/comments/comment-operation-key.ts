/**
 * Chiave di idempotenza e id temporaneo di un commento (HOM-08 §93, §95, §99).
 *
 * Una chiave per commento/risposta in composizione, NON per tentativo: il doppio
 * tap, il Riprova e il timeout riusano la stessa chiave, così `create_comment`
 * risponde con lo stesso commento invece di crearne due (§95). Si butta solo a
 * invio riuscito (o quando il testo cambia: un payload diverso con la stessa chiave
 * è `comment_operation_conflict`, §101).
 *
 * UUID v4 dalla stessa sorgente dei Post (`post-composer/operation-key.ts`): un
 * solo generatore nell'app.
 */

import { newComposerOperationKey } from "../post-composer/operation-key";

export function newCommentOperationKey(): string {
  return newComposerOperationKey();
}

const TEMP_PREFIX = "tmp:";

/** §93: id temporaneo dell'elemento ottimistico, derivato dalla chiave. */
export function tempCommentId(operationKey: string): string {
  return `${TEMP_PREFIX}${operationKey}`;
}

export function isTempCommentId(id: string): boolean {
  return id.startsWith(TEMP_PREFIX);
}
