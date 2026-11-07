/**
 * Accesso ai dati del Centro Candidature (§26).
 *
 * Nessuna regola di dominio vive qui. Chi può leggere una candidatura, quale
 * Position è nello scope, se una submission è nuova, se l'aggiunta alla
 * shortlist è consentita: lo decide il backend, che §5 obbliga a verificare
 * «sessione e actor, accesso corrente alla Society, capability richiesta,
 * Position proprietaria della Application, scope della Position … capability
 * distinta dell'azione» a ogni chiamata.
 *
 * In particolare questo file **non** calcola `isNew`. Sarebbe la riga più
 * facile da scrivere e il modo più sicuro di far divergere lista e conteggi,
 * che §9 vuole identici: `is_new` arriva dal server, da un predicato solo.
 */
import { supabase } from "../../../lib/supabase";
import { DashboardTimeoutError } from "../state/error-classification";
import { MODULE_TIMEOUT_MS, withTimeout } from "../state/retry-policy";
import type {
  ApplicantProfileType,
  ApplicationAdStatus,
  ApplicationDetail,
  ApplicationFilterOption,
  ApplicationPositionContext,
  ApplicationPositionScope,
  ApplicationRow,
  ApplicationState,
  ApplicationsCenter,
  ApplicationsFilter,
  ApplicationsPage,
  ApplicationsTab,
  MarkReadResult,
  ShortlistAddResult,
} from "./applications-types";

/**
 * Codici applicativi sollevati dalle RPC. Stringhe stabili, non messaggi:
 * la copy vive nel livello di presentazione, perché lo stesso codice compare
 * in schermate diverse con parole diverse — §25 distingue l'indisponibilità
 * autorizzativa dall'errore tecnico proprio su questo.
 */
export type ApplicationsErrorCode =
  | "APPLICATIONS_CURSOR_INVALID"
  | "APPLICATIONS_NOT_AUTHORIZED"
  | "APPLICATIONS_TAB_INVALID"
  | "APPLICATION_NOT_AVAILABLE"
  | "APPLICATION_WITHDRAWN"
  | "SHORTLIST_NOT_AUTHORIZED"
  | "UNKNOWN";

const ERROR_CODES: readonly ApplicationsErrorCode[] = [
  "APPLICATIONS_CURSOR_INVALID",
  "APPLICATIONS_NOT_AUTHORIZED",
  "APPLICATIONS_TAB_INVALID",
  "APPLICATION_NOT_AVAILABLE",
  "APPLICATION_WITHDRAWN",
  "SHORTLIST_NOT_AUTHORIZED",
] as const;

export class ApplicationsAccessError extends Error {
  code: ApplicationsErrorCode;

  constructor(code: ApplicationsErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = "ApplicationsAccessError";
  }
}

export function toApplicationsError(error: unknown): ApplicationsAccessError {
  if (error instanceof ApplicationsAccessError) {
    return error;
  }

  /* Un timeout non è un rifiuto autorizzativo: §27 vieta di ritentare in
     loop il secondo — «Non usare Riprova in loop per una risorsa esclusa» —
     e impone retry limitati sul primo. Confonderli produce esattamente il
     comportamento sbagliato su entrambi. */
  if (error instanceof DashboardTimeoutError) {
    throw error;
  }

  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error ?? "");

  /* I codici più lunghi per primi: `APPLICATIONS_NOT_AUTHORIZED` contiene
     `APPLICATION_NOT_...` come sottostringa solo per combinazione, e un
     ordine arbitrario li confonderebbe. */
  const matched = [...ERROR_CODES]
    .sort((a, b) => b.length - a.length)
    .find((code) => message.includes(code));

  return new ApplicationsAccessError(matched ?? "UNKNOWN", message);
}

type RawRecord = Record<string, unknown>;

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function bool(value: unknown): boolean {
  return value === true;
}

/** `null` resta `null` (§9, §16): un dato non leggibile non è uno zero. */
function count(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    return Number(value);
  }

  return null;
}

function integer(value: unknown, fallback: number): number {
  return count(value) ?? fallback;
}

