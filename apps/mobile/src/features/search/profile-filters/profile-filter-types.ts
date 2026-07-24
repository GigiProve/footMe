import type {
  PlayerPosition,
  PreferredFoot,
} from "../../profiles/player-sports";

/**
 * UI-facing filter STATE for Cerca > Profili, kept distinct from
 * `ProfileSearchFilters` (search-types.ts) — the latter is the snake_case
 * jsonb payload the RPC understands. `buildFilterPayload` in
 * `profile-filter-helpers.ts` is the only bridge between the two shapes.
 */

export type PlayerSituationFilter =
  | "any"
  | "svincolato"
  | "tesserato"
  | "disponibile"
  | "in_scadenza";

export type PlayerFiltersState = {
  positions: PlayerPosition[];
  classeMin: number | null;
  classeMax: number | null;
  situation: PlayerSituationFilter;
  categories: string[];
  province: string | null;
  region: string | null;
  acceptedAreas: string[];
  openToTransfer: boolean;
  available: boolean;
  preferredFoot: PreferredFoot | null;
  heightMin: number | null;
  heightMax: number | null;
  hasVideo: boolean;
};

export type CoachContextFilter =
  | "prima_squadra"
  | "settore_giovanile"
  | "entrambi";

export type CoachFiltersState = {
  role: string | null;
  licenses: string[];
  context: CoachContextFilter | null;
  minSeasons: number | null;
  coachedCategories: string[];
  region: string | null;
  province: string | null;
  availableNow: boolean;
  backgrounds: string[];
};

export type StaffScopeFilter = "prima_squadra" | "settore_giovanile";

export type StaffFiltersState = {
  roles: string[];
  hasCertifications: boolean;
  categories: string[];
  scope: StaffScopeFilter | null;
  region: string | null;
  province: string | null;
  availableNow: boolean;
};

export type AgentFiltersState = {
  operatingAreas: string[];
  playerTypes: string[];
  managedBands: string[];
  minYears: number | null;
  hasLicense: boolean | null;
  acceptsNewClients: boolean;
};

export type ProfileFiltersState = {
  player: PlayerFiltersState;
  coach: CoachFiltersState;
  staff: StaffFiltersState;
  agent: AgentFiltersState;
};

export function createDefaultPlayerFiltersState(): PlayerFiltersState {
  return {
    positions: [],
    classeMin: null,
    classeMax: null,
    situation: "any",
    categories: [],
    province: null,
    region: null,
    acceptedAreas: [],
    openToTransfer: false,
    available: false,
    preferredFoot: null,
    heightMin: null,
    heightMax: null,
    hasVideo: false,
  };
}

export function createDefaultCoachFiltersState(): CoachFiltersState {
  return {
    role: null,
    licenses: [],
    context: null,
    minSeasons: null,
    coachedCategories: [],
    region: null,
    province: null,
    availableNow: false,
    backgrounds: [],
  };
}

export function createDefaultStaffFiltersState(): StaffFiltersState {
  return {
    roles: [],
    hasCertifications: false,
    categories: [],
    scope: null,
    region: null,
    province: null,
    availableNow: false,
  };
}

export function createDefaultAgentFiltersState(): AgentFiltersState {
  return {
    operatingAreas: [],
    playerTypes: [],
    managedBands: [],
    minYears: null,
    hasLicense: null,
    acceptsNewClients: false,
  };
}

export function createDefaultProfileFiltersState(): ProfileFiltersState {
  return {
    player: createDefaultPlayerFiltersState(),
    coach: createDefaultCoachFiltersState(),
    staff: createDefaultStaffFiltersState(),
    agent: createDefaultAgentFiltersState(),
  };
}
