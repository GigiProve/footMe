import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  resolveGlobalSearchHref,
  searchClubsPage,
  searchGlobal,
  searchPositionsPage,
  searchProfilesPage,
} from "./search-service";
import type { GlobalSearchRow } from "./search-types";

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
  it("forwards filters and computes the offset", async () => {
    await searchProfilesPage("rossi", "player", 2, 20);

    expect(mocks.rpc).toHaveBeenCalledWith("search_profiles_page", {
      p_limit: 20,
      p_offset: 40,
      p_query: "rossi",
      p_role: "player",
    });
  });

  it("passes null query and role in browse mode", async () => {
    await searchProfilesPage("   ", null, 0);

    expect(mocks.rpc).toHaveBeenCalledWith("search_profiles_page", {
      p_limit: 20,
      p_offset: 0,
      p_query: null,
      p_role: null,
    });
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
