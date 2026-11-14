/**
 * Query key dei Salvati (HOM-07 §160).
 *
 * Le liste stanno sotto il prefisso storico `["saved-items"]` apposta: le
 * invalidazioni già esistenti (eliminazione contenuto HOM-04, composer, Cerca)
 * continuano a coprire anche il nuovo Saved Center senza essere toccate.
 * Una lista per categoria: cambiare tab non mescola dati né paginazione, e il
 * Back torna alla stessa categoria con la stessa lista (§115).
 */

import type { SavedCategory } from "./saved-types";

export const SAVED_QK = {
  counts: ["saved-counts"] as const,
  /** Prefisso di tutte le liste: serve a invalidarle insieme. */
  lists: ["saved-items"] as const,
  list: (category: SavedCategory, ownerId: string | null) =>
    ["saved-items", "list", ownerId, category] as const,
  /** Stato Salvato di un contenuto aperto in dettaglio (§133). */
  contentState: (contentType: string, postId: string) =>
    ["saved-content-state", contentType, postId] as const,
  /** Semina dei flag di Cerca: una query per pagina di id. */
  profileFlags: (ownerId: string | null, ids: readonly string[]) =>
    ["saved-profile-flags", ownerId, ids] as const,
  entityFlags: (entity: "club" | "team", ownerId: string | null, ids: readonly string[]) =>
    ["saved-entity-flags", entity, ownerId, ids] as const,
};
