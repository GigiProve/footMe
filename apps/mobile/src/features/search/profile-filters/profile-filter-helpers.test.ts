import { describe, expect, it } from "vitest";

import {
  buildEmptySuggestions,
  buildFilterPayload,
  coerceSort,
  countActiveFilters,
  resetRole,
  resetSection,
  sectionSummary,
  sortOptionsForRole,
} from "./profile-filter-helpers";
import { createDefaultProfileFiltersState } from "./profile-filter-types";

describe("buildFilterPayload", () => {
  it("returns null when role is null", () => {
    expect(buildFilterPayload(null, createDefaultProfileFiltersState())).toBeNull();
  });

  it("returns null when the active role has no non-default filters", () => {
    expect(buildFilterPayload("player", createDefaultProfileFiltersState())).toBeNull();
  });

  it("emits only non-default player keys", () => {
    const state = createDefaultProfileFiltersState();
    state.player.positions = ["striker"];
    state.player.situation = "svincolato";
    state.player.region = "Lombardia";

    expect(buildFilterPayload("player", state)).toEqual({
      region: "Lombardia",
      player: { positions: ["striker"], situation: "svincolato" },
    });
  });

  it("maps player transfer/available flags to shared + group keys", () => {
    const state = createDefaultProfileFiltersState();
    state.player.openToTransfer = true;
    state.player.available = true;

    expect(buildFilterPayload("player", state)).toEqual({
      is_available: true,
      player: { is_open_to_transfer: true },
    });
  });

  it("maps a single province into the provinces array", () => {
    const state = createDefaultProfileFiltersState();
    state.coach.province = "MI";

    expect(buildFilterPayload("coach", state)).toEqual({
      coach: { provinces: ["MI"] },
    });
  });

  it("emits agent keys with the real managed bands", () => {
    const state = createDefaultProfileFiltersState();
    state.agent.managedBands = ["1-5 calciatori"];
    state.agent.acceptsNewClients = true;

    expect(buildFilterPayload("agent", state)).toEqual({
      agent: { managed_bands: ["1-5 calciatori"], open_to_players: true },
    });
  });

  it("returns a stable plain object without undefined members", () => {
    const state = createDefaultProfileFiltersState();
    state.staff.hasCertifications = true;

    const payload = buildFilterPayload("staff", state);

    expect(payload).toEqual({ staff: { has_certifications: true } });
    expect(JSON.stringify(payload)).not.toContain("undefined");
  });
});

describe("countActiveFilters", () => {
  it("is zero for a null role or default state", () => {
    expect(countActiveFilters(null, createDefaultProfileFiltersState())).toBe(0);
    expect(countActiveFilters("player", createDefaultProfileFiltersState())).toBe(0);
  });

  it("counts each active facet once regardless of list size", () => {
    const state = createDefaultProfileFiltersState();
    state.player.positions = ["striker", "forward" as never];
    state.player.categories = ["Serie D"];

    expect(countActiveFilters("player", state)).toBe(2);
  });
});

describe("sectionSummary", () => {
  it("defaults to 'Nessun filtro'", () => {
    expect(sectionSummary("player", "role", createDefaultProfileFiltersState())).toBe(
      "Nessun filtro",
    );
  });

  it("summarizes a role selection with an overflow count", () => {
    const state = createDefaultProfileFiltersState();
    state.player.positions = ["striker", "forward" as never];

    expect(sectionSummary("player", "role", state)).toBe("Attaccante +1");
  });

  it("summarizes a classe range", () => {
    const state = createDefaultProfileFiltersState();
    state.player.classeMin = 2004;
    state.player.classeMax = 2007;

    expect(sectionSummary("player", "age", state)).toBe("Classe 2004–2007");
  });

  it("summarizes situation svincolato", () => {
    const state = createDefaultProfileFiltersState();
    state.player.situation = "svincolato";

    expect(sectionSummary("player", "situation", state)).toBe("Svincolato");
  });

  it("summarizes zone with region and transfer flag", () => {
    const state = createDefaultProfileFiltersState();
    state.player.region = "Lombardia";
    state.player.openToTransfer = true;

    expect(sectionSummary("player", "zone", state)).toBe("Lombardia • Trasferimento");
  });
});

describe("resetSection / resetRole", () => {
  it("resets only the targeted section", () => {
    const state = createDefaultProfileFiltersState();
    state.player.positions = ["striker"];
    state.player.situation = "svincolato";

    const next = resetSection("player", "role", state);

    expect(next.player.positions).toEqual([]);
    expect(next.player.situation).toBe("svincolato");
  });

  it("resets the whole role group", () => {
    const state = createDefaultProfileFiltersState();
    state.player.positions = ["striker"];
    state.player.situation = "svincolato";
    state.coach.role = "Allenatore";

    const next = resetRole("player", state);

    expect(next.player).toEqual(createDefaultProfileFiltersState().player);
    expect(next.coach.role).toBe("Allenatore");
  });
});

describe("sortOptionsForRole / coerceSort", () => {
  it("only offers classe sorts for player", () => {
    expect(sortOptionsForRole("player").map((o) => o.value)).toContain("classe_asc");
    expect(sortOptionsForRole("coach").map((o) => o.value)).not.toContain("classe_asc");
    expect(sortOptionsForRole(null).map((o) => o.value)).not.toContain("classe_asc");
  });

  it("falls back non-player classe sorts to relevance", () => {
    expect(coerceSort("coach", "classe_asc")).toBe("relevance");
    expect(coerceSort("player", "classe_asc")).toBe("classe_asc");
    expect(coerceSort(null, "classe_desc")).toBe("relevance");
  });
});

describe("buildEmptySuggestions", () => {
  it("returns nothing for a null role", () => {
    expect(buildEmptySuggestions(null, createDefaultProfileFiltersState())).toEqual([]);
  });

  it("caps suggestions at 3 and prioritizes region, svincolato, transfer, role", () => {
    const state = createDefaultProfileFiltersState();
    state.player.region = "Lombardia";
    state.player.situation = "svincolato";
    state.player.positions = ["striker"];

    const suggestions = buildEmptySuggestions("player", state);

    expect(suggestions).toHaveLength(3);
    expect(suggestions.map((s) => s.id)).toEqual([
      "expand-region",
      "remove-svincolato",
      "include-transfer",
    ]);
  });

  it("suggests expanding operating areas for agents", () => {
    const state = createDefaultProfileFiltersState();
    state.agent.operatingAreas = ["Lombardia"];

    const suggestions = buildEmptySuggestions("agent", state);

    expect(suggestions).toEqual([
      expect.objectContaining({ id: "expand-region", label: "Amplia la regione" }),
    ]);
  });
});
