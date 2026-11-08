/**
 * Accesso ai comandi e ai read model di governo delle CUSTOM (DAS-REV-27 §22).
 *
 * Nessuna autorizzazione calcolata qui: le capability arrivano dal server.
 * Si normalizza e si classificano gli errori con il classificatore unico del
 * dominio (`classifyShortlistError`), così un «non disponibile» resta tale
 * in ogni schermata e un errore di rete non diventa mai una revoca (§18).
 */
import { supabase } from "../../../../lib/supabase";
import { classifyShortlistError } from "../shortlist-service";
import { ShortlistError } from "../shortlist-types";
import type {
  AccessChoice,
  AccessUpdateOutcome,
  CustomAccessMode,
  CustomShortlistAccess,
  CustomShortlistDetail,
  ListPatch,
  ListUpdateOutcome,
  OwnerReassignOutcome,
  PeoplePage,
  RecoverablePage,
  RecoveryDetail,
  ScopePreview,
  ShortlistPerson,
} from "./custom-shortlist-types";

type Raw = Record<string, unknown>;

const record = (value: unknown): Raw =>
  typeof value === "object" && value !== null ? (value as Raw) : {};
const text = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;
const nullableText = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;
const bool = (value: unknown): boolean => value === true;
const num = (value: unknown): number =>
  typeof value === "number" ? value : Number(value ?? 0) || 0;
const list = (value: unknown): Raw[] => (Array.isArray(value) ? value.map(record) : []);

function accessMode(value: unknown): CustomAccessMode {
  return value === "shared" || value === "scope" ? value : "owner_only";
}

function person(raw: Raw): ShortlistPerson {
  return {
    avatarUrl: nullableText(raw.avatar_url),
    fullName: text(raw.full_name, "Profilo non disponibile"),
    profileId: text(raw.profile_id),
    roleLabel: nullableText(raw.role_label),
  };
}

function peoplePage(data: unknown): PeoplePage {
  const row = record(data);
  return { items: list(row.items).map(person), nextCursor: nullableText(row.next_cursor) };
}

async function call<T>(fn: string, args: Raw, map: (data: unknown) => T): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);

  if (error) {
    throw classifyShortlistError(error);
  }

  if (data === null || data === undefined) {
    throw new ShortlistError("network");
  }

  return map(data);
}

/** Testata del dettaglio CUSTOM (§9). */
export function fetchCustomShortlistDetail(shortlistId: string): Promise<CustomShortlistDetail> {
  return call("fetch_custom_shortlist_detail", { p_shortlist_id: shortlistId }, (data) => {
    const row = record(data);
    return {
      accessMode: accessMode(row.access_mode),
      accessVerifiedAt: text(row.access_verified_at),
      canDelete: bool(row.can_delete),
      canEdit: bool(row.can_edit),
      canManageAccess: bool(row.can_manage_access),
      clubId: text(row.club_id),
      description: nullableText(row.description),
      isOwner: bool(row.is_owner),
      name: text(row.name),
      scopeLabel: text(row.scope_label, "Intera società"),
      sharedCount: row.shared_count === null || row.shared_count === undefined ? null : num(row.shared_count),
      shortlistId: text(row.shortlist_id),
      teamId: nullableText(row.team_id),
      version: num(row.version),
    };
  });
}

/** Read model owner-only di Gestisci accesso (§13). */
export function fetchCustomShortlistAccess(shortlistId: string): Promise<CustomShortlistAccess> {
  return call("fetch_custom_shortlist_access", { p_shortlist_id: shortlistId }, (data) => {
    const row = record(data);
    return {
      accessMode: accessMode(row.access_mode),
      name: text(row.name),
      owner: row.owner ? person(record(row.owner)) : null,
      scopeLabel: text(row.scope_label, "Intera società"),
      shared: list(row.shared).map(person),
      shortlistId: text(row.shortlist_id),
      teamId: nullableText(row.team_id),
      version: num(row.version),
    };
  });
}

/** Persone eleggibili, per lista esistente o per il draft di creazione (§11). */
export function fetchShareCandidates(input: {
  clubId: string;
  cursor: string | null;
  shortlistId: string | null;
  teamId: string | null;
}): Promise<PeoplePage> {
  return call(
    "fetch_shortlist_share_candidates",
    {
      p_club_id: input.clubId,
      p_cursor: input.cursor,
      p_limit: 30,
      p_shortlist_id: input.shortlistId,
      p_team_id: input.teamId,
    },
    peoplePage,
  );
}

/** Salva accesso: modalità, set completo e versione osservata (§13). */
export function updateCustomShortlistAccess(input: {
  expectedVersion: number;
  idempotencyKey: string;
  mode: AccessChoice;
  profileIds: string[];
  shortlistId: string;
}): Promise<AccessUpdateOutcome> {
  return call(
    "update_custom_shortlist_access",
    {
      p_access_mode: input.mode,
      p_expected_version: input.expectedVersion,
      p_idempotency_key: input.idempotencyKey,
      p_profile_ids: input.mode === "shared" ? input.profileIds : [],
      p_shortlist_id: input.shortlistId,
    },
    (data) => {
      const row = record(data);
      return {
        accessMode: accessMode(row.access_mode),
        replayed: bool(row.replayed),
        sharedCount: num(row.shared_count),
        version: num(row.version),
      };
    },
  );
}

