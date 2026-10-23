/**
 * Accesso ai dati del composer Position (DAS-REV-16 §31).
 *
 * Nessuna regola di autorizzazione vive qui. §5 — «Rivalida comunque sul
 * server anche le chiamate API dirette» — e le RPC lo fanno: `can_create`,
 * `can_publish` e `blockers` arrivano calcolati, e una mutation con un ID
 * fuori scope fallisce indipendentemente da quello che il client crede.
 *
 * Il client **non** rivaluta la pubblicabilità per conto suo: §25 vieta di
 * «accettare un boolean client ready come prova di validità», e questo
 * modulo si limita a trasportare i codici del server.
 */
import { supabase } from "../../../../lib/supabase";
import { DashboardTimeoutError } from "../../state/error-classification";
import { MODULE_TIMEOUT_MS, withTimeout } from "../../state/retry-policy";
import type {
  PositionBlocker,
  PositionCatalogItem,
  PositionCatalogs,
  PositionComposerContext,
  PositionDetails,
  PositionDraft,
  PositionEligibleTeam,
  PositionProfileType,
  PositionScope,
  PositionSecondaryTeam,
} from "./compose-types";

/**
 * Codici applicativi delle RPC. §31 chiede di distinguere «validazione,
 * conflitto, assenza risorsa, revoca autorizzazione, schema non supportato,
 * offline, errore transitorio e rate limit»: sono stringhe stabili, e la
 * copy che le accompagna sta nella presentazione.
 */
export type ComposeErrorCode =
  /** DAS-REV-17 §20: su una pubblicata l'età non torna «non impostata». */
  | "POSITION_AGE_UNSET_NOT_ALLOWED"
  | "POSITION_COMPOSER_NOT_AUTHORIZED"
  | "POSITION_CUSTOM_ROLE_REQUIRED"
  | "POSITION_CUSTOM_ROLE_TOO_LONG"
  /** DAS-REV-17 §24: campo fuori dalla whitelist del lifecycle corrente. */
  | "POSITION_FIELD_NOT_EDITABLE"
  | "POSITION_IDENTITY_LOCKED"
  | "POSITION_LIFECYCLE_CONFLICT"
  /** DAS-REV-17 §23: esiste-ma-negata e inesistente danno lo stesso esito. */
  | "POSITION_NOT_AVAILABLE"
  | "POSITION_NOT_AUTHORIZED"
  | "POSITION_NOT_FOUND"
  | "POSITION_NOT_PUBLISHABLE"
  | "POSITION_OPERATION_CONFLICT"
  | "POSITION_PATCH_INVALID"
  | "POSITION_PUBLISH_NOT_AUTHORIZED"
  | "POSITION_ROLE_INVALID"
  | "POSITION_SCOPE_NOT_ALLOWED"
  | "POSITION_SECONDARY_TEAM_IS_PRIMARY"
  | "POSITION_SECONDARY_TEAMS_NOT_ALLOWED"
  | "POSITION_SELECTION_EMPTY"
  | "POSITION_TEAM_NOT_ELIGIBLE"
  | "POSITION_TEAM_REQUIRED"
  | "POSITION_VERSION_CONFLICT"
  | "UNKNOWN";

const ERROR_CODES: readonly ComposeErrorCode[] = [
  /* Ordine rilevante: i codici più specifici precedono i prefissi di cui
     sono estensione, perché il match è per sottostringa. */
  "POSITION_PUBLISH_NOT_AUTHORIZED",
  "POSITION_COMPOSER_NOT_AUTHORIZED",
  "POSITION_SECONDARY_TEAMS_NOT_ALLOWED",
  "POSITION_SECONDARY_TEAM_IS_PRIMARY",
  "POSITION_AGE_UNSET_NOT_ALLOWED",
  "POSITION_FIELD_NOT_EDITABLE",
  "POSITION_CUSTOM_ROLE_REQUIRED",
  "POSITION_CUSTOM_ROLE_TOO_LONG",
  "POSITION_OPERATION_CONFLICT",
  "POSITION_LIFECYCLE_CONFLICT",
  "POSITION_VERSION_CONFLICT",
  "POSITION_IDENTITY_LOCKED",
  "POSITION_NOT_PUBLISHABLE",
  "POSITION_SCOPE_NOT_ALLOWED",
  "POSITION_TEAM_NOT_ELIGIBLE",
  "POSITION_SELECTION_EMPTY",
  "POSITION_TEAM_REQUIRED",
  "POSITION_NOT_AVAILABLE",
  "POSITION_NOT_AUTHORIZED",
  "POSITION_PATCH_INVALID",
  "POSITION_ROLE_INVALID",
  "POSITION_NOT_FOUND",
] as const;

