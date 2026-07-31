/**
 * UI-facing filter STATE for Cerca > Media e contenuti, kept distinct from
 * `MediaSearchFilters` (media-search-types.ts) — the latter is the snake_case
 * jsonb payload the RPCs understand. `buildMediaFilterPayload` in
 * `media-filter-helpers.ts` is the only bridge between the two shapes.
 *
 * `resultKind` is not part of `MediaSearchFilters`: it decides *which* RPC the
 * screen queries (contenuti, fonti o entrambi), not what the RPC filters.
 */

import type {
  MediaContentFormat,
  MediaResultKind,
  MediaSourceFilterKind,
} from "./media-search-types";

export type MediaPublishedWithin = "any" | "today" | "last7" | "last30";

/**
 * "Relazione personale" (CER-05 §18). `followedSources` è esposto anche
 * dentro l'editor Fonte come voce "Fonti seguite", perché la task lo elenca
 * in entrambe le sezioni: resta un unico pezzo di stato.
 */
export type MediaRelationState = {
  followedSources: boolean;
  savedContents: boolean;
  followedClubs: boolean;
  followedProfiles: boolean;
};

export type MediaFiltersState = {
  resultKind: MediaResultKind;
  formats: MediaContentFormat[];
  sources: MediaSourceFilterKind[];
  categories: string[];
  regions: string[];
  provinces: string[];
  publishedWithin: MediaPublishedWithin;
  relation: MediaRelationState;
};

export function createDefaultMediaRelationState(): MediaRelationState {
  return {
    followedSources: false,
    savedContents: false,
    followedClubs: false,
    followedProfiles: false,
  };
}

export function createDefaultMediaFiltersState(): MediaFiltersState {
  return {
    resultKind: "all",
    formats: [],
    sources: [],
    categories: [],
    regions: [],
    provinces: [],
    publishedWithin: "any",
    relation: createDefaultMediaRelationState(),
  };
}
