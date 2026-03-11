import { supabase } from "../../lib/supabase";

export type ConnectionStatus = "pending" | "accepted" | "rejected" | "blocked";

export type NetworkOverviewItem = {
  connection_id: string;
  status: ConnectionStatus;
  is_requester: boolean;
  other_profile_id: string;
  other_full_name: string;
  other_role: string;
  other_region: string | null;
  other_city: string | null;
  other_primary_position: string | null;
  other_is_available: boolean;
  created_at: string;
  updated_at: string;
};

export async function getNetworkOverview() {
  const { data, error } = await supabase.rpc("get_network_overview");

  if (error) {
    throw error;
  }

  return (data ?? []) as NetworkOverviewItem[];
}

export async function requestConnection(targetProfileId: string) {
  const { data, error } = await supabase.rpc("request_connection", {
    target_profile_id: targetProfileId,
  });

  if (error) {
    throw error;
  }

  return data as string;
}

export async function updateConnectionStatus(
  connectionId: string,
  status: Exclude<ConnectionStatus, "pending">,
) {
  const { error } = await supabase
    .from("connections")
    .update({ status })
    .eq("id", connectionId);

  if (error) {
    throw error;
  }
}

export async function startDirectConversation(targetProfileId: string) {
  const { data, error } = await supabase.rpc("start_direct_conversation", {
    target_profile_id: targetProfileId,
  });

  if (error) {
    throw error;
  }

  return data as string;
}