export class ComposeError extends Error {
  /** Blockers trasportati da `POSITION_NOT_PUBLISHABLE:<id>:<a,b>`. */
  blockers: PositionBlocker[];
  code: ComposeErrorCode;
  /** Position a cui l'errore si riferisce, quando il server la nomina. */
  positionId: string | null;

  constructor(
    code: ComposeErrorCode,
    options?: {
      blockers?: PositionBlocker[];
      message?: string;
      positionId?: string | null;
    },
  ) {
    super(options?.message ?? code);
    this.blockers = options?.blockers ?? [];
    this.code = code;
    this.name = "ComposeError";
    this.positionId = options?.positionId ?? null;
  }
}

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function toComposeError(error: unknown): ComposeError {
  if (error instanceof ComposeError) {
    return error;
  }

  /* Un timeout non è un rifiuto: §12 chiede di non trasformarlo in «Da
     completare», e §10 di riconciliarlo invece di ricreare. */
  if (error instanceof DashboardTimeoutError) {
    throw error;
  }

  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error ?? "");

  const code = ERROR_CODES.find((candidate) => message.includes(candidate));

  if (!code) {
    return new ComposeError("UNKNOWN", { message });
  }

  const positionId = message.match(UUID_RE)?.[0] ?? null;
  const blockers: PositionBlocker[] = [];

  if (code === "POSITION_NOT_PUBLISHABLE") {
    const tail = message.split(":").pop() ?? "";

    for (const entry of tail.split(",")) {
      const trimmed = entry.trim();

      if (trimmed && !UUID_RE.test(trimmed)) {
        blockers.push(trimmed as PositionBlocker);
      }
    }
  }

  return new ComposeError(code, { blockers, message, positionId });
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

// ── Contesto e cataloghi ────────────────────────────────────────────────────

export async function fetchComposerContext(
  clubId: string,
): Promise<PositionComposerContext> {
  const rows = await rpc<RawRecord[]>("fetch_position_composer_context", {
    p_club_id: clubId,
  });

  const row = Array.isArray(rows) ? rows[0] : null;

  if (!row) {
    throw new ComposeError("POSITION_COMPOSER_NOT_AUTHORIZED");
  }

  const limits = (row.limits ?? {}) as Record<string, unknown>;

  return {
    accessVerifiedAt: row.access_verified_at
      ? new Date(String(row.access_verified_at)).getTime()
      : Date.now(),
    canCreate: bool(row.can_create),
    canCreateSociety: bool(row.can_create_society),
    canPublish: bool(row.can_publish),
    clubCity: text(row.club_city),
    clubId: text(row.club_id) ?? clubId,
    clubIsVerified: bool(row.club_is_verified),
    clubLogoUrl: text(row.club_logo_url),
    clubName: text(row.club_name) ?? "",
    clubRegion: text(row.club_region),
    limits: {
      ageMax: int(limits.ageMax) ?? 70,
      ageMin: int(limits.ageMin) ?? 5,
      customRoleName: int(limits.customRoleName) ?? 80,
      description: int(limits.description) ?? 2000,
      requirements: int(limits.requirements) ?? 1000,
      responsibilities: int(limits.responsibilities) ?? 1500,
      staffQualification: int(limits.staffQualification) ?? 300,
    },
    schemaVersion: int(row.schema_version) ?? 1,
    timezoneName: text(row.timezone_name) ?? "Europe/Rome",
  };
}

