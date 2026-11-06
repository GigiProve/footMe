/**
 * Chiave di idempotenza delle mutazioni dei Link di invito (§17, §25).
 *
 * «Stesso submit e stesso payload restituiscono lo stesso link; stesso
 * idempotency key con payload differente è rifiutato.» La chiave è quindi
 * legata al **contenuto**: un nonce di sessione combinato con l'impronta
 * della richiesta corrente.
 *
 * Un doppio tap conserva la stessa identità dell'operazione — §16 vieta che
 * «Genera link» produca due link — mentre una correzione del form ne
 * produce una nuova, perché quella è davvero un'altra operazione.
 */
export function newJoinSessionNonce(): string {
  const globalCrypto = (globalThis as { crypto?: { randomUUID?: () => string } })
    .crypto;

  if (typeof globalCrypto?.randomUUID === "function") {
    return globalCrypto.randomUUID();
  }

  return `jl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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
