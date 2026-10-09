import { supabase } from "../../../lib/supabase";

/**
 * Adapter della Dashboard personale (master 01).
 *
 * Le risorse personali sono già protette dalla RLS dell'actor su se stesso
 * (`is_current_user`), quindi qui non serve una RPC: una select scoped sul
 * proprio profilo è esattamente ciò che il database consente e nulla di più.
 *
 * L'adapter è separato da quello Società anche se la riga visuale è la
 * stessa: riutilizzare l'archetipo non significa unificare i modelli (§7).
 */

/** Stati che il dominio considera una candidatura ancora "attiva". */
const ACTIVE_APPLICATION_STATUSES = [
  "submitted",
  "reviewing",
  "shortlisted",
] as const;

export type PersonalApplication = {
  adId: string;
  adTitle: string;
  clubLogoUrl: string | null;
  clubName: string;
  id: string;
  role: string;
  status: string;
};

export type PersonalSavedPosition = {
  adId: string;
  adTitle: string;
  clubLogoUrl: string | null;
  clubName: string;
  role: string;
};

export type PersonalDashboardData = {
  activeApplicationsCount: number;
  applications: PersonalApplication[];
  needsAvailability: boolean;
  savedPositions: PersonalSavedPosition[];
  savedPositionsCount: number;
};

type AdJoin = {
  club: { logo_url: string | null; name: string } | null;
  id: string;
  role_required: string;
  title: string;
};

/**
 * Un solo round trip per ciascun dominio, in parallelo. §20 vieta sia le
 * quindici richieste separate sia la risposta monolitica che attende il
 * dominio più lento: tre query indipendenti sono il compromesso onesto.
 */
export async function fetchPersonalDashboard(
  profileId: string,
): Promise<PersonalDashboardData> {
  const [applications, saved, availability] = await Promise.all([
    fetchApplications(profileId),
    fetchSavedPositions(profileId),
    fetchNeedsAvailability(profileId),
  ]);

  return {
    activeApplicationsCount: applications.activeCount,
    applications: applications.preview,
    needsAvailability: availability,
    savedPositions: saved.preview,
    savedPositionsCount: saved.count,
  };
}

async function fetchApplications(profileId: string) {
  // Il totale arriva da `count: exact`, non dalla lunghezza della preview:
  // §20 è esplicito su questo, ed è l'errore che rende i numeri inspiegabili.
  const { count, error: countError } = await supabase
    .from("recruiting_applications")
    .select("id", { count: "exact", head: true })
    .eq("applicant_profile_id", profileId)
    .in("status", ACTIVE_APPLICATION_STATUSES);

  if (countError) {
    throw countError;
  }

  const { data, error } = await supabase
    .from("recruiting_applications")
    .select(
      "id, status, ad:recruiting_ads!inner(id, title, role_required, club:clubs!inner(name, logo_url))",
    )
    .eq("applicant_profile_id", profileId)
    .in("status", ACTIVE_APPLICATION_STATUSES)
    .order("created_at", { ascending: false })
    .limit(3);

  if (error) {
    throw error;
  }

  const preview = (data ?? []).flatMap((row) => {
    const ad = row.ad as unknown as AdJoin | null;

    if (!ad) {
      return [];
    }

    return [
      {
        adId: ad.id,
        adTitle: ad.title,
        clubLogoUrl: ad.club?.logo_url ?? null,
        clubName: ad.club?.name ?? "",
        id: row.id as string,
        role: ad.role_required,
        status: row.status as string,
      },
    ];
  });

  return { activeCount: count ?? 0, preview };
}

async function fetchSavedPositions(profileId: string) {
  const { count, error: countError } = await supabase
    .from("saved_ads")
    .select("ad_id", { count: "exact", head: true })
    .eq("profile_id", profileId);

  if (countError) {
    throw countError;
  }

  const { data, error } = await supabase
    .from("saved_ads")
    .select(
      "ad_id, ad:recruiting_ads!inner(id, title, role_required, club:clubs!inner(name, logo_url))",
    )
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(3);

  if (error) {
    throw error;
  }

  const preview = (data ?? []).flatMap((row) => {
    const ad = row.ad as unknown as AdJoin | null;

    if (!ad) {
      return [];
    }

    return [
      {
        adId: ad.id,
        adTitle: ad.title,
        clubLogoUrl: ad.club?.logo_url ?? null,
        clubName: ad.club?.name ?? "",
        role: ad.role_required,
      },
    ];
  });

  return { count: count ?? 0, preview };
}

/**
 * Condizione della priorità "Completa la disponibilità" (master 01).
 *
 * Non è un suggerimento universale: compare solo per chi **ha dichiarato** un
 * ambito geografico ristretto (REGIONS o PROVINCES) ed è aperto a
 * trasferimenti, ma non ha poi indicato alcuna area. In quel caso la ricerca
 * per zona non può trovarlo, ed è un'attività concreta.
 *
 * Chi ha ambito ITALY è già coperto: §16 vieta di trasformare il mockup in un
 * obbligo di completamento per ogni utente.
 */
async function fetchNeedsAvailability(profileId: string): Promise<boolean> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_open_to_transfer")
    .eq("id", profileId)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profile?.is_open_to_transfer) {
    return false;
  }

  const { data, error } = await supabase
    .from("player_profiles")
    .select("availability_type, transfer_regions, transfer_provinces")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    // Non è un calciatore: la disponibilità geografica non è pertinente.
    return false;
  }

  if (data.availability_type === "REGIONS") {
    return (data.transfer_regions ?? []).length === 0;
  }

  if (data.availability_type === "PROVINCES") {
    return (data.transfer_provinces ?? []).length === 0;
  }

  return false;
}