const PROFILE_TYPES: readonly ApplicantProfileType[] = [
  "player",
  "coach",
  "staff",
  "director",
];

function profileType(value: unknown): ApplicantProfileType | null {
  const raw = text(value);

  return raw && (PROFILE_TYPES as readonly string[]).includes(raw)
    ? (raw as ApplicantProfileType)
    : null;
}

function positionScope(value: unknown): ApplicationPositionScope {
  return text(value) === "society" ? "society" : "team";
}

/**
 * §7: «Utilizza un solo nome canonico per lo stato attivo.» L'enum del
 * database ne porta sei per ragioni storiche — la vecchia schermata
 * societaria faceva avanzare `reviewing`, `shortlisted`, `accepted`,
 * `rejected`. Per i lettori di questa task contano due fatti soli: ritirata
 * o no. Il resto non è un lifecycle che questo flusso espone.
 */
function applicationState(value: unknown): ApplicationState {
  return text(value) === "withdrawn" ? "withdrawn" : "active";
}

function adStatus(value: unknown): ApplicationAdStatus {
  return text(value) === "closed" ? "closed" : "published";
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        const id = text(item);

        return id ? [id] : [];
      })
    : [];
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
    throw toApplicationsError(error);
  }

  return data as T;
}

// ── Intestazione del Centro ─────────────────────────────────────────────────

export async function fetchApplicationsCenter(
  clubId: string,
): Promise<ApplicationsCenter> {
  const rows = await rpc<RawRecord[]>("fetch_society_applications_center", {
    p_club_id: clubId,
  });

  const row = Array.isArray(rows) ? rows[0] : null;

  if (!row) {
    throw new ApplicationsAccessError("APPLICATIONS_NOT_AUTHORIZED");
  }

  return {
    accessVerifiedAt: row.access_verified_at
      ? new Date(String(row.access_verified_at)).getTime()
      : Date.now(),
    canAddShortlist: bool(row.can_add_shortlist),
    canView: bool(row.can_view),
    clubId: text(row.club_id) ?? clubId,
    clubIsVerified: bool(row.club_is_verified),
    clubLogoUrl: text(row.club_logo_url),
    clubName: text(row.club_name) ?? "",
    dataRevision: integer(row.data_revision, 0),
    newCount: count(row.new_count),
    totalCount: count(row.total_count),
    scopeLabel: text(row.scope_label),
  };
}

// ── Opzioni dei filtri ──────────────────────────────────────────────────────

export async function fetchApplicationFilterOptions(
  clubId: string,
): Promise<ApplicationFilterOption[]> {
  const raw = await rpc<RawRecord[]>("fetch_society_application_filters", {
    p_club_id: clubId,
  });

  return (Array.isArray(raw) ? raw : []).flatMap((row): ApplicationFilterOption[] => {
    const kind = text(row.option_kind);
    const label = text(row.label);

    if (!label) {
      return [];
    }

    if (kind === "team") {
      const teamId = text(row.team_id);

      return teamId ? [{ kind: "team" as const, label, teamId }] : [];
    }

    if (kind === "position") {
      const adId = text(row.ad_id);

      return adId
        ? [
            {
              adId,
              group: text(row.group_key) === "closed" ? ("closed" as const) : ("active" as const),
              kind: "position" as const,
              label,
              sublabel: text(row.sublabel),
              teamId: text(row.team_id),
            },
          ]
        : [];
    }

    return [];
  });
}

// ── Lista ───────────────────────────────────────────────────────────────────

export const APPLICATIONS_PAGE_SIZE = 20;

function toRow(raw: RawRecord): ApplicationRow | null {
  const id = text(raw.application_id);
  const personId = text(raw.person_id);
  const adId = text(raw.ad_id);

  if (!id || !personId || !adId) {
    return null;
  }

  return {
    adId,
    adStatus: adStatus(raw.ad_status),
    id,
    isNew: bool(raw.is_new),
    latestSubmittedAt: text(raw.latest_submitted_at),
    personAvatarUrl: text(raw.person_avatar_url),
    personId,
    personName: text(raw.person_name) ?? "",
    personRole: profileType(raw.person_role),
    personSituation: text(raw.person_situation),
    positionScope: positionScope(raw.position_scope),
    roleLabel: text(raw.role_label) ?? "",
    state: applicationState(raw.status),
    submissionRevision: integer(raw.submission_revision, 1),
    targetRole: profileType(raw.target_role),
    teamId: text(raw.team_id),
    teamLabel: text(raw.team_label),
    withdrawnAt: text(raw.withdrawn_at),
  };
}

