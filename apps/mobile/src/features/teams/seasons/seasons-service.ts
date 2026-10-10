/**
 * Accesso ai dati di Stagioni e storico (DAS-REV-10).
 *
 * Come in `teams-service.ts`, nessuna regola di dominio vive qui. La
 * stagione corrente e la prossima, il perimetro, le capability, il conteggio
 * delle stagioni nuove di un batch e l'esito dei controlli di disattivazione
 * sono tutti decisi dal server — §6 («La Società non può decidere quale
 * stagione sia globalmente corrente»), §20 («Il numero nella CTA deriva da
 * questa stessa risoluzione») e §31 («Il server ricalcola e valida; nessuna
 * fiducia nei conteggi client»).
 *
 * Questo file traduce righe in tipi ed errori in codici, e niente altro.
 */
import { supabase } from "../../../lib/supabase";

// ── Tipi di lettura ──────────────────────────────────────────────────────

export type SeasonsCenterHeader = {
  accessVerifiedAt: number;
  canView: boolean;
  canViewInactive: boolean;
  clubId: string;
  clubIsVerified: boolean;
  clubLogoUrl: string | null;
  clubName: string | null;
  dataRevision: number;
  /** `null` = non consultabile o fuori perimetro. Mai zero (§10). */
  inactiveCount: number | null;
  /** `null` = la prossima stagione non è in catalogo (§6). */
  nextSeasonId: string | null;
  nextSeasonLabel: string | null;
  preparedCount: number | null;
  scopeLabel: string | null;
  seasonId: string | null;
  seasonLabel: string | null;
  toPrepareCount: number | null;
  totalCount: number | null;
};

export type SeasonsCenterRow = {
  crestUrl: string | null;
  hasSeasonConfig: boolean;
  levelId: string | null;
  levelLabel: string | null;
  name: string;
  nextHasConfig: boolean;
  sortKey: string;
  teamId: string;
  typeId: string | null;
  typeLabel: string | null;
};

export type InactiveTeamRow = {
  crestUrl: string | null;
  hasHistory: boolean;
  name: string;
  sortKey: string;
  teamId: string;
};

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};

/** Configurazione stagionale di una squadra, corrente o prossima. */
export type TeamSeasonConfig = {
  id: string;
  levelId: string | null;
  levelLabel: string | null;
  typeId: string | null;
  typeLabel: string | null;
  version: number;
};

export type TeamSeasonsContext = {
  accessVerifiedAt: number;
  canAddHistory: boolean;
  canEditHistory: boolean;
  canManageLifecycle: boolean;
  canPrepare: boolean;
  canViewHistory: boolean;
  clubId: string;
  clubIsVerified: boolean;
  clubLogoUrl: string | null;
  clubName: string;
  crestUrl: string | null;
  /** Configurazione della stagione corrente, oppure `null` = da configurare. */
  currentConfig: TeamSeasonConfig | null;
  dataRevision: number;
  /** `null` = storico non consultabile; `0` = nessuna stagione passata. */
  historyCount: number | null;
  isArchived: boolean;
  name: string;
  nextConfig: TeamSeasonConfig | null;
  nextSeasonId: string | null;
  nextSeasonLabel: string | null;
  seasonId: string | null;
  seasonLabel: string | null;
  teamId: string;
  teamVersion: number;
};

export type TeamSeasonHistoryRow = {
  levelId: string | null;
  levelLabel: string | null;
  seasonId: string;
  seasonLabel: string;
  sortKey: string;
  teamSeasonId: string;
  typeId: string | null;
  typeLabel: string | null;
  version: number;
};

export type TeamSeasonDetail = {
  canEdit: boolean;
  clubId: string;
  clubIsVerified: boolean;
  clubName: string;
  crestUrl: string | null;
  isArchived: boolean;
  levelId: string | null;
  levelLabel: string | null;
  phase: "current" | "next" | "past" | "future" | null;
  seasonId: string;
  seasonLabel: string;
  teamId: string;
  teamName: string;
  teamSeasonId: string;
  typeId: string | null;
  typeLabel: string | null;
  version: number;
};

export type HistorySeasonOption = {
  alreadyPresent: boolean;
  label: string;
  seasonId: string;
  sortOrder: number;
};

