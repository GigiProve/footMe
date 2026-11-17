/**
 * Accesso ai dati dello stato personale Notifiche (DAS-REV-34 §9, §24, §26).
 *
 * Il client manda solo la scelta, l'id dell'intento e (GROUP) il periodo che ha
 * osservato: destinatario e durata li decide il server dall'autenticazione e
 * dal proprio orologio. Un non partecipante riceve `NOT_MEMBER` e nessuna riga
 * viene creata (QA-004): la schermata non mostra una preferenza fittizia.
 */
import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase } from "../../../lib/supabase";
import { parseNotificationState } from "./mute-presentation";
import type { ConversationNotificationState, MuteChoice } from "./mute-types";

export async function fetchConversationNotificationState(
  conversationId: string,
): Promise<ConversationNotificationState> {
  const { data, error } = await supabase.rpc("fetch_conversation_notification_state", {
    p_conversation_id: conversationId,
  });

  if (error) {
    throw error;
  }

  const state = parseNotificationState(data, conversationId);

  if (!state) {
    throw new Error("Stato notifiche non interpretabile.");
  }

  return state;
}

export async function setConversationMute(input: {
  choice: MuteChoice;
  conversationId: string;
  operationId: string;
  /** Solo GROUP: il periodo osservato; un comando di un periodo finito è rifiutato. */
  periodId: string | null;
}): Promise<ConversationNotificationState> {
  const { data, error } = await supabase.rpc("set_conversation_mute", {
    p_conversation_id: input.conversationId,
    p_operation_id: input.operationId,
    p_option: input.choice,
    p_period_id: input.periodId,
  });

  if (error) {
    throw error;
  }

  const state = parseNotificationState(data, input.conversationId);

  if (!state) {
    // Il comando può essere stato eseguito: esito incerto, si rilegge (§9).
    throw new Error("Risposta notifiche non interpretabile.");
  }

  return state;
}

/**
 * §22: le proprie righe di `conversation_actor_states` (la RLS espone solo
 * quelle del viewer; il filtro per profilo toglie il rumore). Un cambio fatto
 * da un altro dispositivo arriva qui e fa rileggere lo stato autorevole: la
 * riga non si applica da sola, perché è la lettura server a decidere (§9).
 */
export function subscribeToMyActorStates(
  profileId: string,
  onChange: (record: { conversationId: string | null }) => void,
) {
  const channel: RealtimeChannel = supabase
    .channel(`conversation-actor-states:${profileId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        filter: `profile_id=eq.${profileId}`,
        schema: "public",
        table: "conversation_actor_states",
      },
      (payload) => {
        const row = (payload.new && Object.keys(payload.new).length > 0 ? payload.new : payload.old) as
          | { conversation_id?: unknown }
          | null
          | undefined;
        const id = row?.conversation_id;

        onChange({ conversationId: typeof id === "string" && id ? id : null });
      },
    )
    .subscribe();

  return channel;
}
