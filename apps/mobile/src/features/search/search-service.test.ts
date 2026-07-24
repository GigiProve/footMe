import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ageRangeToClasse,
  isProfileFiltersEmpty,
  resolveGlobalSearchHref,
  searchClubsPage,
  searchGlobal,
  searchPositionsPage,
  searchProfilesPage,
} from "./search-service";
import type { GlobalSearchRow, ProfileSearchRow } from "./search-types";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("../../lib/supabase", () => ({
  supabase: { rpc: mocks.rpc },
}));

function makeGlobalRow(overrides: Partial<GlobalSearchRow>): GlobalSearchRow {
  return {
    group_key: "profilo",
    target_type: "profile",
    target_id: "t1",
    title: "Marco Rossi",
    subtitle: null,
    image_url: null,
    ...overrides,
  };
}

// supabase-js returns bigint columns (total_count) as strings, so the test
// factory allows overriding it with either a string or a number.
function makeProfileRow(
  overrides: Partial<Omit<ProfileSearchRow, "total_count">> & {
    total_count?: number | string;
  },
): ProfileSearchRow {
  return {
    profile_id: "p1",
    full_name: "Marco Rossi",
    avatar_url: null,
    role: "player",
    region: null,
    city: null,
    primary_position: null,
    current_club_name: null,
    current_team_name: null,
    age: null,
    is_available: null,
    birth_year: null,
    is_open_to_transfer: null,
    current_category: null,
    coach_primary_role: null,
    coach_top_license: null,
    coach_context: null,
    open_to_new_role: null,
    staff_primary_role: null,
    experience_summary: null,
    open_to_work: null,
    agency_name: null,
    managed_players_count: null,
    agent_operating_areas: null,
    open_to_players: null,
    years_experience: null,
    total_count: 0,
    ...overrides,
  } as ProfileSearchRow;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({ data: [], error: null });
});

describe("searchGlobal", () => {
  it("forwards the trimmed query with per-category limits", async () => {
    await searchGlobal("  como  ", 2, 1);

    expect(mocks.rpc).toHaveBeenCalledWith("search_global", {
      p_content_limit: 1,
      p_per_category: 2,
      p_query: "como",
    });
  });

  it("defaults to 3 per category and 2 contents", async () => {
    await searchGlobal("como");

    expect(mocks.rpc).toHaveBeenCalledWith("search_global", {
      p_content_limit: 2,
      p_per_category: 3,
      p_query: "como",
    });
  });

  it("propagates rpc errors", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("boom") });

    await expect(searchGlobal("como")).rejects.toThrow("boom");
  });
});

describe("searchProfilesPage", () => {
  it("forwards role/sort/filters and computes the offset", async () => {
    await searchProfilesPage({
      filters: { player: { situation: "svincolato" } },
      page: 2,
      pageSize: 20,
      query: "rossi",
      role: "player",
      sort: "recent",
    });

    expect(mocks.rpc).toHaveBeenCalledWith("search_profiles_page", {
      p_filters: { player: { situation: "svincolato" } },
      p_limit: 20,
      p_offset: 40,
      p_query: "rossi",
      p_role: "player",
      p_sort: "recent",
    });
  });

  it("passes null query, role and filters in browse mode, defaulting sort to relevance", async () => {
    await searchProfilesPage({ page: 0, query: "   ", role: null });

    expect(mocks.rpc).toHaveBeenCalledWith("search_profiles_page", {
      p_filters: null,
      p_limit: 20,
      p_offset: 0,
      p_query: null,
      p_role: null,
      p_sort: "relevance",
    });
  });

  it("collapses an empty filters object to null", async () => {
    await searchProfilesPage({
      filters: { player: {} },
      page: 0,
      query: null,
      role: "player",
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "search_profiles_page",
      expect.objectContaining({ p_filters: null }),
    );
  });

  it("returns rows and coerces total_count, defaulting to 0 on an empty page", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        makeProfileRow({ profile_id: "p1", total_count: "3" }),
        makeProfileRow({ profile_id: "p2", total_count: "3" }),
      ],
      error: null,
    });

    const page = await searchProfilesPage({ page: 0, query: null, role: null });

    expect(page.rows).toHaveLength(2);
    expect(page.totalCount).toBe(3);

    mocks.rpc.mockResolvedValue({ data: [], error: null });

    const emptyPage = await searchProfilesPage({ page: 1, query: null, role: null });

    expect(emptyPage.rows).toEqual([]);
    expect(emptyPage.totalCount).toBe(0);
  });

  it("propagates rpc errors", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("boom") });

    await expect(
      searchProfilesPage({ page: 0, query: null, role: null }),
    ).rejects.toThrow("boom");
  });
});

