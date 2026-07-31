/**
 * Bridge between the Cerca > Media e contenuti filter STATE
 * (`MediaFiltersState`) and the jsonb payload the RPCs read
 * (`MediaSearchFilters`), plus the summaries / chips / reset helpers the
 * filters modal and results screen need.
 *
 * Mirrors `club-filters/club-filter-helpers.ts` — same responsibilities, same
 * naming, so the two verticals stay readable side by side.
 */

import {
  MEDIA_FORMAT_OPTIONS,
  MEDIA_PUBLISHED_OPTIONS,
  MEDIA_RELATION_OPTIONS,
  MEDIA_RESULT_KIND_OPTIONS,
  MEDIA_SORT_OPTIONS,
  MEDIA_SOURCE_OPTIONS,
  type MediaFilterSectionId,
} from "./media-filter-configs";
import {
  createDefaultMediaFiltersState,
  createDefaultMediaRelationState,
  type MediaFiltersState,
} from "./media-filter-types";
import type { MediaSearchFilters, MediaSearchSort } from "./media-search-types";

const NO_FILTER_LABEL = undefined;

// ────────────────────────────────
// State -> jsonb payload
// ────────────────────────────────

/**
 * Only non-empty constraints reach the payload: an empty array or a false
 * toggle is omitted entirely, so `isMediaFiltersEmpty` can collapse "no
 * constraints" to null and keep the TanStack query key stable.
 *
 * `resultKind` is deliberately absent: it selects which RPC to call, not what
 * the RPC filters.
 */
export function buildMediaFilterPayload(state: MediaFiltersState): MediaSearchFilters {
  const payload: MediaSearchFilters = {};

  if (state.formats.length > 0) {
    payload.formats = [...state.formats];
  }

  if (state.sources.length > 0) {
    payload.sources = [...state.sources];
  }

  if (state.categories.length > 0) {
    payload.categories = [...state.categories];
  }

  if (state.regions.length > 0) {
    payload.regions = [...state.regions];
  }

  if (state.provinces.length > 0) {
    payload.provinces = [...state.provinces];
  }

  if (state.publishedWithin !== "any") {
    payload.published_within = state.publishedWithin;
  }

  if (state.relation.savedContents) {
    payload.saved = true;
  }

  if (state.relation.followedSources) {
    payload.followed_sources = true;
  }

  if (state.relation.followedClubs) {
    payload.followed_clubs = true;
  }

  if (state.relation.followedProfiles) {
    payload.followed_profiles = true;
  }

  return payload;
}

export function isMediaFiltersEmpty(
  filters: MediaSearchFilters | null | undefined,
): boolean {
  if (!filters) {
    return true;
  }

  return Object.keys(filters).length === 0;
}

// ────────────────────────────────
// Active count
// ────────────────────────────────

export function countActiveMediaFilters(state: MediaFiltersState): number {
  let count = 0;

  if (state.resultKind !== "all") count += 1;

  count += state.formats.length;
  count += state.sources.length;
  count += state.categories.length;
  count += state.regions.length;
  count += state.provinces.length;

  if (state.publishedWithin !== "any") count += 1;

  for (const option of MEDIA_RELATION_OPTIONS) {
    if (state.relation[option.value]) count += 1;
  }

  return count;
}

// ────────────────────────────────
// Section summaries
// ────────────────────────────────

function summarizeList(values: string[]): string | undefined {
  if (values.length === 0) return NO_FILTER_LABEL;
  const [first] = values;
  return values.length > 1 ? `${first} +${values.length - 1}` : first;
}

export function mediaSectionSummary(
  sectionId: MediaFilterSectionId,
  state: MediaFiltersState,
): string | undefined {
  switch (sectionId) {
    case "risultato": {
      if (state.resultKind === "all") return undefined;
      return MEDIA_RESULT_KIND_OPTIONS.find((o) => o.value === state.resultKind)?.label;
    }
    case "tipo": {
      const labels = MEDIA_FORMAT_OPTIONS.filter((o) =>
        state.formats.includes(o.value),
      ).map((o) => o.label);
      return summarizeList(labels);
    }
    case "fonte": {
      const labels = MEDIA_SOURCE_OPTIONS.filter((o) =>
        state.sources.includes(o.value),
      ).map((o) => o.label);
      if (state.relation.followedSources) {
        labels.push("Fonti seguite");
      }
      return summarizeList(labels);
    }
    case "categoria":
      return summarizeList(state.categories);
    case "zona":
      return summarizeList([...state.regions, ...state.provinces]);
    case "data": {
      if (state.publishedWithin === "any") return undefined;
      return MEDIA_PUBLISHED_OPTIONS.find((o) => o.value === state.publishedWithin)?.label;
    }
    case "relazione": {
      const labels = MEDIA_RELATION_OPTIONS.filter((o) => state.relation[o.value]).map(
        (o) => o.label,
      );
      return labels.length > 0 ? labels.join(" • ") : undefined;
    }
    default:
      return undefined;
  }
}

// ────────────────────────────────
// Reset helpers
// ────────────────────────────────

export function resetMediaSection(
  sectionId: MediaFilterSectionId,
  state: MediaFiltersState,
): MediaFiltersState {
  switch (sectionId) {
    case "risultato":
      return { ...state, resultKind: "all" };
    case "tipo":
      return { ...state, formats: [] };
    case "fonte":
      return {
        ...state,
        relation: { ...state.relation, followedSources: false },
        sources: [],
      };
    case "categoria":
      return { ...state, categories: [] };
    case "zona":
      return { ...state, provinces: [], regions: [] };
    case "data":
      return { ...state, publishedWithin: "any" };
    case "relazione":
      return { ...state, relation: createDefaultMediaRelationState() };
    default:
      return state;
  }
}

