import { supabase } from "../../lib/supabase";

export type RepresentationStatus =
  | "accepted"
  | "pending"
  | "rejected"
  | "removed"
  | "reported"
  | "revoked"
  | "terminated";

export type RepresentationVisibility = "private" | "public";

export type RelationshipType =
  | "intermediario"
  | "procuratore"
  | "referente_sportivo";

export function getRelationshipTypeLabel(t: RelationshipType): string {
  switch (t) {
    case "procuratore":
      return "Procuratore";
    case "intermediario":
      return "Intermediario";
    case "referente_sportivo":
      return "Referente sportivo";
  }
}

export type AgentRepresentation = {
  agent_profile_id: string;
  /** Data dichiarata di fine rapporto (REV-PROF-14), non il momento tecnico. */
  ended_on?: string | null;
  id: string;
  message?: string | null;
  pending_visibility?: RepresentationVisibility | null;
  player_profile_id: string;
  private_note?: string | null;
  relationship_type: RelationshipType;
  requested_by: string;
  /** Data dichiarata di inizio rapporto (REV-PROF-14). */
  started_on?: string | null;
  status: RepresentationStatus;
  visibility: RepresentationVisibility;
};

export type RepresentedPlayer = AgentRepresentation & {
  player_avatar_url: string | null;
  player_full_name: string | null;
};

/** Enriched row returned by fetch_agent_assistiti RPC. */
export type AgentAssistito = {
  birth_year: number | null;
  created_at: string;
  current_team: string | null;
  id: string;
  message: string | null;
  player_avatar_url: string | null;
  player_full_name: string | null;
  player_profile_id: string;
  primary_position: string | null;
  relationship_type: RelationshipType;
  status: RepresentationStatus;
  visibility: RepresentationVisibility;
};

/**
 * Agent requests to represent a player. Idempotent: returns the existing
 * representation id when one already exists. Notifies the player.
 */