export async function fetchEligibleTeams(
  clubId: string,
): Promise<PositionEligibleTeam[]> {
  const rows = await rpc<RawRecord[]>("fetch_position_eligible_teams", {
    p_club_id: clubId,
  });

  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const teamId = text(row.team_id);

      return teamId
        ? {
            canCreate: bool(row.can_create),
            canPublish: bool(row.can_publish),
            contextLabel: text(row.context_label),
            teamId,
            teamName: text(row.team_name) ?? "",
          }
        : null;
    })
    .filter((team): team is PositionEligibleTeam => team !== null);
}

export async function fetchCatalogs(
  profileType: PositionProfileType,
): Promise<PositionCatalogs> {
  const rows = await rpc<RawRecord[]>("fetch_position_catalogs", {
    p_profile_type: profileType,
  });

  const empty: PositionCatalogs = {
    categories: [],
    experiences: [],
    qualifications: [],
    roles: [],
    seasons: [],
  };

  const buckets: Record<string, keyof PositionCatalogs> = {
    category: "categories",
    experience: "experiences",
    qualification: "qualifications",
    role: "roles",
    season: "seasons",
  };

  for (const row of Array.isArray(rows) ? rows : []) {
    const bucket = buckets[text(row.catalog) ?? ""];
    const id = text(row.item_id);

    if (!bucket || !id) {
      continue;
    }

    const item: PositionCatalogItem = {
      id,
      isCustom: bool(row.is_custom),
      label: text(row.label) ?? id,
      needsContext: bool(row.needs_context),
    };

    empty[bucket].push(item);
  }

  return empty;
}

// ── Bozze ───────────────────────────────────────────────────────────────────

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

function mapDraft(row: RawRecord): PositionDraft | null {
  const id = text(row.position_id);

  if (!id) {
    return null;
  }

  const ageMode = text(row.age_mode);

  return {
    ageMax: int(row.age_max),
    ageMin: int(row.age_min),
    ageMode:
      ageMode === "range" || ageMode === "unrestricted" ? ageMode : "unset",
    blockers: Array.isArray(row.blockers)
      ? (row.blockers.filter((entry) => typeof entry === "string") as PositionBlocker[])
      : [],
    canEdit: bool(row.can_edit),
    canPublish: bool(row.can_publish),
    clubCity: text(row.club_city),
    clubId: text(row.club_id) ?? "",
    clubIsVerified: bool(row.club_is_verified),
    clubLogoUrl: text(row.club_logo_url),
    clubName: text(row.club_name) ?? "",
    clubRegion: text(row.club_region),
    contextLabel: text(row.context_label),
    creationBatchId: text(row.creation_batch_id),
    customRoleName: text(row.custom_role_name),
    deadlineDate: text(row.deadline_date),
    deadlineTimezone: text(row.deadline_timezone),
    description: text(row.description),
    details: (row.details ?? {}) as PositionDetails,
    hasDetails: bool(row.has_details),
    id,
    profileType: mapProfileType(row.profile_type),
    publishedAt: text(row.published_at),
    resourceVersion: int(row.resource_version) ?? 1,
    roleId: text(row.role_id),
    roleIsCustom: bool(row.role_is_custom),
    roleLabel: text(row.role_label),
    schemaVersion: int(row.schema_version) ?? 1,
    scope: text(row.position_scope) === "society" ? "society" : "team",
    secondaryTeams: mapSecondaryTeams(row.secondary_teams),
    status: text(row.status) ?? "draft",
    teamId: text(row.team_id),
    teamName: text(row.team_name),
    title: text(row.title),
    updatedAt: text(row.updated_at),
  };
}

export async function fetchPositionDrafts(
  ids: readonly string[],
): Promise<PositionDraft[]> {
  if (ids.length === 0) {
    return [];
  }

  const rows = await rpc<RawRecord[]>("fetch_position_drafts", {
    p_ids: [...ids],
  });

  return (Array.isArray(rows) ? rows : [])
    .map(mapDraft)
    .filter((draft): draft is PositionDraft => draft !== null);
}

// ── Mutation ────────────────────────────────────────────────────────────────

export type CreateDraftsInput = {
  clubId: string;
  customRoleName: string | null;
  /** §10: la chiave identifica il tentativo logico, non la richiesta HTTP. */
  operationKey: string;
  profileType: PositionProfileType;
  roleId: string;
  scope: PositionScope;
  /** Vuoto per SOCIETY: nasce **una** Position senza Team (§10). */
  teamIds: readonly string[];
};

