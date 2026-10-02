/**
 * Accesso dati della gestione assistiti (REV-PROF-14).
 *
 * Ogni scrittura passa da una RPC `security definer`: il client non tocca mai
 * direttamente `agent_manual_assistiti` né `agent_assistito_invites`, quindi
 * l'autorizzazione non dipende da cosa chiede la schermata. Le letture usano le
 * stesse RPC dell'hub per owner e schermata richieste: una sola fonte, nessuna
 * seconda lista da tenere allineata.
 */
import { supabase } from "../../../lib/supabase";
import type { PlayerPosition } from "../../profiles/player-sports";
import type {
  AssistitiCounts,
  AssistitoRow,
  InviteChannel,
  InviteStatus,
  RelationshipType,
} from "./assistiti-model";

/**
 * Chiavi di cache condivise. Stanno nel modulo e non nelle route perché ogni
 * schermata del flusso invalida le stesse due query: se ognuna si inventasse la
 * propria chiave, il Master Profile si aggiornerebbe solo a volte.
 */
export const assistitiQueryKeys = {
  counts: (agentProfileId: string) =>
    ["assistiti-counts", agentProfileId] as const,
  overview: (agentProfileId: string) =>
    ["assistiti-overview", agentProfileId] as const,
};

export async function fetchAssistitiCounts(
  agentProfileId: string,
): Promise<AssistitiCounts> {
  const { data, error } = await supabase.rpc("fetch_agent_assistiti_counts", {
    p_agent_profile_id: agentProfileId,
  });

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;

  return {
    active_count: row?.active_count ?? 0,
    ended_count: row?.ended_count ?? 0,
    invite_count: row?.invite_count ?? 0,
    pending_count: row?.pending_count ?? 0,
    private_count: row?.private_count ?? 0,
    public_count: row?.public_count ?? 0,
  };
}

