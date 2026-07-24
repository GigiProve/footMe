import { isProfileFiltersEmpty } from "../search-filters";
import type {
  AgentSearchFilters,
  CoachSearchFilters,
  PlayerSearchFilters,
  ProfileSearchFilters,
  ProfileSearchSort,
  SearchProfileRole,
  StaffSearchFilters,
} from "../search-types";
import {
  AGENT_MANAGED_BAND_OPTIONS,
  COACH_BACKGROUND_OPTIONS,
  COACH_CATEGORY_FILTER_OPTIONS,
  COACH_CONTEXT_OPTIONS,
  COACH_FILTER_ROLE_OPTIONS,
  COACH_LICENSE_FILTER_OPTIONS,
  PLAYER_POSITION_OPTIONS,
  PLAYER_SITUATION_OPTIONS,
  STAFF_ROLE_OPTIONS,
  type FilterSectionId,
} from "./profile-filter-configs";
import {
  createDefaultAgentFiltersState,
  createDefaultCoachFiltersState,
  createDefaultPlayerFiltersState,
  createDefaultStaffFiltersState,
  type ProfileFiltersState,
} from "./profile-filter-types";

const NO_FILTER_LABEL = "Nessun filtro";

// ────────────────────────────────
// Payload building (UI state -> RPC jsonb)
// ────────────────────────────────

/**
 * Maps the UI filter state for the active role to the snake_case RPC
 * payload, emitting only non-default keys. Returns `null` when the role is
 * null or nothing is actually active — this keeps the react-query key
 * stable and lets `search-service.ts` collapse the payload to `null`.
 */
export function buildFilterPayload(
  role: SearchProfileRole | null,
  state: ProfileFiltersState,
): ProfileSearchFilters | null {
  if (!role) {
    return null;
  }

  const payload: ProfileSearchFilters = {};

  if (role === "player") {
    const source = state.player;
    const player: PlayerSearchFilters = {};

    if (source.positions.length > 0) player.positions = source.positions;
    if (source.classeMin != null) player.classe_min = source.classeMin;
    if (source.classeMax != null) player.classe_max = source.classeMax;
    if (source.situation !== "any") player.situation = source.situation;
    if (source.categories.length > 0) player.categories = source.categories;
    if (source.province) player.provinces = [source.province];
    if (source.acceptedAreas.length > 0) player.transfer_areas = source.acceptedAreas;
    if (source.openToTransfer) player.is_open_to_transfer = true;
    if (source.preferredFoot) player.preferred_foot = source.preferredFoot;
    if (source.heightMin != null) player.height_min = source.heightMin;
    if (source.heightMax != null) player.height_max = source.heightMax;
    if (source.hasVideo) player.has_video = true;

    if (source.region) payload.region = source.region;
    if (source.available) payload.is_available = true;
    if (Object.keys(player).length > 0) payload.player = player;
  } else if (role === "coach") {
    const source = state.coach;
    const coach: CoachSearchFilters = {};

    if (source.role) coach.coach_role = source.role;
    if (source.licenses.length > 0) coach.licenses = source.licenses;
    if (source.context) coach.context = source.context;
    if (source.minSeasons != null) coach.min_seasons = source.minSeasons;
    if (source.coachedCategories.length > 0) coach.coached_categories = source.coachedCategories;
    if (source.province) coach.provinces = [source.province];
    if (source.backgrounds.length > 0) {
      coach.backgrounds = source.backgrounds as CoachSearchFilters["backgrounds"];
    }

    if (source.region) payload.region = source.region;
    if (source.availableNow) payload.is_available = true;
    if (Object.keys(coach).length > 0) payload.coach = coach;
  } else if (role === "staff") {
    const source = state.staff;
    const staff: StaffSearchFilters = {};

    if (source.roles.length > 0) staff.staff_roles = source.roles;
    if (source.hasCertifications) staff.has_certifications = true;
    if (source.categories.length > 0) staff.categories = source.categories;
    if (source.scope) staff.scope = source.scope;
    if (source.province) staff.provinces = [source.province];

    if (source.region) payload.region = source.region;
    if (source.availableNow) payload.is_available = true;
    if (Object.keys(staff).length > 0) payload.staff = staff;
  } else if (role === "agent") {
    const source = state.agent;
    const agent: AgentSearchFilters = {};

    if (source.operatingAreas.length > 0) agent.operating_areas = source.operatingAreas;
    if (source.playerTypes.length > 0) agent.player_types = source.playerTypes;
    if (source.managedBands.length > 0) agent.managed_bands = source.managedBands;
    if (source.minYears != null) agent.min_years = source.minYears;
    if (source.hasLicense != null) agent.is_federation_licensed = source.hasLicense;
    if (source.acceptsNewClients) agent.open_to_players = true;

    if (Object.keys(agent).length > 0) payload.agent = agent;
  }

  return isProfileFiltersEmpty(payload) ? null : payload;
}

