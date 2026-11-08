/**
 * Accesso ai dati del flusso Shortlist dal profilo (DAS-REV-26 §24).
 *
 * Ogni funzione è una RPC del core unico (20261106090000): nessuna
 * autorizzazione calcolata qui — il server filtra per actor, Società
 * operativa, capability, perimetro e accesso della singola lista prima che
 * il dato arrivi (§24: «Ogni risposta è filtrata sul server»). Qui si
 * normalizza e si classificano gli errori con lo stesso classificatore del
 * centro, così che la UI distingua «non disponibile» da «rete».
 */
import { supabase } from "../../../../lib/supabase";
import { classifyShortlistError } from "../shortlist-service";
import {
  ShortlistError,
  type ShortlistEvaluationStatus,
  type ShortlistPriority,
} from "../shortlist-types";
import type {
  CustomCreateOutcome,
  CustomScopeOption,
  ProfileAddOutcome,
  ProfileDestination,
  ProfileDestinationGroup,
  ProfileDestinationPage,
  ProfileMembership,
  ProfileMemberships,
  ProfileShortlistState,
} from "./profile-shortlist-types";

type RawRecord = Record<string, unknown>;

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function bool(value: unknown): boolean {
  return value === true;
}

function num(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }

  return 0;
}

const STATUSES: readonly ShortlistEvaluationStatus[] = [
  "da_valutare",
  "interessante",
  "da_contattare",
  "contattato",
  "non_prioritario",
  "scartato",
];

/* Stessa strategia del centro (24 §17): un valore sconosciuto a questa
   build si rende Da valutare **solo** in UI; il database conserva il suo. */
function status(value: unknown): ShortlistEvaluationStatus {
  return STATUSES.includes(value as ShortlistEvaluationStatus)
    ? (value as ShortlistEvaluationStatus)
    : "da_valutare";
}

function priority(value: unknown): ShortlistPriority | null {
  return value === "alta" || value === "media" || value === "bassa" ? value : null;
}

function record(data: unknown): RawRecord {
  if (!data || typeof data !== "object") {
    throw new ShortlistError("network");
  }

  return data as RawRecord;
}

function rows(value: unknown): RawRecord[] {
  return Array.isArray(value) ? (value as RawRecord[]) : [];
}

/** Stato privato della stella (§9). */
export async function fetchProfileShortlistState(
  clubId: string,
  personId: string,
): Promise<ProfileShortlistState> {
  const { data, error } = await supabase.rpc("fetch_profile_shortlist_state", {
    p_club_id: clubId,
    p_person_id: personId,
  });

  if (error) {
    throw classifyShortlistError(error);
  }

  const row = record(data);
  const verifiedAt = nullableText(row.access_verified_at);

  if (!bool(row.available)) {
    return { available: false, verifiedAt };
  }

  return {
    available: true,
    canAdd: bool(row.can_add),
    canCreate: bool(row.can_create),
    inAnyList: bool(row.in_any_list),
    verifiedAt,
  };
}

function membership(row: RawRecord): ProfileMembership | null {
  const entryId = nullableText(row.entry_id);
  const shortlistId = nullableText(row.shortlist_id);

  if (!entryId || !shortlistId) {
    return null;
  }

  return {
    canEditNote: bool(row.can_edit_note),
    canEditStatus: bool(row.can_edit_status),
    canRemove: bool(row.can_remove),
    entryId,
    evaluationStatus: status(row.evaluation_status),
    generation: num(row.generation),
    isClosed: bool(row.is_closed),
    isDraft: bool(row.is_draft),
    kind: row.list_type === "position" ? "position" : "custom",
    positionId: nullableText(row.position_id),
    priority: priority(row.priority),
    revision: num(row.revision),
    scopeLabel: nullableText(row.scope_label),
    shortlistId,
    title: text(row.title, "Lista"),
  };
}

/** Membership leggibili della persona, caricate al tap su ★ (§14). */
export async function fetchProfileShortlistMemberships(
  clubId: string,
  personId: string,
): Promise<ProfileMemberships> {
  const { data, error } = await supabase.rpc("fetch_profile_shortlist_memberships", {
    p_club_id: clubId,
    p_person_id: personId,
  });

  if (error) {
    throw classifyShortlistError(error);
  }

  const row = record(data);

  return {
    canAddMore: bool(row.can_add_more),
    canCreate: bool(row.can_create),
    items: rows(row.items).flatMap((item) => {
      const mapped = membership(item);
      return mapped ? [mapped] : [];
    }),
    truncated: bool(row.truncated),
  };
}

