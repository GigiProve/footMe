/**
 * Accesso ai dati del Centro Shortlist (§23).
 *
 * Tre letture indipendenti per il centro — testata, gruppo Position, gruppo
 * CUSTOM — e non una sola risposta: §12 chiede che «Se un solo gruppo
 * fallisce e l'altro è utilizzabile» ci sia un errore **locale** al gruppo, e
 * una risposta unica renderebbe quel requisito indimostrabile.
 *
 * Nessuna funzione qui calcola autorizzazioni: le calcola il server e le
 * restituisce (§22). Quello che si fa qui è normalizzare, e classificare gli
 * errori di dominio in modo che la UI possa distinguerli (§23).
 */
import { supabase } from "../../../lib/supabase";
import {
  ShortlistError,
  type ShortlistCenterHeader,
  type ShortlistContext,
  type ShortlistCreatedSource,
  type ShortlistCustomRow,
  type ShortlistEvaluationStatus,
  type ShortlistGroupPage,
  type ShortlistMembership,
  type ShortlistPoolRow,
  type ShortlistPositionRow,
  type ShortlistPriority,
} from "./shortlist-types";

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

function count(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }

  return 0;
}

const EVALUATION_STATUSES: readonly ShortlistEvaluationStatus[] = [
  "da_valutare",
  "interessante",
  "da_contattare",
  "contattato",
  "non_prioritario",
  "scartato",
];

/**
 * §17: «non inventare uno stato quando il dato storico è mancante e non
 * azzerare valori non riconosciuti senza una strategia documentata». La
 * strategia è questa: un valore che questa build non conosce viene reso come
 * `da_valutare` **soltanto nella UI**, e il database conserva il suo.
 */
function evaluationStatus(value: unknown): ShortlistEvaluationStatus {
  return EVALUATION_STATUSES.includes(value as ShortlistEvaluationStatus)
    ? (value as ShortlistEvaluationStatus)
    : "da_valutare";
}

function priority(value: unknown): ShortlistPriority | null {
  return value === "alta" || value === "media" || value === "bassa"
    ? value
    : null;
}

function createdSource(value: unknown): ShortlistCreatedSource {
  return value === "profile" || value === "application" ? value : "unknown";
}

/**
 * Classificazione degli errori di dominio (§23).
 *
 * «Gli errori di dominio devono essere distinguibili internamente:
 * autorizzazione, risorsa non disponibile, candidatura ritirata, conflitto,
 * validazione, rate limit, rete/server. Restituisci copy user-facing
 * controllata, non dettagli di query o esistenza di dati non accessibili.»
 */
export function classifyShortlistError(error: unknown): ShortlistError {
  if (error instanceof ShortlistError) {
    return error;
  }

  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : "";

  if (message.includes("APPLICATION_WITHDRAWN")) {
    return new ShortlistError("withdrawn", message);
  }

  if (message.includes("REVISION_STALE") || message.includes("OPERATION_CONTENT_CHANGED")) {
    return new ShortlistError("conflict", message);
  }

  if (
    message.includes("SHORTLIST_NOT_AUTHORIZED") ||
    message.includes("Non autorizzato") ||
    message.includes("Authentication required")
  ) {
    return new ShortlistError("notAuthorized", message);
  }

  if (
    message.includes("SHORTLIST_NOT_FOUND") ||
    message.includes("APPLICATION_NOT_AVAILABLE")
  ) {
    return new ShortlistError("notFound", message);
  }

  return new ShortlistError("network", message);
}

