import { supabase } from "../../lib/supabase";

export type ShortlistScope =
  | "tutta_la_societa"
  | "prima_squadra"
  | "juniores"
  | "under_17"
  | "under_15";

/**
 * DAS-REV-24 §17: «Priorità: Alta, Media, Bassa oppure **non impostata**.»
 * Il `null` è un valore valido del dominio, non un dato mancante — §30:
 * «Una priorità nulla è valida» e non va resa come un avviso.
 */
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
  /**
   * DAS-REV-24 §22: lo scope reale di una lista CUSTOM è ora `team_id`,
   * che punta a una squadra vera. `scope` resta per le righe create prima
   * della 24, la cui etichetta storica non va riscritta (§26), e
   * `scope_label` è la forma già risolta dal server — l'unica da mostrare.
   */
  scope: ShortlistScope;
  team_id: string | null;
  scope_label: string;
  entry_count: number;
  high_priority_count: number;
  created_by_profile_id: string | null;
  created_by_full_name: string | null;
  created_at: string;
  updated_at: string;
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
  priority: ShortlistPriority | null;
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
  priority: ShortlistPriority | null;
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

export async function createShortlist(
  clubId: string,
  createdByProfileId: string,
  /**
   * DAS-REV-24 §22: `teamId` è il perimetro reale; `null` significa
   * «intera Società». La colonna `scope` resta al suo default per i lettori
   * precedenti e non viene più scelta dall'utente (§26: le righe storiche
   * conservano la loro etichetta, le nuove la derivano dalla squadra).
   */
  input: { name: string; description?: string; teamId: string | null },
): Promise<string> {
  const { data, error } = await supabase
    .from("club_shortlists")
    .insert({
      club_id: clubId,
      created_by_profile_id: createdByProfileId,
      description: input.description?.trim() || null,
      /* §23: «Il client non può aggiungere in payload campi protetti come
         … tipo POSITION in una creazione CUSTOM.» La RLS lo rifiuterebbe
         comunque; qui il tipo non viene nemmeno inviato. */
      name: input.name.trim(),
      team_id: input.teamId,
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
  patch: { name?: string; description?: string | null; team_id?: string | null },
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
    /**
     * DAS-REV-24 §17, QA028: «La priorità nulla è accettata per nuove
     * entry; non viene trasformata automaticamente in Media.» Lo schema
     * non ha più un default, quindi passare `null` significa davvero
     * «non impostata».
     */
    priority: ShortlistPriority | null;
    evaluationStatus?: ShortlistEvaluationStatus;
    internalNote?: string | null;
  },
): Promise<void> {
  const { error } = await supabase.from("club_shortlist_entries").insert({
    added_by_profile_id: addedByProfileId,
    /* §19: l'origine di nascita. Il legame con un'eventuale candidatura
       pertinente lo stabilisce il server (§23 vieta al client di scrivere
       campi protetti), non questo insert. */
    created_source: "profile",
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
    priority?: ShortlistPriority | null;
    evaluationStatus?: ShortlistEvaluationStatus;
    internalNote?: string | null;
    /** §20: compare-and-set, per non sovrascrivere una revisione più recente. */
    expectedRevision?: number | null;
  },
): Promise<void> {
  const setNote = "internalNote" in patch;
  const setPriority = "priority" in patch;

  const { error } = await supabase.rpc("update_shortlist_entry", {
    p_entry_id: entryId,
    p_evaluation_status: patch.evaluationStatus ?? null,
    p_expected_revision: patch.expectedRevision ?? null,
    p_internal_note: setNote ? patch.internalNote ?? null : null,
    p_priority: patch.priority ?? null,
    /* §17: la priorità ora si può anche **togliere**, con lo stesso schema
       `p_set_*` già usato per la nota: senza di questo un `null` sarebbe
       indistinguibile da «lascia com'è». */
    p_set_priority: setPriority,
    p_set_note: setNote,
  });

  if (error) {
    throw error;
  }
}

/**
 * Rimozione di una membership (DAS-REV-25 §21).
 *
 * Era un `delete` diretto su `club_shortlist_entries`: autorizzato dalla
 * policy RLS, ma senza esito, senza ricevuta e senza i dati per
 * riconciliare count e stella. §21 la vuole comando, e averne **uno solo**
 * è il punto: due percorsi di rimozione avrebbero due comportamenti
 * diversi sullo stesso dato.
 *
 * La chiave idempotente è opzionale perché questo ingresso — il dettaglio
 * di una lista CUSTOM di RET-07 — non ne genera ancora una; senza chiave il
 * server esegue il comando con le stesse autorizzazioni e non registra la
 * ricevuta. Il percorso con chiave è quello del pack 25.
 */
export async function removeShortlistEntry(
  entryId: string,
  idempotencyKey: string | null = null,
): Promise<void> {
  const { error } = await supabase.rpc("remove_shortlist_entry", {
    p_entry_id: entryId,
    p_idempotency_key: idempotencyKey,
  });

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
      "id, shortlist_id, priority, evaluation_status, club_shortlists!inner(id, name, club_id, list_type)",
    )
    .eq("player_profile_id", playerProfileId)
    .eq("club_shortlists.club_id", clubId)
    /* DAS-REV-24 §25: «Una creazione CUSTOM non chiede il tipo della lista
       e non presenta Position come destinazione.» Lo stesso vale per il
       selector di aggiunta dal profilo, che da questa lettura ricava le
       destinazioni già occupate: un contenitore POSITION non è una lista
       che si sceglie, e il suo nome non è un'etichetta mostrabile (§16).
       Prima della 24 non esistevano righe POSITION qui: il filtro conserva
       il comportamento, non lo cambia. */
    .eq("club_shortlists.list_type", "custom");

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

/**
 * DAS-REV-24 §17: la priorità può non essere impostata, e §30 vieta di
 * renderla come un errore — «Non mostrare … “Priorità non impostata” come
 * errore. Una priorità nulla è valida.» `null` qui significa: non
 * disegnare niente.
 */
export function getPriorityLabel(
  priority: ShortlistPriority | null,
): string | null {
  return priority ? PRIORITY_LABELS[priority] : null;
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

/**
 * Stella della Society operativa su un profilo (§15, §23).
 *
 * «☆: nessuna appartenenza a shortlist accessibili della Society
 * operativa; ★: almeno una appartenenza accessibile della stessa Society.»
 *
 * Non riusa `fetchProfileShortlistMemberships`, che è filtrata sulle sole
 * CUSTOM perché alimenta il selector: la stella deve accendersi anche per
 * una membership nata dalla candidatura (QA093). §23 chiede proprio questa
 * separazione — «Restituisce separatamente l'appartenenza alla specifica
 * Position e quella ad almeno una lista accessibile della Society.»
 */
export async function fetchProfileShortlistStar(
  clubId: string,
  personId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("fetch_shortlist_membership", {
    p_club_id: clubId,
    p_person_ids: [personId],
    p_position_id: null,
  });

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : null;

  return (row as { in_any_list?: boolean } | null)?.in_any_list === true;
}
