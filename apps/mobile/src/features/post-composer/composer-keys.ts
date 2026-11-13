/**
 * Query key del composer Post (HOM-06.1 §76, §101, §146).
 *
 * Ogni dimensione che la cache deve distinguere è nella chiave: il contesto è
 * per utente (§18: le identity autorizzate cambiano con l'account), la ricerca
 * tag per query normalizzata, la modifica per tipo+id+utente, la preview per URL
 * normalizzato (§88: lo stesso URL non genera due preview).
 */

import type { FeedContentType } from "../feed/feed-types";

export const composerKeys = {
  all: ["post-composer"] as const,
  context: (userId: string) => ["post-composer", "context", userId] as const,
  edit: (userId: string, contentType: FeedContentType, contentId: string) =>
    ["post-composer", "edit", userId, contentType, contentId] as const,
  linkPreview: (normalizedUrl: string) => ["post-composer", "link-preview", normalizedUrl] as const,
  tagSearch: (userId: string, query: string) =>
    ["post-composer", "tag-search", userId, query.trim().toLowerCase()] as const,
};
