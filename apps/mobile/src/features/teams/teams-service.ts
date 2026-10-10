/**
 * Accesso ai dati del Centro Squadre (DAS-REV-08).
 *
 * Nessuna regola di dominio vive qui: le capability, il perimetro, la
 * stagione corrente, i duplicati e le versioni attese sono decisi dal
 * backend (§25, «il server deriva l'actor dalla sessione e non considera
 * attendibili capability o ownership dichiarate dal client»). Questo file
 * traduce soltanto le righe in tipi e gli errori in codici.
 */
import { supabase } from "../../lib/supabase";

export type TeamsCenterHeader = {
  accessVerifiedAt: number;
  canCreate: boolean;
  canView: boolean;
  canViewCounts: boolean;
  clubCity: string | null;
  clubId: string;
  clubIsVerified: boolean;
  clubLogoUrl: string | null;
  clubName: string | null;
  clubRegion: string | null;
  dataRevision: number;
  /** Squadre non attive consultabili: il Centro non le elenca (§8). */
  inactiveCount: number | null;
  scopeLabel: string | null;
  seasonId: string | null;
  seasonLabel: string | null;
  /** `null` = non consultabile. Mai convertito in zero (§25). */
  totalCount: number | null;
};

export type TeamsCenterRow = {
  canEdit: boolean;
  countsAvailable: boolean;
  crestInherited: boolean;
  crestUrl: string | null;
  hasSeasonConfig: boolean;
  levelId: string | null;
  levelLabel: string | null;
  name: string;
  playersCount: number | null;
  sortKey: string;
  staffCount: number | null;
  teamId: string;
  typeId: string | null;
  typeLabel: string | null;
};

export type TeamsCenterPage = {
  items: TeamsCenterRow[];
  nextCursor: string | null;
};

export type TeamEditorPayload = {
  canEdit: boolean;
  city: string | null;
  cityMode: TeamInheritanceMode;
  clubCity: string | null;
  clubId: string;
  clubIsVerified: boolean;
  clubLogoUrl: string | null;
  clubName: string;
  clubRegion: string | null;
  crestMode: TeamInheritanceMode;
  crestUrl: string | null;
  levelId: string | null;
  levelLabel: string | null;
  name: string;
  province: string | null;
  region: string | null;
  seasonConfigId: string | null;
  seasonId: string | null;
  seasonLabel: string | null;
  seasonVersion: number | null;
  teamId: string;
  teamVersion: number;
  typeId: string | null;
  typeLabel: string | null;
};

export type TeamInheritanceMode = "inherited" | "custom";

export type TaxonomyOption = {
  id: string;
  isActive?: boolean;
  label: string;
};

export type DuplicateCandidate = {
  crestUrl: string | null;
  id: string;
  levelLabel: string | null;
  name: string;
  typeLabel: string | null;
};

export type DuplicateVerdict = {
  candidates: DuplicateCandidate[];
  confirmationToken: string | null;
  verdict: "clear" | "warning" | "conflict";
};

/**
 * Codici applicativi sollevati dalle RPC. Sono stringhe stabili e non
 * messaggi: la copy di §24 vive nel presentation layer, in italiano, e il
 * database non deve conoscerla.
 */
export type TeamErrorCode =
  | "TEAM_ASSET_INVALID"
  | "TEAM_CITY_INVALID"
  | "TEAM_CITY_MODE_INVALID"
  | "TEAM_CONFIRMATION_REQUIRED"
  | "TEAM_CONFIRMATION_STALE"
  | "TEAM_CREST_MODE_INVALID"
  | "TEAM_DUPLICATE_CONFLICT"
  | "TEAM_LEVEL_INCOMPATIBLE"
  | "TEAM_LEVEL_REPORT_INVALID"
  | "TEAM_NAME_INVALID"
  | "TEAM_NOT_AUTHORIZED"
  | "TEAM_NOT_FOUND"
  | "TEAM_NO_SEASON_CONFIG"
  | "TEAM_SEASON_CHANGED"
  | "TEAM_SEASON_UNAVAILABLE"
  | "TEAM_TYPE_INVALID"
  | "TEAM_VERSION_CONFLICT"
  | "RATE_LIMIT"
  | "UNKNOWN";

export class TeamOperationError extends Error {
  code: TeamErrorCode;

  constructor(code: TeamErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = "TeamOperationError";
  }
}

const KNOWN_CODES: TeamErrorCode[] = [
  "TEAM_ASSET_INVALID",
  "TEAM_CITY_INVALID",
  "TEAM_CITY_MODE_INVALID",
  "TEAM_CONFIRMATION_REQUIRED",
  "TEAM_CONFIRMATION_STALE",
  "TEAM_CREST_MODE_INVALID",
  "TEAM_DUPLICATE_CONFLICT",
  "TEAM_LEVEL_INCOMPATIBLE",
  "TEAM_LEVEL_REPORT_INVALID",
  "TEAM_NAME_INVALID",
  "TEAM_NOT_AUTHORIZED",
  "TEAM_NOT_FOUND",
  "TEAM_NO_SEASON_CONFIG",
  "TEAM_SEASON_CHANGED",
  "TEAM_SEASON_UNAVAILABLE",
  "TEAM_TYPE_INVALID",
  "TEAM_VERSION_CONFLICT",
  "RATE_LIMIT",
];

