import { supabase } from "../../lib/supabase";

export type ShortlistScope =
  | "tutta_la_societa"
  | "prima_squadra"
  | "juniores"
  | "under_17"
  | "under_15";

export type ShortlistPriority = "alta" | "media" | "bassa";

export type ShortlistEvaluationStatus =
  | "da_valutare"
  | "interessante"
  | "da_contattare"
  | "contattato"
  | "non_prioritario"
  | "scartato";

export type ClubShortlist = {
  id: string;
  club_id: string;
  name: string;
  description: string | null;
  scope: ShortlistScope;
  entry_count: number;
  high_priority_count: number;
  created_by_profile_id: string | null;
  created_by_full_name: string | null;
  created_at: string;
  updated_at: string;
};

export type ShortlistOverviewCounts = {
  lists_count: number;
  total_entries: number;
  da_contattare_count: number;
  alta_count: number;
};

export type ShortlistEntry = {
  id: string;
  shortlist_id: string;
  player_profile_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  primary_position: string | null;
  current_team: string | null;
  birth_year: number | null;
  priority: ShortlistPriority;
  evaluation_status: ShortlistEvaluationStatus;
  internal_note: string | null;
  added_by_profile_id: string | null;
  added_by_full_name: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileShortlistMembership = {
  entry_id: string;
  shortlist_id: string;
  shortlist_name: string;
  priority: ShortlistPriority;
  evaluation_status: ShortlistEvaluationStatus;
};

export async function fetchClubShortlists(
  clubId: string,
  page = 0,
  pageSize = 50,
): Promise<ClubShortlist[]> {
  const offset = page * pageSize;
  const { data, error } = await supabase.rpc("fetch_club_shortlists", {
    p_club_id: clubId,
    p_limit: pageSize,
    p_offset: offset,
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as ClubShortlist[];
}

export async function fetchShortlistOverviewCounts(
  clubId: string,
): Promise<ShortlistOverviewCounts> {
  const { data, error } = await supabase.rpc(
    "fetch_shortlist_overview_counts",
    { p_club_id: clubId },
  );

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;

  return {
    alta_count: Number(row?.alta_count ?? 0),
    da_contattare_count: Number(row?.da_contattare_count ?? 0),
    lists_count: Number(row?.lists_count ?? 0),
    total_entries: Number(row?.total_entries ?? 0),
  };
}

export async function createShortlist(
  clubId: string,
  createdByProfileId: string,
  input: { name: string; description?: string; scope: ShortlistScope },
): Promise<string> {
  const { data, error } = await supabase
    .from("club_shortlists")
    .insert({
      club_id: clubId,
      created_by_profile_id: createdByProfileId,
      description: input.description?.trim() || null,
      name: input.name.trim(),
      scope: input.scope,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data.id as string;
}

export async function updateShortlist(
  shortlistId: string,
  patch: { name?: string; description?: string | null; scope?: ShortlistScope },
): Promise<void> {
  const { error } = await supabase
    .from("club_shortlists")
    .update(patch)
    .eq("id", shortlistId);

  if (error) {
    throw error;
  }
}

export async function deleteShortlist(shortlistId: string): Promise<void> {
  const { error } = await supabase
    .from("club_shortlists")
    .delete()
    .eq("id", shortlistId);

  if (error) {
    throw error;
  }
}

export async function fetchShortlistEntries(
  shortlistId: string,
  page = 0,
  pageSize = 100,
): Promise<ShortlistEntry[]> {
  const offset = page * pageSize;
  const { data, error } = await supabase.rpc("fetch_shortlist_entries", {
    p_limit: pageSize,
    p_offset: offset,
    p_shortlist_id: shortlistId,
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as ShortlistEntry[];
}

export async function addShortlistEntry(
  shortlistId: string,
  playerProfileId: string,
  addedByProfileId: string,
  input: {
    priority: ShortlistPriority;
    evaluationStatus?: ShortlistEvaluationStatus;
    internalNote?: string | null;
  },
): Promise<void> {
  const { error } = await supabase.from("club_shortlist_entries").insert({
    added_by_profile_id: addedByProfileId,
    evaluation_status: input.evaluationStatus ?? "da_valutare",
    internal_note: input.internalNote?.trim() || null,
    player_profile_id: playerProfileId,
    priority: input.priority,
    shortlist_id: shortlistId,
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error("Profilo già presente in questa lista.");
    }

    throw error;
  }
}

export async function updateShortlistEntry(
  entryId: string,
  patch: {
    priority?: ShortlistPriority;
    evaluationStatus?: ShortlistEvaluationStatus;
    internalNote?: string | null;
  },
): Promise<void> {
  const setNote = "internalNote" in patch;

  const { error } = await supabase.rpc("update_shortlist_entry", {
    p_entry_id: entryId,
    p_evaluation_status: patch.evaluationStatus ?? null,
    p_internal_note: setNote ? patch.internalNote ?? null : null,
    p_priority: patch.priority ?? null,
    p_set_note: setNote,
  });

  if (error) {
    throw error;
  }
}

export async function removeShortlistEntry(entryId: string): Promise<void> {
  const { error } = await supabase
    .from("club_shortlist_entries")
    .delete()
    .eq("id", entryId);

  if (error) {
    throw error;
  }
}

export async function fetchProfileShortlistMemberships(
  playerProfileId: string,
  clubId: string,
): Promise<ProfileShortlistMembership[]> {
  // Il filtro per club evita di mescolare liste di club diversi quando
  // l'utente ha permessi shortlist su più società.
  const { data, error } = await supabase
    .from("club_shortlist_entries")
    .select(
      "id, shortlist_id, priority, evaluation_status, club_shortlists!inner(id, name, club_id)",
    )
    .eq("player_profile_id", playerProfileId)
    .eq("club_shortlists.club_id", clubId);

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    return [];
  }

  return data.map((row) => {
    const list = (
      Array.isArray(row.club_shortlists) ? row.club_shortlists[0] : row.club_shortlists
    ) as { id: string; name: string } | null;

    return {
      entry_id: row.id,
      evaluation_status: row.evaluation_status as ShortlistEvaluationStatus,
      priority: row.priority as ShortlistPriority,
      shortlist_id: row.shortlist_id,
      shortlist_name: list?.name ?? "",
    };
  });
}

/**
 * Batch shortlist-membership lookup for a page of player rows (e.g. Cerca >
 * Profili results). Returns the subset of `profileIds` already present in
 * at least one shortlist of `clubId`. Mirrors the join used by
 * `fetchProfileShortlistMemberships`, RLS-validated the same way.
 */
export async function fetchShortlistedProfileIds(
  clubId: string,
  profileIds: string[],
): Promise<Set<string>> {
  if (profileIds.length === 0) {
    return new Set();
  }

  const { data, error } = await supabase
    .from("club_shortlist_entries")
    .select("player_profile_id, club_shortlists!inner(club_id)")
    .eq("club_shortlists.club_id", clubId)
    .in("player_profile_id", profileIds);

  if (error) {
    throw error;
  }

  return new Set((data ?? []).map((row) => row.player_profile_id as string));
}

const SCOPE_LABELS: Record<ShortlistScope, string> = {
  juniores: "Juniores",
  prima_squadra: "Prima squadra",
  tutta_la_societa: "Tutta la società",
  under_15: "Under 15",
  under_17: "Under 17",
};

export function getScopeLabel(scope: ShortlistScope): string {
  return SCOPE_LABELS[scope];
}

const PRIORITY_LABELS: Record<ShortlistPriority, string> = {
  alta: "Alta",
  bassa: "Bassa",
  media: "Media",
};

export function getPriorityLabel(priority: ShortlistPriority): string {
  return PRIORITY_LABELS[priority];
}

const EVALUATION_STATUS_LABELS: Record<ShortlistEvaluationStatus, string> = {
  contattato: "Contattato",
  da_contattare: "Da contattare",
  da_valutare: "Da valutare",
  interessante: "Interessante",
  non_prioritario: "Non prioritario",
  scartato: "Scartato",
};

export function getEvaluationStatusLabel(
  status: ShortlistEvaluationStatus,
): string {
  return EVALUATION_STATUS_LABELS[status];
}
