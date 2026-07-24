import { describe, expect, it } from "vitest";

import {
  buildClubActiveChips,
  buildClubFilterPayload,
  countActiveClubFilters,
  tipologiaToKind,
} from "./club-filter-helpers";
import { createDefaultClubFiltersState } from "./club-filter-types";

describe("buildClubFilterPayload", () => {
  it("returns null for the default state", () => {
    expect(buildClubFilterPayload(createDefaultClubFiltersState())).toBeNull();
  });

  it("emits categories when set", () => {
    const state = createDefaultClubFiltersState();
    state.categories = ["Serie D"];

    expect(buildClubFilterPayload(state)).toEqual({ categories: ["Serie D"] });
  });

  it("emits region and city", () => {
    const state = createDefaultClubFiltersState();
    state.region = "Lombardia";
    state.city = "Milano";

    expect(buildClubFilterPayload(state)).toEqual({
      region: "Lombardia",
      city: "Milano",
    });
  });

  it("maps structure flags to has_* keys", () => {
    const state = createDefaultClubFiltersState();
    state.structure.senior = true;
    state.structure.affiliates = true;

    expect(buildClubFilterPayload(state)).toEqual({
      has_senior: true,
      has_affiliates: true,
    });
  });

  it("maps opportunities to open_positions and target_roles", () => {
    const state = createDefaultClubFiltersState();
    state.opportunities.openPositions = true;
    state.opportunities.forPlayers = true;
    state.opportunities.forCoaches = true;

    expect(buildClubFilterPayload(state)).toEqual({
      open_positions: true,
      target_roles: ["player", "coach"],
    });
  });

  it("maps relation flags", () => {
    const state = createDefaultClubFiltersState();
    state.relation.followed = true;
    state.relation.saved = true;

    expect(buildClubFilterPayload(state)).toEqual({
      followed: true,
      saved: true,
    });
  });

  it("never includes tipologia in the payload", () => {
    const state = createDefaultClubFiltersState();
    state.tipologia = "team";

    expect(buildClubFilterPayload(state)).toBeNull();
  });
});

describe("tipologiaToKind", () => {
  it("maps 'all' to null", () => {
    expect(tipologiaToKind("all")).toBeNull();
  });

  it("passes through other values", () => {
    expect(tipologiaToKind("club")).toBe("club");
    expect(tipologiaToKind("team")).toBe("team");
    expect(tipologiaToKind("affiliate")).toBe("affiliate");
  });
});

describe("countActiveClubFilters", () => {
  it("is zero for the default state", () => {
    expect(countActiveClubFilters(createDefaultClubFiltersState())).toBe(0);
  });

  it("counts each active group once", () => {
    const state = createDefaultClubFiltersState();
    state.tipologia = "team";
    state.categories = ["Serie D", "Eccellenza"];
    state.region = "Lombardia";
    state.structure.senior = true;
    state.opportunities.openPositions = true;
    state.relation.saved = true;

    expect(countActiveClubFilters(state)).toBe(6);
  });
});

describe("buildClubActiveChips", () => {
  it("returns no chips for the default state", () => {
    expect(buildClubActiveChips(createDefaultClubFiltersState())).toEqual([]);
  });

  it("removing each chip restores the default state", () => {
    let state = createDefaultClubFiltersState();
    state.tipologia = "team";
    state.categories = ["Serie D"];
    state.region = "Lombardia";
    state.city = "Milano";
    state.structure.senior = true;
    state.opportunities.openPositions = true;
    state.relation.saved = true;

    let chips = buildClubActiveChips(state);
    expect(chips.length).toBe(7);

    for (const chip of buildClubActiveChips(state)) {
      state = chip.remove(state);
    }

    expect(state).toEqual(createDefaultClubFiltersState());
    chips = buildClubActiveChips(state);
    expect(chips).toEqual([]);
  });
});
