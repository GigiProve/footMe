/**
 * Accesso ai dati del Centro Posizioni aperte (DAS-REV-15 §22, §23).
 *
 * Nessuna regola di autorizzazione vive qui. Chi può consultare il Centro,
 * quali righe rientrano nel perimetro, se i conteggi Candidature sono
 * leggibili e quali opzioni di filtro esistono lo decidono le RPC, che
 * risolvono capability e scope server-side a ogni chiamata (§9 — «capability
 * e scope vengono risolti server-side e non sono trusted input del client»).
 *
 * Il cursore è opaco per costruzione: il client lo rispedisce e non lo
 * interpreta. Un token di un'altra Society, tab o filtro viene rifiutato dal
 * server, non dal chiamante.
 */
import { supabase } from "../../../lib/supabase";
import { DashboardTimeoutError } from "../state/error-classification";
import { MODULE_TIMEOUT_MS, withTimeout } from "../state/retry-policy";
import type {
  PositionFilter,
  PositionFilterOption,
  PositionGroup,
  PositionRow,
  PositionsCenter,
  PositionsPage,
} from "./positions-types";

/**
 * Codici applicativi sollevati dalle RPC. Stringhe stabili, non messaggi:
 * §26 tiene la copy nella presentazione, perché lo stesso codice compare in
 * superfici diverse con parole diverse.
 */
export type PositionsErrorCode =
  | "POSITIONS_CENTER_NOT_AUTHORIZED"
  | "POSITIONS_CURSOR_INVALID"
  | "POSITIONS_FILTER_INVALID"
  | "POSITIONS_FILTER_NOT_AUTHORIZED"
  | "POSITIONS_GROUP_INVALID"
  | "POSITION_NOT_AVAILABLE"
  | "UNKNOWN";

const ERROR_CODES: readonly PositionsErrorCode[] = [
  "POSITIONS_CENTER_NOT_AUTHORIZED",
  "POSITIONS_CURSOR_INVALID",
  "POSITIONS_FILTER_INVALID",
  "POSITIONS_FILTER_NOT_AUTHORIZED",
  "POSITIONS_GROUP_INVALID",
  "POSITION_NOT_AVAILABLE",
] as const;

export class PositionsAccessError extends Error {
  code: PositionsErrorCode;

  constructor(code: PositionsErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = "PositionsAccessError";
  }
}

export function toPositionsError(error: unknown): PositionsAccessError {
  if (error instanceof PositionsAccessError) {
    return error;
  }

  /* Un timeout non è un rifiuto autorizzativo: §26 chiede di ritentare il
     primo e vieta di ripetere all'infinito il secondo. */
  if (error instanceof DashboardTimeoutError) {
    throw error;
  }

  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error ?? "");

  const matched = ERROR_CODES.find((code) => message.includes(code));

  return new PositionsAccessError(matched ?? "UNKNOWN", message);
}

type RawRecord = Record<string, unknown>;

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function bool(value: unknown): boolean {
  return value === true;
}

/** `null` resta `null` (§10): un aggregato non leggibile non è uno zero. */
function count(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    return Number(value);
  }

  return null;
}

async function rpc<T>(
  name: string,
  params: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await withTimeout(
    supabase.rpc(name, params),
    MODULE_TIMEOUT_MS,
    () => new DashboardTimeoutError(name),
  );

  if (error) {
    throw toPositionsError(error);
  }

  return data as T;
}

// ── Intestazione ────────────────────────────────────────────────────────────

export async function fetchPositionsCenter(
  clubId: string,
): Promise<PositionsCenter> {
  const rows = await rpc<RawRecord[]>("fetch_society_positions_center", {
    p_club_id: clubId,
  });

  const row = Array.isArray(rows) ? rows[0] : null;

  if (!row) {
    throw new PositionsAccessError("POSITIONS_CENTER_NOT_AUTHORIZED");
  }

  return {
    accessVerifiedAt: row.access_verified_at
      ? new Date(String(row.access_verified_at)).getTime()
      : Date.now(),
    canCreate: bool(row.can_create),
    canViewCounts: bool(row.can_view_counts),
    clubId: text(row.club_id) ?? clubId,
    clubIsVerified: bool(row.club_is_verified),
    clubLogoUrl: text(row.club_logo_url),
    clubName: text(row.club_name) ?? "",
    countsScopeAll: bool(row.counts_scope_all),
    dataRevision: count(row.data_revision) ?? 0,
    scopeLabel: text(row.scope_label),
  };
}

