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
import { normalizeFilters } from "./shortlist-presentation";
import {
  ShortlistError,
  type ShortlistApplicationState,
  type ShortlistCenterHeader,
  type ShortlistContext,
  type ShortlistCreatedSource,
  type ShortlistCustomRow,
  type ShortlistEntryDetail,
  type ShortlistEvaluationOutcome,
  type ShortlistEvaluationPatch,
  type ShortlistEvaluationStatus,
  type ShortlistFilters,
  type ShortlistGroupPage,
  type ShortlistMembership,
  type ShortlistPoolPage,
  type ShortlistPoolRow,
  type ShortlistPositionRow,
  type ShortlistPriority,
  type ShortlistRemoveOutcome,
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

  /* §18: «Un valore troppo lungo non viene tagliato silenziosamente.» È un
     errore di validazione inline accanto al campo, non un guasto di rete. */
  if (message.includes("SHORTLIST_NOTE_TOO_LONG")) {
    return new ShortlistError("noteTooLong", message);
  }

  /* DAS-REV-26 §16, §17: errori di validazione del form CUSTOM, inline
     accanto al campo e mai una copy di rete. Il nome e la descrizione
     conservano il testo digitato. */
  if (message.includes("SHORTLIST_LIST_NAME_REQUIRED")) {
    return new ShortlistError("nameRequired", message);
  }

  if (message.includes("SHORTLIST_LIST_NAME_TOO_LONG")) {
    return new ShortlistError("nameTooLong", message);
  }

  if (message.includes("SHORTLIST_LIST_DESCRIPTION_TOO_LONG")) {
    return new ShortlistError("descriptionTooLong", message);
  }

  /* §17: «Se l'accesso cambia prima del commit, ricarica le opzioni e
     richiedi una scelta ancora valida senza allargare automaticamente lo
     scope.» */
  if (message.includes("SHORTLIST_SCOPE_INVALID")) {
    return new ShortlistError("scopeInvalid", message);
  }

  /* §13: una enum non consentita è rifiutata, non ignorata. Arriva solo da
     un client fuori contratto: la UI non può produrla. */
  if (message.includes("SHORTLIST_FILTER_INVALID")) {
    return new ShortlistError("notFound", message);
  }

  /* §14: un cursore di un'altra query non restituisce dati estranei. Il
     chiamante riparte dalla prima pagina dei filtri correnti. */
  if (message.includes("SHORTLIST_CURSOR_INVALID")) {
    return new ShortlistError("staleCursor", message);
  }

  /* §9: la bozza senza perimetro persistito ha un rimedio proprio —
     completare il contesto nel flusso Position — e quindi una copy propria. */
  if (message.includes("SHORTLIST_SCOPE_UNDEFINED")) {
    return new ShortlistError("scopeUndefined", message);
  }

  /* §26, §28: la entry non c'è più. Distinta da «non autorizzato», perché
     il ritorno è il pool e non la Dashboard. */
  if (message.includes("SHORTLIST_ENTRY_NOT_FOUND")) {
    return new ShortlistError("gone", message);
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
          isDraft: bool(row.is_draft),
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
    canViewNotes: bool(row.can_view_notes),
    clubId: text(row.club_id),
    isClosed: bool(row.is_closed),
    isDraft: bool(row.is_draft),
    kind: row.list_type === "position" ? "position" : "custom",
    positionId: nullableText(row.position_id),
    profilesCount: count(row.profiles_count),
    scopeLabel: nullableText(row.scope_label),
    shortlistId: nullableText(row.shortlist_id),
    title: text(row.title, "Shortlist"),
  };
}

/** §16: `null` = non autorizzato a conoscere la relazione Application. */
function applicationState(value: unknown): ShortlistApplicationState {
  return value === "active" || value === "none" || value === "withdrawn"
    ? value
    : null;
}

/**
 * Una pagina del pool, con filtri, cursore e i due conteggi (§13, §14).
 *
 * I filtri vengono **normalizzati prima di partire**: §13 chiede che due
 * selezioni equivalenti producano la stessa query, e la stessa chiave di
 * cache. Un array vuoto diventa `null`, perché «Nessuna scelta in una
 * dimensione significa nessuna restrizione per quella dimensione» e `[]`
 * sarebbe un filtro che non seleziona niente.
 */
export async function fetchShortlistPoolPage(
  shortlistId: string,
  filters: ShortlistFilters,
  cursor: string | null = null,
  pageSize = 20,
): Promise<ShortlistPoolPage> {
  const normalized = normalizeFilters(filters);

  const { data, error } = await supabase.rpc("fetch_shortlist_pool_page", {
    p_cursor: cursor,
    p_limit: pageSize,
    p_priorities:
      normalized.priorities.length > 0 ? [...normalized.priorities] : null,
    p_shortlist_id: shortlistId,
    p_statuses: normalized.statuses.length > 0 ? [...normalized.statuses] : null,
  });

  if (error) {
    throw classifyShortlistError(error);
  }

  const payload = (data ?? null) as RawRecord | null;

  if (!payload) {
    throw new ShortlistError("network");
  }

  const items = Array.isArray(payload.items)
    ? (payload.items as RawRecord[])
    : [];

  return {
    canEditStatus: bool(payload.can_edit_status),
    canRemove: bool(payload.can_remove),
    canViewApplications: bool(payload.can_view_applications),
    canViewNotes: bool(payload.can_view_notes),
    filtered: count(payload.filtered),
    filtersApplied: bool(payload.filters_applied),
    nextCursor: nullableText(payload.next_cursor),
    rows: items.flatMap((row) => {
      const entryId = nullableText(row.entry_id);
      const personId = nullableText(row.person_id);

      if (!entryId || !personId) {
        return [];
      }

      return [
        {
          applicationState: applicationState(row.application_state),
          avatarUrl: nullableText(row.avatar_url),
          createdSource: createdSource(row.created_source),
          entryId,
          evaluationStatus: evaluationStatus(row.evaluation_status),
          name: text(row.name, "Profilo"),
          notePreview: nullableText(row.note_preview),
          personId,
          primaryPosition: nullableText(row.primary_position),
          priority: priority(row.priority),
          revision: count(row.revision),
          role: nullableText(row.role),
          situation: nullableText(row.situation),
        },
      ];
    }),
    total: count(payload.total),
  };
}