// ── Bozza storica e preview ──────────────────────────────────────────────

export type HistoryPeriodInput = {
  fromSeason: string;
  levelId: string | null;
  toSeason: string;
  typeId: string | null;
};

export type HistoryPeriodPreview = {
  /** Stagioni del periodo già coperte da un periodo precedente della bozza. */
  draftCoveredCount: number;
  errorCode: HistoryPeriodErrorCode | null;
  existingCount: number;
  fromSeason: string | null;
  index: number;
  levelId: string | null;
  newCount: number;
  toSeason: string | null;
  typeId: string | null;
};

export type HistoryPeriodErrorCode =
  | "PERIOD_LEVEL_INCOMPATIBLE"
  | "PERIOD_NOT_HISTORICAL"
  | "PERIOD_RANGE_INVERTED"
  | "PERIOD_SEASON_UNKNOWN"
  | "PERIOD_TYPE_REQUIRED"
  | "PERIOD_TYPE_UNKNOWN";

export type HistoryPreview = {
  conflicts: { periodIndexes: number[]; seasonId: string }[];
  /** Impronta dello storico persistito: cambia se un altro actor scrive (§23). */
  contextVersion: string;
  currentSeasonId: string | null;
  limit: number;
  overLimit: boolean;
  periods: HistoryPeriodPreview[];
  totalExisting: number;
  totalNew: number;
};

export type HistoryCommitResult = {
  createdCount: number;
  seasonIds: string[];
};

// ── Lifecycle ────────────────────────────────────────────────────────────

export type DeactivationBlockerKind = "invites" | "positions";

export type DeactivationBlocker = {
  canOpen: boolean;
  /** `null` = impedimento reale, dettaglio non consultabile dall'actor (§26). */
  count: number | null;
  kind: DeactivationBlockerKind;
};

export type DeactivationCheck = {
  allowed: boolean;
  alreadyInactive: boolean;
  authorized: boolean;
  blockers: DeactivationBlocker[];
};

export type LifecycleResult = {
  alreadyApplied: boolean;
  isArchived: boolean;
  teamId: string;
  version: number;
};

// ── Errori ───────────────────────────────────────────────────────────────

export type SeasonErrorCode =
  | "HISTORY_BATCH_TOO_LARGE"
  | "HISTORY_CONTEXT_CHANGED"
  | "HISTORY_NOTHING_TO_ADD"
  | "HISTORY_PERIOD_CONFLICT"
  | "HISTORY_PERIOD_INVALID"
  | "OPERATION_CONTENT_CHANGED"
  | "SEASON_ALREADY_EXISTS"
  | "SEASON_CATALOG_UNAVAILABLE"
  | "SEASON_CONFIG_NOT_AUTHORIZED"
  | "SEASON_CONTEXT_CHANGED"
  | "SEASON_NOT_HISTORICAL"
  | "SEASON_TARGET_INVALID"
  | "SEASON_VERSION_CONFLICT"
  | "TEAM_HAS_OPEN_ACTIVITY"
  | "TEAM_LEVEL_INCOMPATIBLE"
  | "TEAM_NOT_ACTIVE"
  | "TEAM_NOT_AUTHORIZED"
  | "TEAM_NOT_FOUND"
  | "TEAM_SEASON_NOT_FOUND"
  | "TEAM_TYPE_REQUIRED"
  | "TEAM_TYPE_UNKNOWN"
  | "TEAM_VERSION_CONFLICT"
  | "UNKNOWN";

export class SeasonOperationError extends Error {
  code: SeasonErrorCode;

  constructor(code: SeasonErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = "SeasonOperationError";
  }
}

