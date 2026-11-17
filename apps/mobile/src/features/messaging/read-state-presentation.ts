/**
 * Derivazioni pure della conferma di lettura della chat (DAS-REV-34 §11, §14, §16).
 * Niente rete e niente supabase: testabile senza render.
 *
 *  · §11 il server è la fonte del confine di lettura: il client chiede di
 *    avanzare fino alla sequence più alta **caricata** e il server fa clamp. I
 *    messaggi arrivati nel frattempo restano non letti, perché non si azzera
 *    nulla alla cieca;
 *  · §11, §16 si conferma solo se la chat è davvero visibile (in primo piano,
 *    app attiva): aprire la route in background o stare online non è leggere;
 *  · §14 il periodo di accesso è parte dell'intento: un ack porta il periodo
 *    osservato e il server rifiuta quello di un periodo precedente;
 *  · §11 ack ripetuti non servono: si rinnova solo se la sequence avanza.
 */
import type { ConversationMessage } from "./messaging-service";

/**
 * Sequence più alta tra i messaggi caricati; null se nessuno la porta. Dal
 * server `seq` arriva sempre (NOT NULL da DAS-REV-33): manca solo nei messaggi
 * locali non ancora confermati, che sono propri e non creano unread.
 */
export function maxLoadedSeq(messages: readonly Pick<ConversationMessage, "seq">[]): number | null {
  let max: number | null = null;

  for (const message of messages) {
    if (typeof message.seq === "number" && (max === null || message.seq > max)) {
      max = message.seq;
    }
  }

  return max;
}

export type ReadAckDecision =
  | { action: "none" }
  | { action: "ack"; periodId: string | null; upToSeq: number };

export function decideReadAck(input: {
  isGroup: boolean;
  isReady: boolean;
  isRevoked: boolean;
  isVisible: boolean;
  /** Ultima sequence già confermata per questa conversazione e questo periodo, null se nessuna. */
  lastAckedSeq: number | null;
  messages: readonly Pick<ConversationMessage, "seq">[];
  /** GROUP: periodo osservato dal meta. */
  periodId: string | null;
}): ReadAckDecision {
  if (!input.isVisible || !input.isReady || input.isRevoked || input.messages.length === 0) {
    return { action: "none" };
  }

  // Nei GROUP l'ack senza periodo non può essere validato dal server: si attende il meta.
  if (input.isGroup && !input.periodId) {
    return { action: "none" };
  }

  const upToSeq = maxLoadedSeq(input.messages);

  // §11: senza una sequence caricata non c'è un confine da confermare. Il
  // ripiego su `mark_conversation_read` (max server) segnerebbe letti anche i
  // messaggi arrivati nel frattempo.
  if (upToSeq === null) {
    return { action: "none" };
  }

  if (input.lastAckedSeq !== null && upToSeq <= input.lastAckedSeq) {
    return { action: "none" };
  }

  return { action: "ack", periodId: input.isGroup ? input.periodId : null, upToSeq };
}