export async function requestRepresentation(
  playerProfileId: string,
  opts: {
    message?: string;
    relationshipType?: RelationshipType;
    startedOn?: string | null;
    visibility?: RepresentationVisibility;
  } = {},
): Promise<string> {
  // `p_started_on` viene passato sempre, anche quando è null: se su un database
  // con deriva di schema sopravvivesse la vecchia firma a quattro parametri, una
  // chiamata senza di esso combacerebbe con entrambe le versioni e PostgREST la
  // rifiuterebbe come ambigua.
  const { data, error } = await supabase.rpc("request_agent_representation", {
    p_message: opts.message ?? null,
    p_player_profile_id: playerProfileId,
    p_relationship_type: opts.relationshipType ?? "procuratore",
    p_started_on: opts.startedOn ?? null,
    p_visibility: opts.visibility ?? "public",
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

/**
 * Either party removes an accepted or pending relationship.
 * Agent calling → status='terminated'; player calling → status='revoked'.
 */
export async function removeRepresentation(id: string): Promise<void> {
  const { error } = await supabase.rpc("remove_agent_representation", {
    p_id: id,
  });

  if (error) {
    throw error;
  }
}

/** Agent sets (or clears) the private note on their own representation row. */
export async function setPrivateNote(id: string, note: string): Promise<void> {
  const { error } = await supabase.rpc("set_representation_private_note", {
    p_id: id,
    p_note: note,
  });

  if (error) {
    throw error;
  }
}

/** Agent cancels their own pending request before the player responds. */
export async function cancelRequest(id: string): Promise<void> {
  const { error } = await supabase.rpc(
    "cancel_agent_representation_request",
    { p_id: id },
  );

  if (error) {
    throw error;
  }
}

/** Player reports a representation row for admin review. */
export async function reportRepresentation(
  id: string,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc("report_agent_representation", {
    p_id: id,
    p_reason: reason,
  });

  if (error) {
    throw error;
  }
}

/**
 * Agent proposes a visibility change.
 * 'private' is applied immediately; 'public' sends a proposal to the player.
 */
export async function proposeVisibility(
  id: string,
  visibility: RepresentationVisibility,
): Promise<void> {
  const { error } = await supabase.rpc("propose_representation_visibility", {
    p_id: id,
    p_visibility: visibility,
  });

  if (error) {
    throw error;
  }
}

/** Player accepts or rejects a pending visibility proposal from the agent. */
export async function confirmVisibility(
  id: string,
  accept: boolean,
): Promise<void> {
  const { error } = await supabase.rpc("confirm_representation_visibility", {
    p_accept: accept,
    p_id: id,
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
      "id, agent_profile_id, player_profile_id, status, visibility, requested_by, relationship_type, message, pending_visibility",
    )
    .eq("agent_profile_id", agentProfileId)
    .eq("player_profile_id", playerProfileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as AgentRepresentation) ?? null;
}

/**
 * Fetch the full detail of a single representation row, joined with the agent's
 * profile fields. Respects RLS (own rows or accepted+public).
 */
export async function fetchRepresentationDetail(id: string): Promise<
  | (AgentRepresentation & {
      agent_avatar_url: string | null;
      agent_full_name: string | null;
      agent_role: string | null;
    })
  | null
> {
  const { data, error } = await supabase
    .from("agent_representations")
    .select(
      "id, agent_profile_id, player_profile_id, status, visibility, requested_by, relationship_type, message, pending_visibility, private_note, started_on, ended_on, profiles!agent_representations_agent_profile_id_fkey(full_name, avatar_url, role)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const agent = (
    Array.isArray(data.profiles) ? data.profiles[0] : data.profiles
  ) as { avatar_url: string | null; full_name: string | null; role: string | null } | null;

  return {
    agent_avatar_url: agent?.avatar_url ?? null,
    agent_full_name: agent?.full_name ?? null,
    agent_profile_id: data.agent_profile_id,
    agent_role: agent?.role ?? null,
    ended_on: data.ended_on ?? null,
    id: data.id,
    message: data.message ?? null,
    pending_visibility: data.pending_visibility ?? null,
    player_profile_id: data.player_profile_id,
    private_note: data.private_note ?? null,
    relationship_type: data.relationship_type as RelationshipType,
    requested_by: data.requested_by,
    started_on: data.started_on ?? null,
    status: data.status as RepresentationStatus,
    visibility: data.visibility as RepresentationVisibility,
  };
}

/**
 * Accepted representations for a player, joined with agent name/avatar.
 * Own rows show all statuses; public rows respect RLS.
 */
export async function fetchPlayerRepresentations(
  playerProfileId: string,
): Promise<
  {
    agent_avatar_url: string | null;
    agent_full_name: string | null;
    agent_profile_id: string;
    id: string;
    relationship_type: RelationshipType;
    status: RepresentationStatus;
    visibility: RepresentationVisibility;
  }[]
> {
  const { data, error } = await supabase
    .from("agent_representations")
    .select(
      "id, agent_profile_id, status, visibility, relationship_type, profiles!agent_representations_agent_profile_id_fkey(full_name, avatar_url)",
    )
    .eq("player_profile_id", playerProfileId)
    .eq("status", "accepted")
    .order("accepted_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
    const agent = (
      Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    ) as { avatar_url: string | null; full_name: string | null } | null;

    return {
      agent_avatar_url: agent?.avatar_url ?? null,
      agent_full_name: agent?.full_name ?? null,
      agent_profile_id: row.agent_profile_id,
      id: row.id,
      relationship_type: row.relationship_type as RelationshipType,
      status: row.status as RepresentationStatus,
      visibility: row.visibility as RepresentationVisibility,
    };
  });
}

/**
 * Enriched assistiti list for an agent (pending + accepted).
 * Returns rows from the fetch_agent_assistiti RPC (SECURITY DEFINER — agent only).
 */
export async function fetchAgentAssistiti(
  agentProfileId: string,
): Promise<AgentAssistito[]> {
  const { data, error } = await supabase.rpc("fetch_agent_assistiti", {
    p_agent_profile_id: agentProfileId,
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as AgentAssistito[];
}

/** Accepted players represented by an agent (for the agent's "Assistiti" list). */
export async function fetchRepresentedPlayers(
  agentProfileId: string,
): Promise<RepresentedPlayer[]> {
  const { data, error } = await supabase
    .from("agent_representations")
    .select(
      "id, agent_profile_id, player_profile_id, status, visibility, requested_by, relationship_type, message, pending_visibility, profiles!agent_representations_player_profile_id_fkey(full_name, avatar_url)",
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
      message: row.message ?? null,
      pending_visibility: row.pending_visibility ?? null,
      player_avatar_url: player?.avatar_url ?? null,
      player_full_name: player?.full_name ?? null,
      player_profile_id: row.player_profile_id,
      relationship_type: (row.relationship_type ?? "procuratore") as RelationshipType,
      requested_by: row.requested_by,
      status: row.status as RepresentationStatus,
      visibility: row.visibility as RepresentationVisibility,
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

/**
 * Riga del portfolio pubblico di un procuratore (REV-PROF-13).
 *
 * Non è `AgentAssistito` con meno campi: è un tipo diverso perché la
 * proiezione pubblica non porta stato, visibilità, messaggio o data di
 * nascita. Quello che non arriva qui non può finire a schermo per distrazione.
 */
export type AgentPublicAssistito = {
  created_at: string;
  current_team: string | null;
  id: string;
  player_avatar_url: string | null;
  player_full_name: string | null;
  player_profile_id: string;
  primary_position: string | null;
  relationship_type: RelationshipType;
};

/**
 * Portfolio pubblico di un procuratore: solo relazioni accettate e pubbliche.
 *
 * Owner e visitor chiamano questa stessa funzione e ottengono la stessa
 * risposta — è il punto in cui il Master Profile owner diventa davvero una
 * proiezione di ciò che vedono gli altri. Richieste pendenti, relazioni
 * private, rifiutate, revocate o concluse restano fuori, e con loro restano
 * fuori dal conteggio pubblico: la gestione dedicata è l'unico posto in cui
 * compaiono.
 */
export async function fetchAgentPublicAssistiti(
  agentProfileId: string,
): Promise<AgentPublicAssistito[]> {
  const { data, error } = await supabase.rpc("fetch_agent_public_assistiti", {
    p_agent_profile_id: agentProfileId,
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as AgentPublicAssistito[];
}