// ────────────────────────────────
// Active filter counting
// ────────────────────────────────

export function countActiveFilters(
  role: SearchProfileRole | null,
  state: ProfileFiltersState,
): number {
  if (!role) return 0;

  if (role === "player") {
    const s = state.player;
    let count = 0;
    if (s.positions.length > 0) count += 1;
    if (s.classeMin != null || s.classeMax != null) count += 1;
    if (s.situation !== "any") count += 1;
    if (s.categories.length > 0) count += 1;
    if (s.region || s.province) count += 1;
    if (s.acceptedAreas.length > 0) count += 1;
    if (s.openToTransfer) count += 1;
    if (s.available) count += 1;
    if (s.preferredFoot) count += 1;
    if (s.heightMin != null || s.heightMax != null) count += 1;
    if (s.hasVideo) count += 1;
    return count;
  }

  if (role === "coach") {
    const s = state.coach;
    let count = 0;
    if (s.role) count += 1;
    if (s.licenses.length > 0) count += 1;
    if (s.context) count += 1;
    if (s.minSeasons != null) count += 1;
    if (s.coachedCategories.length > 0) count += 1;
    if (s.region || s.province) count += 1;
    if (s.availableNow) count += 1;
    if (s.backgrounds.length > 0) count += 1;
    return count;
  }

  if (role === "staff") {
    const s = state.staff;
    let count = 0;
    if (s.roles.length > 0) count += 1;
    if (s.hasCertifications) count += 1;
    if (s.categories.length > 0) count += 1;
    if (s.scope) count += 1;
    if (s.region || s.province) count += 1;
    if (s.availableNow) count += 1;
    return count;
  }

  const s = state.agent;
  let count = 0;
  if (s.operatingAreas.length > 0) count += 1;
  if (s.playerTypes.length > 0) count += 1;
  if (s.managedBands.length > 0) count += 1;
  if (s.minYears != null) count += 1;
  if (s.hasLicense != null) count += 1;
  if (s.acceptsNewClients) count += 1;
  return count;
}

// ────────────────────────────────
// Section summaries
// ────────────────────────────────

function summarizeList(
  values: string[],
  labelOf: (value: string) => string,
): string {
  if (values.length === 0) return NO_FILTER_LABEL;
  const first = labelOf(values[0]);
  return values.length > 1 ? `${first} +${values.length - 1}` : first;
}

function summarizeZone(
  region: string | null,
  province: string | null,
  extras: string[] = [],
): string {
  const parts = [region, province, ...extras].filter(Boolean) as string[];
  return parts.length > 0 ? parts.join(" • ") : NO_FILTER_LABEL;
}

