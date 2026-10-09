import { supabase } from "../../lib/supabase";
import { ACTIVE_APPLICATION_STATUSES } from "../dashboard/adapters/personal-adapter";

/**
 * Accesso canonico alle **proprie** candidature (DAS-REV-03 §9, §20).
 *
 * Perché esiste: la Dashboard deve poter aprire "Le mie candidature" e il
 * dettaglio di una candidatura tramite il suo ID, e nel progetto non
 * esisteva nessuna delle due superfici — `/(tabs)/announcements` è il
 * marketplace degli annunci, non la lista delle proprie candidature.
 *
 * §4 autorizza esattamente questo e nulla di più: «Se un componente di
 * preview necessario non esiste, realizzare il minimo componente condiviso e
 * funzionante richiesto da questa overview. Documentarlo come base da
 * estendere nei pack successivi, evitando una seconda implementazione.»
 *
 * Quindi qui non ci sono: ritiro, filtri avanzati, valutazione, messaggi,
 * ordinamenti alternativi. Sono di DAS-REV-04.
 *
 * Nessuna RPC: la RLS di `recruiting_applications` consente già al candidato
 * di leggere le proprie righe (`is_current_user(applicant_profile_id)`), e
 * una SECURITY DEFINER qui aggiungerebbe superficie senza aggiungere
 * capacità.
 */

export type ApplicationFilter = "all" | "active";

export type ApplicationListItem = {
  adId: string;
  category: string | null;
  clubLogoUrl: string | null;
  clubName: string;
  createdAt: string;
  id: string;
  role: string;
  status: string;
  teamName: string | null;
};

export type ApplicationEvent = {
  id: string;
  occurredAt: string;
  toStatus: string;
};

export type ApplicationDetail = ApplicationListItem & {
  adTitle: string;
  clubId: string | null;
  coverMessage: string | null;
  events: ApplicationEvent[];
};

const LIST_SELECT =
  "id, status, created_at, ad:recruiting_ads!inner(id, title, role_required, category, club:clubs!inner(id, name, logo_url), team:club_teams(name, category))";

type AdJoin = {
  category: string | null;
  club: { id: string; logo_url: string | null; name: string } | null;
  id: string;
  role_required: string;
  team: { category: string | null; name: string } | null;
  title: string;
};

type ApplicationRow = {
  ad: unknown;
  cover_message?: string | null;
  created_at: string;
  id: string;
  status: string;
};

function toListItem(row: ApplicationRow): ApplicationListItem | null {
  const ad = row.ad as AdJoin | null;

  if (!ad) {
    return null;
  }

  return {
    adId: ad.id,
    category: ad.team?.category ?? ad.category,
    clubLogoUrl: ad.club?.logo_url ?? null,
    clubName: ad.club?.name ?? "",
    createdAt: row.created_at,
    id: row.id,
    role: ad.role_required,
    status: row.status,
    teamName: ad.team?.name ?? null,
  };
}

const PAGE_SIZE = 20;

export async function fetchMyApplications(
  profileId: string,
  filter: ApplicationFilter,
  page: number,
): Promise<ApplicationListItem[]> {
  let query = supabase
    .from("recruiting_applications")
    .select(LIST_SELECT)
    .eq("applicant_profile_id", profileId);

  if (filter === "active") {
    query = query.in("status", ACTIVE_APPLICATION_STATUSES);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

  if (error) {
    throw error;
  }

  return (data ?? []).flatMap((row) => {
    const item = toListItem(row as unknown as ApplicationRow);

    return item ? [item] : [];
  });
}

export const APPLICATIONS_PAGE_SIZE = PAGE_SIZE;

export async function fetchApplicationDetail(
  profileId: string,
  applicationId: string,
): Promise<ApplicationDetail | null> {
  const [{ data, error }, { data: events, error: eventsError }] =
    await Promise.all([
      supabase
        .from("recruiting_applications")
        .select(`${LIST_SELECT}, cover_message`)
        .eq("id", applicationId)
        .eq("applicant_profile_id", profileId)
        .maybeSingle(),
      supabase
        .from("recruiting_application_events")
        .select("id, to_status, occurred_at")
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

  const row = data as unknown as ApplicationRow;
  const item = toListItem(row);

  if (!item) {
    return null;
  }

  const ad = row.ad as AdJoin;

  return {
    ...item,
    adTitle: ad.title,
    clubId: ad.club?.id ?? null,
    coverMessage: row.cover_message ?? null,
    events: (events ?? []).map((event) => ({
      id: event.id as string,
      occurredAt: event.occurred_at as string,
      toStatus: event.to_status as string,
    })),
  };
}
