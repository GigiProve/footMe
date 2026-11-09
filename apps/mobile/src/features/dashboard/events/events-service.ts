/**
 * Accesso ai dati degli eventi di selezione (DAS-REV-28 §21).
 *
 * Nessuna regola di autorizzazione vive qui: chi vede il Centro, quali righe
 * rientrano nel perimetro, se si può creare, modificare o pubblicare lo
 * decidono le RPC a ogni chiamata (§7: «Il backend restituisce capability
 * effettive»). Il client rispedisce il cursore senza interpretarlo.
 *
 * Gli errori arrivano come codici stabili (`SELECTION_EVENT_INVALID:a,b`):
 * la copy sta in `events-copy.ts`, perché lo stesso codice compare in
 * superfici diverse (§21: «Errori strutturati per campo e categoria»).
 */
import { supabase } from "../../../lib/supabase";
import {
  DashboardTimeoutError,
  classifyDashboardError,
  suggestsOffline,
} from "../state/error-classification";
import { MODULE_TIMEOUT_MS, withTimeout } from "../state/retry-policy";
import type {
  ConfirmationMode,
  EventDraftValues,
  EventLimits,
  EventSection,
  ParticipationMode,
  SaveResult,
  SelectionEventEditor,
  SelectionEventRow,
  SelectionEventStatus,
  SelectionEventTeam,
  SelectionEventType,
  SelectionEventsCenter,
  SelectionEventsPage,
} from "./events-types";

export type SelectionEventsErrorCode =
  | "SELECTION_EVENTS_NOT_AUTHORIZED"
  | "SELECTION_EVENTS_CURSOR_INVALID"
  | "SELECTION_EVENTS_SECTION_INVALID"
  | "SELECTION_EVENT_NOT_AVAILABLE"
  | "SELECTION_EVENT_NOT_AUTHORIZED"
  | "SELECTION_EVENT_VERSION_CONFLICT"
  | "SELECTION_EVENT_LIFECYCLE_CONFLICT"
  | "SELECTION_EVENT_STRUCTURE_LOCKED"
  | "SELECTION_EVENT_NOT_PUBLISHABLE"
  | "SELECTION_EVENT_INVALID"
  | "OPERATION_CONTENT_CHANGED"
  | "TEAM_NOT_ACTIVE"
  /* DAS-REV-29: iscrizione, ritiro e decisione. */
  | "SELECTION_EVENT_REGISTRATION_CLOSED"
  | "SELECTION_EVENT_REGISTRATION_REJECTED"
  | "SELECTION_EVENT_FULL"
  | "SELECTION_EVENT_NOT_ELIGIBLE"
  | "SELECTION_EVENT_NOT_OPERATIONAL"
  | "SELECTION_EVENT_PARTICIPATION_CHANGED"
  /* DAS-REV-30: sorgente Shortlist revocata, anti-abuso tecnico (§14, §27). */
  | "SHORTLIST_SOURCE_NOT_AVAILABLE"
  /* DAS-REV-31 §15, §17, §18: guard temporali e lifecycle. */
  | "SELECTION_EVENT_NOT_STARTED"
  | "SELECTION_EVENT_STARTED"
  | "SELECTION_EVENT_COMPLETED"
  | "SELECTION_EVENT_CANCELLED"
  | "SELECTION_EVENT_MESSAGE_TOO_LONG"
  | "RATE_LIMIT"
  | "NETWORK"
  | "TIMEOUT"
  | "UNKNOWN";

/* L'ordine conta: il primo codice contenuto nel messaggio vince, e i codici
   più lunghi vanno prima di quelli che ne sono un prefisso. */
