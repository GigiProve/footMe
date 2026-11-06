/**
 * Chiave di idempotenza di una mutazione del pack Inviti (§25, §37).
 *
 * «Stessa chiave e stesso payload riprendono lo stesso risultato; stessa
 * chiave con payload diverso viene respinta.» La chiave è quindi legata al
 * **contenuto**: un nonce di sessione combinato con l'impronta della
 * richiesta corrente.
 *
 * Due proposte diverse hanno chiavi diverse; lo stesso invio ritentato dopo
 * un timeout conserva la stessa identità dell'operazione, che è ciò che §37
 * chiede per non creare un secondo pending dopo una risposta persa.
 */
export function newInviteSessionNonce(): string {
  const globalCrypto = (globalThis as { crypto?: { randomUUID?: () => string } })
    .crypto;

  if (typeof globalCrypto?.randomUUID === "function") {
    return globalCrypto.randomUUID();
  }

  return `inv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** djb2: stabile, breve e sufficiente a distinguere due payload. */
function fingerprint(value: string): string {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(index)) | 0;
  }

  return (hash >>> 0).toString(36);
}

export function operationKeyOf(nonce: string, signature: string): string {
  return `${nonce}:${fingerprint(signature)}`;
}
