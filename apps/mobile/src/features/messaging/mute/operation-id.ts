/**
 * Identificativo di un intento di mute (DAS-REV-34 §9).
 *
 * Il server lo riceve come `uuid` (`set_conversation_mute.p_operation_id`):
 * a differenza delle chiavi testuali degli altri moduli deve avere la forma di
 * un UUID v4, anche dove `crypto.randomUUID` non esiste.
 */
export function newOperationId(): string {
  const globalCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;

  if (typeof globalCrypto?.randomUUID === "function") {
    return globalCrypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;

    return value.toString(16);
  });
}
