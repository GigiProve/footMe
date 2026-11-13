/**
 * Eliminazione di un contenuto pubblicato (HOM-04 §45–47, §75–76, §100–101).
 *
 * Una sola RPC, `delete_content`, che rivalida identità, permesso e stato lato
 * server (§33) e registra l'audit (§99). L'esito è esplicito: il client sa con
 * certezza che il contenuto non è più pubblicamente disponibile (§101).
 *
 *  • `deleted` / `already_deleted` / `unavailable` → il contenuto non c'è più
 *    (§75: un secondo admin l'ha già eliminato; §65: non si rivela l'esistenza);
 *  • errcode 42501 → `ContentPermissionError`: il permesso è stato revocato (§70);
 *  • qualunque altro errore resta un errore: il contenuto NON si rimuove (§46, §69).
 */

import { supabase } from "../../lib/supabase";
import type { FeedContentType } from "./feed-types";

export type DeleteContentStatus = "deleted" | "already_deleted" | "unavailable";

export class ContentPermissionError extends Error {
  readonly kind = "permission_denied" as const;

  constructor() {
    super("content_permission_denied");
    this.name = "ContentPermissionError";
  }
}

export function isContentPermissionError(error: unknown): error is ContentPermissionError {
  return error instanceof ContentPermissionError;
}

const STATUSES: readonly DeleteContentStatus[] = ["deleted", "already_deleted", "unavailable"];

/** Pura: dal jsonb della RPC allo stato. Una risposta senza stato non è un esito. */
export function parseDeleteContentStatus(data: unknown): DeleteContentStatus {
  const raw = Array.isArray(data) ? data[0] : data;
  const status =
    typeof raw === "object" && raw !== null ? (raw as { status?: unknown }).status : raw;

  if (typeof status === "string" && STATUSES.includes(status as DeleteContentStatus)) {
    return status as DeleteContentStatus;
  }

  throw new Error("delete_content: risposta senza stato");
}

export async function deleteContent(
  contentType: FeedContentType,
  postId: string,
): Promise<{ status: DeleteContentStatus }> {
  const { data, error } = await supabase.rpc("delete_content", {
    p_content_type: contentType,
    p_post_id: postId,
  });

  if (error) {
    if (error.code === "42501") {
      throw new ContentPermissionError();
    }
    throw error;
  }

  return { status: parseDeleteContentStatus(data) };
}
