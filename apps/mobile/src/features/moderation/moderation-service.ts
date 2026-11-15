/**
 * Accesso dati di Segnala (HOM-11 §74–§162, §180–§184) → RPC `fetch_report_categories`,
 * `fetch_report_state`, `create_moderation_report`.
 *
 * Le tabelle sono chiuse ai client (nessuna policy SELECT: privacy del reporter §78,
 * nessuna «Le mie segnalazioni» §195): tutto passa dalle RPC, che rivalidano a ogni
 * chiamata che il target sia leggibile e non gestito dal viewer. Il reporter è
 * `auth.uid()` (D1, §181): qui non esiste un parametro per l'account. Autore del
 * target, snapshot e stato di moderazione li ricava il server (§180, §183): non hanno
 * un posto nel payload.
 *
 * Un esito o uno stato ignoto è un errore, mai un finto successo (§155).
 */

import { supabase } from "../../lib/supabase";
import { isInteractionIdentityType } from "../interactions/interaction-identity";
import type {
  CreateReportInput,
  CreateReportResult,
  CreateReportStatus,
  ReportCategory,
  ReportState,
  ReportTarget,
  ReportTargetType,
} from "./moderation-types";

type Raw = Record<string, unknown>;

function isRecord(value: unknown): value is Raw {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapObject(data: unknown): Raw | null {
  const row = Array.isArray(data) ? data[0] : data;
  return isRecord(row) ? row : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

const CREATE_STATUSES: readonly CreateReportStatus[] = [
  "created",
  "already_reported",
  "target_unavailable",
  "invalid_category",
  "not_allowed",
];

/** §84: solo righe con id ed etichetta; l'ordine lo decide il server (`sort_order`). */
export function mapCategories(data: unknown): ReportCategory[] {
  const rows = Array.isArray(data) ? data : [];

  return rows.flatMap((row, index): ReportCategory[] => {
    if (!isRecord(row) || typeof row.category_id !== "string") {
      return [];
    }
    const label = text(row.label);
    if (!label) {
      return [];
    }

    return [
      {
        allowsFreeText: row.allows_free_text === true,
        categoryId: row.category_id,
        description: text(row.description),
        label,
        parentId: typeof row.parent_id === "string" ? row.parent_id : null,
        requiresSubcategory: row.requires_subcategory === true,
        sortOrder: typeof row.sort_order === "number" ? row.sort_order : index,
      },
    ];
  });
}

/**
 * §126, §159: un campo assente vale «segnalabile e disponibile, non ancora
 * segnalato». Non è una scorciatoia ottimistica: lo stato serve solo a evitare un giro
 * a vuoto, e `create_moderation_report` rivalida tutto (§159–§160, §182).
 */
export function mapReportState(data: unknown): ReportState {
  const row = unwrapObject(data);
  if (!row) {
    throw new Error("fetch_report_state: risposta vuota");
  }

  return {
    alreadyReported: row.already_reported === true,
    available: row.available !== false,
    reportable: row.reportable !== false,
  };
}

export function mapCreateResult(data: unknown): CreateReportResult {
  const row = unwrapObject(data);
  const status = row?.status;

  if (!CREATE_STATUSES.includes(status as CreateReportStatus)) {
    throw new Error("create_moderation_report: risposta non valida");
  }

  return {
    reportId: typeof row?.report_id === "string" ? row.report_id : null,
    status: status as CreateReportStatus,
  };
}

/** §83, §87: categorie attive e compatibili col tipo di target, già ordinate dal server. */
export async function fetchReportCategories(targetType: ReportTargetType): Promise<ReportCategory[]> {
  const { data, error } = await supabase.rpc("fetch_report_categories", {
    p_target_type: targetType,
  });

  if (error) {
    throw error;
  }

  return mapCategories(data);
}

/** D6, §126–§131: serve al menu (già segnalato) e al flow (target sparito, già segnalato). */
export async function fetchReportState(
  target: Pick<ReportTarget, "targetType" | "contentType" | "targetId">,
): Promise<ReportState> {
  const { data, error } = await supabase.rpc("fetch_report_state", {
    p_content_type: target.contentType,
    p_target_id: target.targetId,
    p_target_type: target.targetType,
  });

  if (error) {
    throw error;
  }

  return mapReportState(data);
}

/**
 * §94, §100–§101: invia la segnalazione. L'identità di interazione corrente viaggia
 * SOLO come metadata (§77): il server la valida e, se non è dell'utente, la scarta.
 */
export async function createModerationReport(input: CreateReportInput): Promise<CreateReportResult> {
  const identity =
    input.contextualIdentity && isInteractionIdentityType(input.contextualIdentity.type)
      ? input.contextualIdentity
      : null;

  const { data, error } = await supabase.rpc("create_moderation_report", {
    p_category_id: input.categoryId,
    p_contextual_identity_id: identity?.id ?? null,
    p_contextual_identity_type: identity?.type ?? null,
    p_content_type: input.target.contentType,
    p_details: input.details,
    p_operation_key: input.operationKey,
    p_origin: input.target.origin ?? "DEEP_LINK",
    p_subcategory_id: input.subcategoryId,
    p_target_id: input.target.targetId,
    p_target_type: input.target.targetType,
  });

  if (error) {
    throw error;
  }

  return mapCreateResult(data);
}
