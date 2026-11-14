/**
 * Accesso ai dati di bozze, programmazione e lifecycle (HOM-06.2 §116–§202).
 *
 * Una RPC per intenzione, nessuna tabella letta dal client (§258–§259): le
 * righe in bozza/programmate/fallite sono chiuse a PostgREST e si leggono solo
 * da qui, con accesso rivalidato dal server. Chi non ha accesso riceve
 * `content_not_found`, identico a «non esiste» (IDOR, §259).
 *
 * Un solo scheduler e una sola lista per Post e Articolo (§83, §169, §7V, §7W):
 * il composer Post e l'editor Articolo chiamano queste stesse funzioni.
 */

import type { FeedContentType } from "../feed/feed-types";
import { supabase } from "../../lib/supabase";
import {
  PUBLISHING_ERROR_CODES,
  type ContentFormat,
  type ContentLauncherState,
  type ContentRef,
  type DraftListItem,
  type DraftListPage,
  type DraftsTab,
  type Publication,
  type PublishingError,
  type PublishingErrorCode,
  type SchedulePolicy,
  type WireContentLauncher,
  type WireContentRef,
  type WireDraftListItem,
  type WireDraftListPage,
  type WireLifecycleResult,
  type WireSaveDraftResult,
  type WireSchedulePolicy,
  type WireSubmitResult,
} from "./publishing-types";
import { toWirePublication } from "./publishing-presentation";

/* ------------------------------------------------------------------ */
/* Mappers                                                             */
/* ------------------------------------------------------------------ */

function unwrapRow<T>(data: unknown): T | null {
  const row = Array.isArray(data) ? data[0] : data;
  return typeof row === "object" && row !== null ? (row as T) : null;
}

export function toWireRef(ref: ContentRef | null): WireContentRef | null {
  return ref ? { content_id: ref.contentId, content_type: ref.contentType } : null;
}

// `toWirePublication` vive in publishing-presentation (pura); riesportata per i chiamanti esistenti.
export { toWirePublication };

/** Dal jsonb `{mode, scheduled_at, timezone}` di una bozza riaperta (§123: publication setting). */
export function fromWirePublication(
  wire: { mode?: string | null; scheduled_at?: string | null; timezone?: string | null } | null | undefined,
): Publication {
  if (wire?.mode === "scheduled" && wire.scheduled_at) {
    return { mode: "scheduled", scheduledAt: wire.scheduled_at, timezone: wire.timezone ?? "UTC" };
  }
  return { mode: "now" };
}

export function mapSchedulePolicy(wire: WireSchedulePolicy | null | undefined): SchedulePolicy {
  return {
    maxHorizonDays: wire?.max_horizon_days ?? 365,
    minLeadMinutes: wire?.min_lead_minutes ?? 5,
  };
}

export function mapLauncher(wire: WireContentLauncher): ContentLauncherState {
  return {
    canPublishArticle: wire.can_publish_article === true,
    canPublishPost: wire.can_publish_post === true,
    canViewDrafts: wire.can_view_drafts === true,
    draftsCount: wire.drafts_count ?? 0,
    failedCount: wire.failed_count ?? 0,
    scheduledCount: wire.scheduled_count ?? 0,
  };
}

export function mapDraftListItem(wire: WireDraftListItem): DraftListItem {
  return {
    canDelete: wire.can_delete,
    canEdit: wire.can_edit,
    canSchedule: wire.can_schedule,
    creationMode: wire.creation_mode,
    failureCode: wire.failure_code,
    format: wire.format,
    identity: {
      avatarUrl: wire.identity.avatar_url,
      id: wire.identity.identity_id,
      isVerified: wire.identity.is_verified,
      name: wire.identity.name,
      type: wire.identity.identity_type,
    },
    previewText: wire.preview_text,
    ref: { contentId: wire.content_id, contentType: wire.content_type },
    scheduleTimezone: wire.schedule_timezone,
    scheduledAt: wire.scheduled_at,
    schedulable: wire.schedulable,
    status: wire.status,
    thumbnailUrl: wire.thumbnail_url,
    title: wire.title,
    unschedulableReason: wire.unschedulable_reason,
    updatedAt: wire.updated_at,
    version: wire.version,
  };
}

/* ------------------------------------------------------------------ */
/* Errori                                                              */
/* ------------------------------------------------------------------ */