const KNOWN_CODES: SeasonErrorCode[] = [
  "HISTORY_BATCH_TOO_LARGE",
  "HISTORY_CONTEXT_CHANGED",
  "HISTORY_NOTHING_TO_ADD",
  "HISTORY_PERIOD_CONFLICT",
  "HISTORY_PERIOD_INVALID",
  "OPERATION_CONTENT_CHANGED",
  "SEASON_ALREADY_EXISTS",
  "SEASON_CATALOG_UNAVAILABLE",
  "SEASON_CONFIG_NOT_AUTHORIZED",
  "SEASON_CONTEXT_CHANGED",
  "SEASON_NOT_HISTORICAL",
  "SEASON_TARGET_INVALID",
  "SEASON_VERSION_CONFLICT",
  "TEAM_HAS_OPEN_ACTIVITY",
  "TEAM_LEVEL_INCOMPATIBLE",
  "TEAM_NOT_ACTIVE",
  "TEAM_NOT_AUTHORIZED",
  "TEAM_NOT_FOUND",
  "TEAM_SEASON_NOT_FOUND",
  "TEAM_TYPE_REQUIRED",
  "TEAM_TYPE_UNKNOWN",
  "TEAM_VERSION_CONFLICT",
];

export function toSeasonError(error: unknown): SeasonOperationError {
  if (error instanceof SeasonOperationError) {
    return error;
  }

  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error ?? "");

  // `SEASON_CONTEXT_CHANGED` è contenuto in nessun altro codice, ma
  // `TEAM_NOT_FOUND` lo è in `TEAM_SEASON_NOT_FOUND`: l'ordine di ricerca
  // sarebbe fragile. Si cerca quindi il codice **più lungo** che corrisponde.
  const match = KNOWN_CODES.filter((code) => message.includes(code)).sort(
    (a, b) => b.length - a.length,
  )[0];

  return new SeasonOperationError(match ?? "UNKNOWN", message);
}

