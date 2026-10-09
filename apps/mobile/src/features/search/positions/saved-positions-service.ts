/**
 * Lista "Salvate" di Posizioni aperte (DAS-REV-05 §15).
 *
 * Servizio separato da `searchPositionsPage` perché quella query filtra
 * `status = 'published'` ed è condivisa con Per te ed Esplora, che §15 vieta
 * di modificare: un gruppo "non più disponibili" lì dentro vorrebbe dire
 * allentare il predicato di pubblicazione per tutte e tre le tab.
 *
 * La classificazione, l'ordinamento e il `total_count` del gruppo arrivano dal
 * backend: §15 e §22 vietano di filtrare un dataset incompleto nel client.
 */

import { supabase } from "../../../lib/supabase";

export const SAVED_PAGE_SIZE = 20;

/** §15: i due filtri interni alla tab Salvate. */
export type SavedGroup = "available" | "unavailable";

/** §7: motivazioni canoniche, enumerate e autorizzate. */
export type SavedUnavailableReason = "closed" | "deadline_passed" | "withdrawn";

export type SavedPositionRow = {
  adId: string;
  category: string | null;
  clubId: string | null;
  clubLogoUrl: string | null;
  clubName: string;
  group: SavedGroup;
  /** Metadato secondario (§11): non è uno stato della posizione. */
  hasApplied: boolean;
  /** §16: la row è un link solo se il dettaglio esiste ed è accessibile. */
  isNavigable: boolean;
  location: string | null;
  role: string;
  savedAt: string;
  teamName: string | null;
  /** §17: data affidabile, oppure `null`. Mai inventata. */
  unavailableAt: string | null;
  unavailableReason: SavedUnavailableReason | null;
};

export type SavedPositionsPage = {
  rows: SavedPositionRow[];
  /** Totale del gruppo corrente lato server, non delle righe scaricate. */
  totalCount: number;
};

type RawRow = {
  ad_id: string;
  availability_group: string;
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
  total_count: number | string | null;
  unavailable_at: string | null;
  unavailable_reason: string | null;
};

const REASONS: SavedUnavailableReason[] = [
  "closed",
  "deadline_passed",
  "withdrawn",
];

function toReason(value: string | null): SavedUnavailableReason | null {
  return REASONS.find((reason) => reason === value) ?? null;
}

export async function fetchSavedPositionsPage({
  group,
  page,
  pageSize = SAVED_PAGE_SIZE,
}: {
  group: SavedGroup;
  page: number;
  pageSize?: number;
}): Promise<SavedPositionsPage> {
  const { data, error } = await supabase.rpc("fetch_saved_positions_page", {
    p_group: group,
    p_limit: pageSize,
    p_offset: page * pageSize,
  });

  if (error) {
    throw error;
  }

  const raw = (data ?? []) as RawRow[];

  return {
    rows: raw.map((item) => ({
      adId: item.ad_id,
      category: item.category,
      clubId: item.club_id,
      clubLogoUrl: item.club_logo_url,
      clubName: item.club_name ?? "",
      group: item.availability_group === "unavailable" ? "unavailable" : "available",
      hasApplied: item.has_applied ?? false,
      // In dubbio la row non è un link: §16 vieta di mostrare una navigazione
      // che sappiamo già condurre a un errore.
      isNavigable: item.is_navigable ?? false,
      location: item.location,
      role: item.role,
      savedAt: item.saved_at,
      teamName: item.team_name,
      unavailableAt: item.unavailable_at,
      unavailableReason: toReason(item.unavailable_reason),
    })),
    totalCount: Number(raw[0]?.total_count ?? 0),
  };
}

/** Chiave di cache: gruppo incluso, perché le due liste non si mescolano (§15). */
export function savedGroupQueryKey(profileId: string | null, group: SavedGroup) {
  return ["positions", "saved", profileId ?? "none", group] as const;
}

/**
 * Rimozione ottimistica di una risorsa dalle pagine già scaricate (§19).
 *
 * Il totale scende di uno **solo** se la pagina conteneva davvero la riga: è
 * il totale del gruppo, e decrementarlo per una risorsa che non vi
 * contribuiva (per esempio un unsave dallo storico mentre si guardano le
 * disponibili) direbbe una cosa falsa.
 */
export function removeAdFromPages(
  pages: SavedPositionsPage[],
  adId: string,
): SavedPositionsPage[] {
  return pages.map((page) => {
    const rows = page.rows.filter((row) => row.adId !== adId);

    return {
      rows,
      totalCount:
        rows.length === page.rows.length
          ? page.totalCount
          : Math.max(0, page.totalCount - 1),
    };
  });
}
