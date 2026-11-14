/**
 * Accesso ai dati del dominio Mi piace per identità (HOM-07 §10–§12, §165, §168).
 *
 *  • `fetchInteractionIdentities` → `fetch_interaction_identities`: le identità
 *    con cui l'utente può interagire (le stesse con cui può pubblicare);
 *  • `loadInteractionIdentity`: elenco + ultima identità Dashboard (preferenza
 *    locale, solo lettura) → l'identità corrente, derivata e mai scelta (§11);
 *  • `setContentLike` → `set_content_like`: Mi piace come STATO desiderato, mai
 *    «inverti» (§18). Il server rivalida identità e accesso al contenuto (§168,
 *    §170, §172) e restituisce il conteggio reale (§19).
 */

import { supabase } from "../../lib/supabase";
import { readLastIdentityId } from "../dashboard/identity/identity-preference";
import {
  isInteractionIdentityType,
  resolveInteractionIdentity,
} from "./interaction-identity";
import type { InteractionIdentity } from "./interaction-types";

type IdentityRow = {
  identity_type?: unknown;
  identity_id?: unknown;
  name?: unknown;
  avatar_url?: unknown;
  is_verified?: unknown;
  rank?: unknown;
};

/**
 * L'elenco arriva intero e ordinato dal database. Una riga con tipo o id
 * sconosciuti (client più vecchio del backend) si scarta senza far cadere le
 * altre.
 */
export async function fetchInteractionIdentities(): Promise<InteractionIdentity[]> {
  const { data, error } = await supabase.rpc("fetch_interaction_identities");

  if (error) {
    throw error;
  }

  const rows = (Array.isArray(data) ? data : []) as IdentityRow[];

  return rows.flatMap((row, index): InteractionIdentity[] => {
    if (!isInteractionIdentityType(row.identity_type) || typeof row.identity_id !== "string") {
      return [];
    }

    return [
      {
        avatarUrl: typeof row.avatar_url === "string" ? row.avatar_url : null,
        id: row.identity_id,
        isVerified: row.is_verified === true,
        name: typeof row.name === "string" ? row.name : "",
        rank: typeof row.rank === "number" ? row.rank : index,
        type: row.identity_type,
      },
    ];
  });
}

/**
 * L'identità di interazione corrente di un utente: l'ultima usata in Dashboard
 * se ancora autorizzata, altrimenti la personale, altrimenti la prima (§11).
 * `null` solo se il server non restituisce nessuna identità.
 */
export async function loadInteractionIdentity(
  profileId: string,
): Promise<InteractionIdentity | null> {
  const [identities, storedId] = await Promise.all([
    fetchInteractionIdentities(),
    readLastIdentityId(profileId),
  ]);

  return resolveInteractionIdentity(identities, storedId);
}

export type SetContentLikeResult = { likesCount: number; isLiked: boolean };

export async function setContentLike(
  contentType: string,
  postId: string,
  liked: boolean,
  identity: Pick<InteractionIdentity, "type" | "id">,
): Promise<SetContentLikeResult> {
  const { data, error } = await supabase.rpc("set_content_like", {
    p_content_type: contentType,
    p_identity_id: identity.id,
    p_identity_type: identity.type,
    p_liked: liked,
    p_post_id: postId,
  });

  if (error) {
    throw error;
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { likes_count?: unknown; is_liked?: unknown }
    | null
    | undefined;

  // `likes_count` è un bigint: PostgREST può consegnarlo come stringa.
  const likesCount =
    typeof row?.likes_count === "string" && row.likes_count.trim() !== ""
      ? Number(row.likes_count)
      : row?.likes_count;

  // Una risposta senza conteggio non è uno stato: meglio l'errore (e il
  // ritorno all'ultimo stato confermato) che uno «0» inventato.
  if (
    !row ||
    typeof likesCount !== "number" ||
    !Number.isFinite(likesCount) ||
    typeof row.is_liked !== "boolean"
  ) {
    throw new Error("set_content_like: risposta senza stato");
  }

  return { isLiked: row.is_liked, likesCount };
}
