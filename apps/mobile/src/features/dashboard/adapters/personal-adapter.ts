import { supabase } from "../../../lib/supabase";
import type { PrioritySignal } from "../priority/priority-types";

/**
 * Adapter della Dashboard personale (DAS-REV-03).
 *
 * DAS-REV-01 leggeva tre select dirette dal client. Non basta più: §15 chiede
 * che eligibility, autorizzazione e confronto temporale siano server-side, e
 * §11 che gli aggiornamenti nascano da eventi reali e non da `updated_at`.
 * Entrambe le cose vivono ora in `fetch_dashboard_personal_overview`.
 *
 * Tre provider, non uno. Le Posizioni salvate avevano già il proprio perché
 * §22 chiede che il loro errore resti locale; DAS-REV-04 §17 chiede la stessa
 * cosa per le candidature — lo screen 06 mostra il riepilogo caricato e le
 * sole preview in errore, e con un provider unico quello stato sarebbe una
 * finzione, perché il conteggio sparirebbe insieme alle righe.
 *
 * Restano quindi: riepilogo e priorità (`fetch_dashboard_personal_overview`),
 * candidature e aggiornamenti (`fetch_dashboard_personal_applications`),
 * posizioni salvate (`fetch_dashboard_personal_saved_positions`).
 */

/** Stati che il dominio considera una candidatura ancora "attiva". */
export const ACTIVE_APPLICATION_STATUSES = [
  "submitted",
  "reviewing",
  "shortlisted",
] as const;

export type PersonalApplication = {
  adId: string;
  category: string | null;
  clubLogoUrl: string | null;
  clubName: string;
  createdAt: string;
  id: string;
  /**
   * Aggiornamento non ancora consultato (DAS-REV-04 §12).
   *
   * Server-side e per **evento**, non per candidatura: un ack non deve
   * coprire un evento successivo arrivato nel frattempo.
   */
  hasUnreadUpdate: boolean;
  /** Istante dell'ultimo evento professionale reale. Null = nessun evento. */
  lastEventAt: string | null;
  /** Evento a cui si riferisce l'eventuale acknowledgement (§12). */
  lastEventId: string | null;
  /** 'status_change' oppure 'selection_completed' (DAS-REV-04 §11). */
  lastEventKind: string | null;
  /** Stato raggiunto da quell'evento: distinto dallo stato corrente (§11). */
  lastEventTo: string | null;
  /**
   * La posizione accetta ancora nuove candidature (DAS-REV-04 §7).
   *
   * Metadato secondario, mai uno stato: una posizione chiusa non conclude le
   * candidature già ricevute.
   */
  positionAccepting: boolean;
  role: string;
  status: string;
  teamName: string | null;
};

/**
 * Riga di "Aggiornamenti recenti" (§11).
 *
 * Tiene separati stato corrente (`status`), evento significativo
 * (`eventStatus`) e data dell'evento (`occurredAt`): sono tre cose diverse e
 * confonderle è il modo canonico di inventare un aggiornamento che non c'è.
 */
export type PersonalUpdate = {
  /** L'evento è già stato consultato su questo o su un altro dispositivo. */
  acknowledged: boolean;
  adId: string;
  applicationId: string;
  clubLogoUrl: string | null;
  clubName: string;
  eventId: string;
  /** 'status_change' oppure 'selection_completed' (DAS-REV-04 §11). */
  eventKind: string;
  eventStatus: string | null;
  /**
   * La candidatura è uscita dalle attive (DAS-REV-04 §13).
   *
   * Decide la destinazione: dettaglio per una ancora operativa, lista
   * Concluse per una conclusione informativa.
   */
  isCompleted: boolean;
  occurredAt: string;
  role: string;
  status: string;
  teamName: string | null;
};

/**
 * Riga della preview "Posizioni salvate" (DAS-REV-05 §9).
 *
 * Le preview contengono **solo** posizioni disponibili: le altre restano nei
 * Salvati ma vivono nel filtro "Non più disponibili" della lista CER (§12).
 * Il gruppo non è quindi un campo di questa riga — è la sua precondizione.
 */
export type PersonalSavedPosition = {
  adId: string;
  category: string | null;
  clubId: string | null;
  clubLogoUrl: string | null;
  clubName: string;
  /**
   * L'utente ha già inviato la propria candidatura (§11).
   *
   * Metadato secondario: non è uno stato della posizione, non la rende
   * indisponibile e non rimuove il bookmark. Qui serve soltanto a riconoscere
   * l'ordine deciso dal backend.
   */
  hasApplied: boolean;
  /** Il dettaglio è leggibile (§16). Una preview disponibile lo è sempre. */
  isNavigable: boolean;
  location: string | null;
  role: string;
  savedAt: string;
  teamName: string | null;
};