/**
 * Scheda interna della membership (§15), indirizzabile in due modi.
 *
 * Dal pool si conosce la entry; dallo sheet §11 si conosce soltanto la
 * candidatura, e §10 vuole che sia il server a derivare persona e Position.
 * `withNote: false` è la proiezione dello sheet: §11 — «Non caricare
 * l'intera nota privata per riempire lo sheet.»
 */
export async function fetchShortlistEntry(
  ref: { applicationId: string } | { entryId: string },
  withNote = true,
): Promise<ShortlistEntryDetail> {
  const { data, error } = await supabase.rpc("fetch_shortlist_entry", {
    p_application_id: "applicationId" in ref ? ref.applicationId : null,
    p_entry_id: "entryId" in ref ? ref.entryId : null,
    p_with_note: withNote,
  });

  if (error) {
    throw classifyShortlistError(error);
  }

  const row = (data ?? null) as RawRecord | null;

  if (!row) {
    throw new ShortlistError("gone");
  }

  return {
    addedByName: nullableText(row.added_by_name),
    applicationId: nullableText(row.application_id),
    applicationState: applicationState(row.application_state),
    avatarUrl: nullableText(row.avatar_url),
    canEditNote: bool(row.can_edit_note),
    canEditStatus: bool(row.can_edit_status),
    canRemove: bool(row.can_remove),
    canViewApplications: bool(row.can_view_applications),
    canViewNotes: bool(row.can_view_notes),
    clubId: text(row.club_id),
    createdAt: nullableText(row.created_at),
    createdSource: createdSource(row.created_source),
    entryId: text(row.entry_id),
    evaluationStatus: evaluationStatus(row.evaluation_status),
    isClosed: bool(row.is_closed),
    isDraft: bool(row.is_draft),
    name: text(row.name, "Profilo"),
    note: nullableText(row.note),
    personId: text(row.person_id),
    positionId: nullableText(row.position_id),
    positionTitle: text(row.position_title, "Posizione"),
    primaryPosition: nullableText(row.primary_position),
    priority: priority(row.priority),
    revision: count(row.revision),
    role: nullableText(row.role),
    scopeLabel: nullableText(row.scope_label),
    shortlistId: text(row.shortlist_id),
    situation: nullableText(row.situation),
  };
}

/**
 * L'unico commit della valutazione (§19).
 *
 * «Non implementare autosave della valutazione. La mutation avviene
 * esclusivamente con Salva modifiche, con versione attesa della entry e
 * protezione dalle ripetizioni prevista dal core.»
 *
 * §18: «Campi presenti con null indicano una cancellazione esplicita
 * ammessa; campi omessi significano invariati.» Da cui i due flag
 * `p_set_*`: senza di essi un `null` sarebbe indistinguibile da «non
 * toccare», e togliere una priorità diventerebbe impossibile.
 */
export async function saveShortlistEvaluation(
  entryId: string,
  patch: ShortlistEvaluationPatch,
  expectedRevision: number,
  idempotencyKey: string,
): Promise<ShortlistEvaluationOutcome> {
  const setPriority = "priority" in patch;
  const setNote = "note" in patch;

  const { data, error } = await supabase.rpc("update_shortlist_entry", {
    p_entry_id: entryId,
    p_evaluation_status: patch.evaluationStatus ?? null,
    p_expected_revision: expectedRevision,
    p_idempotency_key: idempotencyKey,
    p_internal_note: setNote ? patch.note ?? null : null,
    p_priority: setPriority ? patch.priority ?? null : null,
    p_set_note: setNote,
    p_set_priority: setPriority,
  });

  if (error) {
    throw classifyShortlistError(error);
  }

  const row = (data ?? null) as RawRecord | null;

  if (!row) {
    throw new ShortlistError("network");
  }

  return {
    entryId: text(row.entry_id, entryId),
    evaluationStatus: evaluationStatus(row.evaluation_status),
    priority: priority(row.priority),
    replayed: bool(row.replayed),
    revision: count(row.revision),
  };
}

/**
 * Rimozione di **una** membership (§21).
 *
 * L'esito porta con sé quanto serve a riconciliare senza una seconda
 * lettura: il totale della lista e la stella della Society — §22, «se la
 * persona rimane in una CUSTOM o in un'altra Position accessibile, la
 * stella resta piena».
 */
export async function removeShortlistEntry(
  entryId: string,
  idempotencyKey: string,
): Promise<ShortlistRemoveOutcome> {
  const { data, error } = await supabase.rpc("remove_shortlist_entry", {
    p_entry_id: entryId,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    throw classifyShortlistError(error);
  }

  const row = (data ?? null) as RawRecord | null;

  if (!row) {
    throw new ShortlistError("network");
  }

  return {
    entryId: text(row.entry_id, entryId),
    inAnyList: bool(row.in_any_list),
    personId: text(row.person_id),
    positionId: nullableText(row.position_id),
    profilesTotal: count(row.profiles_total),
    shortlistId: text(row.shortlist_id),
  };
}

/**
 * Stella e appartenenza alla Position/**
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
