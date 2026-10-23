/**
 * Accesso ai dati del dettaglio gestionale (DAS-REV-17 §23).
 *
 * Due operazioni e nient'altro: la lettura autorizzata e la patch della
 * Position attiva. Bozza e pubblicazione **non** sono qui — §16 chiede di
 * riusare «il servizio di prima pubblicazione introdotto dal composer», e
 * §14 la stessa `update_position_draft`: «La diversa superficie d'ingresso
 * non giustifica un endpoint che aggira validazione, idempotenza o
 * permessi.»
 *
 * Nessuna regola di autorizzazione vive qui. Il server rivaluta permessi,
 * stato, versione e schema a ogni lettura e a ogni comando: §5 — «Non
 * fidarti dell'identità visualizzata, della provenienza dal Centro o della
 * presenza di un pulsante nel client.»
 */
import { supabase } from "../../../../lib/supabase";
import { DashboardTimeoutError } from "../../state/error-classification";
import { MODULE_TIMEOUT_MS, withTimeout } from "../../state/retry-policy";
import { ComposeError, toComposeError } from "../compose/compose-service";
import type {
  PositionBlocker,
  PositionDetails,
  PositionProfileType,
  PositionSecondaryTeam,
} from "../compose/compose-types";
import type { PositionGroup } from "../positions-types";
import type { PositionLifecycle, PositionManageDetail } from "./manage-types";

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
    throw toComposeError(error);
  }

  return data as T;
}

function mapSecondaryTeams(value: unknown): PositionSecondaryTeam[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      const record = (entry ?? {}) as RawRecord;
      const teamId = text(record.teamId);

      return teamId
        ? {
            isInactive: bool(record.isInactive),
            name: text(record.name) ?? "",
            teamId,
          }
        : null;
    })
    .filter((team): team is PositionSecondaryTeam => team !== null);
}

function mapProfileType(value: unknown): PositionProfileType {
  const raw = text(value);

  return raw === "coach" || raw === "staff" || raw === "director"
    ? raw
    : "player";
}

function mapGroup(value: unknown): PositionGroup {
  const raw = text(value);

  return raw === "active" || raw === "closed" ? raw : "drafts";
}

function mapLifecycle(value: unknown): PositionLifecycle {
  const raw = text(value);

  return raw === "published" || raw === "closed" ? raw : "draft";
}

/**
 * La lettura gestionale, una sola (§23).
 *
 * Restituisce «Dati consentiti, lifecycle, versione, schema, azioni
 * effettive, valutazione della bozza». I conteggi Application arrivano
 * `null` quando l'actor non li può vedere: §5 vieta di mostrarli «nemmeno
 * come zero», e il mapper non li inventa.
 */
export async function fetchPositionManageDetail(
  positionId: string,
): Promise<PositionManageDetail> {
  const rows = await rpc<RawRecord[]>("fetch_society_position_detail", {
    p_ad_id: positionId,
  });

  const row = Array.isArray(rows) ? rows[0] : null;

  if (!row) {
    /* §27: «Un dettaglio Position non caricato non diventa automaticamente
       una "Posizione senza titolo" modificabile.» */
    throw new ComposeError("POSITION_NOT_FOUND", { positionId });
  }

  const totalRaw = int(row.applications_total);
  const newRaw = int(row.applications_new);
  const countsAvailable = bool(row.counts_available);

  return {
    accessVerifiedAt: row.access_verified_at
      ? new Date(String(row.access_verified_at)).getTime()
      : Date.now(),
    ageMax: int(row.age_max),
    ageMin: int(row.age_min),
    ageMode:
      text(row.age_mode) === "range"
        ? "range"
        : text(row.age_mode) === "unrestricted"
          ? "unrestricted"
          : "unset",
    applicationsNew: countsAvailable ? newRaw : null,
    applicationsTotal: countsAvailable ? totalRaw : null,
    blockers: Array.isArray(row.blockers)
      ? (row.blockers.filter(
          (entry) => typeof entry === "string",
        ) as PositionBlocker[])
      : [],
    canClose: bool(row.can_close),
    canEdit: bool(row.can_edit),
    canPublish: bool(row.can_publish),
    closedAt: text(row.closed_at),
    clubCity: text(row.club_city),
    clubId: text(row.club_id) ?? "",
    clubIsVerified: bool(row.club_is_verified),
    clubLogoUrl: text(row.club_logo_url),
    clubName: text(row.club_name) ?? "",
    clubRegion: text(row.club_region),
    contextLabel: text(row.context_label),
    countsAvailable,
    creationBatchId: text(row.creation_batch_id),
    customRoleName: text(row.custom_role_name),
    dataRevision: int(row.data_revision) ?? 0,
    deadlineAt: text(row.deadline_at),
    deadlineDate: text(row.deadline_date),
    deadlineTimezone: text(row.deadline_timezone),
    description: text(row.description),
    details: (row.details ?? {}) as PositionDetails,
    group: mapGroup(row.group_key),
    hasDetails: bool(row.has_details),
    id: text(row.position_id) ?? positionId,
    lifecycle: mapLifecycle(row.status),
    profileType: mapProfileType(row.profile_type),
    publishedAt: text(row.published_at),
    receivingClosed: bool(row.receiving_closed),
    resourceVersion: int(row.resource_version) ?? 1,
    roleId: text(row.role_id),
    roleIsCustom: bool(row.role_is_custom),
    roleLabel: text(row.role_label),
    schemaVersion: int(row.schema_version) ?? 1,
    scope: text(row.position_scope) === "society" ? "society" : "team",
    seasonLabel: text(row.season_label),
    secondaryTeams: mapSecondaryTeams(row.secondary_teams),
    status: text(row.status) ?? "draft",
    teamId: text(row.team_id),
    teamIsInactive: bool(row.team_is_inactive),
    teamName: text(row.team_name),
    title: text(row.title),
    updatedAt: text(row.updated_at),
  };
}

/**
 * Patch dei soli dettagli consentiti di una Position attiva (§21).
 *
 * Il tipo è deliberatamente più stretto di `PositionPatch`: profilo, ruolo,
 * nome custom, ambito e squadra principale non compaiono, perché §19 li
 * vuole fissi dopo la pubblicazione. Il server rifiuta comunque l'intero
 * comando se arrivano — §21: «non ignorare silenziosamente i campi vietati
 * salvando il resto» — ma un tipo che li ammettesse renderebbe l'errore
 * raggiungibile per distrazione invece che per manomissione.
 */
export type PublishedPositionPatch = {
  ageMax?: number | null;
  ageMin?: number | null;
  /** Mai `"unset"`: §20 vieta il ritorno a «età non impostata». */
  ageMode?: "range" | "unrestricted";
  description?: string | null;
  details?: Partial<Record<keyof PositionDetails, unknown>>;
  secondaryTeamIds?: string[];
};

export async function updatePublishedPosition(input: {
  expectedVersion: number | null;
  patch: PublishedPositionPatch;
  positionId: string;
}): Promise<{ resourceVersion: number }> {
  const rows = await rpc<RawRecord[]>("update_published_position", {
    p_ad_id: input.positionId,
    p_expected_version: input.expectedVersion,
    p_patch: input.patch,
  });

  const row = Array.isArray(rows) ? rows[0] : null;

  return { resourceVersion: int(row?.resource_version) ?? 1 };
}