function toPositionContext(raw: unknown): ApplicationPositionContext | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }

  const row = raw as RawRecord;
  const adId = text(row.ad_id);

  if (!adId) {
    return null;
  }

  const status = adStatus(row.status);

  return {
    adId,
    group: text(row.group) === "closed" ? "closed" : "active",
    roleLabel: text(row.role_label) ?? "",
    scope: positionScope(row.scope),
    status,
    targetRole: profileType(row.target_role),
    teamId: text(row.team_id),
    teamLabel: text(row.team_label),
  };
}

export async function fetchApplicationsPage(input: {
  adId?: string | null;
  clubId: string;
  cursor?: string | null;
  filter?: ApplicationsFilter;
  limit?: number;
  tab: ApplicationsTab;
}): Promise<ApplicationsPage> {
  const limit = input.limit ?? APPLICATIONS_PAGE_SIZE;
  const filter = input.filter ?? { adIds: [], teamIds: [] };

  const rows = await rpc<RawRecord[]>("fetch_society_applications_page", {
    p_ad_id: input.adId ?? null,
    p_ad_ids: filter.adIds.length > 0 ? filter.adIds : null,
    p_club_id: input.clubId,
    p_cursor: input.cursor ?? null,
    p_limit: limit,
    p_tab: input.tab,
    p_team_ids: filter.teamIds.length > 0 ? filter.teamIds : null,
  });

  const row = Array.isArray(rows) ? rows[0] : null;

  if (!row) {
    return {
      asOf: null,
      effectiveFilter: { adIds: [], teamIds: [] },
      filteredNew: null,
      filteredOperative: null,
      filteredTotal: null,
      hasMore: false,
      nextCursor: null,
      positionContext: null,
      rows: [],
    };
  }

  const items = Array.isArray(row.items) ? (row.items as RawRecord[]) : [];
  const parsed = items.flatMap((item) => {
    const mapped = toRow(item);

    return mapped ? [mapped] : [];
  });

  const nextCursor = text(row.next_cursor);

  return {
    asOf: text(row.as_of),
    effectiveFilter: {
      adIds: stringList(row.effective_ad_ids),
      teamIds: stringList(row.effective_team_ids),
    },
    filteredNew: count(row.filtered_new),
    filteredOperative: count(row.filtered_operative),
    filteredTotal: count(row.filtered_total),
    /* `hasMore` è il cursore, non il conteggio delle righe: il server lo
       emette solo quando la pagina è piena, e fidarsi della lunghezza
       produrrebbe una pagina vuota in più a ogni multiplo esatto. */
    hasMore: Boolean(nextCursor),
    nextCursor,
    positionContext: toPositionContext(row.position_context),
    rows: parsed,
  };
}

// ── Dettaglio ───────────────────────────────────────────────────────────────

