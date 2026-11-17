/**
 * DAS-REV-34 §25 — accesso dati del resolver delle conversazioni.
 *
 * Una sola RPC: `resolve_conversation_target(p_conversation_id, p_period_id,
 * p_intent)` → {outcome, conversation_id, period_id, conversation_type}. Il server risolve con
 * l'account, il periodo e lo stato correnti e non restituisce né nomi né testi.
 * Un errore di trasporto o di server NON è un esito: lancia, e il chiamante
 * mostra un errore ritentabile senza aprire il fallback di revoca.
 */

import { supabase } from "../../lib/supabase";
import {
  parseConversationResolution,
  type ConversationLink,
  type ConversationResolution,
} from "./conversation-target-presentation";

export async function resolveConversationTarget(link: ConversationLink): Promise<ConversationResolution> {
  const { data, error } = await supabase.rpc("resolve_conversation_target", {
    p_conversation_id: link.conversationId,
    p_intent: link.intent,
    p_period_id: link.periodId,
  });

  if (error) {
    throw error;
  }

  const resolution = parseConversationResolution(data);

  if (!resolution) {
    // Una forma sconosciuta non si interpreta come revoca né come apertura.
    throw new Error("Esito del resolver conversazione non valido");
  }

  return resolution;
}