const NETWORK_PATTERN = /network|fetch|timeout|timed out|offline|internet|connection|ECONN|ENOTFOUND/i;

function readField(error: unknown, field: string): string {
  if (typeof error === "object" && error !== null && field in error) {
    const value = (error as Record<string, unknown>)[field];
    return value === null || value === undefined ? "" : String(value);
  }
  return "";
}

/** Il detail di `article_duplicate` è `{"content_type":…,"content_id":…}` (§7M). */
function parseDuplicateRef(detail: string): ContentRef | null {
  try {
    const parsed = JSON.parse(detail) as { content_type?: string; content_id?: string };
    if (parsed?.content_id && parsed.content_type) {
      return { contentId: parsed.content_id, contentType: parsed.content_type as FeedContentType };
    }
  } catch {
    // detail non JSON: nessun link «Visualizza articolo».
  }
  return null;
}

/**
 * Dal codice nel `message` della RPC; senza codice, i SQLSTATE noti (42501
 * permesso, 40001 conflitto, P0002 non trovato), poi rete, poi ignoto.
 */
export function parsePublishingError(error: unknown): PublishingError {
  const message = error instanceof Error ? error.message : readField(error, "message") || (typeof error === "string" ? error : "");
  const code = readField(error, "code");
  const detail = readField(error, "details") || readField(error, "detail") || null;

  const named = PUBLISHING_ERROR_CODES.find((candidate: PublishingErrorCode) => message.includes(candidate));
  if (named) {
    return {
      detail,
      duplicateRef: named === "article_duplicate" && detail ? parseDuplicateRef(detail) : null,
      kind: named,
    };
  }

  const byState: Record<string, PublishingErrorCode> = {
    "40001": "content_version_conflict",
    "42501": "content_permission_denied",
    "55000": "content_invalid_state",
    P0002: "content_not_found",
  };
  if (byState[code]) {
    return { detail, duplicateRef: null, kind: byState[code] };
  }

  return { detail, duplicateRef: null, kind: NETWORK_PATTERN.test(message) ? "network" : "unknown" };
}

/** Errore lanciato dai wrapper: conserva l'originale e la classificazione. */
export class PublishingRequestError extends Error {
  readonly parsed: PublishingError;
  readonly cause: unknown;

  constructor(cause: unknown) {
    const parsed = parsePublishingError(cause);
    super(parsed.kind);
    this.name = "PublishingRequestError";
    this.parsed = parsed;
    this.cause = cause;
  }
}

async function call<T>(fn: string, args: Record<string, unknown> | undefined, check: (row: T | null) => boolean): Promise<T> {
  const { data, error } = args ? await supabase.rpc(fn, args) : await supabase.rpc(fn);
  if (error) {
    throw new PublishingRequestError(error);
  }
  const row = unwrapRow<T>(data);
  if (!check(row)) {
    throw new PublishingRequestError(new Error(`${fn}: risposta inattesa`));
  }
  return row as T;
}

/* ------------------------------------------------------------------ */
/* Launcher e lista                                                    */
/* ------------------------------------------------------------------ */

/** §4–§10: azioni realmente disponibili e contatori per il «+». */
export async function fetchContentLauncher(): Promise<ContentLauncherState> {
  const wire = await call<WireContentLauncher>("fetch_content_launcher", undefined, (row) => row !== null);
  return mapLauncher(wire);
}

/** §137–§161: una pagina di Bozze (updated_at desc) o Programmati (scheduled_at asc). */
export async function listContentDrafts(tab: DraftsTab, cursor: unknown | null, limit = 20): Promise<DraftListPage> {
  const wire = await call<WireDraftListPage>(
    "list_content_drafts",
    { p_cursor: cursor ?? null, p_limit: limit, p_tab: tab },
    (row) => row !== null && Array.isArray(row.items),
  );
  return { items: wire.items.map(mapDraftListItem), nextCursor: wire.next_cursor ?? null };
}

/* ------------------------------------------------------------------ */
/* Salvataggio e invio                                                 */
/* ------------------------------------------------------------------ */

export type SaveDraftArgs = {
  operationKey: string;
  ref: ContentRef | null;
  expectedVersion: number | null;
  format: ContentFormat;
  identityType: string;
  identityId: string;
  payload: Record<string, unknown>;
};

export type SavedDraft = {
  ref: ContentRef;
  version: number;
  updatedAt: string;
  rightsConfirmed: boolean | null;
};

