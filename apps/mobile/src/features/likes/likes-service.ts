/**
 * Lista di chi ha messo Mi piace (HOM-07 §45–§69, §165) →
 * `list_content_likers`.
 *
 * Ranking, filtri di visibilità (eliminati, sospesi, bloccati, §63) e controllo
 * di accesso al contenuto sono del server: conteggio e lista nascono dalla
 * stessa definizione (§68). Qui solo il ponte snake_case → camelCase e la
 * paginazione a cursore (§60–§61): mai migliaia di identità in una richiesta.
 */

import { supabase } from "../../lib/supabase";
import { isInteractionIdentityType } from "../interactions/interaction-identity";
import type { LikeActor, LikesCursor, LikesPage } from "./likes-types";

/** §60–§61: una pagina; il server limita a 50. */
export const LIKES_PAGE_SIZE = 30;

type LikerRow = {
  actor_type?: unknown;
  actor_id?: unknown;
  name?: unknown;
  avatar_url?: unknown;
  is_verified?: unknown;
  role?: unknown;
  club_name?: unknown;
  team_label?: unknown;
  club_category?: unknown;
  media_kind?: unknown;
  primary_position?: unknown;
  is_self?: unknown;
  is_following?: unknown;
  next_cursor?: unknown;
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function isCursor(value: unknown): value is LikesCursor {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Una riga con tipo o id sconosciuti non è una riga: si scarta senza rompere la pagina. */
export function mapLikerRow(row: LikerRow): LikeActor | null {
  if (!isInteractionIdentityType(row.actor_type) || typeof row.actor_id !== "string") {
    return null;
  }

  return {
    actorId: row.actor_id,
    actorType: row.actor_type,
    avatarUrl: text(row.avatar_url),
    clubCategory: text(row.club_category),
    clubName: text(row.club_name),
    isFollowing: row.is_following === true,
    isSelf: row.is_self === true,
    isVerified: row.is_verified === true,
    key: `${row.actor_type}:${row.actor_id}`,
    mediaKind: text(row.media_kind),
    name: text(row.name) ?? "",
    primaryPosition: text(row.primary_position),
    role: text(row.role),
    teamLabel: text(row.team_label),
  };
}

export async function fetchContentLikers(
  contentType: string,
  postId: string,
  cursor: LikesCursor | null,
  limit: number = LIKES_PAGE_SIZE,
): Promise<LikesPage> {
  const { data, error } = await supabase.rpc("list_content_likers", {
    p_content_type: contentType,
    p_cursor: cursor,
    p_limit: limit,
    p_post_id: postId,
  });

  if (error) {
    throw error;
  }

  const rows = (Array.isArray(data) ? data : []) as LikerRow[];
  const last = rows[rows.length - 1];

  return {
    items: rows.map(mapLikerRow).filter((item): item is LikeActor => item !== null),
    // Il cursore sta sull'ultima riga; `null` a lista finita.
    nextCursor: last && isCursor(last.next_cursor) ? last.next_cursor : null,
  };
}
