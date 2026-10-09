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
 * Due provider, non uno: le Posizioni salvate hanno il proprio, così il loro
 * fallimento resta locale al modulo mentre riepilogo, candidature e
 * aggiornamenti restano utilizzabili (§22). Riepilogo, segnali, requisiti,
 * candidature e aggiornamenti condividono invece la stessa fonte, e §21
 * vieta di duplicare la richiesta.
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
  /** Istante dell'ultimo evento professionale reale. Null = nessun evento. */
  lastEventAt: string | null;
  /** Stato raggiunto da quell'evento: distinto dallo stato corrente (§11). */
  lastEventTo: string | null;
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
  adId: string;
  applicationId: string;
  clubLogoUrl: string | null;
  clubName: string;
  eventStatus: string;
  occurredAt: string;
  role: string;
  status: string;
  teamName: string | null;
};

export type PersonalSavedPosition = {
  adId: string;
  category: string | null;
  clubId: string | null;
  clubLogoUrl: string | null;
  clubName: string;
  /** La posizione è ancora pubblicata. Una chiusa resta nei Salvati (§10). */
  isAvailable: boolean;
  location: string | null;
  role: string;
  savedAt: string;
  teamName: string | null;
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
  applications: PersonalApplication[];
  /** Scadenze eleggibili totali, prima del cap di due della fonte (§16). */
  deadlinesTotalCount: number;
  optionalSuggestion: PersonalSuggestion | null;
  /** Finestre effettive applicate dal backend, per la diagnostica. */
  policy: { promotionWindowDays: number; recencyDays: number };
  prioritySignals: PrioritySignal[];
  priorityTotalCount: number;
  recentUpdates: PersonalUpdate[];
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
    Array.isArray(candidate.applications) &&
    Array.isArray(candidate.recentUpdates) &&
    Array.isArray(candidate.prioritySignals) &&
    Array.isArray(candidate.requirements)
  );
}

export function isPersonalSavedPositions(
  value: unknown,
): value is PersonalSavedPosition[] {
  return Array.isArray(value);
}

type OverviewRow = {
  active_applications_count: number | null;
  applications_preview: unknown;
  deadlines_total_count: number | null;
  optional_suggestion: unknown;
  policy: unknown;
  priority_signals: unknown;
  priority_total_count: number | null;
  profile_requirements: unknown;
  recent_updates: unknown;
  saved_positions_count: number | null;
};

type RawApplication = {
  ad_id: string;
  category: string | null;
  club_logo_url: string | null;
  club_name: string | null;
  created_at: string;
  id: string;
  last_event_at: string | null;
  last_event_to: string | null;
  role: string;
  status: string;
  team_name: string | null;
};

type RawUpdate = {
  ad_id: string;
  application_id: string;
  club_logo_url: string | null;
  club_name: string | null;
  event_status: string;
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
    applications: asArray<RawApplication>(row.applications_preview).map(
      (item) => ({
        adId: item.ad_id,
        category: item.category,
        clubLogoUrl: item.club_logo_url,
        clubName: item.club_name ?? "",
        createdAt: item.created_at,
        id: item.id,
        lastEventAt: item.last_event_at,
        lastEventTo: item.last_event_to,
        role: item.role,
        status: item.status,
        teamName: item.team_name,
      }),
    ),
    deadlinesTotalCount: row.deadlines_total_count ?? 0,
    optionalSuggestion: (row.optional_suggestion as PersonalSuggestion) ?? null,
    policy: {
      promotionWindowDays: policy.deadline_promotion_window_days ?? 7,
      recencyDays: policy.application_update_recency_days ?? 7,
    },
    prioritySignals: asArray<RawSignal>(row.priority_signals).map(toSignal),
    priorityTotalCount: row.priority_total_count ?? 0,
    recentUpdates: asArray<RawUpdate>(row.recent_updates).map((item) => ({
      adId: item.ad_id,
      applicationId: item.application_id,
      clubLogoUrl: item.club_logo_url,
      clubName: item.club_name ?? "",
      eventStatus: item.event_status,
      occurredAt: item.occurred_at,
      role: item.role,
      status: item.status,
      teamName: item.team_name,
    })),
    requirements: asArray<PersonalRequirement>(row.profile_requirements),
    savedPositionsCount: row.saved_positions_count ?? 0,
  };
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
  is_available: boolean;
  location: string | null;
  role: string;
  saved_at: string;
  team_name: string | null;
};

export async function fetchPersonalSavedPositions(): Promise<
  PersonalSavedPosition[]
> {
  const { data, error } = await supabase.rpc(
    "fetch_dashboard_personal_saved_positions",
  );

  if (error) {
    throw error;
  }

  return asArray<RawSavedPosition>(data).map((item) => ({
    adId: item.ad_id,
    category: item.category,
    clubId: item.club_id,
    clubLogoUrl: item.club_logo_url,
    clubName: item.club_name ?? "",
    isAvailable: item.is_available,
    location: item.location,
    role: item.role,
    savedAt: item.saved_at,
    teamName: item.team_name,
  }));
}
