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

export type MessageKind = "text" | "contact_card" | "image" | "video" | "document";

export type ConversationMessage = {
  message_id: string;
  body: string;
  message_kind: MessageKind;
  media_url: string | null;
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

  // Supabase join payloads can be typed as either a nested object or a single-item
  // array depending on generated relation metadata, so normalize both shapes.
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

export type InboxConversation = {
  conversation_id: string;
  conversation_type: "direct" | "group";
  display_title: string;
  avatar_url: string | null;
  other_profile_id: string | null;
  participant_count: number;
  last_message_body: string | null;
  last_message_kind: string | null;
  last_message_sent_at: string | null;
  last_message_sender_profile_id: string | null;
  last_message_sender_name: string | null;
  unread_count: number;
  archived: boolean;
  blocked_by_me: boolean;
};

export async function fetchInboxConversations(
  limit = 50,
  offset = 0,
  includeArchived = false,
): Promise<InboxConversation[]> {
  const { data, error } = await supabase.rpc("fetch_inbox_conversations", {
    p_limit: limit,
    p_offset: offset,
    p_include_archived: includeArchived,
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as InboxConversation[];
}

export type DirectConversationMeta = {
  other_profile_id: string;
  other_full_name: string;
  other_avatar_url: string | null;
  other_role: string;
  other_primary_position: string | null;
  club_id: string | null;
  club_name: string | null;
  club_category: string | null;
  mutual_follow: boolean;
  representation_active: boolean;
  representation_type: string | null;
  roster_linked: boolean;
  shortlisted: boolean;
  i_have_sent: boolean;
  other_has_sent: boolean;
  blocked_by_me: boolean;
  archived: boolean;
  application_id: string | null;
  application_status: string | null;
  ad_id: string | null;
  ad_title: string | null;
  applicant_full_name: string | null;
};

export async function openDirectConversation(
  targetProfileId: string,
  applicationId?: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("open_direct_conversation", {
    target_profile_id: targetProfileId,
    p_application_id: applicationId ?? null,
  });

  if (error) {
    throw error;
  }

  return data as string;
}

export async function fetchDirectConversationMeta(
  conversationId: string,
): Promise<DirectConversationMeta | null> {
  const { data, error } = await supabase.rpc("fetch_direct_conversation_meta", {
    target_conversation_id: conversationId,
  });

  if (error) {
    throw error;
  }

  return (data?.[0] ?? null) as DirectConversationMeta | null;
}

export async function blockUser(targetProfileId: string) {
  const { error } = await supabase.rpc("block_user", {
    target_profile_id: targetProfileId,
  });

  if (error) {
    throw error;
  }
}

export async function unblockUser(targetProfileId: string) {
  const { error } = await supabase.rpc("unblock_user", {
    target_profile_id: targetProfileId,
  });

  if (error) {
    throw error;
  }
}

export type ConversationReportReason =
  | "spam"
  | "messaggio_inappropriato"
  | "profilo_falso"
  | "molestie"
  | "altro";

export async function reportConversation(input: {
  conversationId: string;
  reason: ConversationReportReason;
  details?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("report_conversation", {
    target_conversation_id: input.conversationId,
    p_reason: input.reason,
    p_details: input.details ?? null,
  });

  if (error) {
    throw error;
  }

  return data as string;
}

export async function setConversationArchived(
  conversationId: string,
  archived: boolean,
) {
  const { error } = await supabase.rpc("set_conversation_archived", {
    target_conversation_id: conversationId,
    p_archived: archived,
  });

  if (error) {
    throw error;
  }
}

export async function getChatMediaSignedUrl(
  path: string,
  expiresIn = 3600,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("chat-media")
    .createSignedUrl(path, expiresIn);

  if (error) {
    throw error;
  }

  return data?.signedUrl ?? null;
}

export async function markInboxAllRead(): Promise<number> {
  const { data, error } = await supabase.rpc("mark_inbox_all_read");

  if (error) {
    throw error;
  }

  return (data ?? 0) as number;
}
