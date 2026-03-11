import { RealtimeChannel } from "@supabase/supabase-js";

import { supabase } from "../../lib/supabase";

export type ConversationSummary = {
  conversation_id: string;
  other_profile_id: string;
  other_full_name: string;
  other_role: string;
  other_region: string | null;
  other_city: string | null;
  other_primary_position: string | null;
  last_message_body: string | null;
  last_message_sent_at: string | null;
  last_message_sender_profile_id: string | null;
  unread_count: number;
};

export type ConversationMessage = {
  message_id: string;
  body: string;
  sent_at: string;
  read_at: string | null;
  sender_profile_id: string;
  sender_full_name: string;
};

export async function getConversationSummaries() {
  const { data, error } = await supabase.rpc("get_conversation_summaries");

  if (error) {
    throw error;
  }

  return (data ?? []) as ConversationSummary[];
}

export async function getConversationMessages(conversationId: string) {
  const { data, error } = await supabase.rpc("get_conversation_messages", {
    target_conversation_id: conversationId,
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as ConversationMessage[];
}

export async function markConversationRead(conversationId: string) {
  const { error } = await supabase.rpc("mark_conversation_read", {
    target_conversation_id: conversationId,
  });

  if (error) {
    throw error;
  }
}

export async function sendMessage(input: {
  body: string;
  conversationId: string;
  senderProfileId: string;
}) {
  const body = input.body.trim();

  if (!body) {
    throw new Error("Scrivi un messaggio prima di inviare.");
  }

  const { error } = await supabase.from("messages").insert({
    body,
    conversation_id: input.conversationId,
    sender_profile_id: input.senderProfileId,
  });

  if (error) {
    throw error;
  }
}

export function subscribeToConversation(
  conversationId: string,
  onChange: () => void,
) {
  const channel: RealtimeChannel = supabase
    .channel(`conversation:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        filter: `conversation_id=eq.${conversationId}`,
        schema: "public",
        table: "messages",
      },
      () => onChange(),
    )
    .subscribe();

  return channel;
}

export async function unsubscribeFromConversation(channel: RealtimeChannel) {
  await supabase.removeChannel(channel);
}