export async function fetchShortlistCenterHeader(
  clubId: string,
): Promise<ShortlistCenterHeader> {
  const { data, error } = await supabase
    .rpc("fetch_shortlist_center_header", { p_club_id: clubId })
    .maybeSingle();

  if (error) {
    throw classifyShortlistError(error);
  }

  const row = (data ?? null) as RawRecord | null;

  if (!row) {
    throw new ShortlistError("notAuthorized");
  }

  return {
    accessVerifiedAt: row.access_verified_at
      ? Date.parse(String(row.access_verified_at))
      : Date.now(),
    canAddNotes: bool(row.can_add_notes),
    canAddProfiles: bool(row.can_add_profiles),
    canCreateLists: bool(row.can_create_lists),
    canEditStatus: bool(row.can_edit_status),
    canRemoveProfiles: bool(row.can_remove_profiles),
    canView: bool(row.can_view),
    clubId: text(row.club_id, clubId),
    clubIsVerified: bool(row.club_is_verified),
    clubLogoUrl: nullableText(row.club_logo_url),
    clubName: text(row.club_name),
    dataRevision: count(row.data_revision),
    scopeLabel: nullableText(row.scope_label),
  };
}

/**
 * §24: il cursore arriva **solo** sull'ultima riga della pagina quando ne
 * esiste un'altra. Leggerlo da lì e non da un campo di testata è ciò che
 * impedisce a un `next_cursor` di rivelare una quantità fuori scope.
 */
function pageCursor(rows: RawRecord[]): string | null {
  for (const row of rows) {
    const cursor = nullableText(row.next_cursor);

    if (cursor) {
      return cursor;
    }
  }

  return null;
}

export async function fetchShortlistPositionGroup(
  clubId: string,
  cursor: string | null = null,
): Promise<ShortlistGroupPage<ShortlistPositionRow>> {
  const { data, error } = await supabase.rpc("fetch_shortlist_position_lists", {
    p_club_id: clubId,
    p_cursor: cursor,
    p_limit: 20,
  });

  if (error) {
    throw classifyShortlistError(error);
  }

  const rows = (data ?? []) as RawRecord[];

  return {
    nextCursor: pageCursor(rows),
    rows: rows.flatMap((row) => {
      const shortlistId = nullableText(row.shortlist_id);
      const positionId = nullableText(row.position_id);

      if (!shortlistId || !positionId) {
        return [];
      }

      return [
        {
          isClosed: bool(row.is_closed),
          positionId,
          profilesCount: count(row.profiles_count),
          scopeLabel: nullableText(row.scope_label),
          shortlistId,
          title: text(row.title, "Posizione"),
        },
      ];
    }),
  };
}

export async function fetchShortlistCustomGroup(
  clubId: string,
  cursor: string | null = null,
): Promise<ShortlistGroupPage<ShortlistCustomRow>> {
  const { data, error } = await supabase.rpc("fetch_shortlist_custom_lists", {
    p_club_id: clubId,
    p_cursor: cursor,
    p_limit: 20,
  });

  if (error) {
    throw classifyShortlistError(error);
  }

  const rows = (data ?? []) as RawRecord[];

  return {
    nextCursor: pageCursor(rows),
    rows: rows.flatMap((row) => {
      const shortlistId = nullableText(row.shortlist_id);

      if (!shortlistId) {
        return [];
      }

      return [
        {
          name: text(row.name, "Lista"),
          profilesCount: count(row.profiles_count),
          scopeLabel: text(row.scope_label, "Intera società"),
          shortlistId,
        },
      ];
    }),
  };
}

/**
 * Contesto di una lista. §25: l'ingresso dal centro porta l'id della lista,
 * quello dal dominio Position porta l'id della Position — e «Un accesso dalla
 * Position può raggiungere la medesima lista anche vuota», senza crearla.
 */
export async function fetchShortlistContext(
  ref: { positionId: string } | { shortlistId: string },
): Promise<ShortlistContext> {
  const { data, error } = await supabase
    .rpc("fetch_shortlist_context", {
      p_position_id: "positionId" in ref ? ref.positionId : null,
      p_shortlist_id: "shortlistId" in ref ? ref.shortlistId : null,
    })
    .maybeSingle();

  if (error) {
    throw classifyShortlistError(error);
  }

  const row = (data ?? null) as RawRecord | null;

  if (!row) {
    throw new ShortlistError("notFound");
  }

  return {
    canAddNotes: bool(row.can_add_notes),
    canAddProfiles: bool(row.can_add_profiles),
    canEditStatus: bool(row.can_edit_status),
    canRemoveProfiles: bool(row.can_remove_profiles),
    clubId: text(row.club_id),
    isClosed: bool(row.is_closed),
    kind: row.list_type === "position" ? "position" : "custom",
    positionId: nullableText(row.position_id),
    profilesCount: count(row.profiles_count),
    scopeLabel: nullableText(row.scope_label),
    shortlistId: nullableText(row.shortlist_id),
    title: text(row.title, "Shortlist"),
  };
}