export async function fetchApplicationDetail(
  applicationId: string,
): Promise<ApplicationDetail> {
  const rows = await rpc<RawRecord[]>("fetch_society_application_detail", {
    p_application_id: applicationId,
  });

  const row = Array.isArray(rows) ? rows[0] : null;

  if (!row) {
    throw new ApplicationsAccessError("APPLICATION_NOT_AVAILABLE");
  }

  const id = text(row.application_id);
  const personId = text(row.person_id);
  const adId = text(row.ad_id);

  if (!id || !personId || !adId) {
    throw new ApplicationsAccessError("APPLICATION_NOT_AVAILABLE");
  }

  return {
    accessVerifiedAt: row.access_verified_at
      ? new Date(String(row.access_verified_at)).getTime()
      : Date.now(),
    adId,
    adStatus: adStatus(row.ad_status),
    canAddShortlist: bool(row.can_add_shortlist),
    canMessage: bool(row.can_message),
    clubId: text(row.club_id) ?? "",
    clubIsVerified: bool(row.club_is_verified),
    clubLogoUrl: text(row.club_logo_url),
    clubName: text(row.club_name) ?? "",
    createdAt: text(row.created_at),
    dataRevision: integer(row.data_revision, 0),
    group: text(row.ad_group) === "closed" ? "closed" : "active",
    id,
    inShortlist: bool(row.in_shortlist),
    isNew: bool(row.is_new),
    latestSubmittedAt: text(row.latest_submitted_at),
    personAvatarUrl: text(row.person_avatar_url),
    personId,
    personName: text(row.person_name) ?? "",
    personRole: profileType(row.person_role),
    personSituation: text(row.person_situation),
    positionScope: positionScope(row.position_scope),
    receivingClosed: bool(row.receiving_closed),
    roleLabel: text(row.role_label) ?? "",
    seasonLabel: text(row.season_label),
    state: applicationState(row.status),
    submissionRevision: integer(row.submission_revision, 1),
    targetRole: profileType(row.target_role),
    teamId: text(row.team_id),
    teamLabel: text(row.team_label),
    withdrawnAt: text(row.withdrawn_at),
  };
}

// ── Mutazioni ───────────────────────────────────────────────────────────────

/**
 * §8: «Invia al comando di lettura la revisione della submission realmente
 * visualizzata.» La revisione è quindi un parametro obbligatorio del
 * chiamante, non un valore che questa funzione va a rileggere: rileggerlo
 * annullerebbe la protezione contro la ricandidatura arrivata nel frattempo.
 */
export async function markApplicationRead(input: {
  applicationId: string;
  submissionRevision: number;
}): Promise<MarkReadResult> {
  const rows = await rpc<RawRecord[]>("mark_society_application_read", {
    p_application_id: input.applicationId,
    p_revision: input.submissionRevision,
  });

  const row = Array.isArray(rows) ? rows[0] : null;

  if (!row) {
    throw new ApplicationsAccessError("APPLICATION_NOT_AVAILABLE");
  }

  return {
    /* La RPC non restituisce l'id: il chiamante l'ha appena passato, e una
       colonna OUT con il nome di una colonna della tabella su cui scrive
       renderebbe ambiguo il suo `on conflict`. */
    id: input.applicationId,
    isNew: bool(row.is_new),
    marked: bool(row.marked),
    submissionRevision: integer(row.current_revision, input.submissionRevision),
  };
}

/**
 * §20: «Non fidarti di person_id, Society o position_id arbitrari inviati
 * dal client.» L'unico argomento è la candidatura; persona e Position le
 * risolve il server da lei.
 */
export async function addApplicationToShortlist(
  applicationId: string,
  /**
   * DAS-REV-24 §13: «Il retry usa la protezione idempotente della stessa
   * operazione finché il suo esito non è risolto.» La chiave la genera il
   * client, una per intenzione — un retry dopo timeout la riusa e replica
   * la ricevuta; una nuova aggiunta dopo una rimozione ne porta una nuova
   * ed è un'intenzione diversa (§20).
   */
  idempotencyKey: string | null = null,
): Promise<ShortlistAddResult> {
  /* DAS-REV-24 §26: il comando è ora quello del core unico.
     `add_position_shortlist_entry` resta come wrapper di compatibilità per
     i client non aggiornati, ma non porta la chiave idempotente. */
  const rows = await rpc<RawRecord[]>("add_application_to_shortlist", {
    p_application_id: applicationId,
    p_idempotency_key: idempotencyKey,
  });

  const row = Array.isArray(rows) ? rows[0] : null;

  if (!row) {
    throw new ApplicationsAccessError("APPLICATION_NOT_AVAILABLE");
  }

  return {
    /* `position_ref` e non `ad_id`: le colonne OUT della RPC non possono
       portare il nome di una colonna della tabella su cui scrive. */
    adId: text(row.position_ref) ?? "",
    already: bool(row.already),
    entryId: text(row.entry_id) ?? "",
    personId: text(row.person_ref) ?? "",
  };
}
