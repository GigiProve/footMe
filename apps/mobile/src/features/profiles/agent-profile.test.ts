import { describe, expect, it } from "vitest";

import {
  buildAgentCategoryDistribution,
  buildAgentManagedPlayerFilterOptions,
  filterAgentManagedPlayers,
  formatAgentManagedPlayerLine,
  getAgentManagedPlayerAgeBand,
  type AgentManagedPlayerEntryRecord,
  type AgentManagedPlayersFilters,
} from "./agent-profile";

const entries: AgentManagedPlayerEntryRecord[] = [
  {
    agent_profile_id: "agent-1",
    avatar_url: null,
    birth_year: 2007,
    category_label: "Juniores",
    display_name: "Marco Rossi",
    id: "player-1",
    is_free_agent: false,
    linked_profile_id: "profile-1",
    primary_position: "forward",
    sort_order: 0,
  },
  {
    agent_profile_id: "agent-1",
    avatar_url: null,
    birth_year: 2003,
    category_label: "Serie D",
    display_name: "Luca Bianchi",
    id: "player-2",
    is_free_agent: false,
    linked_profile_id: "profile-2",
    primary_position: "midfielder",
    sort_order: 1,
  },
  {
    agent_profile_id: "agent-1",
    avatar_url: null,
    birth_year: 1999,
    category_label: "Eccellenza",
    display_name: "Andrea Verdi",
    id: "player-3",
    is_free_agent: true,
    linked_profile_id: null,
    primary_position: "defender",
    sort_order: 2,
  },
];

describe("agent-profile filters", () => {
  it("derives filter options from managed players", () => {
    const options = buildAgentManagedPlayerFilterOptions(entries);

    expect(options.categories).toEqual(["Juniores", "Serie D", "Eccellenza"]);
    expect(options.roles).toEqual(["forward", "midfielder", "defender"]);
    expect(options.ages).toEqual(["U19", "U23", "Over"]);
    expect(options.statuses).toEqual(["free_agent", "non_free_agent"]);
  });

  it("filters managed players across category, role, age and status", () => {
    const filters: AgentManagedPlayersFilters = {
      age: "U23",
      category: "Serie D",
      role: "midfielder",
      status: "non_free_agent",
    };

    const result = filterAgentManagedPlayers(entries, filters, 2026);

    expect(result).toHaveLength(1);
    expect(result[0]?.display_name).toBe("Luca Bianchi");
  });

  it("formats the player line with role, category, age band and status", () => {
    expect(formatAgentManagedPlayerLine(entries[2]!, 2026)).toBe(
      "Difensore • Eccellenza • Over • Svincolato",
    );
    expect(getAgentManagedPlayerAgeBand(2007, 2026)).toBe("U19");
  });

  it("maps missing categories into svincolati instead of a fallback label", () => {
    const distribution = buildAgentCategoryDistribution([
      ...entries,
      {
        agent_profile_id: "agent-1",
        avatar_url: null,
        birth_year: 2005,
        category_label: null,
        display_name: "Giacomo Neri",
        id: "player-4",
        is_free_agent: false,
        linked_profile_id: null,
        primary_position: "goalkeeper",
        sort_order: 3,
      },
    ]);

    expect(distribution.find((item) => item.label === "Svincolati")?.count).toBe(2);
    expect(distribution.find((item) => item.label === "Da definire")).toBeUndefined();
  });
});
