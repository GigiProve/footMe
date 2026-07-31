import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchMediaForYou,
  resolveMediaContentHref,
  resolveMediaPublisherHref,
  resolveMediaSourceHref,
  resolveMediaSuggestionHref,
  searchMediaContentPage,
  searchMediaSourcesPage,
  searchMediaSuggestions,
  toggleFollowSource,
  toggleSavedContent,
} from "./media-search-service";
import type { MediaSuggestionRow } from "./media-search-types";

const mocks = vi.hoisted(() => ({
  followClub: vi.fn(),
  followProfile: vi.fn(),
  rpc: vi.fn(),
  toggleSavedClubMedia: vi.fn(),
  toggleSavedFanMedia: vi.fn(),
  toggleSavedFanTribuna: vi.fn(),
  toggleSavedMediaProfilePost: vi.fn(),
  toggleSavedMediaTribuna: vi.fn(),
  unfollowClub: vi.fn(),
  unfollowProfile: vi.fn(),
}));

vi.mock("../../../lib/supabase", () => ({
  supabase: { rpc: mocks.rpc },
}));

vi.mock("../../clubs/club-service", () => ({
  followClub: mocks.followClub,
  unfollowClub: mocks.unfollowClub,
}));

vi.mock("../../clubs/club-media-service", () => ({
  toggleSavedClubMedia: mocks.toggleSavedClubMedia,
}));

vi.mock("../../profiles/fan-media-service", () => ({
  followProfile: mocks.followProfile,
  toggleSavedFanMedia: mocks.toggleSavedFanMedia,
  unfollowProfile: mocks.unfollowProfile,
}));

vi.mock("../../profiles/fan-tribuna-service", () => ({
  toggleSavedFanTribuna: mocks.toggleSavedFanTribuna,
}));

vi.mock("../../profiles/media-profile-post-service", () => ({
  toggleSavedMediaProfilePost: mocks.toggleSavedMediaProfilePost,
}));

vi.mock("../../profiles/media-tribuna-service", () => ({
  toggleSavedMediaTribuna: mocks.toggleSavedMediaTribuna,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("searchMediaContentPage", () => {
  it("maps page to offset and defaults the sort to pertinenza", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    await searchMediaContentPage({ page: 2, query: "AC Como" });

    expect(mocks.rpc).toHaveBeenCalledWith("search_media_content_page", {
      p_filters: null,
      p_limit: 20,
      p_offset: 40,
      p_query: "AC Como",
      p_sort: "pertinenza",
    });
  });

  it("collapses a blank query to null so the RPC browses", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    await searchMediaContentPage({ page: 0, query: "   " });

    expect(mocks.rpc.mock.calls[0][1].p_query).toBeNull();
  });

  it("collapses empty filters to null to keep the query key stable", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    await searchMediaContentPage({ filters: {}, page: 0, query: null });

    expect(mocks.rpc.mock.calls[0][1].p_filters).toBeNull();
  });

  it("forwards non-empty filters untouched", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    await searchMediaContentPage({
      filters: { formats: ["video"] },
      page: 0,
      query: null,
    });

    expect(mocks.rpc.mock.calls[0][1].p_filters).toEqual({ formats: ["video"] });
  });

  // supabase-js returns bigint columns as strings.
  it("coerces the string total_count to a number", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ post_id: "c1", total_count: "42" }],
      error: null,
    });

    const page = await searchMediaContentPage({ page: 0, query: "como" });

    expect(page.totalCount).toBe(42);
    expect(page.rows).toHaveLength(1);
  });

  it("reports zero results for an empty page", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    const page = await searchMediaContentPage({ page: 0, query: "nulla" });

    expect(page.totalCount).toBe(0);
  });

  it("rethrows RPC errors", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("rpc down") });

    await expect(searchMediaContentPage({ page: 0, query: null })).rejects.toThrow(
      "rpc down",
    );
  });
});

describe("searchMediaSourcesPage", () => {
  it("sends query, filters and pagination", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    await searchMediaSourcesPage({
      filters: { sources: ["creator"] },
      page: 1,
      query: "como",
    });

    expect(mocks.rpc).toHaveBeenCalledWith("search_media_sources_page", {
      p_filters: { sources: ["creator"] },
      p_limit: 20,
      p_offset: 20,
      p_query: "como",
    });
  });

  it("coerces the string total_count", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ entity_id: "m1", total_count: "3" }],
      error: null,
    });

    await expect(searchMediaSourcesPage({ page: 0, query: null })).resolves.toMatchObject({
      totalCount: 3,
    });
  });
});

describe("searchMediaSuggestions", () => {
  it("passes the raw query and group size", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    await searchMediaSuggestions("Com", 2);

    expect(mocks.rpc).toHaveBeenCalledWith("search_media_suggestions", {
      p_per_group: 2,
      p_query: "Com",
    });
  });

  it("returns an empty list when the RPC short-circuits", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });

    await expect(searchMediaSuggestions("C")).resolves.toEqual([]);
  });
});

