/**
 * La chiave idempotente di un'operazione Position (DAS-REV-16 §10, §25;
 * DAS-REV-17 §16, §25).
 *
 * «Un retry della stessa operazione utilizza lo stesso identificatore
 * idempotente e lo stesso contenuto/versione. Un nuovo tentativo con dati
 * modificati non riutilizza impropriamente la chiave precedente.»
 *
 * La chiave è **derivata**, non estratta a sorte a ogni tentativo: un nonce
 * casuale creato una volta per sessione, combinato con l'impronta di ciò
 * che si sta chiedendo. Stessa richiesta, stessa chiave anche dopo dieci
 * render; richiesta diversa, chiave diversa.
 *
 * Vive in un file proprio perché due superfici la usano — il composer e il
 * dettaglio gestionale — e una funzione duplicata produrrebbe due impronte
 * diverse per la stessa richiesta al primo cambiamento.
 */

/** djb2: basta a distinguere due richieste, e non deve resistere a un attacco. */
export function fingerprint(value: string): string {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(index)) | 0;
  }

  return (hash >>> 0).toString(36);
}

export function operationKeyOf(nonce: string, signature: string): string {
  return `${nonce}-${fingerprint(signature)}`;
}

/**
 * Il nonce di sessione.
 *
 * L'impurità è lecita in un inizializzatore di stato (`useState(() => …)`),
 * che React chiama una volta sola; non lo sarebbe in un render.
 */
export function createSessionNonce(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
