/**
 * Query key di bozze e programmati (HOM-06.2 §234–§239).
 *
 * Le liste sono per utente e per tab: Bozze e Programmati si cachano separate
 * (§234) e restano visibili durante il refresh (§236, §238). Il launcher è per
 * utente: le identity e i contatori cambiano con l'account.
 */

import type { ContentRef, DraftsTab } from "./publishing-types";

export const publishingKeys = {
  all: ["publishing"] as const,
  launcher: (userId: string) => ["publishing", "launcher", userId] as const,
  lists: (userId: string) => ["publishing", "list", userId] as const,
  list: (userId: string, tab: DraftsTab) => ["publishing", "list", userId, tab] as const,
  editor: (userId: string, ref: ContentRef) =>
    ["publishing", "editor", userId, ref.contentType, ref.contentId] as const,
};
