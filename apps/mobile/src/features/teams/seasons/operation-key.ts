/**
 * Chiave idempotente di una mutazione (§15, §23).
 *
 * «La chiave idempotente identifica la stessa operazione e lo stesso
 * contenuto. Un doppio tap o retry non crea nuovi record o un secondo
 * batch … Non generare una nuova chiave a ogni retry.»
 *
 * La chiave nasce quindi **una volta per tentativo dell'utente** — quando il
 * form si apre o la conferma si prepara — e sopravvive ai retry. Cambia solo
 * quando cambia la decisione: dopo un conflitto che richiede una nuova
 * conferma, il chiamante ne genera una nuova.
 */
export function newOperationKey(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  // Fallback unico quanto basta: la chiave deve riconoscere **lo stesso**
  // tentativo nella stessa sessione, non essere irripetibile nell'universo.
  return `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
