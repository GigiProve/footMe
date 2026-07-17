import { supabase } from "../../lib/supabase";

export type CommunicationCategory = "societa" | "squadra" | "store" | "eventi";

export type CommunicationSummary = {
  communication_id: string;
  category: CommunicationCategory;
  title: string;
  preview: string;
  sender_club_id: string;
  sender_name: string;
  sender_logo_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  published_at: string;
  is_read: boolean;
};

export type CommunicationDetail = {
  communication_id: string;
  category: CommunicationCategory;
  title: string;
  body: string;
  audience_label: string;
  sender_club_id: string;
  sender_name: string;
  sender_logo_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  published_at: string;
  read_at: string | null;
  recipient_count: number;
};

export async function fetchCommunications(
  limit = 50,
  offset = 0,
): Promise<CommunicationSummary[]> {
  const { data, error } = await supabase.rpc("fetch_communications", {
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as CommunicationSummary[];
}

export async function fetchCommunicationDetail(
  communicationId: string,
): Promise<CommunicationDetail> {
  const { data, error } = await supabase.rpc("fetch_communication_detail", {
    p_communication_id: communicationId,
  });

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    throw new Error("Comunicazione non trovata");
  }

  return row as CommunicationDetail;
}

export async function markCommunicationRead(
  communicationId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("mark_communication_read", {
    p_communication_id: communicationId,
  });

  if (error) {
    throw error;
  }

  return Boolean(data);
}