export async function fetchShortlistPool(
  shortlistId: string,
  page = 0,
  pageSize = 20,
): Promise<ShortlistPoolRow[]> {
  const { data, error } = await supabase.rpc("fetch_shortlist_entries", {
    p_limit: pageSize,
    p_offset: page * pageSize,
    p_shortlist_id: shortlistId,
  });

  if (error) {
    throw classifyShortlistError(error);
  }

  return ((data ?? []) as RawRecord[]).flatMap((row) => {
    const entryId = nullableText(row.id);
    const personId = nullableText(row.player_profile_id);

    if (!entryId || !personId) {
      return [];
    }

    return [
      {
        avatarUrl: nullableText(row.avatar_url),
        createdSource: createdSource(row.created_source),
        currentTeam: nullableText(row.current_team),
        entryId,
        evaluationStatus: evaluationStatus(row.evaluation_status),
        /* §22: `null` significa «non autorizzato a saperlo», e non va
           trasformato in «non si è candidato». */
        hasApplication:
          typeof row.has_application === "boolean" ? row.has_application : null,
        name: text(row.full_name, "Profilo"),
        personId,
        priority: priority(row.priority),
        revision: count(row.revision),
        role: nullableText(row.role),
      },
    ];
  });
}

/**
 * Stella e appartenenza alla Position (§15, §23).
 *
 * «Supporta caricamenti efficienti per più profili quando la superficie lo
 * richiede; non effettuare una query pesante per ogni stella.»
 */
export async function fetchShortlistMembership(
  clubId: string,
  personIds: string[],
  positionId: string | null = null,
): Promise<ShortlistMembership[]> {
  if (personIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase.rpc("fetch_shortlist_membership", {
    p_club_id: clubId,
    p_person_ids: personIds,
    p_position_id: positionId,
  });

  if (error) {
    throw classifyShortlistError(error);
  }

  return ((data ?? []) as RawRecord[]).flatMap((row) => {
    const personId = nullableText(row.person_id);

    if (!personId) {
      return [];
    }

    return [
      {
        inAnyList: bool(row.in_any_list),
        inPositionList: bool(row.in_position_list),
        personId,
      },
    ];
  });
}

export type ShortlistAddOutcome = {
  /** §18: lo stato «esistente o creata», utile al protocollo. */
  already: boolean;
  entryId: string;
  positionId: string;
  /** §18: «count aggiornato». */
  profilesTotal: number;
  shortlistId: string;
};

/**
 * Aggiunta one-tap dalla candidatura (§13, §18).
 *
 * Nessun parametro di destinazione: «Il server deriva destinazione e persona
 * dalla Application.» La chiave idempotente è l'unica cosa che il client
 * aggiunge, e serve a §13 — «Il retry usa la protezione idempotente della
 * stessa operazione finché il suo esito non è risolto.»
 */
export async function addApplicationToShortlist(
  applicationId: string,
  idempotencyKey: string,
): Promise<ShortlistAddOutcome> {
  const { data, error } = await supabase
    .rpc("add_application_to_shortlist", {
      p_application_id: applicationId,
      p_idempotency_key: idempotencyKey,
    })
    .maybeSingle();

  if (error) {
    throw classifyShortlistError(error);
  }

  const row = (data ?? null) as RawRecord | null;

  if (!row) {
    throw new ShortlistError("network");
  }

  return {
    already: bool(row.already),
    entryId: text(row.entry_id),
    positionId: text(row.position_ref),
    profilesTotal: count(row.profiles_total),
    shortlistId: text(row.shortlist_ref),
  };
}
