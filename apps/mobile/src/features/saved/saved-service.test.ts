import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchSavedCounts,
  fetchSavedItems,
  removeSavedItem,
  resolveSavedItemHref,
  saveProfile,
  type SavedItem,
} from "./saved-service";

const mocks = vi.hoisted(() => {
  const builder: Record<string, unknown> = {};
  builder.upsert = vi.fn(() => Promise.resolve({ error: null }));
  builder.delete = vi.fn(() => builder);
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
  builder.then = (resolve: (value: unknown) => unknown) =>
    resolve({ error: null });

  return {
    builder,
    from: vi.fn(() => builder),
    rpc: vi.fn(),
    toggleSavedAd: vi.fn(() => Promise.resolve()),
    toggleSavedMediaTribuna: vi.fn(() => Promise.resolve()),
    toggleSavedClubMedia: vi.fn(() => Promise.resolve()),
    toggleSavedFanTribuna: vi.fn(() => Promise.resolve()),
  };
});

vi.mock("../../lib/supabase", () => ({
  supabase: { from: mocks.from, rpc: mocks.rpc },
}));
vi.mock("../recruiting/recruiting-service", () => ({
  toggleSavedAd: mocks.toggleSavedAd,
}));
vi.mock("../profiles/media-tribuna-service", () => ({
  toggleSavedMediaTribuna: mocks.toggleSavedMediaTribuna,
}));
vi.mock("../clubs/club-media-service", () => ({
  toggleSavedClubMedia: mocks.toggleSavedClubMedia,
}));
vi.mock("../profiles/fan-tribuna-service", () => ({
  toggleSavedFanTribuna: mocks.toggleSavedFanTribuna,
}));

function makeItem(overrides: Partial<SavedItem>): SavedItem {
  return {
    kind: "profile",
    source_table: "saved_profiles",
    entity_id: "entity-1",
    content_type: null,
    title: "Title",
    subtitle: null,
    thumbnail_url: null,
    saved_at: "2026-06-27T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveSavedItemHref", () => {
  it("routes profiles and clubs to their detail screens", () => {
    expect(resolveSavedItemHref(makeItem({ kind: "profile", entity_id: "p1" }))).toBe(
      "/profile/p1",
    );
    expect(
      resolveSavedItemHref(makeItem({ kind: "club", entity_id: "c1" })),
    ).toBe("/club/c1");
  });

  it("routes routable content types and returns null for the rest", () => {
    expect(
      resolveSavedItemHref(
        makeItem({ kind: "content", content_type: "club_media", entity_id: "x" }),
      ),
    ).toBe("/content/club_media/x");
    expect(
      resolveSavedItemHref(
        makeItem({ kind: "content", content_type: "fan_tribuna", entity_id: "y" }),
      ),
    ).toBe("/content/fan_tribuna/y");
    // media_tribuna has no standalone detail route
    expect(
      resolveSavedItemHref(
        makeItem({ kind: "content", content_type: "media_tribuna", entity_id: "z" }),
      ),
    ).toBeNull();
    expect(resolveSavedItemHref(makeItem({ kind: "position" }))).toBeNull();
  });
});

describe("removeSavedItem", () => {
  it("dispatches each source_table to the correct unsave path", async () => {
    await removeSavedItem("owner", makeItem({ source_table: "saved_ads", entity_id: "ad1" }));
    expect(mocks.toggleSavedAd).toHaveBeenCalledWith("owner", "ad1", false);

    await removeSavedItem(
      "owner",
      makeItem({ source_table: "saved_media_tribuna", entity_id: "m1" }),
    );
    expect(mocks.toggleSavedMediaTribuna).toHaveBeenCalledWith("owner", "m1", false);

    await removeSavedItem(
      "owner",
      makeItem({ source_table: "saved_club_media", entity_id: "cm1" }),
    );
    expect(mocks.toggleSavedClubMedia).toHaveBeenCalledWith("owner", "cm1", false);

    await removeSavedItem(
      "owner",
      makeItem({ source_table: "saved_fan_tribuna", entity_id: "f1" }),
    );
    expect(mocks.toggleSavedFanTribuna).toHaveBeenCalledWith("owner", "f1", false);

    await removeSavedItem(
      "owner",
      makeItem({ source_table: "saved_profiles", entity_id: "p1" }),
    );
    expect(mocks.from).toHaveBeenCalledWith("saved_profiles");

    await removeSavedItem(
      "owner",
      makeItem({ source_table: "saved_clubs", kind: "club", entity_id: "c1" }),
    );
    expect(mocks.from).toHaveBeenCalledWith("saved_clubs");
  });
});

describe("saveProfile", () => {
  it("rejects when saving your own profile", async () => {
    await expect(saveProfile("me", "me")).rejects.toThrow();
  });
});

describe("rpc readers", () => {
  it("fetchSavedItems forwards filter and pagination", async () => {
    mocks.rpc.mockResolvedValue({ data: [makeItem({})], error: null });
    const result = await fetchSavedItems("content", 2, 20);
    expect(mocks.rpc).toHaveBeenCalledWith("fetch_saved_items", {
      p_filter: "content",
      p_limit: 20,
      p_offset: 40,
    });
    expect(result).toHaveLength(1);
  });

  it("fetchSavedCounts coerces counts to numbers", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          profiles_count: "3",
          clubs_count: "1",
          positions_count: "2",
          contents_count: "5",
        },
      ],
      error: null,
    });
    const counts = await fetchSavedCounts();
    expect(counts).toEqual({
      profiles_count: 3,
      clubs_count: 1,
      positions_count: 2,
      contents_count: 5,
    });
  });
});
