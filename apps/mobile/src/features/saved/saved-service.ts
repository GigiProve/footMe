/**
 * Accesso dati dei Salvati (HOM-07 §83–§84, §160–§167).
 *
 *  • scrittura unica: `set_saved` con `target_type` + `target_id` espliciti
 *    (§166–§167), per contenuti, profili, società, squadre e posizioni;
 *  • lettura per categoria: `list_saved`, keyset su `saved_at desc` (§120–§121);
 *  • stato di un contenuto aperto in dettaglio: `can_save` / `is_saved` di
 *    `fetch_content_interaction_state`.
 *
 * Ogni lettura che semina lo store porta `fetchedAt`, l'istante (ms) in cui la
 * richiesta è partita: lo store fa prevalere solo il dato server più recente
 * (§19, §141).
 *
 * Restano i lettori batch dei flag di Cerca (profili, società, squadre) e lo
 * stato iniziale del profilo pubblico: sono seed dello store, non stato
 * indipendente.
 */

import { supabase } from "../../lib/supabase";
import type { FeedContentType } from "../feed/feed-types";
import { parseSavedPage } from "./saved-presentation";
import type {
  SavedCategory,
  SavedCursor,
  SavedListRowWire,
  SavedPage,
  SavedTarget,
} from "./saved-types";

export const SAVED_PAGE_SIZE = 20;

/**
 * Salva o rimuove un target (§94–§100). Ritorna lo stato che il server ha
 * registrato; senza riga ricade sul valore richiesto. L'errore risale: è chi
 * ha aperto l'aggiornamento ottimistico a fare rollback.
 */
export async function setSavedRemote(target: SavedTarget, saved: boolean): Promise<boolean> {
  // Argomenti nominati: nella RPC `p_saved` precede `p_content_type`.
  const { data, error } = await supabase.rpc("set_saved", {
    p_content_type: target.type === "content" ? target.contentType : null,
    p_saved: saved,
    p_target_id: target.id,
    p_target_type: target.type,
  });

  if (error) {
    throw error;
  }

  const row = (Array.isArray(data) ? data[0] : data) as { is_saved?: boolean } | null | undefined;

  return typeof row?.is_saved === "boolean" ? row.is_saved : saved;
}

export type ContentSaveState = { canSave: boolean; isSaved: boolean; fetchedAt?: number };

/**
 * Stato Salvato di un contenuto per il suo dettaglio (§133). Null se il
 * contenuto non è leggibile ora (nessuna riga): niente segnalibro da mostrare.
 */
export async function fetchContentSaveState(
  contentType: FeedContentType,
  postId: string,
): Promise<ContentSaveState | null> {
  const fetchedAt = Date.now();
  const { data, error } = await supabase.rpc("fetch_content_interaction_state", {
    p_content_type: contentType,
    p_post_id: postId,
  });

  if (error) {
    throw error;
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { can_save?: boolean; is_saved?: boolean }
    | null
    | undefined;

  if (!row) {
    return null;
  }

  return { canSave: row.can_save === true, fetchedAt, isSaved: row.is_saved === true };
}

/** Una pagina di una categoria del Saved Center (§105, §120–§121, §160–§161). */
export async function fetchSavedPage(
  category: SavedCategory,
  cursor: SavedCursor | null,
  limit = SAVED_PAGE_SIZE,
): Promise<SavedPage> {
  const fetchedAt = Date.now();
  const { data, error } = await supabase.rpc("list_saved", {
    p_category: category,
    p_cursor: cursor,
    p_limit: limit,
  });

  if (error) {
    throw error;
  }

  return { ...parseSavedPage((data ?? []) as SavedListRowWire[]), fetchedAt };
}

export async function fetchProfileSaveState(
  ownerId: string,
  targetId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("saved_profiles")
    .select("owner_profile_id")
    .eq("owner_profile_id", ownerId)
    .eq("target_profile_id", targetId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data !== null;
}

/**
 * Batch save-state lookup for a page of profile rows (e.g. Cerca > Profili
 * results). Returns the subset of `targetIds` the owner has saved.
 */
export async function fetchSavedProfileIds(
  ownerId: string,
  targetIds: string[],
): Promise<Set<string>> {
  if (targetIds.length === 0) {
    return new Set();
  }

  const { data, error } = await supabase
    .from("saved_profiles")
    .select("target_profile_id")
    .eq("owner_profile_id", ownerId)
    .in("target_profile_id", targetIds);

  if (error) {
    throw error;
  }

  return new Set((data ?? []).map((row) => row.target_profile_id as string));
}

/**
 * Batch save-state lookup for a page of club rows (e.g. Cerca > Società
 * results). Returns the subset of `clubIds` the owner has saved.
 */
export async function fetchSavedClubIds(
  ownerId: string,
  clubIds: string[],
): Promise<Set<string>> {
  if (clubIds.length === 0) {
    return new Set();
  }

  const { data, error } = await supabase
    .from("saved_clubs")
    .select("club_id")
    .eq("owner_profile_id", ownerId)
    .in("club_id", clubIds);

  if (error) {
    throw error;
  }

  return new Set((data ?? []).map((row) => row.club_id as string));
}

/**
 * Batch save-state lookup for a page of team rows (e.g. Cerca > Società
 * results filtered to squadre interne). Returns the subset of `teamIds` the
 * owner has saved.
 */
export async function fetchSavedTeamIds(
  ownerId: string,
  teamIds: string[],
): Promise<Set<string>> {
  if (teamIds.length === 0) {
    return new Set();
  }

  const { data, error } = await supabase
    .from("saved_teams")
    .select("team_id")
    .eq("owner_profile_id", ownerId)
    .in("team_id", teamIds);

  if (error) {
    throw error;
  }

  return new Set((data ?? []).map((row) => row.team_id as string));
}

