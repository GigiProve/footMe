import { describe, expect, it } from "vitest";

import {
  buildBroaderQuery,
  buildMediaActiveChips,
  buildMediaEmptySuggestions,
  buildMediaFilterPayload,
  countActiveMediaFilters,
  isMediaFiltersEmpty,
  mediaSectionSummary,
  resetMediaSection,
} from "./media-filter-helpers";
import { createDefaultMediaFiltersState } from "./media-filter-types";

describe("buildMediaFilterPayload", () => {
  it("emits nothing for the default state", () => {
    const payload = buildMediaFilterPayload(createDefaultMediaFiltersState());

    expect(payload).toEqual({});
    expect(isMediaFiltersEmpty(payload)).toBe(true);
  });

  it("emits formats and sources", () => {
    const state = createDefaultMediaFiltersState();
    state.formats = ["video", "foto"];
    state.sources = ["testata"];

    expect(buildMediaFilterPayload(state)).toEqual({
      formats: ["video", "foto"],
      sources: ["testata"],
    });
  });

  it("emits categories, regions and provinces", () => {
    const state = createDefaultMediaFiltersState();
    state.categories = ["Serie D"];
    state.regions = ["Lombardia"];
    state.provinces = ["Como"];

    expect(buildMediaFilterPayload(state)).toEqual({
      categories: ["Serie D"],
      provinces: ["Como"],
      regions: ["Lombardia"],
    });
  });

  it("omits published_within when set to any", () => {
    const state = createDefaultMediaFiltersState();
    state.publishedWithin = "any";

    expect(buildMediaFilterPayload(state)).toEqual({});
  });

  it("maps published_within when constrained", () => {
    const state = createDefaultMediaFiltersState();
    state.publishedWithin = "last7";

    expect(buildMediaFilterPayload(state)).toEqual({ published_within: "last7" });
  });

  it("maps relation toggles to their payload keys", () => {
    const state = createDefaultMediaFiltersState();
    state.relation.savedContents = true;
    state.relation.followedSources = true;
    state.relation.followedClubs = true;
    state.relation.followedProfiles = true;

    expect(buildMediaFilterPayload(state)).toEqual({
      followed_clubs: true,
      followed_profiles: true,
      followed_sources: true,
      saved: true,
    });
  });

  it("never emits resultKind — it selects the RPC, not the filter", () => {
    const state = createDefaultMediaFiltersState();
    state.resultKind = "sources";

    expect(buildMediaFilterPayload(state)).toEqual({});
  });
});

describe("countActiveMediaFilters", () => {
  it("is zero for the default state", () => {
    expect(countActiveMediaFilters(createDefaultMediaFiltersState())).toBe(0);
  });

  it("counts each selected value, the result kind and each relation toggle", () => {
    const state = createDefaultMediaFiltersState();
    state.resultKind = "contents";
    state.formats = ["video", "foto"];
    state.categories = ["Serie D"];
    state.publishedWithin = "today";
    state.relation.savedContents = true;

    expect(countActiveMediaFilters(state)).toBe(6);
  });
});

describe("mediaSectionSummary", () => {
  it("returns undefined for untouched sections", () => {
    const state = createDefaultMediaFiltersState();

    expect(mediaSectionSummary("tipo", state)).toBeUndefined();
    expect(mediaSectionSummary("zona", state)).toBeUndefined();
    expect(mediaSectionSummary("data", state)).toBeUndefined();
  });

  it("summarises multiple values with a +N suffix", () => {
    const state = createDefaultMediaFiltersState();
    state.formats = ["articolo", "video", "foto"];

    expect(mediaSectionSummary("tipo", state)).toBe("Articoli +2");
  });

  it("folds regions and provinces into the zone summary", () => {
    const state = createDefaultMediaFiltersState();
    state.regions = ["Lombardia"];
    state.provinces = ["Como"];

    expect(mediaSectionSummary("zona", state)).toBe("Lombardia +1");
  });

  it("includes 'Fonti seguite' in the source summary", () => {
    const state = createDefaultMediaFiltersState();
    state.relation.followedSources = true;

    expect(mediaSectionSummary("fonte", state)).toBe("Fonti seguite");
  });
});

describe("resetMediaSection", () => {
  it("clears both regions and provinces for the zone section", () => {
    const state = createDefaultMediaFiltersState();
    state.regions = ["Lombardia"];
    state.provinces = ["Como"];

    const next = resetMediaSection("zona", state);

    expect(next.regions).toEqual([]);
    expect(next.provinces).toEqual([]);
  });

  it("clears the followed-sources toggle together with the source kinds", () => {
    const state = createDefaultMediaFiltersState();
    state.sources = ["creator"];
    state.relation.followedSources = true;

    const next = resetMediaSection("fonte", state);

    expect(next.sources).toEqual([]);
    expect(next.relation.followedSources).toBe(false);
  });

  it("leaves the other relation toggles untouched when resetting the source section", () => {
    const state = createDefaultMediaFiltersState();
    state.relation.followedSources = true;
    state.relation.savedContents = true;

    const next = resetMediaSection("fonte", state);

    expect(next.relation.savedContents).toBe(true);
  });
});

describe("buildMediaActiveChips", () => {
  it("is empty for the default state", () => {
    expect(buildMediaActiveChips(createDefaultMediaFiltersState())).toEqual([]);
  });

  it("produces one removable chip per active value", () => {
    const state = createDefaultMediaFiltersState();
    state.formats = ["video"];
    state.categories = ["Serie D"];
    state.regions = ["Lombardia"];

    const chips = buildMediaActiveChips(state);

    expect(chips.map((chip) => chip.label)).toEqual(["Video", "Serie D", "Lombardia"]);
  });

  it("removes only the targeted value", () => {
    const state = createDefaultMediaFiltersState();
    state.categories = ["Serie D", "Eccellenza"];

    const chip = buildMediaActiveChips(state).find((entry) => entry.label === "Serie D");
    const next = chip?.remove(state);

    expect(next?.categories).toEqual(["Eccellenza"]);
  });
});

describe("buildMediaEmptySuggestions", () => {
  it("suggests nothing when no filter is active", () => {
    expect(buildMediaEmptySuggestions(createDefaultMediaFiltersState(), "como")).toEqual(
      [],
    );
  });

  it("caps the list at three suggestions", () => {
    const state = createDefaultMediaFiltersState();
    state.formats = ["video"];
    state.regions = ["Lombardia"];
    state.categories = ["Serie D"];
    state.publishedWithin = "today";
    state.resultKind = "contents";

    expect(buildMediaEmptySuggestions(state, "serie d lombardia")).toHaveLength(3);
  });

  it("offers to widen the geographic zone", () => {
    const state = createDefaultMediaFiltersState();
    state.provinces = ["Como"];

    const suggestion = buildMediaEmptySuggestions(state, null)[0];
    const next = suggestion.apply(state);

    expect(suggestion.label).toBe("Amplia la zona geografica");
    expect(next.provinces).toEqual([]);
    expect(next.regions).toEqual([]);
  });
});

describe("buildBroaderQuery", () => {
  it("drops the last word of a multi-word query", () => {
    expect(buildBroaderQuery("Serie D Lombardia")).toBe("Serie D");
  });

  it("returns null for a single word", () => {
    expect(buildBroaderQuery("Como")).toBeNull();
  });

  it("returns null for an empty query", () => {
    expect(buildBroaderQuery("   ")).toBeNull();
    expect(buildBroaderQuery(null)).toBeNull();
  });
});
