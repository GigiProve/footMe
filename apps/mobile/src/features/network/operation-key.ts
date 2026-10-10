/**
 * Chiave di idempotenza di una mutazione della rete (§26).
 *
 * «La stessa chiave identifica la stessa operazione e gli stessi parametri;
 * non generare una nuova chiave a ogni retry dopo timeout. Se cambiano
 * termini o destinatario, è una nuova operazione da confermare.»
 *
 * Nasce quindi una volta per tentativo dell'utente e sopravvive ai retry.
 * Se ne genera un'altra solo quando la decisione cambia.
 */
export function newNetworkOperationKey(): string {
  const globalCrypto = (globalThis as { crypto?: { randomUUID?: () => string } })
    .crypto;

  if (typeof globalCrypto?.randomUUID === "function") {
    return globalCrypto.randomUUID();
  }

  return `net-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
