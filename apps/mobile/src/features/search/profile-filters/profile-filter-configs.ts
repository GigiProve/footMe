import {
  AGENT_MANAGED_PLAYERS_OPTIONS,
  AGENT_PLAYER_TYPE_OPTIONS,
} from "../../onboarding/agent/agent-options";
import { LICENSE_TYPE_OPTIONS } from "../../onboarding/coach/CoachRoleStep";
import { STAFF_ROLE_OPTIONS } from "../../onboarding/onboarding-types";
import { PROVINCE_OPTIONS, REGION_OPTIONS } from "../../profiles/profile-form-utils";
import {
  PLAYER_CATEGORY_OPTIONS,
  PLAYER_POSITION_OPTIONS,
  PREFERRED_FOOT_OPTIONS,
} from "../../profiles/player-sports";
import type { SearchProfileRole } from "../search-types";
import type { ProfileFiltersState } from "./profile-filter-types";

export type { SearchProfileRole };

/**
 * Section ids drilled into by `ProfileFiltersModal`. Ids are role-scoped via
 * `FILTER_SECTIONS`, so the same id (e.g. "category") can be reused across
 * roles with a different backing field.
 */
export type FilterSectionId =
  | "role"
  | "age"
  | "situation"
  | "category"
  | "zone"
  | "traits"
  | "license"
  | "experience"
  | "background"
  | "certifications"
  | "scope"
  | "operating_area"
  | "assisted"
  | "agent_license"
  | "availability";

export const FILTER_MODAL_TITLES: Record<SearchProfileRole, string> = {
  player: "Filtri calciatori",
  coach: "Filtri allenatori",
  staff: "Filtri staff",
  agent: "Filtri agenti",
};

export const FILTER_SECTIONS: Record<
  SearchProfileRole,
  { id: FilterSectionId; title: string }[]
> = {
  player: [
    { id: "role", title: "Ruolo" },
    { id: "age", title: "Età e classe" },
    { id: "situation", title: "Situazione sportiva" },
    { id: "category", title: "Categoria" },
    { id: "zone", title: "Zona e disponibilità" },
    { id: "traits", title: "Caratteristiche" },
  ],
  coach: [
    { id: "role", title: "Ruolo" },
    { id: "license", title: "Patentino" },
    { id: "experience", title: "Esperienza" },
    { id: "category", title: "Categoria" },
    { id: "zone", title: "Zona e disponibilità" },
    { id: "background", title: "Esperienze precedenti" },
  ],
  // NB: the mockup lists a 6th "Esperienza" section for staff, but
  // StaffFiltersState carries no backing field for it (no min-seasons /
  // years proxy for staff in the data layer) — omitted per the master
  // plan's rule that not-yet-ready sections are left out of FILTER_SECTIONS.
  staff: [
    { id: "role", title: "Ruolo staff" },
    { id: "certifications", title: "Titoli e certificazioni" },
    { id: "scope", title: "Ambito preferito" },
    { id: "category", title: "Categoria" },
    { id: "zone", title: "Zona e disponibilità" },
  ],
  agent: [
    { id: "operating_area", title: "Area operativa" },
    { id: "category", title: "Categorie seguite" },
    { id: "assisted", title: "Numero assistiti" },
    { id: "experience", title: "Esperienza" },
    { id: "agent_license", title: "Licenza" },
    { id: "availability", title: "Disponibilità" },
  ],
};

// ────────────────────────────────
// Option lists — reused from onboarding / profile canonical sources.
// ────────────────────────────────

export { PLAYER_POSITION_OPTIONS, PREFERRED_FOOT_OPTIONS, PLAYER_CATEGORY_OPTIONS };
export { REGION_OPTIONS, PROVINCE_OPTIONS };
export { STAFF_ROLE_OPTIONS };

/** Coach license options, minus "Nessun patentino" — the null selection on
 * the Radio already covers "Nessuna preferenza". */
export const COACH_LICENSE_FILTER_OPTIONS = LICENSE_TYPE_OPTIONS.filter(
  (option) => option.value !== "Nessun patentino",
);

/**
 * Coach filter roles — a distinct, smaller list than the onboarding
 * `COACH_PRIMARY_ROLE_OPTIONS` (which is not exported), per the approved
 * plan.
 */
export const COACH_FILTER_ROLE_OPTIONS: { label: string; value: string }[] = [
  { label: "Allenatore", value: "Allenatore" },
  { label: "Vice allenatore", value: "Vice allenatore" },
  { label: "Allenatore portieri", value: "Allenatore portieri" },
  { label: "Collaboratore tecnico", value: "Collaboratore tecnico" },
  { label: "Match analyst", value: "Match analyst" },
];

/**
 * Coach/staff "categorie allenate" — mirrors the local (non-exported) list
 * in `CoachRoleStep.tsx`; duplicated here rather than exported from
 * onboarding to avoid widening that module's public surface.
 */
