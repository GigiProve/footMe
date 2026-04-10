import type { PlayerPosition } from "./player-sports";
import type { AgentMediaItemRecord } from "./agent-media";
import { getPlayerPositionLabel, isPlayerPosition } from "./player-sports";

export type AgentProfileRecord = {
  agency_logo_url: string | null;
  agency_name: string | null;
  agency_role: string | null;
  federation: string | null;
  has_other_football_experience: boolean;
  has_played_football: boolean;
  is_federation_licensed: boolean;
  main_player_roles: PlayerPosition[];
  managed_players_count: string | null;
  media_items: AgentMediaItemRecord[];
  open_to_clubs: boolean;
  open_to_players: boolean;
  operational_focuses: string[];
  operational_note: string | null;
  operating_macro_areas: string[];
  operating_regions: string[];
  other_football_roles: string[];
  period_end_month: string | null;
  period_end_year: number | null;
  period_start_month: string | null;
  period_start_year: number | null;
  player_career_entries: unknown[];
  player_types: string[];
  profile_id: string;
};

export type AgentCareerEntryRecord = {
  agency_logo_url: string | null;
  agency_name: string;
  agent_profile_id: string;
  id: string;
  period_end_month: string | null;
  period_end_year: number | null;
  period_start_month: string | null;
  period_start_year: number | null;
  role: string;
  sort_order: number;
};

export type AgentManagedPlayerEntryRecord = {
  agent_profile_id: string;
  avatar_url: string | null;
  birth_year: number | null;
  category_label: string | null;
  display_name: string;
  id: string;
  is_free_agent: boolean;
  linked_profile_id: string | null;
  primary_position: PlayerPosition | null;
  sort_order: number;
};

export type AgentCareerEntryDraft = {
  agency_logo_url: string | null;
  agency_name: string;
  id: string;
  period_end_month: string | null;
  period_end_year: number | null;
  period_start_month: string | null;
  period_start_year: number | null;
  role: string;
};

export type AgentManagedPlayerEntryDraft = {
  avatar_url: string | null;
  birth_year: number | null;
  category_label: string | null;
  display_name: string;
  id: string;
  is_free_agent: boolean;
  linked_profile_id: string | null;
  primary_position: PlayerPosition | null;
};

export type AgentPlayerCandidate = {
  avatar_url: string | null;
  birth_year: number | null;
  category_label: string | null;
  full_name: string;
  is_free_agent: boolean;
  primary_position: PlayerPosition | null;
  profile_id: string;
  region: string | null;
};

export type AgentManagedPlayerAgeFilter = "U19" | "U23" | "Over";
export type AgentManagedPlayerStatusFilter = "free_agent" | "non_free_agent";

export type AgentManagedPlayersFilters = {
  age: AgentManagedPlayerAgeFilter | null;
  category: string | null;
  role: PlayerPosition | null;
  status: AgentManagedPlayerStatusFilter | null;
};

export const AGENT_OPERATIONAL_FOCUS_OPTIONS = [
  "Inserimento in prima squadra",
  "Valorizzazione giovani",
  "Gestione svincolati",
  "Ricerca opportunità in categorie superiori",
  "Mercato dilettanti",
  "Altro",
] as const;

export const AGENT_OPERATING_MACRO_AREA_OPTIONS = [
  "Nord Italia",
  "Centro Italia",
  "Sud Italia",
  "Isole",
  "Estero",
] as const;

const AGENT_POSITION_LABELS: Partial<Record<PlayerPosition, string>> = {
  defender: "Difensori",
  forward: "Attaccanti",
  goalkeeper: "Portieri",
  midfielder: "Centrocampisti",
};

const AGE_FILTER_ORDER: AgentManagedPlayerAgeFilter[] = ["U19", "U23", "Over"];
const STATUS_FILTER_ORDER: AgentManagedPlayerStatusFilter[] = [
  "free_agent",
  "non_free_agent",
];

export function createLocalUuid() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  const template = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";

  return template.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function createAgentCareerEntryDraft(): AgentCareerEntryDraft {
  return {
    agency_logo_url: null,
    agency_name: "",
    id: createLocalUuid(),
    period_end_month: null,
    period_end_year: null,
    period_start_month: null,
    period_start_year: null,
    role: "",
  };
}

export function createAgentManagedPlayerEntryDraft(): AgentManagedPlayerEntryDraft {
  return {
    avatar_url: null,
    birth_year: null,
    category_label: null,
    display_name: "",
    id: createLocalUuid(),
    is_free_agent: false,
    linked_profile_id: null,
    primary_position: null,
  };
}

export function createManagedPlayerDraftFromCandidate(
  candidate: AgentPlayerCandidate,
): AgentManagedPlayerEntryDraft {
  return {
    avatar_url: candidate.avatar_url,
    birth_year: candidate.birth_year,
    category_label: candidate.category_label,
    display_name: candidate.full_name,
    id: createLocalUuid(),
    is_free_agent: candidate.is_free_agent,
    linked_profile_id: candidate.profile_id,
    primary_position: candidate.primary_position,
  };
}

