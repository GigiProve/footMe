/**
 * Payload pubblico del Master Profile Tifoso (REV-PROF-19).
 *
 * Owner e Visitor leggono di qui, dalla stessa RPC: la superficie è una sola
 * e deve mostrare gli stessi dati pubblici a entrambi. Ciò che il Tifoso ha
 * scelto in onboarding per personalizzare feed e ricerca — regioni, province,
 * "tutta Italia" — non passa da questa funzione e non raggiunge il client di
 * nessun visitatore: la proiezione è fatta nella RPC
 * (20261008160000_fan_master_profile.sql), non nascosta nel rendering.
 */
import { supabase } from "../../../lib/supabase";

/** Società del cuore risolta sull'entità canonica. */
export type FanFavoriteClub = {
  id: string;
  logoUrl: string | null;
  name: string;
  /** "Eccellenza · Sicilia", quando la società porta questi dati. */
  subtitle: string | null;
};

export type PublicFanProfile = {
  /**
   * Categorie seguite, normalizzate sul vocabolario sportivo condiviso
   * (`INTEREST_CATEGORY_OPTIONS`).
   */
  followedCategories: string[];
  /** Interessi calcistici: le macro-categorie di REV-ONB-08 §AF. */
  footballTypes: string[];
  favoriteClub: FanFavoriteClub | null;
  /**
   * Squadra del cuore salvata come testo libero prima che esistesse la
   * relazione canonica. Valorizzata solo in assenza di `favoriteClub`: non si
   * mostrano due squadre del cuore, e non si collega una stringa a una società
   * con un nome simile.
   */
  legacyFavoriteTeamName: string | null;
};

type PublicFanProfileRow = {
  favorite_club_id: string | null;
  favorite_club_logo_url: string | null;
  favorite_club_name: string | null;
  favorite_club_subtitle: string | null;
  favorite_team_name: string | null;
  football_types: string[] | null;
  interest_categories: string[] | null;
};

/**
 * Legge il profilo pubblico del Tifoso. `null` quando il profilo non esiste,
 * non è un Tifoso o c'è un blocco fra le due persone: in tutti e tre i casi
 * la risposta è "nessun dato pubblico", mai un payload parziale.
 */
export async function fetchPublicFanProfile(
  profileId: string,
): Promise<PublicFanProfile | null> {
  const { data, error } = await supabase.rpc("fetch_public_fan_profile", {
    target_profile_id: profileId,
  });

  if (error) {
    throw error;
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | PublicFanProfileRow
    | null
    | undefined;

  if (!row) {
    return null;
  }

  return {
    favoriteClub:
      row.favorite_club_id && row.favorite_club_name
        ? {
            id: row.favorite_club_id,
            logoUrl: row.favorite_club_logo_url,
            name: row.favorite_club_name,
            subtitle: row.favorite_club_subtitle,
          }
        : null,
    followedCategories: normalizeLabels(row.interest_categories),
    footballTypes: normalizeLabels(row.football_types),
    legacyFavoriteTeamName: normalizeText(row.favorite_team_name),
  };
}

function normalizeLabels(values: string[] | null | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = typeof value === "string" ? value.trim() : "";

    if (!trimmed || seen.has(trimmed.toLowerCase())) {
      continue;
    }

    seen.add(trimmed.toLowerCase());
    result.push(trimmed);
  }

  return result;
}

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}