export const COACH_CATEGORY_FILTER_OPTIONS: { label: string; value: string }[] = [
  { label: "Prima Squadra", value: "Prima Squadra" },
  { label: "Juniores", value: "Juniores" },
  { label: "Allievi", value: "Allievi" },
  { label: "Giovanissimi", value: "Giovanissimi" },
  { label: "Berretti", value: "Berretti" },
  { label: "Scuola Calcio", value: "Scuola Calcio" },
  { label: "Settore Giovanile", value: "Settore Giovanile" },
];

export const COACH_CONTEXT_OPTIONS: { label: string; value: "prima_squadra" | "settore_giovanile" | "entrambi" }[] = [
  { label: "Prima squadra", value: "prima_squadra" },
  { label: "Settore giovanile", value: "settore_giovanile" },
  { label: "Prima squadra e settore giovanile", value: "entrambi" },
];

export const COACH_BACKGROUND_OPTIONS: { label: string; value: string }[] = [
  { label: "Ex calciatore", value: "ex_calciatore" },
  { label: "Preparatore atletico", value: "preparatore_atletico" },
  { label: "Collaboratore tecnico", value: "collaboratore_tecnico" },
  { label: "Osservatore", value: "osservatore" },
];

export const PLAYER_SITUATION_OPTIONS: { label: string; value: import("./profile-filter-types").PlayerSituationFilter }[] = [
  { label: "Qualsiasi situazione", value: "any" },
  { label: "Svincolato", value: "svincolato" },
  { label: "Tesserato", value: "tesserato" },
  { label: "Disponibile a valutare opportunità", value: "disponibile" },
  { label: "In scadenza", value: "in_scadenza" },
];

/** Real managed-players bands from `agent-options.ts`, with the approved UI labels. */
export const AGENT_MANAGED_BAND_OPTIONS: { label: string; value: string }[] = [
  { label: "Fino a 5", value: AGENT_MANAGED_PLAYERS_OPTIONS[0] },
  { label: "5–15", value: AGENT_MANAGED_PLAYERS_OPTIONS[1] },
  { label: "Oltre 15", value: AGENT_MANAGED_PLAYERS_OPTIONS[2] },
];

export const AGENT_PLAYER_TYPE_FILTER_OPTIONS: { label: string; value: string }[] =
  AGENT_PLAYER_TYPE_OPTIONS.map((value) => ({ label: value, value }));

/**
 * Agent operating-area values. No onboarding step currently collects a
 * "Tutta Italia" / "Estero" macro-area (only region-shaped free text), so
 * these two literal values follow the approved plan text directly.
 */
export const AGENT_AREA_SPECIAL_OPTIONS = {
  allItaly: "Tutta Italia",
  abroad: "Estero",
} as const;

// ────────────────────────────────
// Quick chips
// ────────────────────────────────

export type QuickChipAction =
  | {
      kind: "toggle";
      apply: (state: ProfileFiltersState) => ProfileFiltersState;
      remove: (state: ProfileFiltersState) => ProfileFiltersState;
    }
  | { kind: "drill"; sectionId: FilterSectionId };

export type QuickChipConfig = {
  id: string;
  getLabel: (state: ProfileFiltersState) => string;
  isActive: (state: ProfileFiltersState) => boolean;
  action: QuickChipAction;
};

function underAgeClasseMin(age: number, currentYear: number): number {
  return currentYear - age;
}

export function buildPlayerQuickChips(
  currentYear: number = new Date().getFullYear(),
): QuickChipConfig[] {
  return [
    {
      id: "role",
      getLabel: (state) => {
        const count = state.player.positions.length;
        if (count === 0) return "Ruolo";
        const first =
          PLAYER_POSITION_OPTIONS.find((option) => option.value === state.player.positions[0])
            ?.label ?? state.player.positions[0];
        return count > 1 ? `${first} +${count - 1}` : first;
      },
      isActive: (state) => state.player.positions.length > 0,
      action: { kind: "drill", sectionId: "role" },
    },
    {
      id: "zone",
      getLabel: (state) => state.player.region ?? "Zona",
      isActive: (state) => Boolean(state.player.region || state.player.province),
      action: { kind: "drill", sectionId: "zone" },
    },
    {
      id: "available",
      getLabel: () => "Disponibilità",
      isActive: (state) => state.player.available,
      action: {
        kind: "toggle",
        apply: (state) => ({
          ...state,
          player: { ...state.player, available: true },
        }),
        remove: (state) => ({
          ...state,
          player: { ...state.player, available: false },
        }),
      },
    },
    {
      id: "svincolati",
      getLabel: () => "Svincolati",
      isActive: (state) => state.player.situation === "svincolato",
      action: {
        kind: "toggle",
        apply: (state) => ({
          ...state,
          player: { ...state.player, situation: "svincolato" },
        }),
        remove: (state) => ({
          ...state,
          player: { ...state.player, situation: "any" },
        }),
      },
    },
    {
      id: "under21",
      getLabel: () => "Under 21",
      isActive: (state) => state.player.classeMin === underAgeClasseMin(21, currentYear),
      action: {
        kind: "toggle",
        apply: (state) => ({
          ...state,
          player: { ...state.player, classeMin: underAgeClasseMin(21, currentYear) },
        }),
        remove: (state) => ({
          ...state,
          player: { ...state.player, classeMin: null },
        }),
      },
    },
  ];
}