export function isAgentPlayerPosition(value: unknown): value is PlayerPosition {
  return isPlayerPosition(value);
}

export function formatAgentPeriod(input: {
  endMonth?: string | null;
  endYear?: number | null;
  startMonth?: string | null;
  startYear?: number | null;
}) {
  const start = formatPeriodPoint(input.startMonth ?? null, input.startYear ?? null);
  const end = formatPeriodPoint(input.endMonth ?? null, input.endYear ?? null);

  if (start && end) {
    return `${start} - ${end}`;
  }

  if (start) {
    return `${start} - oggi`;
  }

  if (end) {
    return `Fino a ${end}`;
  }

  return "Periodo da definire";
}

function formatPeriodPoint(month: string | null, year: number | null) {
  if (month && year) {
    return `${month} ${year}`;
  }

  if (year) {
    return String(year);
  }

  return null;
}

export function getAgentManagedPlayersCount(
  entries: AgentManagedPlayerEntryRecord[] | AgentManagedPlayerEntryDraft[],
  fallback: string | null | undefined,
) {
  return entries.length > 0 ? entries.length : null;
}

export function getAgentManagedPlayersLabel(
  entries: AgentManagedPlayerEntryRecord[] | AgentManagedPlayerEntryDraft[],
  fallback: string | null | undefined,
) {
  const total = getAgentManagedPlayersCount(entries, fallback);

  if (total !== null) {
    return `${total} ${total === 1 ? "giocatore gestito" : "giocatori gestiti"}`;
  }

  if (fallback?.trim()) {
    return fallback.trim();
  }

  return "Portfolio in definizione";
}

export function deriveLegacyManagedPlayersCount(
  entries: AgentManagedPlayerEntryRecord[] | AgentManagedPlayerEntryDraft[],
) {
  const total = entries.length;

  if (total <= 0) {
    return null;
  }

  if (total <= 5) {
    return "1-5 calciatori";
  }

  if (total <= 15) {
    return "5-15 calciatori";
  }

  return "15+ calciatori";
}

export function buildAgentCategoryDistribution(
  entries: AgentManagedPlayerEntryRecord[] | AgentManagedPlayerEntryDraft[],
) {
  const buckets = new Map<string, number>();

  entries.forEach((entry) => {
    const bucket = getCategoryBucket(entry.category_label, entry.is_free_agent);
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  });

  return [...buckets.entries()]
    .map(([label, count]) => ({ count, label }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      if (left.label === "Svincolati") {
        return 1;
      }

      if (right.label === "Svincolati") {
        return -1;
      }

      return left.label.localeCompare(right.label);
    });
}

export function buildAgentCategorySummary(
  entries: AgentManagedPlayerEntryRecord[] | AgentManagedPlayerEntryDraft[],
  fallbackTypes: string[] = [],
) {
  const distribution = buildAgentCategoryDistribution(entries);

  if (distribution.length > 0) {
    return distribution.map((item) => item.label).join(" • ");
  }

  if (fallbackTypes.length > 0) {
    return fallbackTypes.join(" • ");
  }

  return "Portfolio in definizione";
}

export function buildAgentPlayerTypeTags(
  entries: AgentManagedPlayerEntryRecord[] | AgentManagedPlayerEntryDraft[],
  fallbackRoles: PlayerPosition[] = [],
) {
  const roleCounts = new Map<PlayerPosition, number>();

  entries.forEach((entry) => {
    if (entry.primary_position) {
      roleCounts.set(
        entry.primary_position,
        (roleCounts.get(entry.primary_position) ?? 0) + 1,
      );
    }
  });

  const roleTags = [...roleCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([role]) => AGENT_POSITION_LABELS[role] ?? getPlayerPositionLabel(role))
    .filter(Boolean);

  if (roleTags.length > 0) {
    return roleTags;
  }

  return fallbackRoles.map((role) => AGENT_POSITION_LABELS[role] ?? getPlayerPositionLabel(role));
}