export function sectionSummary(
  role: SearchProfileRole | null,
  sectionId: FilterSectionId,
  state: ProfileFiltersState,
): string {
  if (!role) return NO_FILTER_LABEL;

  if (role === "player") {
    const s = state.player;
    switch (sectionId) {
      case "role":
        return summarizeList(s.positions, (value) =>
          PLAYER_POSITION_OPTIONS.find((o) => o.value === value)?.label ?? value,
        );
      case "age": {
        if (s.classeMin != null && s.classeMax != null) return `Classe ${s.classeMin}–${s.classeMax}`;
        if (s.classeMin != null) return `Classe dal ${s.classeMin}`;
        if (s.classeMax != null) return `Classe fino al ${s.classeMax}`;
        return NO_FILTER_LABEL;
      }
      case "situation":
        return s.situation === "any"
          ? NO_FILTER_LABEL
          : PLAYER_SITUATION_OPTIONS.find((o) => o.value === s.situation)?.label ?? NO_FILTER_LABEL;
      case "category":
        return summarizeList(s.categories, (value) => value);
      case "zone":
        return summarizeZone(s.region, s.province, [
          s.openToTransfer ? "Trasferimento" : "",
          s.available ? "Disponibile" : "",
        ].filter(Boolean));
      case "traits": {
        const parts: string[] = [];
        if (s.preferredFoot) {
          parts.push(
            s.preferredFoot === "right" ? "Destro" : s.preferredFoot === "left" ? "Sinistro" : "Ambidestro",
          );
        }
        if (s.heightMin != null || s.heightMax != null) {
          parts.push(
            s.heightMin != null && s.heightMax != null
              ? `${s.heightMin}–${s.heightMax} cm`
              : s.heightMin != null
                ? `Da ${s.heightMin} cm`
                : `Fino a ${s.heightMax} cm`,
          );
        }
        if (s.hasVideo) parts.push("Con video");
        return parts.length > 0 ? parts.join(" • ") : NO_FILTER_LABEL;
      }
      default:
        return NO_FILTER_LABEL;
    }
  }

  if (role === "coach") {
    const s = state.coach;
    switch (sectionId) {
      case "role":
        return s.role ? COACH_FILTER_ROLE_OPTIONS.find((o) => o.value === s.role)?.label ?? s.role : NO_FILTER_LABEL;
      case "license":
        return summarizeList(
          s.licenses,
          (value) => COACH_LICENSE_FILTER_OPTIONS.find((o) => o.value === value)?.label ?? value,
        );
      case "experience": {
        const parts: string[] = [];
        if (s.context) parts.push(COACH_CONTEXT_OPTIONS.find((o) => o.value === s.context)?.label ?? s.context);
        if (s.minSeasons != null) parts.push(`Min ${s.minSeasons} stagioni`);
        return parts.length > 0 ? parts.join(" • ") : NO_FILTER_LABEL;
      }
      case "category":
        return summarizeList(
          s.coachedCategories,
          (value) => COACH_CATEGORY_FILTER_OPTIONS.find((o) => o.value === value)?.label ?? value,
        );
      case "zone":
        return summarizeZone(s.region, s.province, [s.availableNow ? "Disponibile" : ""].filter(Boolean));
      case "background":
        return summarizeList(
          s.backgrounds,
          (value) => COACH_BACKGROUND_OPTIONS.find((o) => o.value === value)?.label ?? value,
        );
      default:
        return NO_FILTER_LABEL;
    }
  }

  if (role === "staff") {
    const s = state.staff;
    switch (sectionId) {
      case "role":
        return summarizeList(
          s.roles,
          (value) => STAFF_ROLE_OPTIONS.find((o) => o.value === value)?.label ?? value,
        );
      case "certifications":
        return s.hasCertifications ? "Solo con titoli e certificazioni" : NO_FILTER_LABEL;
      case "scope":
        return s.scope === "prima_squadra"
          ? "Prima squadra"
          : s.scope === "settore_giovanile"
            ? "Settore giovanile"
            : NO_FILTER_LABEL;
      case "category":
        return summarizeList(s.categories, (value) => value);
      case "zone":
        return summarizeZone(s.region, s.province, [s.availableNow ? "Disponibile" : ""].filter(Boolean));
      default:
        return NO_FILTER_LABEL;
    }
  }

  const s = state.agent;
  switch (sectionId) {
    case "operating_area":
      return summarizeList(s.operatingAreas, (value) => value);
    case "category":
      return summarizeList(s.playerTypes, (value) => value);
    case "assisted":
      return summarizeList(
        s.managedBands,
        (value) => AGENT_MANAGED_BAND_OPTIONS.find((o) => o.value === value)?.label ?? value,
      );
    case "experience":
      return s.minYears != null ? `Almeno ${s.minYears} anni` : NO_FILTER_LABEL;
    case "agent_license":
      return s.hasLicense === true ? "Licenza presente" : NO_FILTER_LABEL;
    case "availability":
      return s.acceptsNewClients ? "Valuta nuovi assistiti" : NO_FILTER_LABEL;
    default:
      return NO_FILTER_LABEL;
  }
}

