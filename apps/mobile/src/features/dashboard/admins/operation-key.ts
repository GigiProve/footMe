/**
 * Chiave di idempotenza di una mutazione amministrativa.
 *
 * Viveva dentro `admin-invite-link`, che importa `expo-clipboard` e lo stack
 * di condivisione del link esterno. DAS-REV-14 la usa in sei schermate che
 * con la condivisione non hanno niente a che fare: tenerla lì obbligava a
 * trascinarsi dietro quelle dipendenze — e a mockare il clipboard per
 * testare un editor di ruoli.
 *
 * DAS-REV-13 §19: «I retry riusano la stessa chiave finché l'esito non è
 * conosciuto.» DAS-REV-14 §27 aggiunge l'altra metà: «stessa chiave e
 * payload diverso va respinta», ed è il motivo per cui questa funzione viene
 * chiamata attraverso `useOperationKey`, che la lega al contenuto.
 */
export function newAdminOperationKey(): string {
  const globalCrypto = (globalThis as { crypto?: { randomUUID?: () => string } })
    .crypto;

  if (typeof globalCrypto?.randomUUID === "function") {
    return globalCrypto.randomUUID();
  }

  return `adm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