/** Motivazioni canoniche e autorizzate di indisponibilità (§7). */
export type SavedUnavailableReason =
  | "closed"
  | "deadline_passed"
  | "withdrawn";

/**
 * Aggiornamento informativo di indisponibilità (§13).
 *
 * È un evento, non uno stato: ha un id proprio perché §14 chiede di
 * riconoscerlo stabilmente, e lo stesso evento consegnato due volte deve
 * restare un solo aggiornamento.
 */
export type PersonalSavedUpdate = {
  adId: string;
  category: string | null;
  clubLogoUrl: string | null;
  clubName: string;
  eventId: string;
  occurredAt: string;
  reason: SavedUnavailableReason | null;
  role: string;
  teamName: string | null;
};

/**
 * Payload del modulo Posizioni salvate (§8, §9, §13).
 *
 * I conteggi stanno accanto alle preview ma non ne dipendono: §8 vieta
 * l'equivalenza fra totale e righe mostrate, e `unavailableCount` esiste
 * perché l'empty di §20 deve sapere che lo storico esiste **senza**
 * scaricarlo.
 */
export type PersonalSavedPositionsData = {
  availableCount: number;
  preview: PersonalSavedPosition[];
  recentUpdates: PersonalSavedUpdate[];
  unavailableCount: number;
};

/** Requisito canonico mancante, già risolto in copy e destinazione (§13). */
export type PersonalRequirement = {
  description: string;
  href: string;
  key: string;
};

/** Suggerimento facoltativo del profilo (§19). Mai un requisito. */
export type PersonalSuggestion = {
  href: string;
  key: string;
};

export type PersonalDashboardData = {
  activeApplicationsCount: number;
  /** Scadenze eleggibili totali, prima del cap di due della fonte (§16). */
  deadlinesTotalCount: number;
  optionalSuggestion: PersonalSuggestion | null;
  /** Finestre effettive applicate dal backend, per la diagnostica. */
  policy: { promotionWindowDays: number; recencyDays: number };
  prioritySignals: PrioritySignal[];
  priorityTotalCount: number;
  requirements: PersonalRequirement[];
  savedPositionsCount: number;
};

/** Forma minima accettata per riusare un record di cache. */
export function isPersonalDashboardData(
  value: unknown,
): value is PersonalDashboardData {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<PersonalDashboardData>;

  return (
    Array.isArray(candidate.prioritySignals) &&
    Array.isArray(candidate.requirements) &&
    typeof candidate.activeApplicationsCount === "number"
  );
}

/**
 * Dati del modulo Candidature (DAS-REV-04).
 *
 * `hasCompleted` è l'indicatore autorizzato di §16: dice che lo storico
 * esiste **senza scaricarlo**, ed è ciò che distingue "Nessuna candidatura
 * attiva" — con accesso alle Concluse — da "Nessuna candidatura ancora".
 */
export type PersonalApplicationsData = {
  applications: PersonalApplication[];
  hasCompleted: boolean;
  recentUpdates: PersonalUpdate[];
};

export function isPersonalApplicationsData(
  value: unknown,
): value is PersonalApplicationsData {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<PersonalApplicationsData>;

  return (
    Array.isArray(candidate.applications) &&
    Array.isArray(candidate.recentUpdates)
  );
}

export function isPersonalSavedPositionsData(
  value: unknown,
): value is PersonalSavedPositionsData {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<PersonalSavedPositionsData>;

  return (
    Array.isArray(candidate.preview) &&
    Array.isArray(candidate.recentUpdates) &&
    typeof candidate.availableCount === "number"
  );
}

type OverviewRow = {
  active_applications_count: number | null;
  deadlines_total_count: number | null;
  optional_suggestion: unknown;
  policy: unknown;
  priority_signals: unknown;
  priority_total_count: number | null;
  profile_requirements: unknown;
  saved_positions_count: number | null;
};

type ApplicationsRow = {
  applications_preview: unknown;
  has_completed: boolean | null;
  recent_updates: unknown;
};

type RawApplication = {
  ad_id: string;
  category: string | null;
  club_logo_url: string | null;
  club_name: string | null;
  created_at: string;
  has_unread_update: boolean | null;
  id: string;
  last_event_at: string | null;
  last_event_id: string | null;
  last_event_kind: string | null;
  last_event_to: string | null;
  position_accepting: boolean | null;
  role: string;
  status: string;
  team_name: string | null;
};