export function resetMediaFilters(): MediaFiltersState {
  return createDefaultMediaFiltersState();
}

// ────────────────────────────────
// Sort
// ────────────────────────────────

export function mediaSortOptions(): { label: string; value: MediaSearchSort }[] {
  return [...MEDIA_SORT_OPTIONS];
}

// ────────────────────────────────
// Removable active-filter chips
// ────────────────────────────────

export type MediaActiveChip = {
  id: string;
  label: string;
  remove: (state: MediaFiltersState) => MediaFiltersState;
};

export function buildMediaActiveChips(state: MediaFiltersState): MediaActiveChip[] {
  const chips: MediaActiveChip[] = [];

  if (state.resultKind !== "all") {
    const label =
      MEDIA_RESULT_KIND_OPTIONS.find((o) => o.value === state.resultKind)?.label ??
      state.resultKind;
    chips.push({
      id: "result-kind",
      label,
      remove: (s) => ({ ...s, resultKind: "all" }),
    });
  }

  for (const option of MEDIA_FORMAT_OPTIONS) {
    if (state.formats.includes(option.value)) {
      chips.push({
        id: `format-${option.value}`,
        label: option.label,
        remove: (s) => ({
          ...s,
          formats: s.formats.filter((value) => value !== option.value),
        }),
      });
    }
  }

  for (const option of MEDIA_SOURCE_OPTIONS) {
    if (state.sources.includes(option.value)) {
      chips.push({
        id: `source-${option.value}`,
        label: option.label,
        remove: (s) => ({
          ...s,
          sources: s.sources.filter((value) => value !== option.value),
        }),
      });
    }
  }

  for (const category of state.categories) {
    chips.push({
      id: `categoria-${category}`,
      label: category,
      remove: (s) => ({
        ...s,
        categories: s.categories.filter((value) => value !== category),
      }),
    });
  }

  for (const region of state.regions) {
    chips.push({
      id: `region-${region}`,
      label: region,
      remove: (s) => ({ ...s, regions: s.regions.filter((value) => value !== region) }),
    });
  }

  for (const province of state.provinces) {
    chips.push({
      id: `province-${province}`,
      label: province,
      remove: (s) => ({
        ...s,
        provinces: s.provinces.filter((value) => value !== province),
      }),
    });
  }

  if (state.publishedWithin !== "any") {
    const label =
      MEDIA_PUBLISHED_OPTIONS.find((o) => o.value === state.publishedWithin)?.label ??
      state.publishedWithin;
    chips.push({
      id: "published-within",
      label,
      remove: (s) => ({ ...s, publishedWithin: "any" }),
    });
  }

  for (const option of MEDIA_RELATION_OPTIONS) {
    if (state.relation[option.value]) {
      chips.push({
        id: `relation-${option.value}`,
        label: option.label,
        remove: (s) => ({
          ...s,
          relation: { ...s.relation, [option.value]: false },
        }),
      });
    }
  }

  return chips;
}

// ────────────────────────────────
// Empty-state suggestions (max 3, CER-05 §22)
// ────────────────────────────────

export type EmptyMediaFilterSuggestion = {
  id: string;
  label: string;
  apply: (state: MediaFiltersState) => MediaFiltersState;
};

/**
 * Suggerimenti contestuali: si offre di rimuovere il vincolo più restrittivo
 * prima di quelli marginali. `query` serve solo per il suggerimento
 * "cerca solo <primo token>" quando la query ha più parole.
 */
export function buildMediaEmptySuggestions(
  state: MediaFiltersState,
  query: string | null,
): EmptyMediaFilterSuggestion[] {
  const suggestions: EmptyMediaFilterSuggestion[] = [];

  if (state.formats.length > 0) {
    const [firstFormat] = state.formats;
    const label =
      MEDIA_FORMAT_OPTIONS.find((o) => o.value === firstFormat)?.label ?? firstFormat;
    suggestions.push({
      id: `remove-format-${firstFormat}`,
      label: `Rimuovi il filtro «${label}»`,
      apply: (s) => ({
        ...s,
        formats: s.formats.filter((value) => value !== firstFormat),
      }),
    });
  }

  if (state.provinces.length > 0 || state.regions.length > 0) {
    suggestions.push({
      id: "expand-zone",
      label: "Amplia la zona geografica",
      apply: (s) => ({ ...s, provinces: [], regions: [] }),
    });
  }

  if (state.categories.length > 0) {
    const [firstCategory] = state.categories;
    suggestions.push({
      id: `remove-category-${firstCategory}`,
      label: `Rimuovi «${firstCategory}»`,
      apply: (s) => ({
        ...s,
        categories: s.categories.filter((value) => value !== firstCategory),
      }),
    });
  }

  if (state.publishedWithin !== "any") {
    suggestions.push({
      id: "any-date",
      label: "Cerca in qualsiasi data",
      apply: (s) => ({ ...s, publishedWithin: "any" }),
    });
  }

  if (state.resultKind !== "all") {
    suggestions.push({
      id: "all-result-kinds",
      label: "Includi contenuti e profili Media",
      apply: (s) => ({ ...s, resultKind: "all" }),
    });
  }

  return suggestions.slice(0, 3);
}

/**
 * Suggerimento di query più generale ("Cerca solo «Serie D»"), separato dai
 * suggerimenti sui filtri perché agisce sul testo, non sullo stato.
 */
export function buildBroaderQuery(query: string | null): string | null {
  const trimmed = query?.trim() ?? "";

  if (trimmed.length === 0) {
    return null;
  }

  const words = trimmed.split(/\s+/);

  if (words.length < 2) {
    return null;
  }

  return words.slice(0, words.length - 1).join(" ");
}
