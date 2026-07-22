import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchFollowedProfiles,
  fetchFollowingCount,
  resolveFollowedHref,
  unfollowEntity,
  type FollowedEntity,
} from "./following-service";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  unfollowProfile: vi.fn(() => Promise.resolve()),
  unfollowClub: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../lib/supabase", () => ({
  supabase: { rpc: mocks.rpc },
}));
vi.mock("../profiles/fan-media-service", () => ({
  unfollowProfile: mocks.unfollowProfile,
}));
vi.mock("../clubs/club-service", () => ({
  unfollowClub: mocks.unfollowClub,
}));

function makeEntity(overrides: Partial<FollowedEntity>): FollowedEntity {
  return {
    kind: "profile",
    entity_id: "e1",
    name: "Marco Rossi",
    role: "player",
    subtitle: null,
    avatar_url: null,
    followed_at: "2026-06-27T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveFollowedHref", () => {
  it("routes people to /profile and clubs to /club", () => {
    expect(resolveFollowedHref(makeEntity({ kind: "profile", entity_id: "p1" }))).toBe(
      "/profile/p1",
    );
    expect(resolveFollowedHref(makeEntity({ kind: "club", entity_id: "c1" }))).toBe(
      "/club/c1",
    );
  });
});

describe("unfollowEntity", () => {
  it("dispatches clubs to unfollowClub and people to unfollowProfile", async () => {
    await unfollowEntity("owner", makeEntity({ kind: "club", entity_id: "c1" }));
    expect(mocks.unfollowClub).toHaveBeenCalledWith("owner", "c1");
    expect(mocks.unfollowProfile).not.toHaveBeenCalled();

    await unfollowEntity("owner", makeEntity({ kind: "profile", entity_id: "p1" }));
    expect(mocks.unfollowProfile).toHaveBeenCalledWith("owner", "p1");
  });
});

describe("rpc readers", () => {
  it("fetchFollowedProfiles forwards filter and pagination", async () => {
    mocks.rpc.mockResolvedValue({ data: [makeEntity({})], error: null });
    const result = await fetchFollowedProfiles("club", 1, 20);
    expect(mocks.rpc).toHaveBeenCalledWith("fetch_followed_profiles", {
      p_filter: "club",
      p_limit: 20,
      p_offset: 20,
    });
    expect(result).toHaveLength(1);
  });

  it("fetchFollowingCount coerces the count to a number", async () => {
    mocks.rpc.mockResolvedValue({ data: "7", error: null });
    await expect(fetchFollowingCount()).resolves.toBe(7);
  });
});