// ────────────────────────────────
// Reset helpers
// ────────────────────────────────

export function resetRole(
  role: SearchProfileRole,
  state: ProfileFiltersState,
): ProfileFiltersState {
  if (role === "player") return { ...state, player: createDefaultPlayerFiltersState() };
  if (role === "coach") return { ...state, coach: createDefaultCoachFiltersState() };
  if (role === "staff") return { ...state, staff: createDefaultStaffFiltersState() };
  return { ...state, agent: createDefaultAgentFiltersState() };
}

export function resetSection(
  role: SearchProfileRole,
  sectionId: FilterSectionId,
  state: ProfileFiltersState,
): ProfileFiltersState {
  if (role === "player") {
    const defaults = createDefaultPlayerFiltersState();
    const s = state.player;
    switch (sectionId) {
      case "role":
        return { ...state, player: { ...s, positions: defaults.positions } };
      case "age":
        return { ...state, player: { ...s, classeMin: defaults.classeMin, classeMax: defaults.classeMax } };
      case "situation":
        return { ...state, player: { ...s, situation: defaults.situation } };
      case "category":
        return { ...state, player: { ...s, categories: defaults.categories } };
      case "zone":
        return {
          ...state,
          player: {
            ...s,
            region: defaults.region,
            province: defaults.province,
            acceptedAreas: defaults.acceptedAreas,
            openToTransfer: defaults.openToTransfer,
            available: defaults.available,
          },
        };
      case "traits":
        return {
          ...state,
          player: {
            ...s,
            preferredFoot: defaults.preferredFoot,
            heightMin: defaults.heightMin,
            heightMax: defaults.heightMax,
            hasVideo: defaults.hasVideo,
          },
        };
      default:
        return state;
    }
  }

  if (role === "coach") {
    const defaults = createDefaultCoachFiltersState();
    const s = state.coach;
    switch (sectionId) {
      case "role":
        return { ...state, coach: { ...s, role: defaults.role } };
      case "license":
        return { ...state, coach: { ...s, licenses: defaults.licenses } };
      case "experience":
        return { ...state, coach: { ...s, context: defaults.context, minSeasons: defaults.minSeasons } };
      case "category":
        return { ...state, coach: { ...s, coachedCategories: defaults.coachedCategories } };
      case "zone":
        return {
          ...state,
          coach: { ...s, region: defaults.region, province: defaults.province, availableNow: defaults.availableNow },
        };
      case "background":
        return { ...state, coach: { ...s, backgrounds: defaults.backgrounds } };
      default:
        return state;
    }
  }

  if (role === "staff") {
    const defaults = createDefaultStaffFiltersState();
    const s = state.staff;
    switch (sectionId) {
      case "role":
        return { ...state, staff: { ...s, roles: defaults.roles } };
      case "certifications":
        return { ...state, staff: { ...s, hasCertifications: defaults.hasCertifications } };
      case "scope":
        return { ...state, staff: { ...s, scope: defaults.scope } };
      case "category":
        return { ...state, staff: { ...s, categories: defaults.categories } };
      case "zone":
        return {
          ...state,
          staff: { ...s, region: defaults.region, province: defaults.province, availableNow: defaults.availableNow },
        };
      default:
        return state;
    }
  }

  const defaults = createDefaultAgentFiltersState();
  const s = state.agent;
  switch (sectionId) {
    case "operating_area":
      return { ...state, agent: { ...s, operatingAreas: defaults.operatingAreas } };
    case "category":
      return { ...state, agent: { ...s, playerTypes: defaults.playerTypes } };
    case "assisted":
      return { ...state, agent: { ...s, managedBands: defaults.managedBands } };
    case "experience":
      return { ...state, agent: { ...s, minYears: defaults.minYears } };
    case "agent_license":
      return { ...state, agent: { ...s, hasLicense: defaults.hasLicense } };
    case "availability":
      return { ...state, agent: { ...s, acceptsNewClients: defaults.acceptsNewClients } };
    default:
      return state;
  }
}