type RawUpdate = {
  acknowledged: boolean | null;
  ad_id: string;
  application_id: string;
  club_logo_url: string | null;
  club_name: string | null;
  event_id: string;
  event_kind: string;
  event_status: string | null;
  is_completed: boolean | null;
  occurred_at: string;
  role: string;
  status: string;
  team_name: string | null;
};

type RawSignal = {
  ad_title?: string | null;
  aggregation_key: string;
  club_name?: string | null;
  count: number;
  deadline_at?: string | null;
  deadline_timezone?: string | null;
  hub_href?: string | null;
  occurred_at: string;
  requirements?: PersonalRequirement[];
  role?: string | null;
  target_id: string;
  target_kind: string;
  team_name?: string | null;
  type_id: string;
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export async function fetchPersonalDashboard(): Promise<PersonalDashboardData> {
  const { data, error } = await supabase
    .rpc("fetch_dashboard_personal_overview")
    .maybeSingle();

  if (error) {
    throw error;
  }

  const row = (data ?? {}) as OverviewRow;
  const policy = (row.policy ?? {}) as Record<string, number>;

  return {
    activeApplicationsCount: row.active_applications_count ?? 0,
    deadlinesTotalCount: row.deadlines_total_count ?? 0,
    optionalSuggestion: (row.optional_suggestion as PersonalSuggestion) ?? null,
    policy: {
      promotionWindowDays: policy.deadline_promotion_window_days ?? 7,
      recencyDays: policy.application_update_recency_days ?? 7,
    },
    prioritySignals: asArray<RawSignal>(row.priority_signals).map(toSignal),
    priorityTotalCount: row.priority_total_count ?? 0,
    requirements: asArray<PersonalRequirement>(row.profile_requirements),
    savedPositionsCount: row.saved_positions_count ?? 0,
  };
}

/**
 * Preview delle candidature attive, aggiornamenti recenti ed esistenza dello
 * storico (DAS-REV-04 §17, §18).
 *
 * «Fornire separatamente il totale attivo e le preview limitate»: il totale
 * sta nel riepilogo, queste righe qui. Il backend ne manda al massimo tre; la
 * presentazione ne mostra normalmente due e usa la terza quando la
 * deduplicazione ne toglie una già promossa in alto (§10).
 */
export async function fetchPersonalApplications(): Promise<PersonalApplicationsData> {
  const { data, error } = await supabase
    .rpc("fetch_dashboard_personal_applications")
    .maybeSingle();

  if (error) {
    throw error;
  }

  const row = (data ?? {}) as ApplicationsRow;

  return {
    applications: asArray<RawApplication>(row.applications_preview).map(
      (item) => ({
        adId: item.ad_id,
        category: item.category,
        clubLogoUrl: item.club_logo_url,
        clubName: item.club_name ?? "",
        createdAt: item.created_at,
        hasUnreadUpdate: item.has_unread_update ?? false,
        id: item.id,
        lastEventAt: item.last_event_at,
        lastEventId: item.last_event_id,
        lastEventKind: item.last_event_kind,
        lastEventTo: item.last_event_to,
        // In dubbio la posizione accetta: il metadato "chiusa" è
        // un'affermazione sul dominio e §6 vieta di dedurla (§7).
        positionAccepting: item.position_accepting ?? true,
        role: item.role,
        status: item.status,
        teamName: item.team_name,
      }),
    ),
    hasCompleted: row.has_completed ?? false,
    recentUpdates: asArray<RawUpdate>(row.recent_updates).map((item) => ({
      acknowledged: item.acknowledged ?? false,
      adId: item.ad_id,
      applicationId: item.application_id,
      clubLogoUrl: item.club_logo_url,
      clubName: item.club_name ?? "",
      eventId: item.event_id,
      eventKind: item.event_kind,
      eventStatus: item.event_status,
      isCompleted: item.is_completed ?? false,
      occurredAt: item.occurred_at,
      role: item.role,
      status: item.status,
      teamName: item.team_name,
    })),
  };
}

/**
 * Consultazione persistente di un aggiornamento (§12).
 *
 * Si chiama **dopo** il caricamento riuscito della destinazione, non al tap:
 * «Il solo tap non basta se navigazione o caricamento falliscono.» È
 * idempotente server-side, quindi una seconda chiamata non è un errore e un
 * retry non produce effetti doppi.
 */
export async function acknowledgeApplicationEvent(
  eventId: string,
): Promise<void> {
  const { error } = await supabase.rpc("acknowledge_application_event", {
    p_event_id: eventId,
  });

  if (error) {
    throw error;
  }
}

/**
 * Il contesto della riga ("Attaccante · Varese Calcio") è composto qui dalle
 * sue parti, non precotto dal backend: §8 della Foundation chiede un
 * `contextLabel` localizzabile, e il ruolo va tradotto dal client con la
 * stessa tabella usata ovunque.
 */
function toSignal(raw: RawSignal): PrioritySignal {
  return {
    aggregationKey: raw.aggregation_key,
    contextLabel: null,
    count: raw.count,
    deadlineAt: raw.deadline_at ?? null,
    impact: null,
    occurredAt: raw.occurred_at,
    revision: 0,
    targetId: raw.target_id,
    targetKind: raw.target_kind as PrioritySignal["targetKind"],
    typeId: raw.type_id as PrioritySignal["typeId"],
    // Metadati specifici del tipo, letti dai builder di presentazione.
    payload: {
      adTitle: raw.ad_title ?? null,
      clubName: raw.club_name ?? null,
      deadlineTimezone: raw.deadline_timezone ?? null,
      hubHref: raw.hub_href ?? null,
      requirements: raw.requirements ?? [],
      role: raw.role ?? null,
      teamName: raw.team_name ?? null,
    },
  };
}

type RawSavedPosition = {
  ad_id: string;
  category: string | null;
  club_id: string | null;
  club_logo_url: string | null;
  club_name: string | null;
  has_applied: boolean | null;
  is_navigable: boolean | null;
  location: string | null;
  role: string;
  saved_at: string;
  team_name: string | null;
};

type RawSavedUpdate = {
  ad_id: string;
  category: string | null;
  club_logo_url: string | null;
  club_name: string | null;
  event_id: string;
  occurred_at: string;
  reason: string | null;
  role: string;
  team_name: string | null;
};

type SavedPositionsRow = {
  available_count: number | null;
  recent_updates: unknown;
  saved_preview: unknown;
  unavailable_count: number | null;
};

const UNAVAILABLE_REASONS: SavedUnavailableReason[] = [
  "closed",
  "deadline_passed",
  "withdrawn",
];

/**
 * Una reason sconosciuta non diventa testo a schermo (§7): resta `null` e la
 * row mostra il solo "Non più disponibile". Esporre un valore non enumerato
 * significherebbe rivelare una motivazione interna non autorizzata.
 */
function toReason(value: string | null): SavedUnavailableReason | null {
  return UNAVAILABLE_REASONS.find((reason) => reason === value) ?? null;
}

/**
 * Conteggi, preview e aggiornamenti delle Posizioni salvate (§8, §9, §13).
 *
 * Provider separato dal riepilogo: §21 chiede che il suo errore resti locale
 * al modulo — nello screen 06 i conteggi sono già a schermo e fallisce la
 * sola richiesta delle preview.
 */
export async function fetchPersonalSavedPositions(): Promise<PersonalSavedPositionsData> {
  const { data, error } = await supabase
    .rpc("fetch_dashboard_personal_saved_positions")
    .maybeSingle();

  if (error) {
    throw error;
  }

  const row = (data ?? {}) as SavedPositionsRow;

  return {
    availableCount: row.available_count ?? 0,
    preview: asArray<RawSavedPosition>(row.saved_preview).map((item) => ({
      adId: item.ad_id,
      category: item.category,
      clubId: item.club_id,
      clubLogoUrl: item.club_logo_url,
      clubName: item.club_name ?? "",
      hasApplied: item.has_applied ?? false,
      // In dubbio la row **non** è un link: §16 vieta di mostrare una
      // navigazione che sappiamo già condurre a un errore.
      isNavigable: item.is_navigable ?? false,
      location: item.location,
      role: item.role,
      savedAt: item.saved_at,
      teamName: item.team_name,
    })),
    recentUpdates: asArray<RawSavedUpdate>(row.recent_updates).map((item) => ({
      adId: item.ad_id,
      category: item.category,
      clubLogoUrl: item.club_logo_url,
      clubName: item.club_name ?? "",
      eventId: item.event_id,
      occurredAt: item.occurred_at,
      reason: toReason(item.reason),
      role: item.role,
      teamName: item.team_name,
    })),
    unavailableCount: row.unavailable_count ?? 0,
  };
}
