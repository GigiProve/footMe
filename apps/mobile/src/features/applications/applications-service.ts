import { supabase } from "../../lib/supabase";

/**
 * Accesso canonico alle **proprie** candidature (DAS-REV-03 §9, DAS-REV-04
 * §14, §18).
 *
 * DAS-REV-03 leggeva `recruiting_applications` direttamente, con il filtro
 * "attive" espresso come un `in` sugli stati. DAS-REV-04 §6 separa tre
 * concetti che quel filtro confondeva — stato della candidatura,
 * disponibilità della posizione, conclusione della selezione — e Attive /
 * Concluse diventa una **classificazione derivata**, non un elenco di stati.
 *
 * Una classificazione derivata non è esprimibile in PostgREST: né il filtro
 * (serve `application_group()`), né l'ordinamento dello storico (serve la
 * data reale di conclusione, che vive su un evento o sulla posizione). Da qui
 * la RPC, che §18 chiede comunque: «Autorizzare prima di contare, ordinare e
 * applicare il limite» e «Non caricare l'intero dataset per filtrarlo nel
 * client».
 *
 * Il dettaglio resta una select diretta: la RLS di `recruiting_applications`
 * consente già al candidato di leggere le proprie righe
 * (`is_current_user(applicant_profile_id)`), e una SECURITY DEFINER lì
 * aggiungerebbe superficie senza aggiungere capacità.
 */

/** Gruppo della lista. È la classificazione del dominio, non uno stato. */
export type ApplicationGroup = "active" | "completed";

/**
 * Come il dominio spiega la conclusione (§7, §14).
 *
 * `status` — l'esito è già nello stato della candidatura (Accettata,
 * Rifiutata, Ritirata) e va mostrato con la sua label canonica.
 * `selection_completed` — la selezione è finita senza un esito per candidato:
 * vale il generico "Selezione conclusa", che §7 vieta di sostituire con
 * Rifiutata, Scartata o Non selezionato.
 */
export type ApplicationOutcome = "selection_completed" | "status";

export type ApplicationListItem = {
  adId: string;
  category: string | null;
  clubLogoUrl: string | null;
  clubName: string;
  /** Data reale della conclusione. Null = il dominio non la conosce (§14). */
  concludedAt: string | null;
  createdAt: string;
  group: ApplicationGroup;
  id: string;
  /** Evento più recente: è ciò a cui si riferisce l'acknowledgement (§12). */
  lastEventId: string | null;
  outcome: ApplicationOutcome | null;
  /** La posizione accetta ancora nuove candidature (§7). */
  positionAccepting: boolean;
  role: string;
  status: string;
  teamName: string | null;
};

export type ApplicationPage = {
  items: ApplicationListItem[];
  nextCursor: string | null;
};

export type ApplicationEvent = {
  id: string;
  kind: string;
  occurredAt: string;
  toStatus: string | null;
};

export type ApplicationDetail = {
  adId: string;
  adTitle: string;
  category: string | null;
  clubId: string | null;
  clubLogoUrl: string | null;
  clubName: string;
  concludedAt: string | null;
  coverMessage: string | null;
  createdAt: string;
  events: ApplicationEvent[];
  group: ApplicationGroup;
  id: string;
  outcome: ApplicationOutcome | null;
  positionAccepting: boolean;
  role: string;
  status: string;
  teamName: string | null;
};

const TERMINAL_STATUSES = ["accepted", "rejected", "withdrawn"];

const DETAIL_SELECT =
  "id, status, created_at, cover_message, ad:recruiting_ads!inner(id, title, role_required, category, status, application_deadline_at, selection_completed_at, club:clubs!inner(id, name, logo_url), team:club_teams(name, category))";

type AdJoin = {
  application_deadline_at: string | null;
  category: string | null;
  club: { id: string; logo_url: string | null; name: string } | null;
  id: string;
  role_required: string;
  selection_completed_at: string | null;
  status: string;
  team: { category: string | null; name: string } | null;
  title: string;
};

type RawListItem = {
  ad_id: string;
  category: string | null;
  club_logo_url: string | null;
  club_name: string | null;
  concluded_at: string | null;
  created_at: string;
  group: string;
  id: string;
  last_event_id: string | null;
  outcome: string | null;
  position_accepting: boolean | null;
  role: string;
  status: string;
  team_name: string | null;
};

const PAGE_SIZE = 20;

export const APPLICATIONS_PAGE_SIZE = PAGE_SIZE;