describe("fetchMediaForYou", () => {
  it("clamps nothing client-side and forwards the limit", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    await fetchMediaForYou(4);

    expect(mocks.rpc).toHaveBeenCalledWith("fetch_media_for_you", { p_limit: 4 });
  });
});

describe("toggleSavedContent", () => {
  it("routes each content type to its own saved_* table helper", async () => {
    await toggleSavedContent("u1", "club_media", "p1", true);
    await toggleSavedContent("u1", "media_profile", "p2", true);
    await toggleSavedContent("u1", "media_tribuna", "p3", false);
    await toggleSavedContent("u1", "fan_tribuna", "p4", true);
    await toggleSavedContent("u1", "fan_media", "p5", false);

    expect(mocks.toggleSavedClubMedia).toHaveBeenCalledWith("u1", "p1", true);
    expect(mocks.toggleSavedMediaProfilePost).toHaveBeenCalledWith("u1", "p2", true);
    expect(mocks.toggleSavedMediaTribuna).toHaveBeenCalledWith("u1", "p3", false);
    expect(mocks.toggleSavedFanTribuna).toHaveBeenCalledWith("u1", "p4", true);
    expect(mocks.toggleSavedFanMedia).toHaveBeenCalledWith("u1", "p5", false);
  });
});

describe("toggleFollowSource", () => {
  it("uses club_follows for società", async () => {
    await toggleFollowSource("u1", "club", "c1", true);
    expect(mocks.followClub).toHaveBeenCalledWith("u1", "c1");

    await toggleFollowSource("u1", "club", "c1", false);
    expect(mocks.unfollowClub).toHaveBeenCalledWith("u1", "c1");
  });

  it("uses profile_follows for i profili Media", async () => {
    await toggleFollowSource("u1", "media_profile", "m1", true);
    expect(mocks.followProfile).toHaveBeenCalledWith("u1", "m1");

    await toggleFollowSource("u1", "media_profile", "m1", false);
    expect(mocks.unfollowProfile).toHaveBeenCalledWith("u1", "m1");
  });
});

describe("href resolvers", () => {
  it("sends every content type to the existing detail route", () => {
    expect(
      resolveMediaContentHref({ content_type: "club_media", post_id: "p1" }),
    ).toBe("/content/club_media/p1");
    expect(
      resolveMediaContentHref({ content_type: "media_tribuna", post_id: "p2" }),
    ).toBe("/content/media_tribuna/p2");
    expect(resolveMediaContentHref({ content_type: "fan_media", post_id: "p3" })).toBe(
      "/content/fan_media/p3",
    );
  });

  it("opens the publisher's public profile", () => {
    expect(
      resolveMediaPublisherHref({ publisher_id: "c1", publisher_type: "club" }),
    ).toBe("/club/c1");
    expect(
      resolveMediaPublisherHref({ publisher_id: "m1", publisher_type: "profile" }),
    ).toBe("/profile/m1");
  });

  it("opens a source's public profile", () => {
    expect(resolveMediaSourceHref({ entity_id: "c1", source_type: "club" })).toBe(
      "/club/c1",
    );
    expect(
      resolveMediaSourceHref({ entity_id: "m1", source_type: "media_profile" }),
    ).toBe("/profile/m1");
  });
});

describe("resolveMediaSuggestionHref", () => {
  function makeSuggestion(overrides: Partial<MediaSuggestionRow>): MediaSuggestionRow {
    return {
      group_key: "societa",
      group_order: 1,
      image_url: null,
      label: "AC Como",
      search_term: null,
      subtitle: null,
      target_id: "c1",
      target_type: "club",
      ...overrides,
    };
  }

  it("routes entity suggestions to their profile", () => {
    expect(resolveMediaSuggestionHref(makeSuggestion({}))).toBe("/club/c1");
    expect(
      resolveMediaSuggestionHref(
        makeSuggestion({ target_id: "t1", target_type: "club_team" }),
      ),
    ).toBe("/club/team/t1");
    expect(
      resolveMediaSuggestionHref(
        makeSuggestion({ target_id: "m1", target_type: "media_profile" }),
      ),
    ).toBe("/profile/m1");
    expect(
      resolveMediaSuggestionHref(
        makeSuggestion({ target_id: "p1", target_type: "profile" }),
      ),
    ).toBe("/profile/p1");
  });

  // Argomenti e territori rilanciano la ricerca invece di navigare.
  it("returns null for topics and territories", () => {
    expect(
      resolveMediaSuggestionHref(
        makeSuggestion({
          group_key: "argomento",
          label: "Serie D",
          search_term: "Serie D",
          target_id: null,
          target_type: null,
        }),
      ),
    ).toBeNull();
  });
});
