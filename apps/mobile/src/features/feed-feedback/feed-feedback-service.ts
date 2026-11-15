/**
 * Accesso dati di «Non mi interessa» (HOM-11 §37–§53, §166, §177) → RPC
 * `fetch_feed_feedback_reasons`, `mark_content_not_interested`,
 * `set_not_interested_reason`, `undo_not_interested`.
 *
 * Le tabelle sono chiuse ai client: tutto passa dalle RPC, che rivalidano a ogni
 * chiamata che il contenuto sia leggibile, che l'origin sia in whitelist (D2) e che
 * il viewer non lo gestisca (D5). L'autore del contenuto NON viaggia dal client: il
 * server lo deriva (§180). Qui solo il ponte snake_case → camelCase e i default
 * sicuri: uno stato sconosciuto è un errore, mai un finto successo.
 *
 * Non c'è alcuna chiamata a Follow né a Segnala: tre domini, tre mutation, nessuna
 * cascata (§166–§167).
 */

import { supabase } from "../../lib/supabase";
import type {
  FeedbackReason,
  MarkNotInterestedInput,
  MarkNotInterestedResult,
  MarkNotInterestedStatus,
  SetReasonStatus,
  UndoNotInterestedStatus,
} from "./feed-feedback-types";

type Raw = Record<string, unknown>;

function isRecord(value: unknown): value is Raw {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Una RPC `returns jsonb` arriva come oggetto; per sicurezza si accetta anche `[oggetto]`. */
function unwrapObject(data: unknown): Raw | null {
  const row = Array.isArray(data) ? data[0] : data;
  return isRecord(row) ? row : null;
}

const MARK_STATUSES: readonly MarkNotInterestedStatus[] = [
  "recorded",
  "already_recorded",
  "unavailable",
  "not_allowed",
];

/** §47–§49: solo righe con id ed etichetta; l'ordine lo decide il server (`sort_order`). */
export function mapReasons(data: unknown): FeedbackReason[] {
  const rows = Array.isArray(data) ? data : [];

  return rows.flatMap((row, index): FeedbackReason[] => {
    if (!isRecord(row) || typeof row.reason_id !== "string" || typeof row.label !== "string") {
      return [];
    }
    if (row.label.trim().length === 0) {
      return [];
    }

    return [
      {
        label: row.label,
        reasonId: row.reason_id,
        sortOrder: typeof row.sort_order === "number" ? row.sort_order : index,
      },
    ];
  });
}

export function mapMarkResult(data: unknown): MarkNotInterestedResult {
  const row = unwrapObject(data);
  const status = row?.status;

  if (!MARK_STATUSES.includes(status as MarkNotInterestedStatus)) {
    // Risposta vuota o stato ignoto: non si finge un successo (§51).
    throw new Error("mark_content_not_interested: risposta non valida");
  }

  return {
    feedbackId: typeof row?.feedback_id === "string" ? row.feedback_id : null,
    status: status as MarkNotInterestedStatus,
  };
}

/** §47–§49: i motivi attivi, già ordinati dal server. */
export async function fetchFeedbackReasons(): Promise<FeedbackReason[]> {
  const { data, error } = await supabase.rpc("fetch_feed_feedback_reasons");

  if (error) {
    throw error;
  }

  return mapReasons(data);
}

/**
 * §28, §37–§39: registra il segnale. Con un Simple Repost si passano anche il tipo e
 * l'id del reposter (§39, §146); il server ne ricava `distribution_context`.
 */
export async function markContentNotInterested(
  input: MarkNotInterestedInput,
): Promise<MarkNotInterestedResult> {
  const { data, error } = await supabase.rpc("mark_content_not_interested", {
    p_content_id: input.contentId,
    p_content_type: input.contentType,
    p_operation_key: input.operationKey,
    p_origin: input.origin,
    p_reposter_identity_id: input.reposter?.identityId ?? null,
    p_reposter_identity_type: input.reposter?.identityType ?? null,
  });

  if (error) {
    throw error;
  }

  return mapMarkResult(data);
}

/** §50: il motivo è facoltativo e arriva DOPO l'hide, che è già completo (§45). */
export async function setNotInterestedReason(
  feedbackId: string,
  reasonId: string,
): Promise<SetReasonStatus> {
  const { data, error } = await supabase.rpc("set_not_interested_reason", {
    p_feedback_id: feedbackId,
    p_reason_id: reasonId,
  });

  if (error) {
    throw error;
  }

  const status = unwrapObject(data)?.status;
  if (status === "updated" || status === "not_found" || status === "invalid_reason") {
    return status;
  }

  throw new Error("set_not_interested_reason: risposta non valida");
}

/** §34, §53: Annulla cancella la riga propria, motivo incluso. Idempotente. */
export async function undoNotInterested(feedbackId: string): Promise<UndoNotInterestedStatus> {
  const { data, error } = await supabase.rpc("undo_not_interested", {
    p_feedback_id: feedbackId,
  });

  if (error) {
    throw error;
  }

  const status = unwrapObject(data)?.status;
  if (status === "removed" || status === "not_found") {
    return status;
  }

  throw new Error("undo_not_interested: risposta non valida");
}
