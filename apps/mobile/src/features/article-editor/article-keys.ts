/**
 * Query key dell'editor Articolo (HOM-06.2). Il contesto è per utente (le
 * identity autorizzate cambiano con l'account, §16), il dettaglio pubblico per
 * contenuto, la fonte per URL (lo stesso URL non genera due fetch, §7I), la copia
 * locale per utente e bozza (§125–§127).
 */

import type { FeedContentType } from "../feed/feed-types";

export const articleKeys = {
  all: ["article-editor"] as const,
  context: (userId: string) => ["article-editor", "context", userId] as const,
  detail: (contentType: FeedContentType, contentId: string) =>
    ["article-editor", "detail", contentType, contentId] as const,
  /** `scope` = `new` o `<content_type>:<content_id>` della bozza riaperta. */
  local: (userId: string, scope: string) => ["article-editor", "local", userId, scope] as const,
};