// ── Opzioni del filtro ──────────────────────────────────────────────────────

/**
 * §14: «Le opzioni non dipendono solo dalla prima pagina caricata.» Vengono
 * da una lettura propria, con il perimetro della tab corrente.
 *
 * `all` non arriva dal server ma viene anteposta qui: è un'opzione costante
 * della consultazione, e farla dipendere dalla rete significherebbe poterla
 * perdere con un errore.
 */
export async function fetchPositionFilterOptions(input: {
  clubId: string;
  group: PositionGroup;
}): Promise<PositionFilterOption[]> {
  const rows = await rpc<RawRecord[]>("fetch_society_position_filters", {
    p_club_id: input.clubId,
    p_group: input.group,
  });

  const options: PositionFilterOption[] = [];

  for (const row of Array.isArray(rows) ? rows : []) {
    const kind = text(row.option_kind);

    if (kind === "society") {
      options.push({ kind: "society" });
      continue;
    }

    const teamId = text(row.team_id);

    if (kind === "team" && teamId) {
      options.push({
        isInactive: bool(row.is_inactive),
        kind: "team",
        label: text(row.label) ?? "",
        teamId,
      });
    }
  }

  /* Con un solo contesto effettivo la riga «Tutte le posizioni» non ha senso:
     §14 chiede testo in chiaro, non un dropdown con una sola voce. */
  return options.length > 1
    ? [{ kind: "all" } as PositionFilterOption, ...options]
    : options;
}

// ── Pagina ──────────────────────────────────────────────────────────────────

function mapRow(row: RawRecord): PositionRow | null {
  const id = text(row.position_id);

  if (!id) {
    return null;
  }

  return {
    applicationsNew: count(row.applications_new),
    applicationsTotal: count(row.applications_total),
    closedAt: text(row.closed_at),
    contextLabel: text(row.context_label),
    countsAvailable: bool(row.counts_available),
    id,
    publishedAt: text(row.published_at),
    receivingClosed: bool(row.receiving_closed),
    roleRequired: text(row.role_required),
    scope: text(row.position_scope) === "society" ? "society" : "team",
    seasonLabel: text(row.season_label),
    sortKey: text(row.sort_key) ?? "",
    status: text(row.status) ?? "",
    targetRole: text(row.target_role),
    teamId: text(row.team_id),
    teamIsInactive: bool(row.team_is_inactive),
    teamName: text(row.team_name),
    title: text(row.title),
    updatedAt: text(row.updated_at),
  };
}

export const POSITIONS_PAGE_SIZE = 20;

export async function fetchPositionsPage(input: {
  clubId: string;
  cursor?: string | null;
  filter: PositionFilter;
  group: PositionGroup;
  limit?: number;
}): Promise<PositionsPage> {
  const limit = input.limit ?? POSITIONS_PAGE_SIZE;

  const rows = await rpc<RawRecord[]>("fetch_society_positions_page", {
    p_club_id: input.clubId,
    p_cursor: input.cursor ?? null,
    p_group: input.group,
    p_limit: limit,
    p_scope: input.filter.kind,
    p_team_id: input.filter.kind === "team" ? input.filter.teamId : null,
  });

  const list = Array.isArray(rows) ? rows : [];
  const mapped = list
    .map(mapRow)
    .filter((row): row is PositionRow => row !== null);

  const last = list[list.length - 1];

  return {
    asOf: last ? text(last.as_of) : null,
    /* Una pagina piena **può** avere un seguito; una pagina corta no. §16
       vieta di dedurre la fine dall'assenza di un cursore, che il server
       emette su ogni riga. */
    hasMore: list.length >= limit,
    nextCursor: last ? text(last.next_cursor) : null,
    rows: mapped,
  };
}