const SERVER_CODES: readonly SelectionEventsErrorCode[] = [
  "SELECTION_EVENTS_NOT_AUTHORIZED",
  "SELECTION_EVENTS_CURSOR_INVALID",
  "SELECTION_EVENTS_SECTION_INVALID",
  "SELECTION_EVENT_NOT_AVAILABLE",
  "SELECTION_EVENT_NOT_AUTHORIZED",
  "SELECTION_EVENT_VERSION_CONFLICT",
  "SELECTION_EVENT_LIFECYCLE_CONFLICT",
  "SELECTION_EVENT_STRUCTURE_LOCKED",
  "SELECTION_EVENT_NOT_PUBLISHABLE",
  "SELECTION_EVENT_INVALID",
  "OPERATION_CONTENT_CHANGED",
  "TEAM_NOT_ACTIVE",
  "SELECTION_EVENT_REGISTRATION_CLOSED",
  "SELECTION_EVENT_REGISTRATION_REJECTED",
  "SELECTION_EVENT_FULL",
  "SELECTION_EVENT_NOT_ELIGIBLE",
  "SELECTION_EVENT_NOT_OPERATIONAL",
  "SELECTION_EVENT_PARTICIPATION_CHANGED",
  "SHORTLIST_SOURCE_NOT_AVAILABLE",
  /* «…_NOT_STARTED» non contiene «…_STARTED» come sottostringa: l'ordine fra
     i due non conta. */
  "SELECTION_EVENT_NOT_STARTED",
  "SELECTION_EVENT_STARTED",
  "SELECTION_EVENT_COMPLETED",
  "SELECTION_EVENT_CANCELLED",
  "SELECTION_EVENT_MESSAGE_TOO_LONG",
  "RATE_LIMIT",
] as const;

export class SelectionEventsError extends Error {
  code: SelectionEventsErrorCode;
  /** Codici per campo di INVALID / NOT_PUBLISHABLE (`title_missing`, …). */
  fields: string[];

  constructor(code: SelectionEventsErrorCode, fields: string[] = [], message?: string) {
    super(message ?? code);
    this.code = code;
    this.fields = fields;
    this.name = "SelectionEventsError";
  }

  /** §24: «Non trattare 403 come errore di rete.» */
  get isAuthorization(): boolean {
    return (
      this.code === "SELECTION_EVENTS_NOT_AUTHORIZED" ||
      this.code === "SELECTION_EVENT_NOT_AUTHORIZED" ||
      this.code === "SELECTION_EVENT_NOT_AVAILABLE"
    );
  }

  /** Esito sconosciuto: la richiesta può essere arrivata (§13, §19). */
  get isTransport(): boolean {
    return this.code === "NETWORK" || this.code === "TIMEOUT";
  }
}

function messageOf(error: unknown): string {
  return typeof error === "object" && error !== null && "message" in error
    ? String((error as { message: unknown }).message)
    : String(error ?? "");
}

export function toSelectionEventsError(error: unknown): SelectionEventsError {
  if (error instanceof SelectionEventsError) {
    return error;
  }

  if (error instanceof DashboardTimeoutError) {
    return new SelectionEventsError("TIMEOUT");
  }

  const message = messageOf(error);
  const code = SERVER_CODES.find((candidate) => message.includes(candidate));

  if (code) {
    const fields =
      code === "SELECTION_EVENT_INVALID" || code === "SELECTION_EVENT_NOT_PUBLISHABLE"
        ? (message.split(`${code}:`)[1] ?? "")
            .split(/[,\s]/)
            .map((entry) => entry.trim())
            .filter((entry) => /^[a-z_]+$/.test(entry))
        : code === "SELECTION_EVENT_STRUCTURE_LOCKED"
          ? ["structure_locked"]
          : code === "TEAM_NOT_ACTIVE"
            ? ["team_inactive"]
            : [];

    return new SelectionEventsError(code, fields, message);
  }

  const category = classifyDashboardError(error);

  if (category === "timeout") {
    return new SelectionEventsError("TIMEOUT", [], message);
  }

  if (suggestsOffline(category)) {
    return new SelectionEventsError("NETWORK", [], message);
  }

  return new SelectionEventsError("UNKNOWN", [], message);
}

type RawRecord = Record<string, unknown>;

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function bool(value: unknown): boolean {
  return value === true;
}

