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
  message_kind: "contact_card" | "text";
  sent_at: string;
  read_at: string | null;
  shared_contact_name: string | null;
  shared_contact_phone: string | null;
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
    message_kind: "text",
    sender_profile_id: input.senderProfileId,
  });

  if (error) {
    throw error;
  }
}

export async function sendContactCardMessage(input: {
  contactName: string;
  conversationId: string;
  phone: string;
  senderProfileId: string;
}) {
  const contactName = input.contactName.trim();
  const phone = input.phone.trim();

  if (!contactName || !phone) {
    throw new Error("Aggiungi un numero di telefono valido prima di condividerlo.");
  }

  const { error } = await supabase.from("messages").insert({
    body: "Numero di telefono condiviso",
    conversation_id: input.conversationId,
    message_kind: "contact_card",
    sender_profile_id: input.senderProfileId,
    shared_contact_name: contactName,
    shared_contact_phone: phone,
  });

  if (error) {
    throw error;
  }
}

export async function getShareablePhoneContact(profileId: string) {
  const { data, error } = await supabase
    .from("profile_private_contacts")
    .select("phone, profiles!inner(full_name)")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const relatedProfile = Array.isArray(data?.profiles)
    ? data.profiles[0]
    : data?.profiles;

  return {
    fullName: relatedProfile?.full_name ?? "",
    phone: data?.phone ?? "",
  };
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