export const COACH_QUICK_CHIPS: QuickChipConfig[] = [
  {
    id: "role",
    getLabel: (state) => {
      const found = COACH_FILTER_ROLE_OPTIONS.find((o) => o.value === state.coach.role);
      return found?.label ?? "Ruolo";
    },
    isActive: (state) => Boolean(state.coach.role),
    action: { kind: "drill", sectionId: "role" },
  },
  {
    id: "license",
    getLabel: (state) => {
      const count = state.coach.licenses.length;
      if (count === 0) return "Patentino";
      const first =
        COACH_LICENSE_FILTER_OPTIONS.find((o) => o.value === state.coach.licenses[0])?.label ??
        state.coach.licenses[0];
      return count > 1 ? `${first} +${count - 1}` : first;
    },
    isActive: (state) => state.coach.licenses.length > 0,
    action: { kind: "drill", sectionId: "license" },
  },
  {
    id: "zone",
    getLabel: (state) => state.coach.region ?? "Zona",
    isActive: (state) => Boolean(state.coach.region || state.coach.province),
    action: { kind: "drill", sectionId: "zone" },
  },
  {
    id: "available",
    getLabel: () => "Disponibili",
    isActive: (state) => state.coach.availableNow,
    action: {
      kind: "toggle",
      apply: (state) => ({ ...state, coach: { ...state.coach, availableNow: true } }),
      remove: (state) => ({ ...state, coach: { ...state.coach, availableNow: false } }),
    },
  },
];

export const STAFF_QUICK_CHIPS: QuickChipConfig[] = [
  {
    id: "role",
    getLabel: (state) => {
      const count = state.staff.roles.length;
      if (count === 0) return "Ruolo";
      const first =
        STAFF_ROLE_OPTIONS.find((o) => o.value === state.staff.roles[0])?.label ??
        state.staff.roles[0];
      return count > 1 ? `${first} +${count - 1}` : first;
    },
    isActive: (state) => state.staff.roles.length > 0,
    action: { kind: "drill", sectionId: "role" },
  },
  {
    id: "zone",
    getLabel: (state) => state.staff.region ?? "Zona",
    isActive: (state) => Boolean(state.staff.region || state.staff.province),
    action: { kind: "drill", sectionId: "zone" },
  },
  {
    id: "available",
    getLabel: () => "Disponibili",
    isActive: (state) => state.staff.availableNow,
    action: {
      kind: "toggle",
      apply: (state) => ({ ...state, staff: { ...state.staff, availableNow: true } }),
      remove: (state) => ({ ...state, staff: { ...state.staff, availableNow: false } }),
    },
  },
];

export const AGENT_QUICK_CHIPS: QuickChipConfig[] = [
  {
    id: "zone",
    getLabel: (state) => {
      const count = state.agent.operatingAreas.length;
      if (count === 0) return "Zona";
      const first = state.agent.operatingAreas[0];
      return count > 1 ? `${first} +${count - 1}` : first;
    },
    isActive: (state) => state.agent.operatingAreas.length > 0,
    action: { kind: "drill", sectionId: "operating_area" },
  },
  {
    id: "assisted",
    getLabel: (state) => {
      const found = AGENT_MANAGED_BAND_OPTIONS.find((o) =>
        state.agent.managedBands.includes(o.value),
      );
      return found?.label ?? "Assistiti";
    },
    isActive: (state) => state.agent.managedBands.length > 0,
    action: { kind: "drill", sectionId: "assisted" },
  },
  {
    id: "license",
    getLabel: () => "Licenza",
    isActive: (state) => state.agent.hasLicense === true,
    action: {
      kind: "toggle",
      apply: (state) => ({ ...state, agent: { ...state.agent, hasLicense: true } }),
      remove: (state) => ({ ...state, agent: { ...state.agent, hasLicense: null } }),
    },
  },
];

export const QUICK_CHIPS: Record<SearchProfileRole, QuickChipConfig[]> = {
  player: buildPlayerQuickChips(),
  coach: COACH_QUICK_CHIPS,
  staff: STAFF_QUICK_CHIPS,
  agent: AGENT_QUICK_CHIPS,
};
