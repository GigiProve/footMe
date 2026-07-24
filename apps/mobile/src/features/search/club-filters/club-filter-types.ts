/**
 * UI-facing filter STATE for Cerca > Società, kept distinct from
 * `ClubSearchFilters` (search-types.ts) — the latter is the snake_case
 * jsonb payload the RPC understands. `buildClubFilterPayload` in
 * `club-filter-helpers.ts` is the only bridge between the two shapes.
 *
 * `tipologia` is not part of `ClubSearchFilters` — it maps separately to
 * the search RPC's `kind` param via `tipologiaToKind`.
 */

export type ClubTipologia = "all" | "club" | "team" | "affiliate";

export type ClubStructureState = {
  senior: boolean;
  youth: boolean;
  teams: boolean;
  affiliates: boolean;
};

export type ClubOpportunitiesState = {
  openPositions: boolean;
  forPlayers: boolean;
  forCoaches: boolean;
  forStaff: boolean;
};

export type ClubRelationState = {
  followed: boolean;
  saved: boolean;
};

export type ClubFiltersState = {
  tipologia: ClubTipologia;
  categories: string[];
  region: string | null;
  city: string | null;
  structure: ClubStructureState;
  opportunities: ClubOpportunitiesState;
  relation: ClubRelationState;
};

export function createDefaultClubStructureState(): ClubStructureState {
  return {
    senior: false,
    youth: false,
    teams: false,
    affiliates: false,
  };
}

export function createDefaultClubOpportunitiesState(): ClubOpportunitiesState {
  return {
    openPositions: false,
    forPlayers: false,
    forCoaches: false,
    forStaff: false,
  };
}

export function createDefaultClubRelationState(): ClubRelationState {
  return {
    followed: false,
    saved: false,
  };
}

export function createDefaultClubFiltersState(): ClubFiltersState {
  return {
    tipologia: "all",
    categories: [],
    region: null,
    city: null,
    structure: createDefaultClubStructureState(),
    opportunities: createDefaultClubOpportunitiesState(),
    relation: createDefaultClubRelationState(),
  };
}