/** §117–§122: crea al primo salvataggio significativo, poi aggiorna lo stesso draft_id. */
export async function saveContentDraft(args: SaveDraftArgs): Promise<SavedDraft> {
  const wire = await call<WireSaveDraftResult>(
    "save_content_draft",
    {
      p_expected_version: args.expectedVersion,
      p_format: args.format,
      p_identity_id: args.identityId,
      p_identity_type: args.identityType,
      p_operation_key: args.operationKey,
      p_payload: args.payload,
      p_ref: toWireRef(args.ref),
    },
    (row) => Boolean(row?.content_id),
  );
  return {
    ref: { contentId: wire.content_id, contentType: wire.content_type },
    rightsConfirmed: wire.rights_confirmed ?? null,
    updatedAt: wire.updated_at,
    version: wire.version,
  };
}

export type SubmitArgs = SaveDraftArgs & {
  publication: Publication | "keep";
  origin: string;
};

export type SubmitResult = {
  ref: ContentRef;
  status: "published" | "scheduled";
  scheduledAt: string | null;
  version: number;
  replayed: boolean;
};

/** §203–§211: Pubblica (Ora) o Programma (data futura) o Salva (`keep`). */
export async function submitContent(args: SubmitArgs): Promise<SubmitResult> {
  const wire = await call<WireSubmitResult>(
    "submit_content",
    {
      p_expected_version: args.expectedVersion,
      p_format: args.format,
      p_identity_id: args.identityId,
      p_identity_type: args.identityType,
      p_operation_key: args.operationKey,
      p_origin: args.origin,
      p_payload: args.payload,
      p_publication: toWirePublication(args.publication),
      p_ref: toWireRef(args.ref),
    },
    (row) => Boolean(row?.content_id),
  );
  return {
    ref: { contentId: wire.content_id, contentType: wire.content_type },
    replayed: wire.replayed === true,
    scheduledAt: wire.scheduled_at ?? null,
    status: wire.status,
    version: wire.version,
  };
}

/** Payload completo per riaprire una bozza/programmato/fallito o un Articolo pubblicato (§147–§148). */
export async function fetchContentForEditor<T>(ref: ContentRef): Promise<T> {
  return call<T>(
    "fetch_content_for_editor",
    { p_content_id: ref.contentId, p_content_type: ref.contentType },
    (row) => row !== null && typeof row === "object",
  );
}

/* ------------------------------------------------------------------ */
/* Gestione dalla lista                                                */
/* ------------------------------------------------------------------ */

function lifecycleCheck(row: WireLifecycleResult | null): boolean {
  return Boolean(row?.status);
}

/** §150, §168: Programma una bozza o cambia data e ora di un programmato. */
export async function scheduleContent(
  ref: ContentRef,
  expectedVersion: number,
  scheduledAt: string,
  timezone: string,
): Promise<WireLifecycleResult> {
  return call<WireLifecycleResult>(
    "schedule_content",
    {
      p_expected_version: expectedVersion,
      p_ref: toWireRef(ref),
      p_scheduled_at: scheduledAt,
      p_timezone: timezone,
    },
    lifecycleCheck,
  );
}

/** §171–§174 (Pubblica ora) e §196–§198 (Riprova di un fallito). */
export async function publishContentNow(ref: ContentRef, expectedVersion: number): Promise<WireLifecycleResult> {
  return call<WireLifecycleResult>(
    "publish_content_now",
    { p_expected_version: expectedVersion, p_ref: toWireRef(ref) },
    lifecycleCheck,
  );
}

/** §175–§177: SCHEDULED/FAILED → DRAFT, dati e asset conservati. */
export async function moveContentToDraft(ref: ContentRef, expectedVersion: number): Promise<WireLifecycleResult> {
  return call<WireLifecycleResult>(
    "move_content_to_draft",
    { p_expected_version: expectedVersion, p_ref: toWireRef(ref) },
    lifecycleCheck,
  );
}

/** §153, §178–§179: elimina bozza o programmato; il job futuro non la vede più. */
export async function deleteContentDraft(ref: ContentRef, expectedVersion: number): Promise<WireLifecycleResult> {
  return call<WireLifecycleResult>(
    "delete_content_draft",
    { p_expected_version: expectedVersion, p_ref: toWireRef(ref) },
    lifecycleCheck,
  );
}