export async function fetchMyApplicationsPage(
  group: ApplicationGroup,
  cursor: string | null,
): Promise<ApplicationPage> {
  const { data, error } = await supabase
    .rpc("fetch_my_applications_page", {
      p_cursor: cursor,
      p_group: group,
      p_limit: PAGE_SIZE,
    })
    .maybeSingle();

  if (error) {
    throw error;
  }

  const row = (data ?? {}) as { items: unknown; next_cursor: string | null };
  const items = Array.isArray(row.items) ? (row.items as RawListItem[]) : [];

  return {
    items: items.map(toListItem),
    nextCursor: row.next_cursor ?? null,
  };
}

function toListItem(raw: RawListItem): ApplicationListItem {
  return {
    adId: raw.ad_id,
    category: raw.category,
    clubLogoUrl: raw.club_logo_url,
    clubName: raw.club_name ?? "",
    concludedAt: raw.concluded_at,
    createdAt: raw.created_at,
    group: raw.group === "completed" ? "completed" : "active",
    id: raw.id,
    lastEventId: raw.last_event_id,
    outcome: toOutcome(raw.outcome),
    // In dubbio la posizione accetta: dichiararla chiusa è un'affermazione
    // sul dominio, e §6 vieta di dedurla (§7).
    positionAccepting: raw.position_accepting ?? true,
    role: raw.role,
    status: raw.status,
    teamName: raw.team_name,
  };
}

function toOutcome(value: string | null): ApplicationOutcome | null {
  return value === "selection_completed" || value === "status" ? value : null;
}

export async function fetchApplicationDetail(
  profileId: string,
  applicationId: string,
): Promise<ApplicationDetail | null> {
  const [{ data, error }, { data: events, error: eventsError }] =
    await Promise.all([
      supabase
        .from("recruiting_applications")
        .select(DETAIL_SELECT)
        .eq("id", applicationId)
        .eq("applicant_profile_id", profileId)
        .maybeSingle(),
      supabase
        .from("recruiting_application_events")
        .select("id, to_status, occurred_at, event_kind")
        .eq("application_id", applicationId)
        .order("occurred_at", { ascending: false }),
    ]);

  if (error) {
    throw error;
  }

  if (eventsError) {
    throw eventsError;
  }

  if (!data) {
    return null;
  }

  const row = data as unknown as {
    ad: unknown;
    cover_message: string | null;
    created_at: string;
    id: string;
    status: string;
  };
  const ad = row.ad as AdJoin | null;

  if (!ad) {
    return null;
  }

  const timeline: ApplicationEvent[] = (events ?? []).map((event) => ({
    id: event.id as string,
    kind: (event.event_kind as string) ?? "status_change",
    occurredAt: event.occurred_at as string,
    toStatus: (event.to_status as string | null) ?? null,
  }));

  // Stessa classificazione del backend, sugli stessi fatti: lo stato
  // terminale vince, poi la conclusione della selezione (§6). La posizione
  // chiusa e la scadenza non entrano mai in questo giudizio.
  const isTerminal = TERMINAL_STATUSES.includes(row.status);
  const isCompleted = isTerminal || !!ad.selection_completed_at;

  return {
    adId: ad.id,
    adTitle: ad.title,
    category: ad.team?.category ?? ad.category,
    clubId: ad.club?.id ?? null,
    clubLogoUrl: ad.club?.logo_url ?? null,
    clubName: ad.club?.name ?? "",
    // §14: la data della conclusione è quella dell'evento reale; in sua
    // assenza quella dichiarata sulla posizione. Mai la chiusura
    // dell'annuncio, mai una data con un altro significato.
    concludedAt: isCompleted
      ? (timeline.find(
          (event) =>
            event.kind === "selection_completed" ||
            (event.toStatus !== null &&
              TERMINAL_STATUSES.includes(event.toStatus)),
        )?.occurredAt ??
        ad.selection_completed_at ??
        null)
      : null,
    coverMessage: row.cover_message ?? null,
    createdAt: row.created_at,
    events: timeline,
    group: isCompleted ? "completed" : "active",
    id: row.id,
    outcome: isCompleted ? (isTerminal ? "status" : "selection_completed") : null,
    positionAccepting:
      ad.status === "published" &&
      (!ad.application_deadline_at ||
        Date.parse(ad.application_deadline_at) > Date.now()),
    role: ad.role_required,
    status: row.status,
    teamName: ad.team?.name ?? null,
  };
}