// ────────────────────────────────
// Sort
// ────────────────────────────────

const BASE_SORT_OPTIONS: { label: string; value: ProfileSearchSort }[] = [
  { label: "Più rilevanti", value: "relevance" },
  { label: "Aggiornati di recente", value: "recent" },
  { label: "Più vicini", value: "vicini" },
];

const PLAYER_SORT_OPTIONS: { label: string; value: ProfileSearchSort }[] = [
  ...BASE_SORT_OPTIONS,
  { label: "Classe crescente", value: "classe_asc" },
  { label: "Classe decrescente", value: "classe_desc" },
];

export function sortOptionsForRole(
  role: SearchProfileRole | null,
): { label: string; value: ProfileSearchSort }[] {
  return role === "player" ? PLAYER_SORT_OPTIONS : BASE_SORT_OPTIONS;
}

/** Falls back a role-incompatible sort (e.g. classe_* outside player) to "relevance". */
export function coerceSort(
  role: SearchProfileRole | null,
  sort: ProfileSearchSort,
): ProfileSearchSort {
  const isClasseSort = sort === "classe_asc" || sort === "classe_desc";
  if (isClasseSort && role !== "player") {
    return "relevance";
  }
  return sort;
}

// ────────────────────────────────
// Empty-state suggestions
// ────────────────────────────────

export type EmptyFilterSuggestion = {
  id: string;
  label: string;
  apply: (state: ProfileFiltersState) => ProfileFiltersState;
};

export function buildEmptySuggestions(
  role: SearchProfileRole | null,
  state: ProfileFiltersState,
): EmptyFilterSuggestion[] {
  if (!role) return [];

  const suggestions: EmptyFilterSuggestion[] = [];

  if (role === "agent") {
    if (state.agent.operatingAreas.length > 0) {
      suggestions.push({
        id: "expand-region",
        label: "Amplia la regione",
        apply: (s) => ({ ...s, agent: { ...s.agent, operatingAreas: [] } }),
      });
    }
  } else {
    const region =
      role === "player" ? state.player.region : role === "coach" ? state.coach.region : state.staff.region;

    if (region) {
      suggestions.push({
        id: "expand-region",
        label: "Amplia la regione",
        apply: (s) => {
          if (role === "player") return { ...s, player: { ...s.player, region: null, province: null } };
          if (role === "coach") return { ...s, coach: { ...s.coach, region: null, province: null } };
          return { ...s, staff: { ...s.staff, region: null, province: null } };
        },
      });
    }
  }

  if (role === "player" && state.player.situation === "svincolato") {
    suggestions.push({
      id: "remove-svincolato",
      label: 'Rimuovi "Svincolato"',
      apply: (s) => ({ ...s, player: { ...s.player, situation: "any" } }),
    });
  }

  if (role === "player" && !state.player.openToTransfer) {
    suggestions.push({
      id: "include-transfer",
      label: "Includi profili disponibili al trasferimento",
      apply: (s) => ({ ...s, player: { ...s.player, openToTransfer: true } }),
    });
  }

  if (role === "player" && state.player.positions.length > 0) {
    suggestions.push({
      id: "remove-role",
      label: "Rimuovi il filtro ruolo",
      apply: (s) => ({ ...s, player: { ...s.player, positions: [] } }),
    });
  }

  return suggestions.slice(0, 3);
}