export function buildAgentAgeBandTags(
  entries: AgentManagedPlayerEntryRecord[] | AgentManagedPlayerEntryDraft[],
) {
  const currentYear = new Date().getFullYear();
  const counts = new Map<string, number>();

  entries.forEach((entry) => {
    if (!entry.birth_year) {
      return;
    }

    const age = currentYear - entry.birth_year;
    const label =
      age < 18 ? "U18" : age <= 21 ? "18-21" : age <= 25 ? "22-25" : "26+";

    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([label]) => label);
}

export function getAgentManagedPlayerAge(
  birthYear: number | null | undefined,
  currentYear = new Date().getFullYear(),
) {
  if (!birthYear) {
    return null;
  }

  return currentYear - birthYear;
}

export function getAgentManagedPlayerAgeBand(
  birthYear: number | null | undefined,
  currentYear = new Date().getFullYear(),
): AgentManagedPlayerAgeFilter | null {
  const age = getAgentManagedPlayerAge(birthYear, currentYear);

  if (age === null) {
    return null;
  }

  if (age <= 19) {
    return "U19";
  }

  if (age <= 23) {
    return "U23";
  }

  return "Over";
}

export function getAgentManagedPlayerStatusLabel(
  status: AgentManagedPlayerStatusFilter,
) {
  return status === "free_agent" ? "Svincolato" : "Non svincolato";
}

export function buildAgentManagedPlayerFilterOptions(
  entries: AgentManagedPlayerEntryRecord[] | AgentManagedPlayerEntryDraft[],
) {
  const categories = new Set<string>();
  const roles = new Set<PlayerPosition>();
  const ages = new Set<AgentManagedPlayerAgeFilter>();
  const statuses = new Set<AgentManagedPlayerStatusFilter>();

  entries.forEach((entry) => {
    if (entry.category_label?.trim()) {
      categories.add(entry.category_label.trim());
    }

    if (entry.primary_position) {
      roles.add(entry.primary_position);
    }

    const ageBand = getAgentManagedPlayerAgeBand(entry.birth_year);

    if (ageBand) {
      ages.add(ageBand);
    }

    statuses.add(entry.is_free_agent ? "free_agent" : "non_free_agent");
  });

  return {
    ages: AGE_FILTER_ORDER.filter((value) => ages.has(value)),
    categories: [...categories],
    roles: [...roles],
    statuses: STATUS_FILTER_ORDER.filter((value) => statuses.has(value)),
  };
}

export function filterAgentManagedPlayers(
  entries: AgentManagedPlayerEntryRecord[] | AgentManagedPlayerEntryDraft[],
  filters: AgentManagedPlayersFilters,
  currentYear = new Date().getFullYear(),
) {
  return entries.filter((entry) => {
    if (filters.category && entry.category_label?.trim() !== filters.category) {
      return false;
    }

    if (filters.role && entry.primary_position !== filters.role) {
      return false;
    }

    if (
      filters.age &&
      getAgentManagedPlayerAgeBand(entry.birth_year, currentYear) !== filters.age
    ) {
      return false;
    }

    if (filters.status === "free_agent" && !entry.is_free_agent) {
      return false;
    }

    if (filters.status === "non_free_agent" && entry.is_free_agent) {
      return false;
    }

    return true;
  });
}

export function formatAgentManagedPlayerLine(
  entry: AgentManagedPlayerEntryRecord | AgentManagedPlayerEntryDraft,
  currentYear = new Date().getFullYear(),
) {
  const parts: string[] = [];

  if (entry.primary_position) {
    parts.push(getPlayerPositionLabel(entry.primary_position));
  }

  if (entry.category_label?.trim()) {
    parts.push(entry.category_label.trim());
  }

  const ageBand = getAgentManagedPlayerAgeBand(entry.birth_year, currentYear);

  if (ageBand) {
    parts.push(ageBand);
  }

  if (entry.is_free_agent) {
    parts.push("Svincolato");
  }

  return parts.join(" • ");
}

export function buildOperationalModeItems(profile: AgentProfileRecord | null) {
  if (!profile) {
    return [];
  }

  const items = [...profile.operational_focuses];

  if (profile.operating_macro_areas.length > 0) {
    items.push(`Zone: ${profile.operating_macro_areas.join(", ")}`);
  }

  if (profile.operational_note?.trim()) {
    items.push(profile.operational_note.trim());
  }

  return items;
}

export function deriveLegacyPlayerTypes(
  entries: AgentManagedPlayerEntryRecord[] | AgentManagedPlayerEntryDraft[],
) {
  if (entries.length === 0) {
    return [] as string[];
  }

  const hasYouth = entries.some((entry) => isYouthCategory(entry.category_label));
  const hasSenior = entries.some(
    (entry) => !entry.is_free_agent && !isYouthCategory(entry.category_label),
  );

  if (hasYouth && hasSenior) {
    return ["Entrambi"];
  }

  return hasYouth ? ["Giovani"] : ["Senior"];
}

export function deriveLegacyMainPlayerRoles(
  entries: AgentManagedPlayerEntryRecord[] | AgentManagedPlayerEntryDraft[],
) {
  const uniqueRoles = new Set<PlayerPosition>();

  entries.forEach((entry) => {
    if (entry.primary_position) {
      uniqueRoles.add(entry.primary_position);
    }
  });

  return [...uniqueRoles];
}

function getCategoryBucket(categoryLabel: string | null, isFreeAgent: boolean) {
  if (isFreeAgent) {
    return "Svincolati";
  }

  if (!categoryLabel?.trim()) {
    return "Svincolati";
  }

  return isYouthCategory(categoryLabel) ? "Under" : categoryLabel.trim();
}

function isYouthCategory(categoryLabel: string | null | undefined) {
  if (!categoryLabel) {
    return false;
  }

  const normalized = categoryLabel.trim().toLowerCase();

  return (
    normalized.includes("under") ||
    normalized.includes("juniores") ||
    normalized.includes("allievi") ||
    normalized.includes("giovanissimi") ||
    normalized.includes("primavera")
  );
}
