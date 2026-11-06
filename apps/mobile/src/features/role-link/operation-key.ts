/**
 * Chiave di idempotenza delle mutazioni del rapporto sportivo (§15, §30).
 *
 * «Stessa chiave e stesso payload riprendono lo stesso risultato; stessa
 * chiave con payload diverso fallisce in modo controllato.» La chiave è
 * quindi legata al **contenuto**: un nonce di sessione combinato con
 * l'impronta del payload corrente.
 *
 * Due conseguenze volute. Un retry dopo un timeout conserva la stessa
 * identità dell'operazione, e §15 chiede esattamente questo per non creare
 * due richieste involontarie. E una modifica dei dati dopo un tentativo
 * ambiguo cambia l'impronta, quindi il server la respinge finché il comando
 * precedente non è stato riconciliato — «Una modifica dei dati dopo un
 * tentativo ambiguo richiede prima la riconciliazione del comando
 * precedente».
 */
export function newRoleLinkNonce(): string {
  const globalCrypto = (globalThis as { crypto?: { randomUUID?: () => string } })
    .crypto;

  if (typeof globalCrypto?.randomUUID === "function") {
    return globalCrypto.randomUUID();
  }

  return `rl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** djb2: stabile, breve e sufficiente a distinguere due payload. */
function fingerprint(value: string): string {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(index)) | 0;
  }

  return (hash >>> 0).toString(36);
}

export function roleLinkOperationKey(nonce: string, signature: string): string {
  return `${nonce}:${fingerprint(signature)}`;
}