type RawRecord = Record<string, unknown>;

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function count(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function config(
  id: unknown,
  typeId: unknown,
  typeLabel: unknown,
  levelId: unknown,
  levelLabel: unknown,
  version: unknown,
): TeamSeasonConfig | null {
  const resolvedId = text(id);

  if (!resolvedId) {
    return null;
  }

  return {
    id: resolvedId,
    levelId: text(levelId),
    levelLabel: text(levelLabel),
    typeId: text(typeId),
    typeLabel: text(typeLabel),
    version: Number(version ?? 1),
  };
}

// ── Letture ──────────────────────────────────────────────────────────────

export async function fetchSeasonsCenter(
  clubId: string,
): Promise<SeasonsCenterHeader> {
  const { data, error } = await supabase
    .rpc("fetch_seasons_center", { p_club_id: clubId })
    .maybeSingle();

  if (error) throw toSeasonError(error);

  const row = (data ?? {}) as RawRecord;

  return {
    accessVerifiedAt: row.access_verified_at
      ? new Date(String(row.access_verified_at)).getTime()
      : Date.now(),
    canView: row.can_view === true,
    canViewInactive: row.can_view_inactive === true,
    clubId,
    clubIsVerified: row.club_is_verified === true,
    clubLogoUrl: text(row.club_logo_url),
    clubName: text(row.club_name),
    dataRevision: Number(row.data_revision ?? 0),
    inactiveCount: count(row.inactive_count),
    nextSeasonId: text(row.next_season_id),
    nextSeasonLabel: text(row.next_season_label),
    preparedCount: count(row.prepared_count),
    scopeLabel: text(row.scope_label),
    seasonId: text(row.season_id),
    seasonLabel: text(row.season_label),
    toPrepareCount: count(row.to_prepare_count),
    totalCount: count(row.total_count),
  };
}

export async function fetchSeasonsCenterPage(
  clubId: string,
  cursor: string | null,
  limit = 20,
): Promise<CursorPage<SeasonsCenterRow>> {
  const { data, error } = await supabase.rpc("fetch_seasons_center_page", {
    p_club_id: clubId,
    p_cursor: cursor,
    p_limit: limit,
  });

  if (error) throw toSeasonError(error);

  const items = ((data ?? []) as RawRecord[]).map((row) => ({
    crestUrl: text(row.crest_url),
    hasSeasonConfig: row.has_season_config === true,
    levelId: text(row.level_id),
    levelLabel: text(row.level_label),
    name: String(row.name ?? ""),
    nextHasConfig: row.next_has_config === true,
    sortKey: String(row.sort_key ?? ""),
    teamId: String(row.team_id ?? ""),
    typeId: text(row.type_id),
    typeLabel: text(row.type_label),
  }));

  return {
    items,
    nextCursor: items.length === limit ? items[items.length - 1].sortKey : null,
  };
}

export async function fetchInactiveTeams(
  clubId: string,
  cursor: string | null,
  limit = 20,
): Promise<CursorPage<InactiveTeamRow>> {
  const { data, error } = await supabase.rpc("fetch_inactive_teams", {
    p_club_id: clubId,
    p_cursor: cursor,
    p_limit: limit,
  });

  if (error) throw toSeasonError(error);

  const items = ((data ?? []) as RawRecord[]).map((row) => ({
    crestUrl: text(row.crest_url),
    hasHistory: row.has_history === true,
    name: String(row.name ?? ""),
    sortKey: String(row.sort_key ?? ""),
    teamId: String(row.team_id ?? ""),
  }));

  return {
    items,
    nextCursor: items.length === limit ? items[items.length - 1].sortKey : null,
  };
}

export async function fetchTeamSeasonsContext(
  teamId: string,
): Promise<TeamSeasonsContext> {
  const { data, error } = await supabase
    .rpc("fetch_team_seasons_context", { p_team_id: teamId })
    .maybeSingle();

  if (error) throw toSeasonError(error);

  if (!data) {
    throw new SeasonOperationError("TEAM_NOT_FOUND");
  }

  const row = data as RawRecord;

  return {
    accessVerifiedAt: row.access_verified_at
      ? new Date(String(row.access_verified_at)).getTime()
      : Date.now(),
    canAddHistory: row.can_add_history === true,
    canEditHistory: row.can_edit_history === true,
    canManageLifecycle: row.can_manage_lifecycle === true,
    canPrepare: row.can_prepare === true,
    canViewHistory: row.can_view_history === true,
    clubId: String(row.club_id ?? ""),
    clubIsVerified: row.club_is_verified === true,
    clubLogoUrl: text(row.club_logo_url),
    clubName: String(row.club_name ?? ""),
    crestUrl: text(row.crest_url),
    currentConfig: config(
      row.current_config_id,
      row.current_type_id,
      row.current_type_label,
      row.current_level_id,
      row.current_level_label,
      row.current_version,
    ),
    dataRevision: Number(row.data_revision ?? 0),
    historyCount: count(row.history_count),
    isArchived: row.is_archived === true,
    name: String(row.name ?? ""),
    nextConfig: config(
      row.next_config_id,
      row.next_type_id,
      row.next_type_label,
      row.next_level_id,
      row.next_level_label,
      row.next_version,
    ),
    nextSeasonId: text(row.next_season_id),
    nextSeasonLabel: text(row.next_season_label),
    seasonId: text(row.season_id),
    seasonLabel: text(row.season_label),
    teamId: String(row.team_id ?? teamId),
    teamVersion: Number(row.team_version ?? 1),
  };
}

export async function fetchTeamSeasonHistoryPage(
  teamId: string,
  cursor: string | null,
  limit = 20,
): Promise<CursorPage<TeamSeasonHistoryRow>> {
  const { data, error } = await supabase.rpc(
    "fetch_team_season_history_page",
    { p_cursor: cursor, p_limit: limit, p_team_id: teamId },
  );

  if (error) throw toSeasonError(error);

  const items = ((data ?? []) as RawRecord[]).map((row) => ({
    levelId: text(row.level_id),
    levelLabel: text(row.level_label),
    seasonId: String(row.season_id ?? ""),
    seasonLabel: String(row.season_label ?? ""),
    sortKey: String(row.sort_key ?? ""),
    teamSeasonId: String(row.team_season_id ?? ""),
    typeId: text(row.type_id),
    typeLabel: text(row.type_label),
    version: Number(row.version ?? 1),
  }));

  return {
    items,
    nextCursor: items.length === limit ? items[items.length - 1].sortKey : null,
  };
}

export async function fetchTeamSeasonDetail(
  teamSeasonId: string,
): Promise<TeamSeasonDetail> {
  const { data, error } = await supabase
    .rpc("fetch_team_season_detail", { p_team_season_id: teamSeasonId })
    .maybeSingle();

  if (error) throw toSeasonError(error);

  if (!data) {
    throw new SeasonOperationError("TEAM_SEASON_NOT_FOUND");
  }

  const row = data as RawRecord;
  const phase = text(row.phase);

  return {
    canEdit: row.can_edit === true,
    clubId: String(row.club_id ?? ""),
    clubIsVerified: row.club_is_verified === true,
    clubName: String(row.club_name ?? ""),
    crestUrl: text(row.crest_url),
    isArchived: row.is_archived === true,
    levelId: text(row.level_id),
    levelLabel: text(row.level_label),
    phase:
      phase === "current" || phase === "next" || phase === "past" || phase === "future"
        ? phase
        : null,
    seasonId: String(row.season_id ?? ""),
    seasonLabel: String(row.season_label ?? ""),
    teamId: String(row.team_id ?? ""),
    teamName: String(row.team_name ?? ""),
    teamSeasonId: String(row.team_season_id ?? teamSeasonId),
    typeId: text(row.type_id),
    typeLabel: text(row.type_label),
    version: Number(row.version ?? 1),
  };
}

export async function fetchHistorySeasonOptions(
  teamId: string,
): Promise<HistorySeasonOption[]> {
  const { data, error } = await supabase.rpc(
    "fetch_team_history_season_options",
    { p_team_id: teamId },
  );

  if (error) throw toSeasonError(error);

  return ((data ?? []) as RawRecord[]).map((row) => ({
    alreadyPresent: row.already_present === true,
    label: String(row.label ?? ""),
    seasonId: String(row.season_id ?? ""),
    sortOrder: Number(row.sort_order ?? 0),
  }));
}

// ── Mutazioni ────────────────────────────────────────────────────────────

function toPeriodPayload(periods: HistoryPeriodInput[]) {
  return periods.map((period) => ({
    from_season: period.fromSeason,
    level_id: period.levelId,
    to_season: period.toSeason,
    type_id: period.typeId,
  }));
}

export async function previewHistoryPeriods(
  teamId: string,
  periods: HistoryPeriodInput[],
): Promise<HistoryPreview> {
  const { data, error } = await supabase.rpc("preview_team_season_history", {
    p_periods: toPeriodPayload(periods),
    p_team_id: teamId,
  });

  if (error) throw toSeasonError(error);

  const row = (data ?? {}) as RawRecord;

  return {
    conflicts: ((row.conflicts ?? []) as RawRecord[]).map((item) => ({
      periodIndexes: ((item.period_indexes ?? []) as number[]).map(Number),
      seasonId: String(item.season_id ?? ""),
    })),
    contextVersion: String(row.context_version ?? ""),
    currentSeasonId: text(row.current_season_id),
    limit: Number(row.limit ?? 100),
    overLimit: row.over_limit === true,
    periods: ((row.periods ?? []) as RawRecord[]).map((item) => ({
      draftCoveredCount: Number(item.draft_covered_count ?? 0),
      errorCode: (text(item.error_code) ?? null) as HistoryPeriodErrorCode | null,
      existingCount: Number(item.existing_count ?? 0),
      fromSeason: text(item.from_season),
      index: Number(item.index ?? 0),
      levelId: text(item.level_id),
      newCount: Number(item.new_count ?? 0),
      toSeason: text(item.to_season),
      typeId: text(item.type_id),
    })),
    totalExisting: Number(row.total_existing ?? 0),
    totalNew: Number(row.total_new ?? 0),
  };
}

export async function saveTeamSeasonConfig(input: {
  expectedVersion: number | null;
  idempotencyKey: string;
  levelId: string | null;
  seasonId: string;
  target: "current" | "next";
  teamId: string;
  typeId: string;
}): Promise<TeamSeasonConfig & { created: boolean; seasonId: string }> {
  const { data, error } = await supabase.rpc("save_team_season_config", {
    p_expected_version: input.expectedVersion,
    p_idempotency_key: input.idempotencyKey,
    p_level_id: input.levelId,
    p_season_id: input.seasonId,
    p_target: input.target,
    p_team_id: input.teamId,
    p_type_id: input.typeId,
  });

  if (error) throw toSeasonError(error);

  const row = (data ?? {}) as RawRecord;

  return {
    created: row.created === true,
    id: String(row.team_season_id ?? ""),
    levelId: text(row.level_id),
    levelLabel: null,
    seasonId: String(row.season_id ?? input.seasonId),
    typeId: text(row.type_id),
    typeLabel: null,
    version: Number(row.version ?? 1),
  };
}

export async function updateTeamSeasonHistory(input: {
  expectedVersion: number;
  levelId: string | null;
  teamSeasonId: string;
  typeId: string;
}): Promise<TeamSeasonConfig> {
  const { data, error } = await supabase.rpc("update_team_season_history", {
    p_expected_version: input.expectedVersion,
    p_level_id: input.levelId,
    p_team_season_id: input.teamSeasonId,
    p_type_id: input.typeId,
  });

  if (error) throw toSeasonError(error);

  const row = (data ?? {}) as RawRecord;

  return {
    id: String(row.team_season_id ?? input.teamSeasonId),
    levelId: text(row.level_id),
    levelLabel: null,
    typeId: text(row.type_id),
    typeLabel: null,
    version: Number(row.version ?? 1),
  };
}

export async function commitHistoryPeriods(input: {
  contextVersion: string;
  expectedNewCount: number;
  idempotencyKey: string;
  periods: HistoryPeriodInput[];
  teamId: string;
}): Promise<HistoryCommitResult> {
  const { data, error } = await supabase.rpc("commit_team_season_history", {
    p_context_version: input.contextVersion,
    p_expected_new_count: input.expectedNewCount,
    p_idempotency_key: input.idempotencyKey,
    p_periods: toPeriodPayload(input.periods),
    p_team_id: input.teamId,
  });

  if (error) throw toSeasonError(error);

  const row = (data ?? {}) as RawRecord;

  return {
    createdCount: Number(row.created_count ?? 0),
    seasonIds: ((row.season_ids ?? []) as unknown[]).map(String),
  };
}

export async function checkTeamDeactivation(
  teamId: string,
): Promise<DeactivationCheck> {
  const { data, error } = await supabase.rpc("check_team_deactivation", {
    p_team_id: teamId,
  });

  if (error) throw toSeasonError(error);

  const row = (data ?? {}) as RawRecord;

  return {
    allowed: row.allowed === true,
    alreadyInactive: row.already_inactive === true,
    authorized: row.authorized === true,
    blockers: ((row.blockers ?? []) as RawRecord[])
      .map((item) => ({
        canOpen: item.can_open === true,
        count: count(item.count),
        kind: String(item.kind ?? "") as DeactivationBlockerKind,
      }))
      // §25: «Una condizione non riconosciuta dal client non deve essere
      // interpretata come autorizzazione a procedere» — resta nell'elenco
      // come impedimento generico, non viene scartata.
      .filter((item) => item.kind.length > 0),
  };
}

export async function deactivateClubTeam(input: {
  expectedVersion: number;
  idempotencyKey: string;
  teamId: string;
}): Promise<LifecycleResult> {
  const { data, error } = await supabase.rpc("deactivate_club_team", {
    p_expected_version: input.expectedVersion,
    p_idempotency_key: input.idempotencyKey,
    p_team_id: input.teamId,
  });

  if (error) throw toSeasonError(error);

  const row = (data ?? {}) as RawRecord;

  return {
    alreadyApplied: row.already_applied === true,
    isArchived: row.is_archived === true,
    teamId: String(row.team_id ?? input.teamId),
    version: Number(row.version ?? 1),
  };
}

export async function reactivateClubTeam(input: {
  expectedVersion: number;
  idempotencyKey: string;
  levelId: string | null;
  seasonId: string | null;
  teamId: string;
  typeId: string | null;
}): Promise<LifecycleResult & { branch: string | null }> {
  const { data, error } = await supabase.rpc("reactivate_club_team", {
    p_expected_version: input.expectedVersion,
    p_idempotency_key: input.idempotencyKey,
    p_level_id: input.levelId,
    p_season_id: input.seasonId,
    p_team_id: input.teamId,
    p_type_id: input.typeId,
  });

  if (error) throw toSeasonError(error);

  const row = (data ?? {}) as RawRecord;

  return {
    alreadyApplied: row.already_applied === true,
    branch: text(row.branch),
    isArchived: row.is_archived === true,
    teamId: String(row.team_id ?? input.teamId),
    version: Number(row.version ?? 1),
  };
}
