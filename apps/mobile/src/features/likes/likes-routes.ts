/**
 * Destinazione della lista Mi piace (HOM-07 §45–§46).
 *
 * Una route sola, `/likes/[type]/[id]`, FUORI dalle tab: pagina detail con
 * «← Mi piace», senza chrome Home (niente PROLINK, tab, campanella, «+»). Tipo e
 * id insieme: lo stesso uuid non identifica un contenuto da solo (stessa regola
 * di `/content/[type]/[id]`). L'accesso al contenuto lo rivalida il server.
 */

import type { FeedContentType } from "../feed/feed-types";

export function likesHref(contentType: FeedContentType | string, postId: string): string {
  return `/likes/${contentType}/${postId}`;
}

function first(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw : "";
}

/** I due parametri della route, o `null` se uno manca: nessuna lista senza contenuto. */
export function parseLikesParams(params: {
  type?: string | string[];
  id?: string | string[];
}): { contentType: string; postId: string } | null {
  const contentType = first(params.type);
  const postId = first(params.id);

  return contentType && postId ? { contentType, postId } : null;
}