function int(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    return Number(value);
  }

  return null;
}

/** `HH:MM:SS` del server → `HH:MM` del form. */
function hm(value: unknown): string | null {
  const raw = text(value);

  return raw && /^\d{2}:\d{2}/.test(raw) ? raw.slice(0, 5) : null;
}

function civil(value: unknown): string | null {
  const raw = text(value);

  return raw && /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : null;
}

function eventType(value: unknown): SelectionEventType | null {
  return value === "tryout" || value === "stage" || value === "open_day"
    ? value
    : null;
}

function status(value: unknown): SelectionEventStatus {
  return value === "published" || value === "completed" || value === "cancelled"
    ? value
    : "draft";
}

function participation(value: unknown): ParticipationMode | null {
  return value === "open_registration" || value === "invite_only" ? value : null;
}

function confirmation(value: unknown): ConfirmationMode | null {
  return value === "automatic" || value === "manual" ? value : null;
}

const DEFAULT_LIMITS: EventLimits = {
  birthYearMax: new Date().getFullYear(),
  birthYearMin: 1900,
  decisionMessage: 500,
  description: 2000,
  flyerMaxBytes: 8388608,
  flyerMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  maxParticipants: 10000,
  requirements: 1000,
  title: 120,
  venueAddress: 200,
  venueName: 120,
};

export function mapLimits(value: unknown): EventLimits {
  const raw = (value && typeof value === "object" ? value : {}) as RawRecord;
  const read = (key: Exclude<keyof EventLimits, "flyerMimeTypes">) =>
    int(raw[key]) ?? DEFAULT_LIMITS[key];
  const mimes = Array.isArray(raw.flyerMimeTypes)
    ? raw.flyerMimeTypes.filter((entry): entry is string => typeof entry === "string")
    : [];

  return {
    birthYearMax: read("birthYearMax"),
    birthYearMin: read("birthYearMin"),
    decisionMessage: read("decisionMessage"),
    description: read("description"),
    flyerMaxBytes: read("flyerMaxBytes"),
    flyerMimeTypes: mimes.length > 0 ? mimes : DEFAULT_LIMITS.flyerMimeTypes,
    maxParticipants: read("maxParticipants"),
    requirements: read("requirements"),
    title: read("title"),
    venueAddress: read("venueAddress"),
    venueName: read("venueName"),
  };
}

/** Esportata per i sottoflussi (dettaglio, richieste): stesso timeout, stessa classificazione. */
export async function selectionEventsRpc<T>(name: string, params: Record<string, unknown>): Promise<T> {
  let result: { data: unknown; error: unknown };

  try {
    result = await withTimeout(
      supabase.rpc(name, params) as unknown as Promise<{ data: unknown; error: unknown }>,
      MODULE_TIMEOUT_MS,
      () => new DashboardTimeoutError(name),
    );
  } catch (error) {
    throw toSelectionEventsError(error);
  }

  if (result.error) {
    throw toSelectionEventsError(result.error);
  }

  return result.data as T;
}

// ── Centro ──────────────────────────────────────────────────────────────────

export function mapCenter(row: RawRecord | null | undefined, clubId: string): SelectionEventsCenter {
  if (!row) {
    throw new SelectionEventsError("SELECTION_EVENTS_NOT_AUTHORIZED");
  }

  return {
    accessVerifiedAt: row.access_verified_at
      ? new Date(String(row.access_verified_at)).getTime()
      : Date.now(),
    canCreate: bool(row.can_create),
    clubId: text(row.club_id) ?? clubId,
    clubIsVerified: bool(row.club_is_verified),
    clubLogoUrl: text(row.club_logo_url),
    clubName: text(row.club_name) ?? "",
    limits: mapLimits(row.limits),
    scopeLabel: text(row.scope_label),
    timezone: text(row.timezone_name) ?? "Europe/Rome",
  };
}