export async function fetchAssistitiOverview(
  agentProfileId: string,
): Promise<AssistitoRow[]> {
  const { data, error } = await supabase.rpc("fetch_agent_assistiti_overview", {
    p_agent_profile_id: agentProfileId,
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as AssistitoRow[];
}

export type RelationshipState = {
  blocked: boolean;
  player_profile_id: string;
  status: "accepted" | "pending" | null;
};

/**
 * Stato della relazione per i profili appena trovati dalla ricerca. Sta qui e
 * non dentro la RPC di ricerca: il motore di ricerca resta uno solo e non
 * impara niente sul procuratore che lo interroga.
 */
export async function fetchRelationshipStates(
  playerProfileIds: readonly string[],
): Promise<Map<string, RelationshipState>> {
  if (playerProfileIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase.rpc(
    "fetch_agent_relationship_states",
    { p_player_profile_ids: playerProfileIds },
  );

  if (error) {
    throw error;
  }

  const states = new Map<string, RelationshipState>();

  for (const row of (data ?? []) as RelationshipState[]) {
    states.set(row.player_profile_id, row);
  }

  return states;
}

export type ManualDuplicate = {
  full_name: string;
  id: string;
  invite_status: InviteStatus | null;
  kind: "manual" | "representation";
  primary_position: PlayerPosition | null;
  status: string;
  team_label: string | null;
};

export async function findManualDuplicates(input: {
  fullName: string;
  position?: PlayerPosition | null;
  team?: string | null;
}): Promise<ManualDuplicate[]> {
  const { data, error } = await supabase.rpc("find_agent_manual_duplicates", {
    p_full_name: input.fullName,
    p_position: input.position ?? null,
    p_team: input.team ?? null,
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as ManualDuplicate[];
}

export type CreatedManualAssistito = {
  expires_at: string;
  invite_id: string;
  invite_token: string;
  manual_id: string;
};

/**
 * Crea il record manuale e il suo invito in un colpo solo.
 * `invite_token` è l'unico momento in cui il token esiste in chiaro: va usato
 * subito per costruire il link e poi dimenticato.
 */
export async function createManualAssistito(input: {
  confirmDuplicate?: boolean;
  fullName: string;
  position?: PlayerPosition | null;
  relationshipType: RelationshipType;
  startedOn?: string | null;
  team?: string | null;
}): Promise<CreatedManualAssistito> {
  const { data, error } = await supabase.rpc("create_agent_manual_assistito", {
    p_confirm_duplicate: input.confirmDuplicate ?? false,
    p_full_name: input.fullName,
    p_position: input.position ?? null,
    p_relationship_type: input.relationshipType,
    p_started_on: input.startedOn ?? null,
    p_team: input.team ?? null,
  });

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    throw new Error("Non è stato possibile salvare l'assistito. Riprova.");
  }

  return row as CreatedManualAssistito;
}

export async function updateManualAssistito(input: {
  fullName?: string;
  id: string;
  position?: PlayerPosition | null;
  relationshipType?: RelationshipType;
  startedOn?: string | null;
  team?: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc("update_agent_manual_assistito", {
    p_full_name: input.fullName ?? null,
    p_id: input.id,
    p_position: input.position ?? null,
    p_relationship_type: input.relationshipType ?? null,
    p_started_on: input.startedOn ?? null,
    p_team: input.team ?? null,
  });

  if (error) {
    throw error;
  }
}

export async function deleteManualAssistito(id: string): Promise<void> {
  const { error } = await supabase.rpc("delete_agent_manual_assistito", {
    p_id: id,
  });

  if (error) {
    throw error;
  }
}

export type IssuedInvite = {
  expires_at: string;
  invite_id: string;
  /** Null quando esiste già un invito valido e non è stata chiesta rotazione. */
  invite_token: string | null;
  status: InviteStatus;
};

export async function issueInvite(
  manualAssistitoId: string,
  options: { rotate?: boolean } = {},
): Promise<IssuedInvite> {
  const { data, error } = await supabase.rpc("issue_agent_assistito_invite", {
    p_manual_assistito_id: manualAssistitoId,
    p_rotate: options.rotate ?? false,
  });

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    throw new Error("Non è stato possibile creare l'invito. Riprova.");
  }

  return row as IssuedInvite;
}

/**
 * Il canale è stato aperto. Non significa consegnato: nessun sistema operativo
 * lo conferma, quindi lo stato resta "condivisione completata".
 */
export async function markInviteShared(
  inviteId: string,
  channel: InviteChannel,
): Promise<void> {
  const { error } = await supabase.rpc("mark_agent_assistito_invite_shared", {
    p_channel: channel,
    p_invite_id: inviteId,
  });

  if (error) {
    throw error;
  }
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.rpc("revoke_agent_assistito_invite", {
    p_invite_id: inviteId,
  });

  if (error) {
    throw error;
  }
}

export type ResolvedInvite = {
  agency_name: string | null;
  agent_avatar_url: string | null;
  agent_full_name: string | null;
  agent_profile_id: string;
  already_linked: boolean;
  expires_at: string;
  invite_id: string;
  invite_status: InviteStatus;
  manual_full_name: string;
  relationship_type: RelationshipType;
  visibility: "private";
};

export async function resolveInvite(token: string): Promise<ResolvedInvite> {
  const { data, error } = await supabase.rpc(
    "resolve_agent_assistito_invite",
    { p_token: token },
  );

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    throw new Error("INVITE_INVALID");
  }

  return row as ResolvedInvite;
}

/** Accettazione o rifiuto esplicito del calciatore. */
export async function respondInvite(
  token: string,
  accept: boolean,
): Promise<string | null> {
  const { data, error } = await supabase.rpc(
    "respond_agent_assistito_invite",
    { p_accept: accept, p_token: token },
  );

  if (error) {
    throw error;
  }

  return (data as string | null) ?? null;
}

export async function updateRepresentationTerms(input: {
  id: string;
  relationshipType?: RelationshipType;
  startedOn?: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc("update_agent_representation_terms", {
    p_id: input.id,
    p_relationship_type: input.relationshipType ?? null,
    p_started_on: input.startedOn ?? null,
  });

  if (error) {
    throw error;
  }
}

export async function endRepresentation(
  id: string,
  endedOn?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc("end_agent_representation", {
    p_ended_on: endedOn ?? null,
    p_id: id,
  });

  if (error) {
    throw error;
  }
}

/**
 * Porta le voci del portfolio dell'onboarding nel modello canonico:
 * richiesta di collegamento per chi puntava a un profilo reale, record manuale
 * privato per i nomi scritti a mano. Idempotente.
 */
export async function syncOnboardingPortfolio(): Promise<number> {
  const { data, error } = await supabase.rpc("sync_agent_portfolio_entries");

  if (error) {
    throw error;
  }

  return (data as number | null) ?? 0;
}