export function toTeamError(error: unknown): TeamOperationError {
  if (error instanceof TeamOperationError) {
    return error;
  }

  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error ?? "");

  const match = KNOWN_CODES.find((code) => message.includes(code));

  return new TeamOperationError(match ?? "UNKNOWN", message);
}

type RawRecord = Record<string, unknown>;

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function count(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

export async function fetchTeamsCenter(
  clubId: string,
): Promise<TeamsCenterHeader> {
  const { data, error } = await supabase
    .rpc("fetch_teams_center", { p_club_id: clubId })
    .maybeSingle();

  if (error) throw toTeamError(error);

  const row = (data ?? {}) as RawRecord;

  return {
    accessVerifiedAt: row.access_verified_at
      ? new Date(String(row.access_verified_at)).getTime()
      : Date.now(),
    canCreate: row.can_create === true,
    canView: row.can_view === true,
    canViewCounts: row.can_view_counts === true,
    clubCity: text(row.club_city),
    clubId,
    clubIsVerified: row.club_is_verified === true,
    clubLogoUrl: text(row.club_logo_url),
    clubName: text(row.club_name),
    clubRegion: text(row.club_region),
    dataRevision: Number(row.data_revision ?? 0),
    inactiveCount: count(row.inactive_count),
    scopeLabel: text(row.scope_label),
    seasonId: text(row.season_id),
    seasonLabel: text(row.season_label),
    totalCount: count(row.total_count),
  };
}

export async function fetchTeamsCenterPage(
  clubId: string,
  cursor: string | null,
  limit = 20,
): Promise<TeamsCenterPage> {
  const { data, error } = await supabase.rpc("fetch_teams_center_page", {
    p_club_id: clubId,
    p_cursor: cursor,
    p_limit: limit,
  });

  if (error) throw toTeamError(error);

  const items = ((data ?? []) as RawRecord[]).map(
    (row): TeamsCenterRow => ({
      canEdit: row.can_edit === true,
      countsAvailable: row.counts_available === true,
      crestInherited: row.crest_inherited === true,
      crestUrl: text(row.crest_url),
      hasSeasonConfig: row.has_season_config === true,
      levelId: text(row.level_id),
      levelLabel: text(row.level_label),
      name: String(row.name ?? ""),
      playersCount: count(row.players_count),
      sortKey: String(row.sort_key ?? ""),
      staffCount: count(row.staff_count),
      teamId: String(row.team_id ?? ""),
      typeId: text(row.type_id),
      typeLabel: text(row.type_label),
    }),
  );

  return {
    items,
    // Una pagina piena non prova che ce ne siano altre, ma chiedere una
    // pagina vuota costa meno di non poter scorrere: il cursore si ferma da
    // solo alla prima risposta corta.
    nextCursor:
      items.length === limit ? (items[items.length - 1]?.sortKey ?? null) : null,
  };
}

export async function fetchTeamEditor(
  teamId: string,
): Promise<TeamEditorPayload> {
  const { data, error } = await supabase
    .rpc("fetch_team_editor", { p_team_id: teamId })
    .maybeSingle();

  if (error) throw toTeamError(error);

  if (!data) {
    throw new TeamOperationError("TEAM_NOT_FOUND");
  }

  const row = data as RawRecord;

  return {
    canEdit: row.can_edit === true,
    city: text(row.city),
    cityMode: row.city_mode === "custom" ? "custom" : "inherited",
    clubCity: text(row.club_city),
    clubId: String(row.club_id ?? ""),
    clubIsVerified: row.club_is_verified === true,
    clubLogoUrl: text(row.club_logo_url),
    clubName: String(row.club_name ?? ""),
    clubRegion: text(row.club_region),
    crestMode: row.crest_mode === "custom" ? "custom" : "inherited",
    crestUrl: text(row.crest_url),
    levelId: text(row.level_id),
    levelLabel: text(row.level_label),
    name: String(row.name ?? ""),
    province: text(row.province),
    region: text(row.region),
    seasonConfigId: text(row.season_config_id),
    seasonId: text(row.season_id),
    seasonLabel: text(row.season_label),
    seasonVersion: count(row.season_version),
    teamId: String(row.team_id ?? ""),
    teamVersion: Number(row.team_version ?? 0),
    typeId: text(row.type_id),
    typeLabel: text(row.type_label),
  };
}

export async function fetchTeamTypeOptions(): Promise<TaxonomyOption[]> {
  const { data, error } = await supabase.rpc("fetch_team_type_options");

  if (error) throw toTeamError(error);

  return ((data ?? []) as RawRecord[]).map((row) => ({
    id: String(row.id ?? ""),
    label: String(row.label ?? ""),
  }));
}

export async function fetchTeamLevelOptions(
  typeId: string,
  seasonId: string | null,
  query: string | null,
): Promise<TaxonomyOption[]> {
  const { data, error } = await supabase.rpc("fetch_team_level_options", {
    p_query: query && query.trim().length > 0 ? query.trim() : null,
    p_season_id: seasonId,
    p_type_id: typeId,
  });

  if (error) throw toTeamError(error);

  return ((data ?? []) as RawRecord[]).map((row) => ({
    id: String(row.id ?? ""),
    isActive: row.is_active !== false,
    label: String(row.label ?? ""),
  }));
}

export async function checkTeamDuplicates(input: {
  clubId: string;
  levelId: string | null;
  name: string;
  teamId?: string | null;
  typeId: string;
}): Promise<DuplicateVerdict> {
  const { data, error } = await supabase
    .rpc("check_club_team_duplicates", {
      p_club_id: input.clubId,
      p_level_id: input.levelId,
      p_name: input.name,
      p_team_id: input.teamId ?? null,
      p_type_id: input.typeId,
    })
    .maybeSingle();

  if (error) throw toTeamError(error);

  const row = (data ?? {}) as RawRecord;
  const rawCandidates = Array.isArray(row.candidates)
    ? (row.candidates as RawRecord[])
    : [];

  return {
    candidates: rawCandidates.map((candidate) => ({
      crestUrl: text(candidate.crest_url),
      id: String(candidate.id ?? ""),
      levelLabel: text(candidate.level_label),
      name: String(candidate.name ?? ""),
      typeLabel: text(candidate.type_label),
    })),
    confirmationToken: text(row.confirmation_token),
    verdict:
      row.verdict === "conflict"
        ? "conflict"
        : row.verdict === "warning"
          ? "warning"
          : "clear",
  };
}

export type CreateTeamInput = {
  city: string | null;
  cityMode: TeamInheritanceMode;
  clubId: string;
  confirmationToken: string | null;
  crestMode: TeamInheritanceMode;
  crestUrl: string | null;
  idempotencyKey: string;
  levelId: string | null;
  name: string;
  region: string | null;
  seasonId: string | null;
  typeId: string;
};

export async function createClubTeam(
  input: CreateTeamInput,
): Promise<{ created: boolean; teamId: string }> {
  const { data, error } = await supabase
    .rpc("create_club_team", {
      p_city: input.city,
      p_city_mode: input.cityMode,
      p_club_id: input.clubId,
      p_confirmation: input.confirmationToken,
      p_crest_mode: input.crestMode,
      p_crest_url: input.crestUrl,
      p_idempotency_key: input.idempotencyKey,
      p_level_id: input.levelId,
      p_name: input.name,
      p_region: input.region,
      p_season_id: input.seasonId,
      p_type_id: input.typeId,
    })
    .maybeSingle();

  if (error) throw toTeamError(error);

  const row = (data ?? {}) as RawRecord;

  return {
    created: row.created === true,
    teamId: String(row.team_id ?? ""),
  };
}

/**
 * Patch parziale: solo le chiavi presenti vengono scritte (§22). Un campo
 * assente non è un campo svuotato, e `level_id: null` — chiave presente con
 * valore nullo — è la rimozione esplicita del campionato.
 */
export type TeamPatch = Partial<{
  city: string | null;
  city_mode: TeamInheritanceMode;
  crest_mode: TeamInheritanceMode;
  crest_url: string | null;
  level_id: string | null;
  name: string;
  region: string | null;
  type_id: string;
}>;

export async function updateClubTeam(input: {
  confirmationToken?: string | null;
  expectedSeasonVersion: number | null;
  expectedTeamVersion: number;
  patch: TeamPatch;
  seasonId: string | null;
  teamId: string;
}): Promise<{ seasonVersion: number | null; teamVersion: number }> {
  const { data, error } = await supabase
    .rpc("update_club_team", {
      p_confirmation: input.confirmationToken ?? null,
      p_expected_season_version: input.expectedSeasonVersion,
      p_expected_team_version: input.expectedTeamVersion,
      p_patch: input.patch,
      p_season_id: input.seasonId,
      p_team_id: input.teamId,
    })
    .maybeSingle();

  if (error) throw toTeamError(error);

  const row = (data ?? {}) as RawRecord;

  return {
    seasonVersion: count(row.season_version),
    teamVersion: Number(row.team_version ?? 0),
  };
}

export async function reportMissingTeamLevel(input: {
  clubId: string;
  proposedLabel: string;
  teamId?: string | null;
  typeId: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("report_missing_team_level", {
    p_club_id: input.clubId,
    p_proposed: input.proposedLabel,
    p_team_id: input.teamId ?? null,
    p_type_id: input.typeId,
  });

  if (error) throw toTeamError(error);

  return String(data ?? "");
}