/** Anteprima d'impatto del cambio ambito, senza effetti (§14). */
export function previewCustomShortlistScope(
  shortlistId: string,
  teamId: string | null,
): Promise<ScopePreview> {
  return call("preview_custom_shortlist_scope", { p_shortlist_id: shortlistId, p_team_id: teamId }, (data) => {
    const row = record(data);
    const kind = row.kind === "named" || row.kind === "generic" ? row.kind : "none";
    return {
      kind,
      losing: Array.isArray(row.losing)
        ? list(row.losing).map((x) => ({ fullName: text(x.full_name), profileId: text(x.profile_id) }))
        : null,
      ownerValid: bool(row.owner_valid),
    };
  });
}

/** Salva modifiche: patch dei soli campi cambiati (§14). */
export function updateCustomShortlist(input: {
  expectedVersion: number;
  idempotencyKey: string;
  patch: ListPatch;
  shortlistId: string;
}): Promise<ListUpdateOutcome> {
  return call(
    "update_custom_shortlist",
    {
      p_expected_version: input.expectedVersion,
      p_idempotency_key: input.idempotencyKey,
      p_patch: input.patch,
      p_shortlist_id: input.shortlistId,
    },
    (data) => {
      const row = record(data);
      return {
        accessMode: accessMode(row.access_mode),
        description: nullableText(row.description),
        name: text(row.name),
        replayed: bool(row.replayed),
        scopeLabel: text(row.scope_label, "Intera società"),
        teamId: nullableText(row.team_id),
        version: num(row.version),
      };
    },
  );
}

/** Elimina lista (§16). */
export function deleteCustomShortlist(input: {
  idempotencyKey: string;
  shortlistId: string;
}): Promise<{ replayed: boolean }> {
  return call(
    "delete_custom_shortlist",
    { p_idempotency_key: input.idempotencyKey, p_shortlist_id: input.shortlistId },
    (data) => ({ replayed: bool(record(data).replayed) }),
  );
}

/** Capability di recupero per il menu del Centro (§19). */
export function fetchShortlistGovernanceCaps(clubId: string): Promise<{ canRecover: boolean }> {
  return call("fetch_shortlist_governance_caps", { p_club_id: clubId }, (data) => ({
    canRecover: bool(record(data).can_recover),
  }));
}

export function fetchRecoverableShortlists(
  clubId: string,
  cursor: string | null,
): Promise<RecoverablePage> {
  return call(
    "fetch_recoverable_custom_shortlists",
    { p_club_id: clubId, p_cursor: cursor, p_limit: 30 },
    (data) => {
      const row = record(data);
      return {
        items: list(row.items).map((x) => ({
          name: text(x.name),
          scopeLabel: text(x.scope_label, "Intera società"),
          shortlistId: text(x.shortlist_id),
        })),
        nextCursor: nullableText(row.next_cursor),
      };
    },
  );
}

/** Screen 12: soli metadati minimi (§19). */
export function fetchShortlistRecovery(shortlistId: string): Promise<RecoveryDetail> {
  return call("fetch_custom_shortlist_recovery", { p_shortlist_id: shortlistId }, (data) => {
    const row = record(data);
    return {
      name: text(row.name),
      scopeLabel: text(row.scope_label, "Intera società"),
      shortlistId: text(row.shortlist_id),
      version: num(row.version),
    };
  });
}

export function fetchOwnerCandidates(shortlistId: string, cursor: string | null): Promise<PeoplePage> {
  return call(
    "fetch_shortlist_owner_candidates",
    { p_cursor: cursor, p_limit: 30, p_shortlist_id: shortlistId },
    peoplePage,
  );
}

/** Assegna proprietario (§19). */
export function reassignShortlistOwner(input: {
  expectedVersion: number;
  idempotencyKey: string;
  newOwnerId: string;
  shortlistId: string;
}): Promise<OwnerReassignOutcome> {
  return call(
    "reassign_custom_shortlist_owner",
    {
      p_expected_version: input.expectedVersion,
      p_idempotency_key: input.idempotencyKey,
      p_new_owner_id: input.newOwnerId,
      p_shortlist_id: input.shortlistId,
    },
    (data) => {
      const row = record(data);
      return {
        accessMode: accessMode(row.access_mode),
        actorIsOwner: bool(row.actor_is_owner),
        ownerName: text(row.owner_name),
        replayed: bool(row.replayed),
        version: num(row.version),
      };
    },
  );
}

/**
 * Tutti gli id eleggibili, pagina per pagina, per riconciliare una
 * selezione dopo un rifiuto per eligibility (§11, Q27-09). Limite di pagine
 * esplicito: nessun loop infinito (§24).
 */
export async function fetchAllShareCandidateIds(input: {
  clubId: string;
  shortlistId: string | null;
  teamId: string | null;
}): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < 20; page += 1) {
    const result: PeoplePage = await fetchShareCandidates({ ...input, cursor });
    ids.push(...result.items.map((item) => item.profileId));

    if (!result.nextCursor) {
      break;
    }

    cursor = result.nextCursor;
  }

  return ids;
}
