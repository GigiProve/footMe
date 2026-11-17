/**
 * Conversazione realmente a schermo (DAS-REV-34 §16, QA-047/QA-048).
 *
 * «Non usare la sola presenza dell'app in foreground come prova della lettura
 * di qualunque chat»: la chat imposta il proprio id solo mentre è in primo
 * piano e l'app è attiva, e lo azzera su blur, smontaggio e background. Chi
 * decide cosa mostrare in foreground (handler delle Push, filone notifiche) legge
 * `getVisibleConversationId()`: una Push della conversazione visibile non
 * produce banner, tutte le altre sì. Nessuna tabella di presenza sul server:
 * è una variabile di modulo, per costruzione non sopravvive al processo.
 */

let visibleConversationId: string | null = null;

export function setVisibleConversation(conversationId: string | null): void {
  visibleConversationId = conversationId;
}

export function getVisibleConversationId(): string | null {
  return visibleConversationId;
}

/**
 * Azzera solo se la conversazione visibile è ancora quella indicata: lo
 * smontaggio di una chat può arrivare dopo l'`effect` della chat che l'ha
 * sostituita, e non deve cancellarne l'id.
 */
export function clearVisibleConversation(conversationId: string): void {
  if (visibleConversationId === conversationId) {
    visibleConversationId = null;
  }
}
