/**
 * Accesso ai dati dell'hub Struttura societaria (DAS-REV-12 §15, §24).
 *
 * Nessuna regola di dominio vive qui. Capability, scope, perimetro dei
 * conteggi ed eleggibilità dei segnali li decide il backend: §24 chiede che
 * «ogni endpoint/proiezione organizzativa verifichi autenticazione, Society,
 * accesso dell'actor, capability effettiva, scope e stato della risorsa».
 * Questo file traduce righe in tipi e scarta ciò che non sa rendere.
 */
import { supabase } from "../../../lib/supabase";
import { MODULE_TIMEOUT_MS, withTimeout } from "../state/retry-policy";
import { DashboardTimeoutError } from "../state/error-classification";
import {
  STRUCTURE_SIGNAL_KINDS,
  type SocietyStructure,
  type StructureSignal,
  type StructureSignalKind,
} from "./structure-types";

/** Codici applicativi sollevati dalla RPC: stringhe stabili, non messaggi. */
export type StructureErrorCode = "STRUCTURE_NOT_AUTHORIZED" | "UNKNOWN";

export class StructureAccessError extends Error {
  code: StructureErrorCode;

  constructor(code: StructureErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = "StructureAccessError";
  }
}

export function toStructureError(error: unknown): StructureAccessError {
  if (error instanceof StructureAccessError) {
    return error;
  }

  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error ?? "");

  return new StructureAccessError(
    message.includes("STRUCTURE_NOT_AUTHORIZED")
      ? "STRUCTURE_NOT_AUTHORIZED"
      : "UNKNOWN",
    message,
  );
}

type RawRecord = Record<string, unknown>;

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function bool(value: unknown): boolean {
  return value === true;
}

/**
 * `null` resta `null` (§15). Un intero arriva come number o come stringa a
 * seconda del tipo SQL; qualunque altra cosa è un payload che non sappiamo
 * leggere e vale "non disponibile", non zero.
 */
function count(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    return Number(value);
  }

  return null;
}

function isSignalKind(value: unknown): value is StructureSignalKind {
  return (
    typeof value === "string" &&
    (STRUCTURE_SIGNAL_KINDS as readonly string[]).includes(value)
  );
}

/**
 * Un segnale di cui questa build non conosce il `kind` viene **omesso**, non
 * reso con un renderer arbitrario: §14 vieta di «eseguire codice o
 * navigazioni arbitrarie provenienti dal payload», e un tipo sconosciuto non
 * deve far crashare la pagina.
 *
 * Vale lo stesso per un segnale che non porta il riferimento canonico della
 * propria destinazione: senza quello il tap non risolverebbe un target noto.
 */
export function mapStructureSignals(value: unknown): StructureSignal[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry): StructureSignal[] => {
    if (typeof entry !== "object" || entry === null) {
      return [];
    }

    const row = entry as RawRecord;
    const id = text(row.id);
    const kind = row.kind;
    const title = text(row.title);
    const clubId = text(row.club_id);

    if (!id || !title || !clubId || !isSignalKind(kind)) {
      return [];
    }

    const relationshipId = text(row.relationship_id);
    const teamId = text(row.team_id);
    const rawTarget = text(row.season_target);
    const seasonTarget =
      rawTarget === "current" || rawTarget === "next" ? rawTarget : null;

    if (kind === "network_request" && !relationshipId) {
      return [];
    }

    if (kind === "team_season" && (!teamId || !seasonTarget)) {
      return [];
    }

    const signalCount = count(row.count);

    if (signalCount === null || signalCount <= 0) {
      return [];
    }

    return [
      {
        actionLabel: text(row.action_label) ?? "Apri",
        clubId,
        context: text(row.context),
        count: signalCount,
        id,
        kind,
        relationshipId,
        seasonTarget,
        teamId,
        title,
      },
    ];
  });
}

/**
 * Composizione dell'hub.
 *
 * Il timeout non interrompe la richiesta sottostante — Supabase non espone un
 * AbortSignal — ma impedisce alla pagina di restare in loading oltre il
 * budget di §18.
 */
export async function fetchSocietyStructure(
  clubId: string,
): Promise<SocietyStructure> {
  const { data, error } = await withTimeout(
    supabase.rpc("fetch_society_structure", { p_club_id: clubId }).maybeSingle(),
    MODULE_TIMEOUT_MS,
    () => new DashboardTimeoutError("fetch_society_structure"),
  );

  if (error) {
    throw toStructureError(error);
  }

  const row = (data ?? {}) as RawRecord;

  return {
    accessVerifiedAt: row.access_verified_at
      ? new Date(String(row.access_verified_at)).getTime()
      : Date.now(),
    adminInvitesPendingCount: count(row.admin_invites_pending_count),
    adminsCount: count(row.admins_count),
    canEditCompanyData: bool(row.can_edit_company_data),
    canOpenAdminCenter: bool(row.can_open_admin_center),
    canViewAdminInvites: bool(row.can_view_admin_invites),
    canViewAdmins: bool(row.can_view_admins),
    canViewCompanyData: bool(row.can_view_company_data),
    canViewNetwork: bool(row.can_view_network),
    canViewRequests: bool(row.can_view_requests),
    canViewSeasons: bool(row.can_view_seasons),
    canViewTeams: bool(row.can_view_teams),
    city: text(row.club_city),
    clubId: text(row.club_id) ?? clubId,
    dataRevision: count(row.data_revision) ?? 0,
    isVerified: bool(row.club_is_verified),
    logoUrl: text(row.club_logo_url),
    name: text(row.club_name) ?? "",
    scopeLabel: text(row.scope_label),
    signals: mapStructureSignals(row.signals),
  };
}
