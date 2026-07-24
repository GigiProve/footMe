import type {
  ClubSearchFilters,
  ClubSearchSort,
  SearchClubKind,
} from "../search-types";
import {
  CLUB_CATEGORY_OPTIONS,
  CLUB_OPPORTUNITY_OPTIONS,
  CLUB_RELATION_OPTIONS,
  CLUB_STRUCTURE_OPTIONS,
  CLUB_TIPOLOGIA_OPTIONS,
  type ClubFilterSectionId,
} from "./club-filter-configs";
import {
  createDefaultClubFiltersState,
  createDefaultClubOpportunitiesState,
  createDefaultClubRelationState,
  createDefaultClubStructureState,
  type ClubFiltersState,
  type ClubTipologia,
} from "./club-filter-types";

const NO_FILTER_LABEL = "Nessun filtro";

// ────────────────────────────────
// Payload building (UI state -> RPC jsonb)
// ────────────────────────────────

/**
 * Maps the UI filter state to the snake_case RPC payload, emitting only
 * non-default keys. Returns `null` when nothing is active — this keeps the
 * react-query key stable and lets `search-service.ts` collapse the payload
 * to `null`. `tipologia` is never included here — it is mapped separately
 * to the RPC's `kind` param via `tipologiaToKind`.
 */
export function buildClubFilterPayload(
  state: ClubFiltersState,
): ClubSearchFilters | null {
  const payload: ClubSearchFilters = {};

  if (state.categories.length > 0) payload.categories = state.categories;
  if (state.region) payload.region = state.region;
  if (state.city) payload.city = state.city;

  if (state.structure.senior) payload.has_senior = true;
  if (state.structure.youth) payload.has_youth = true;
  if (state.structure.teams) payload.has_teams = true;
  if (state.structure.affiliates) payload.has_affiliates = true;

  if (state.opportunities.openPositions) payload.open_positions = true;

  const targetRoles: ("player" | "coach" | "staff")[] = [];
  if (state.opportunities.forPlayers) targetRoles.push("player");
  if (state.opportunities.forCoaches) targetRoles.push("coach");
  if (state.opportunities.forStaff) targetRoles.push("staff");
  if (targetRoles.length > 0) payload.target_roles = targetRoles;

  if (state.relation.followed) payload.followed = true;
  if (state.relation.saved) payload.saved = true;

  return isClubFiltersEmpty(payload) ? null : payload;
}

function isClubFiltersEmpty(filters: ClubSearchFilters): boolean {
  return Object.keys(filters).length === 0;
}

/** Maps the UI-only tipologia chip to the search RPC's `kind` param. */
export function tipologiaToKind(t: ClubTipologia): SearchClubKind | null {
  return t === "all" ? null : t;
}

// ────────────────────────────────
// Active filter counting
// ────────────────────────────────

export function countActiveClubFilters(state: ClubFiltersState): number {
  let count = 0;

  if (state.tipologia !== "all") count += 1;
  if (state.categories.length > 0) count += 1;
  if (state.region) count += 1;
  if (state.city) count += 1;

  if (state.structure.senior) count += 1;
  if (state.structure.youth) count += 1;
  if (state.structure.teams) count += 1;
  if (state.structure.affiliates) count += 1;

  if (state.opportunities.openPositions) count += 1;
  if (state.opportunities.forPlayers) count += 1;
  if (state.opportunities.forCoaches) count += 1;
  if (state.opportunities.forStaff) count += 1;

  if (state.relation.followed) count += 1;
  if (state.relation.saved) count += 1;

  return count;
}

// ────────────────────────────────
// Section summaries
// ────────────────────────────────

function summarizeList(values: string[]): string {
  if (values.length === 0) return NO_FILTER_LABEL;
  const [first] = values;
  return values.length > 1 ? `${first} +${values.length - 1}` : first;
}