describe("isProfileFiltersEmpty", () => {
  it("treats null/undefined and fully-empty payloads as empty", () => {
    expect(isProfileFiltersEmpty(null)).toBe(true);
    expect(isProfileFiltersEmpty(undefined)).toBe(true);
    expect(isProfileFiltersEmpty({})).toBe(true);
    expect(isProfileFiltersEmpty({ player: {}, coach: {} })).toBe(true);
  });

  it("is false as soon as a shared key or a role group has content", () => {
    expect(isProfileFiltersEmpty({ region: "Lombardia" })).toBe(false);
    expect(isProfileFiltersEmpty({ is_available: true })).toBe(false);
    expect(isProfileFiltersEmpty({ player: { situation: "svincolato" } })).toBe(
      false,
    );
    expect(isProfileFiltersEmpty({ agent: { min_years: 3 } })).toBe(false);
  });
});

describe("ageRangeToClasse", () => {
  it("derives classe_min from ageMax and classe_max from ageMin", () => {
    expect(ageRangeToClasse(19, 21, 2026)).toEqual({
      classeMax: 2007,
      classeMin: 2005,
    });
  });

  it("supports an open-ended range (Under 21 style: only ageMax set)", () => {
    expect(ageRangeToClasse(null, 21, 2026)).toEqual({ classeMin: 2005 });
  });

  it("supports an open-ended range (Over 23 style: only ageMin set)", () => {
    expect(ageRangeToClasse(23, undefined, 2026)).toEqual({ classeMax: 2003 });
  });

  it("returns an empty object when both bounds are missing", () => {
    expect(ageRangeToClasse(null, null, 2026)).toEqual({});
  });
});

describe("searchClubsPage", () => {
  it("forwards the kind filter", async () => {
    await searchClubsPage("como", "team", 1, 10);

    expect(mocks.rpc).toHaveBeenCalledWith("search_clubs_page", {
      p_kind: "team",
      p_limit: 10,
      p_offset: 10,
      p_query: "como",
    });
  });
});

describe("searchPositionsPage", () => {
  it("forwards target and saved-only filters", async () => {
    await searchPositionsPage("attaccante", "player", true, 3, 20);

    expect(mocks.rpc).toHaveBeenCalledWith("search_positions_page", {
      p_limit: 20,
      p_offset: 60,
      p_query: "attaccante",
      p_saved_only: true,
      p_target: "player",
    });
  });

  it("browses all published positions with empty filters", async () => {
    await searchPositionsPage(null, null, false, 0);

    expect(mocks.rpc).toHaveBeenCalledWith("search_positions_page", {
      p_limit: 20,
      p_offset: 0,
      p_query: null,
      p_saved_only: false,
      p_target: null,
    });
  });
});

describe("resolveGlobalSearchHref", () => {
  it("routes every target type to its detail screen", () => {
    expect(
      resolveGlobalSearchHref(
        makeGlobalRow({ target_type: "profile", target_id: "p1" }),
      ),
    ).toBe("/profile/p1");
    expect(
      resolveGlobalSearchHref(
        makeGlobalRow({ target_type: "club", target_id: "c1" }),
      ),
    ).toBe("/club/c1");
    expect(
      resolveGlobalSearchHref(
        makeGlobalRow({ target_type: "club_team", target_id: "t1" }),
      ),
    ).toBe("/club/team/t1");
    expect(
      resolveGlobalSearchHref(
        makeGlobalRow({ target_type: "recruiting_ad", target_id: "a1" }),
      ),
    ).toBe("/position/a1");
    expect(
      resolveGlobalSearchHref(
        makeGlobalRow({ target_type: "club_media", target_id: "m1" }),
      ),
    ).toBe("/content/club_media/m1");
    expect(
      resolveGlobalSearchHref(
        makeGlobalRow({ target_type: "fan_tribuna", target_id: "f1" }),
      ),
    ).toBe("/content/fan_tribuna/f1");
  });
});