export async function fetchSelectionEventsCenter(clubId: string): Promise<SelectionEventsCenter> {
  const rows = await selectionEventsRpc<RawRecord[]>("fetch_selection_events_center", {
    p_club_id: clubId,
  });

  return mapCenter(Array.isArray(rows) ? rows[0] : null, clubId);
}

export function mapRow(row: RawRecord): SelectionEventRow | null {
  const id = text(row.event_id);
  const teamId = text(row.team_id);

  if (!id || !teamId) {
    return null;
  }

  return {
    canEdit: bool(row.can_edit),
    confirmedCount: int(row.confirmed_count),
    countsAvailable: bool(row.counts_available),
    eventType: eventType(row.event_type),
    id,
    isFull: bool(row.is_full),
    maxParticipants: int(row.max_participants),
    pendingRequestsCount: int(row.pending_requests_count),
    startDate: civil(row.start_date),
    startTime: hm(row.start_time),
    status: status(row.status),
    teamId,
    teamName: text(row.team_name) ?? "",
    timezone: text(row.timezone_name) ?? "Europe/Rome",
    title: text(row.title),
    updatedAt: text(row.updated_at),
  };
}

/** Prima pagina di una sezione: abbastanza per vedere le tre sezioni (§12). */
export const SECTION_PAGE_SIZE = 10;

export async function fetchSelectionEventsPage(input: {
  clubId: string;
  cursor?: string | null;
  limit?: number;
  section: EventSection;
}): Promise<SelectionEventsPage> {
  const rows = await selectionEventsRpc<RawRecord[]>("fetch_selection_events_page", {
    p_club_id: input.clubId,
    p_cursor: input.cursor ?? null,
    p_limit: input.limit ?? SECTION_PAGE_SIZE,
    p_section: input.section,
  });

  const list = Array.isArray(rows) ? rows : [];
  const last = list[list.length - 1];

  return {
    /* Il server legge una riga in più e lo dice: non si deduce la fine da
       una pagina piena (§12). */
    hasMore: last ? bool(last.has_more) : false,
    nextCursor: last ? text(last.next_cursor) : null,
    rows: list.map(mapRow).filter((row): row is SelectionEventRow => row !== null),
  };
}

export async function fetchSelectionEventTeams(clubId: string): Promise<SelectionEventTeam[]> {
  const rows = await selectionEventsRpc<RawRecord[]>("fetch_selection_event_teams", {
    p_club_id: clubId,
  });

  return (Array.isArray(rows) ? rows : []).flatMap((row) => {
    const id = text(row.team_id);

    return id
      ? [
          {
            canCreate: bool(row.can_create),
            canEdit: bool(row.can_edit),
            contextLabel: text(row.context_label),
            id,
            name: text(row.team_name) ?? "",
          },
        ]
      : [];
  });
}

// ── Editor ──────────────────────────────────────────────────────────────────

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function mapEditor(row: RawRecord | null | undefined): SelectionEventEditor {
  const id = row ? text(row.event_id) : null;

  if (!row || !id) {
    throw new SelectionEventsError("SELECTION_EVENT_NOT_AVAILABLE");
  }

  const yearFrom = int(row.birth_year_from);
  const yearTo = int(row.birth_year_to);
  const capacity = int(row.max_participants);

  const flyerId = text(row.flyer_media_id);
  const flyerPath = text(row.flyer_path);

  return {
    canEdit: bool(row.can_edit),
    canPublish: bool(row.can_publish),
    clubId: text(row.club_id) ?? "",
    confirmedCount: int(row.confirmed_count),
    /* DAS-REV-29 §8: la locandina salvata, con le dimensioni per riservare
       lo spazio dell'anteprima. */
    flyer:
      flyerId && flyerPath
        ? {
            height: int(row.flyer_height),
            id: flyerId,
            path: flyerPath,
            width: int(row.flyer_width),
          }
        : null,
    hasActivity: bool(row.has_activity),
    id,
    status: status(row.status),
    teamIsArchived: bool(row.team_is_archived),
    teamName: text(row.team_name) ?? "",
    timezone: text(row.timezone_name) ?? "Europe/Rome",
    values: {
      birthYearFrom: yearFrom === null ? "" : String(yearFrom),
      birthYearTo: yearTo === null ? "" : String(yearTo),
      confirmationMode: confirmation(row.registration_confirmation_mode),
      deadlineDate: civil(row.registration_deadline_date),
      deadlineTime: hm(row.registration_deadline_time),
      description: asText(row.description),
      endTime: hm(row.end_time),
      eventType: eventType(row.event_type),
      maxParticipants: capacity === null ? "" : String(capacity),
      participationMode: participation(row.participation_mode),
      requirements: asText(row.requirements_info),
      startDate: civil(row.start_date),
      startTime: hm(row.start_time),
      teamId: text(row.team_id),
      title: asText(row.title),
      venueAddress: asText(row.venue_address),
      venueName: asText(row.venue_name),
      flyerMediaId: text(row.flyer_media_id),
    },
    version: int(row.version) ?? 1,
  };
}