export function clubSectionSummary(
  sectionId: ClubFilterSectionId,
  state: ClubFiltersState,
): string | undefined {
  switch (sectionId) {
    case "tipologia": {
      if (state.tipologia === "all") return undefined;
      return CLUB_TIPOLOGIA_OPTIONS.find((o) => o.value === state.tipologia)?.label;
    }
    case "categoria":
      return state.categories.length > 0 ? summarizeList(state.categories) : undefined;
    case "zona": {
      const parts = [state.region, state.city].filter(Boolean) as string[];
      return parts.length > 0 ? parts.join(" • ") : undefined;
    }
    case "struttura": {
      const labels = CLUB_STRUCTURE_OPTIONS.filter((o) => state.structure[o.value]).map(
        (o) => o.label,
      );
      return labels.length > 0 ? labels.join(" • ") : undefined;
    }
    case "opportunita": {
      const labels = CLUB_OPPORTUNITY_OPTIONS.filter(
        (o) => state.opportunities[o.value],
      ).map((o) => o.label);
      return labels.length > 0 ? labels.join(" • ") : undefined;
    }
    case "relazione": {
      const labels = CLUB_RELATION_OPTIONS.filter((o) => state.relation[o.value]).map(
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

export function resetClubSection(
  sectionId: ClubFilterSectionId,
  state: ClubFiltersState,
): ClubFiltersState {
  switch (sectionId) {
    case "tipologia":
      return { ...state, tipologia: "all" };
    case "categoria":
      return { ...state, categories: [] };
    case "zona":
      return { ...state, region: null, city: null };
    case "struttura":
      return { ...state, structure: createDefaultClubStructureState() };
    case "opportunita":
      return { ...state, opportunities: createDefaultClubOpportunitiesState() };
    case "relazione":
      return { ...state, relation: createDefaultClubRelationState() };
    default:
      return state;
  }
}

export function resetClubFilters(): ClubFiltersState {
  return createDefaultClubFiltersState();
}

// ────────────────────────────────
// Sort
// ────────────────────────────────

export function clubSortOptions(): { label: string; value: ClubSearchSort }[] {
  return [
    { label: "Più rilevanti", value: "relevance" },
    { label: "Più vicine", value: "vicini" },
    { label: "Aggiornate di recente", value: "recent" },
    { label: "Con più posizioni aperte", value: "positions" },
    { label: "Nome A–Z", value: "name" },
  ];
}

// ────────────────────────────────
// Removable active-filter chips
// ────────────────────────────────

export type ClubActiveChip = {
  id: string;
  label: string;
  remove: (state: ClubFiltersState) => ClubFiltersState;
};

export function buildClubActiveChips(state: ClubFiltersState): ClubActiveChip[] {
  const chips: ClubActiveChip[] = [];

  if (state.tipologia !== "all") {
    const label =
      CLUB_TIPOLOGIA_OPTIONS.find((o) => o.value === state.tipologia)?.label ??
      state.tipologia;
    chips.push({
      id: "tipologia",
      label,
      remove: (s) => ({ ...s, tipologia: "all" }),
    });
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

  if (state.region) {
    chips.push({
      id: "region",
      label: state.region,
      remove: (s) => ({ ...s, region: null }),
    });
  }

  if (state.city) {
    chips.push({
      id: "city",
      label: state.city,
      remove: (s) => ({ ...s, city: null }),
    });
  }

  for (const option of CLUB_STRUCTURE_OPTIONS) {
    if (state.structure[option.value]) {
      chips.push({
        id: `structure-${option.value}`,
        label: option.label,
        remove: (s) => ({
          ...s,
          structure: { ...s.structure, [option.value]: false },
        }),
      });
    }
  }

  for (const option of CLUB_OPPORTUNITY_OPTIONS) {
    if (state.opportunities[option.value]) {
      chips.push({
        id: `opportunity-${option.value}`,
        label: option.label,
        remove: (s) => ({
          ...s,
          opportunities: { ...s.opportunities, [option.value]: false },
        }),
      });
    }
  }

  for (const option of CLUB_RELATION_OPTIONS) {
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
// Empty-state suggestions
// ────────────────────────────────

export type EmptyClubFilterSuggestion = {
  id: string;
  label: string;
  apply: (state: ClubFiltersState) => ClubFiltersState;
};

export function buildClubEmptySuggestions(
  state: ClubFiltersState,
): EmptyClubFilterSuggestion[] {
  const suggestions: EmptyClubFilterSuggestion[] = [];

  if (state.region) {
    suggestions.push({
      id: "expand-region",
      label: "Amplia la regione",
      apply: (s) => ({ ...s, region: null, city: null }),
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

  if (state.tipologia !== "all" && state.tipologia !== "affiliate") {
    suggestions.push({
      id: "include-affiliates",
      label: "Includi anche società affiliate",
      apply: (s) => ({ ...s, tipologia: "all" }),
    });
  }

  return suggestions.slice(0, 3);
}
