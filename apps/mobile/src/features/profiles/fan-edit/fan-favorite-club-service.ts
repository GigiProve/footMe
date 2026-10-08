/**
 * Squadra del cuore: ricerca e lettura dell'entità canonica (REV-PROF-20,
 * schermata 3).
 *
 * Due letture, nessuna scrittura. La squadra del cuore è una relazione verso
 * `clubs`: il profilo Tifoso conserva l'identificativo e nient'altro —
 * denominazione, logo e categoria si leggono sempre da qui, così una società
 * che cambia categoria non lascia una copia vecchia dentro il profilo di chi
 * la tifa.
 *
 * `searchFanFavoriteClubs` passa dalla RPC dedicata invece che da
 * `search_teams`: quella restituisce anche i nomi scritti a mano nelle
 * carriere, che non sono entità e non possono diventare una relazione.
 */
import { supabase } from "../../../lib/supabase";

export type FanFavoriteClubOption = {
  id: string;
  logoUrl: string | null;
  name: string;
  /** "Eccellenza · Sicilia": serve a distinguere le omonimie. */
  subtitle: string | null;
};

type FanFavoriteClubRow = {
  club_id: string | null;
  logo_url: string | null;
  name: string | null;
  subtitle: string | null;
};

/** Query sotto i due caratteri: nessuna richiesta, nessun risultato. */
export const FAN_CLUB_SEARCH_MIN_LENGTH = 2;

export async function searchFanFavoriteClubs(
  query: string,
  limit = 20,
): Promise<FanFavoriteClubOption[]> {
  const trimmed = query.trim();

  if (trimmed.length < FAN_CLUB_SEARCH_MIN_LENGTH) {
    return [];
  }

  const { data, error } = await supabase.rpc("search_fan_favorite_clubs", {
    p_limit: limit,
    p_query: trimmed,
  });

  if (error) {
    throw error;
  }

  const seen = new Set<string>();
  const result: FanFavoriteClubOption[] = [];

  for (const row of (data ?? []) as FanFavoriteClubRow[]) {
    const id = row.club_id?.trim();
    const name = row.name?.trim();

    if (!id || !name || seen.has(id)) {
      continue;
    }

    seen.add(id);
    result.push({
      id,
      logoUrl: row.logo_url ?? null,
      name,
      subtitle: row.subtitle?.trim() || null,
    });
  }

  return result;
}

/**
 * La società attualmente scelta, letta dall'entità canonica. `null` quando la
 * relazione non porta più da nessuna parte — società eliminata, sospesa o
 * rifiutata: l'editor chiede allora una nuova scelta invece di mostrare una
 * card che rimanda a un profilo inesistente.
 */
export async function fetchFanFavoriteClub(
  clubId: string,
): Promise<FanFavoriteClubOption | null> {
  const { data, error } = await supabase
    .from("clubs")
    .select("id, name, logo_url, category, region, verification_status")
    .eq("id", clubId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const row = data as {
    category: string | null;
    id: string;
    logo_url: string | null;
    name: string | null;
    region: string | null;
    verification_status: string | null;
  };

  const status = row.verification_status ?? "unverified";

  if (status === "rejected" || status === "suspended") {
    return null;
  }

  return {
    id: row.id,
    logoUrl: row.logo_url ?? null,
    name: row.name?.trim() || "",
    subtitle: buildSubtitle(row.category, row.region),
  };
}

function buildSubtitle(
  category: string | null,
  region: string | null,
): string | null {
  const parts = [category?.trim(), region?.trim()].filter(
    (part): part is string => Boolean(part),
  );

  return parts.length > 0 ? parts.join(" · ") : null;
}