function destination(row: RawRecord): ProfileDestination | null {
  const kind = row.kind === "position" ? "position" : "custom";
  const positionId = nullableText(row.position_id);
  const shortlistId = nullableText(row.shortlist_id);

  if ((kind === "position" && !positionId) || (kind === "custom" && !shortlistId)) {
    return null;
  }

  return {
    isClosed: bool(row.is_closed),
    isDraft: bool(row.is_draft),
    kind,
    positionId,
    scopeLabel: nullableText(row.scope_label),
    shortlistId,
    title: text(row.title, kind === "position" ? "Posizione" : "Lista"),
  };
}

/** Una pagina di un gruppo del selector (§11, §12). */
export async function fetchProfileShortlistDestinations(
  clubId: string,
  personId: string,
  group: ProfileDestinationGroup,
  cursor: string | null = null,
): Promise<ProfileDestinationPage> {
  const { data, error } = await supabase.rpc("fetch_profile_shortlist_destinations", {
    p_club_id: clubId,
    p_cursor: cursor,
    p_group: group,
    p_limit: 20,
    p_person_id: personId,
  });

  if (error) {
    throw classifyShortlistError(error);
  }

  const row = record(data);

  return {
    canCreate: bool(row.can_create),
    items: rows(row.items).flatMap((item) => {
      const mapped = destination(item);
      return mapped ? [mapped] : [];
    }),
    nextCursor: nullableText(row.next_cursor),
  };
}

/**
 * Aggiunta immediata dal profilo (§13).
 *
 * Una sola destinazione: `positionId` per una Position — anche senza
 * contenitore — oppure `shortlistId` per una CUSTOM. Nient'altro arriva dal
 * client: tipo, Società, perimetro, autore, data e valutazione li deriva il
 * server.
 */
export async function addProfileToShortlist(input: {
  clubId: string;
  idempotencyKey: string;
  personId: string;
  target: { positionId: string } | { shortlistId: string };
}): Promise<ProfileAddOutcome> {
  const { data, error } = await supabase.rpc("add_profile_to_shortlist", {
    p_club_id: input.clubId,
    p_idempotency_key: input.idempotencyKey,
    p_person_id: input.personId,
    p_position_id: "positionId" in input.target ? input.target.positionId : null,
    p_shortlist_id: "shortlistId" in input.target ? input.target.shortlistId : null,
  });

  if (error) {
    throw classifyShortlistError(error);
  }

  const row = record(data);

  return {
    already: bool(row.already),
    entryId: nullableText(row.entry_id),
    inAnyList: bool(row.in_any_list),
    removedSince: bool(row.removed_since),
    replayed: bool(row.replayed),
    shortlistId: text(row.shortlist_id),
  };
}

/**
 * Creazione CUSTOM (§16-§19), con persona iniziale facoltativa.
 *
 * Lo stesso comando serve il centro (persona nulla) e il profilo: §29 — un
 * solo servizio di creazione, un solo default Solo io. Owner e accesso non
 * sono parametri: li stampa il server.
 */
export async function createCustomShortlist(input: {
  clubId: string;
  description: string;
  idempotencyKey: string;
  name: string;
  personId: string | null;
  teamId: string | null;
}): Promise<CustomCreateOutcome> {
  const { data, error } = await supabase.rpc("create_custom_shortlist", {
    p_club_id: input.clubId,
    p_description: input.description,
    p_idempotency_key: input.idempotencyKey,
    p_name: input.name,
    p_person_id: input.personId,
    p_team_id: input.teamId,
  });

  if (error) {
    throw classifyShortlistError(error);
  }

  const row = record(data);
  const shortlistId = nullableText(row.shortlist_id);

  if (!shortlistId) {
    throw new ShortlistError("network");
  }

  return {
    entryActive: bool(row.entry_active),
    entryId: nullableText(row.entry_id),
    name: text(row.name),
    replayed: bool(row.replayed),
    scopeLabel: text(row.scope_label, "Intera società"),
    shortlistId,
    status: row.status === "completed" ? "completed" : "created",
  };
}

/** Ambiti autorizzati di una nuova CUSTOM (§17). */
export async function fetchCustomScopeOptions(
  clubId: string,
  withAdd: boolean,
): Promise<CustomScopeOption[]> {
  const { data, error } = await supabase.rpc("fetch_shortlist_custom_scope_options", {
    p_club_id: clubId,
    p_with_add: withAdd,
  });

  if (error) {
    throw classifyShortlistError(error);
  }

  return rows(data).map((row) => ({
    label: text(row.label, "Squadra"),
    teamId: nullableText(row.team_id),
  }));
}