export type CreatedDraft = { positionId: string; teamId: string | null };

export async function createPositionDrafts(
  input: CreateDraftsInput,
): Promise<CreatedDraft[]> {
  const rows = await rpc<RawRecord[]>("create_position_drafts", {
    p_club_id: input.clubId,
    p_custom_role_name: input.customRoleName,
    p_operation_key: input.operationKey,
    p_profile_type: input.profileType,
    p_role_id: input.roleId,
    p_scope: input.scope,
    p_team_ids: input.scope === "society" ? [] : [...input.teamIds],
  });

  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const positionId = text(row.position_id);

      return positionId ? { positionId, teamId: text(row.team_id) } : null;
    })
    .filter((row): row is CreatedDraft => row !== null);
}

/**
 * Patch parziale (§21).
 *
 * Una chiave assente non viene toccata; `null` rimuove. Per questo il tipo
 * è un `Partial` e non l'oggetto intero: passare la bozza completa a ogni
 * salvataggio significherebbe sovrascrivere campi che questo client non
 * conosce.
 */
export type PositionPatch = {
  ageMax?: number | null;
  ageMin?: number | null;
  ageMode?: "range" | "unrestricted" | "unset";
  customRoleName?: string | null;
  description?: string | null;
  details?: Partial<Record<keyof PositionDetails, unknown>>;
  profileType?: PositionProfileType;
  roleId?: string;
  scope?: PositionScope;
  secondaryTeamIds?: string[];
  teamId?: string | null;
};

export async function updatePositionDraft(input: {
  expectedVersion: number | null;
  patch: PositionPatch;
  positionId: string;
}): Promise<{ resourceVersion: number }> {
  const rows = await rpc<RawRecord[]>("update_position_draft", {
    p_ad_id: input.positionId,
    p_expected_version: input.expectedVersion,
    p_patch: input.patch,
  });

  const row = Array.isArray(rows) ? rows[0] : null;

  return { resourceVersion: int(row?.resource_version) ?? 1 };
}

export async function setPositionDeadline(input: {
  /** Data civile `YYYY-MM-DD`, o `null` per «Nessuna scadenza» (§23). */
  deadlineDate: string | null;
  expectedVersion: number | null;
  positionId: string;
}): Promise<{ resourceVersion: number }> {
  const rows = await rpc<RawRecord[]>("set_position_deadline", {
    p_ad_id: input.positionId,
    p_deadline_date: input.deadlineDate,
    p_expected_version: input.expectedVersion,
  });

  const row = Array.isArray(rows) ? rows[0] : null;

  return { resourceVersion: int(row?.resource_version) ?? 1 };
}

export type PublishResult = { positionId: string; publishedAt: string | null };

export async function publishPositions(input: {
  expectedVersions: readonly (number | null)[];
  operationKey: string;
  positionIds: readonly string[];
}): Promise<PublishResult[]> {
  /* Gli ID viaggiano ordinati perché il server deduplica e riordina allo
     stesso modo: l'impronta di idempotenza deve coincidere fra un tentativo
     e il suo retry (§25). Le versioni seguono lo stesso ordine. */
  const paired = input.positionIds
    .map((positionId, index) => ({
      expectedVersion: input.expectedVersions[index] ?? null,
      positionId,
    }))
    /* Confronto per code unit e non `localeCompare`: il server ordina
       byte per byte, e una collation locale produrrebbe un ordine diverso
       su cui l'impronta non coinciderebbe più. */
    .sort((a, b) => (a.positionId < b.positionId ? -1 : a.positionId > b.positionId ? 1 : 0));

  const rows = await rpc<RawRecord[]>("publish_positions", {
    p_ad_ids: paired.map((entry) => entry.positionId),
    p_expected_versions: paired.map((entry) => entry.expectedVersion),
    p_operation_key: input.operationKey,
  });

  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const positionId = text(row.position_id);

      return positionId
        ? { positionId, publishedAt: text(row.published_at) }
        : null;
    })
    .filter((row): row is PublishResult => row !== null);
}

export async function deletePositionDraft(positionId: string): Promise<void> {
  await rpc<unknown>("delete_position_draft", { p_ad_id: positionId });
}
