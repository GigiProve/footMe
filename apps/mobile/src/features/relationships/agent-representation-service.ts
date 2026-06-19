import { supabase } from "../../lib/supabase";

export type RepresentationStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "removed";

export type RepresentationVisibility = "public" | "private";

export type AgentRepresentation = {
  agent_profile_id: string;
  id: string;
  player_profile_id: string;
  requested_by: string;
  status: RepresentationStatus;
  visibility: RepresentationVisibility;
};

export type RepresentedPlayer = AgentRepresentation & {
  player_avatar_url: string | null;
  player_full_name: string | null;
};

/**
 * Agent requests to represent a player. Idempotent: returns the existing
 * representation id when one already exists. Notifies the player.
 */
export async function requestRepresentation(
  playerProfileId: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("request_agent_representation", {
    p_player_profile_id: playerProfileId,
  });

  if (error) {
    throw error;
  }

  return data as string;
}

/** Player accepts or rejects a pending representation request. */
export async function respondRepresentation(
  representationId: string,
  accept: boolean,
) {
  const { error } = await supabase.rpc("respond_agent_representation", {
    p_accept: accept,
    p_id: representationId,
  });

  if (error) {
    throw error;
  }
}

/** Agent or player sets a representation public or private (privacy control). */
export async function setRepresentationVisibility(
  representationId: string,
  visibility: RepresentationVisibility,
) {
  const { error } = await supabase.rpc("set_representation_visibility", {
    p_id: representationId,
    p_visibility: visibility,
  });

  if (error) {
    throw error;
  }
}

/**
 * Current relationship between an agent and a player, if any is visible to the
 * caller under RLS (own rows, or accepted+public).
 */
export async function fetchRepresentationState(
  agentProfileId: string,
  playerProfileId: string,
): Promise<AgentRepresentation | null> {
  const { data, error } = await supabase
    .from("agent_representations")
    .select(
      "id, agent_profile_id, player_profile_id, status, visibility, requested_by",
    )
    .eq("agent_profile_id", agentProfileId)
    .eq("player_profile_id", playerProfileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as AgentRepresentation) ?? null;
}

/** Accepted players represented by an agent (for the agent's "Assistiti" list). */
export async function fetchRepresentedPlayers(
  agentProfileId: string,
): Promise<RepresentedPlayer[]> {
  const { data, error } = await supabase
    .from("agent_representations")
    .select(
      "id, agent_profile_id, player_profile_id, status, visibility, requested_by, profiles!agent_representations_player_profile_id_fkey(full_name, avatar_url)",
    )
    .eq("agent_profile_id", agentProfileId)
    .eq("status", "accepted")
    .order("accepted_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
    const player = (
      Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    ) as {
      avatar_url: string | null;
      full_name: string | null;
    } | null;

    return {
      agent_profile_id: row.agent_profile_id,
      id: row.id,
      player_avatar_url: player?.avatar_url ?? null,
      player_full_name: player?.full_name ?? null,
      player_profile_id: row.player_profile_id,
      requested_by: row.requested_by,
      status: row.status,
      visibility: row.visibility,
    };
  });
}

/** Accepted agent for a player, respecting public visibility (for player profile). */
export async function fetchPlayerAgent(
  playerProfileId: string,
): Promise<{ agent_full_name: string | null; agent_profile_id: string } | null> {
  const { data, error } = await supabase
    .from("agent_representations")
    .select(
      "agent_profile_id, profiles!agent_representations_agent_profile_id_fkey(full_name)",
    )
    .eq("player_profile_id", playerProfileId)
    .eq("status", "accepted")
    .eq("visibility", "public")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const agent = (
    Array.isArray(data.profiles) ? data.profiles[0] : data.profiles
  ) as { full_name: string | null } | null;

  return {
    agent_full_name: agent?.full_name ?? null,
    agent_profile_id: data.agent_profile_id,
  };
}