export async function fetchSelectionEventEditor(eventId: string): Promise<SelectionEventEditor> {
  const rows = await selectionEventsRpc<RawRecord[]>("fetch_selection_event_editor", {
    p_event_id: eventId,
  });

  return mapEditor(Array.isArray(rows) ? rows[0] : null);
}

// ── Comandi ─────────────────────────────────────────────────────────────────

function mapSave(rows: RawRecord[] | null): SaveResult {
  const row = Array.isArray(rows) ? rows[0] : null;
  const eventId = row ? text(row.event_id) : null;

  if (!row || !eventId) {
    throw new SelectionEventsError("UNKNOWN");
  }

  return {
    eventId,
    replayed: bool(row.replayed),
    status: status(row.status),
    version: int(row.version) ?? 1,
  };
}

/**
 * Salva bozza (§13). `eventId` null crea; altrimenti aggiorna la stessa
 * bozza con la versione letta. `patch` contiene **solo** i campi da scrivere
 * (§20: le patch parziali non cancellano ciò che non è stato toccato).
 */
export async function saveSelectionEventDraft(input: {
  clubId: string;
  eventId: string | null;
  expectedVersion: number | null;
  idempotencyKey: string;
  patch: Record<string, unknown>;
}): Promise<SaveResult> {
  const rows = await selectionEventsRpc<RawRecord[]>("save_selection_event_draft", {
    p_club_id: input.clubId,
    p_event_id: input.eventId,
    p_expected_version: input.expectedVersion,
    p_idempotency_key: input.idempotencyKey,
    p_patch: input.patch,
  });

  return mapSave(rows);
}

/** Pubblica evento (§19): comando esplicito, mai una patch di stato. */
export async function publishSelectionEvent(input: {
  eventId: string;
  expectedVersion: number;
  idempotencyKey: string;
}): Promise<SaveResult> {
  const rows = await selectionEventsRpc<RawRecord[]>("publish_selection_event", {
    p_event_id: input.eventId,
    p_expected_version: input.expectedVersion,
    p_idempotency_key: input.idempotencyKey,
  });

  return mapSave(rows);
}

/** Valori del form, così come il server li ha (per il diff della patch). */
export type ServerValues = EventDraftValues;

/**
 * Modifica di un evento PUBLISHED (DAS-REV-29 §8, screen 02): lo stesso
 * comando che la 28 ha preparato per il dettaglio, con i suoi guard di
 * attività e capienza. Non pubblica e non cambia stato.
 */
export async function updateSelectionEvent(input: {
  eventId: string;
  expectedVersion: number;
  idempotencyKey: string;
  patch: Record<string, unknown>;
}): Promise<SaveResult> {
  const rows = await selectionEventsRpc<RawRecord[]>("update_selection_event", {
    p_event_id: input.eventId,
    p_expected_version: input.expectedVersion,
    p_idempotency_key: input.idempotencyKey,
    p_patch: input.patch,
  });

  return mapSave(rows);
}
