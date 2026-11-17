/**
 * Mi piace e Salva sui media di carriera (HOM-15 §174–§175).
 *
 * I media del json `media_items` dei profili professionali (più i due video
 * sintetici «profile-highlight-video» e «coach-technical-video») hanno un
 * target canonico lato server: content type `career_media`, content id =
 * l'uuid che il registro `career_media_items` assegna all'elemento
 * (migrazione 20261201090000). Il client conosce l'elemento per il suo `id`
 * nel json (`item_key`): `fetch_career_media_interactions` restituisce, per gli
 * elementi leggibili ora, la coppia chiave → uuid con lo stato Like/Salva.
 * Nessuna riga per un elemento = nessun controllo (profilo bloccato, elemento
 * legacy senza id persistito): meglio nessun controllo di uno che mente.
 */

import { supabase } from "../../../lib/supabase";
import { parseLikedAs } from "../../interactions/interaction-identity";
import type { LikeIdentityRef } from "../../interactions/interaction-types";

/** Il content type dei media di carriera: lo stesso per like-store, saved-store e RPC. */
export const CAREER_MEDIA_CONTENT_TYPE = "career_media";

export type CareerMediaInteraction = {
  /** L'`id` dell'elemento nel json (o la chiave del video sintetico). */
  itemKey: string;
  /** L'uuid canonico: il `post_id` di Mi piace e Salvati. */
  mediaId: string;
  likesCount: number;
  likedAs: LikeIdentityRef[];
  canLike: boolean;
  canSave: boolean;
  isSaved: boolean;
};

export type CareerMediaInteractions = {
  /** Istante (ms) in cui è partita la richiesta: il seed degli store (HOM-07 §141). */
  fetchedAt: number;
  byItemKey: ReadonlyMap<string, CareerMediaInteraction>;
};

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Righe grezze della RPC → stato per chiave. Una riga senza chiave o uuid si scarta. */
export function parseCareerMediaInteractions(
  rows: unknown,
  fetchedAt: number,
): CareerMediaInteractions {
  const byItemKey = new Map<string, CareerMediaInteraction>();

  for (const raw of Array.isArray(rows) ? rows : []) {
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const row = raw as Record<string, unknown>;
    const itemKey = str(row.item_key);
    const mediaId = str(row.media_id);
    if (!itemKey || !mediaId) {
      continue;
    }
    const likes = Number(row.likes_count);
    byItemKey.set(itemKey, {
      canLike: row.can_like === true,
      canSave: row.can_save === true,
      isSaved: row.is_saved === true,
      itemKey,
      likedAs: parseLikedAs(row.liked_as),
      likesCount: Number.isFinite(likes) && likes > 0 ? likes : 0,
      mediaId,
    });
  }

  return { byItemKey, fetchedAt };
}

export async function fetchCareerMediaInteractions(
  ownerProfileId: string,
): Promise<CareerMediaInteractions> {
  const fetchedAt = Date.now();
  const { data, error } = await supabase.rpc("fetch_career_media_interactions", {
    p_profile_id: ownerProfileId,
  });

  if (error) {
    throw error;
  }

  return parseCareerMediaInteractions(data, fetchedAt);
}
