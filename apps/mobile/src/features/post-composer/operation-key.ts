/**
 * Chiave di idempotenza della pubblicazione (HOM-06.1 §118, §176).
 *
 * Una chiave per SESSIONE di composer, non per tentativo: doppio tap, retry,
 * timeout e rete ambigua riusano la stessa chiave, così `publish_post` risponde
 * `replayed = true` invece di creare un secondo Post (§239). Nasce quando il
 * composer si apre, sopravvive ai fallimenti e al recovery (§135: va nello
 * snapshot), e si butta solo a pubblicazione riuscita o abbandono.
 *
 * È un UUID v4 puro (non il `nonce:fingerprint` degli Inviti): il server la può
 * conservare tanto come `uuid` quanto come `text` senza che il prefisso la
 * renda non valida. Stesso pattern di `features/dashboard/invites/operation-key.ts`
 * per la sorgente di entropia.
 */

function randomHex(length: number): string {
  let out = "";
  for (let index = 0; index < length; index += 1) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out;
}

export function newComposerOperationKey(): string {
  const globalCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;

  if (typeof globalCrypto?.randomUUID === "function") {
    return globalCrypto.randomUUID();
  }

  // v4: la cifra di versione è 4, la variante è 8|9|a|b.
  const variant = "89ab"[Math.floor(Math.random() * 4)];
  return `${randomHex(8)}-${randomHex(4)}-4${randomHex(3)}-${variant}${randomHex(3)}-${randomHex(12)}`;
}

/**
 * Id locale di un media in composizione (§43 `local_id`). Stessa sorgente della
 * chiave: non deve dipendere dal nome del file, che può ripetersi.
 */
export function newComposerLocalId(): string {
  return newComposerOperationKey();
}
