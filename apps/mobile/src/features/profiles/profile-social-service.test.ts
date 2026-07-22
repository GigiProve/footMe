import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchProfileFollowers,
  fetchProfileMutualConnections,
  fetchProfileSocialSummary,
  updateProfileAvatarUrl,
  updateProfileCoverUrl,
} from "./profile-social-service";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  update: vi.fn(
    (
      _table: string,
      _payload: Record<string, unknown>,
      _column: string,
      _value: unknown,
    ): Promise<{ data: null; error: Error | null }> =>
      Promise.resolve({ data: null, error: null }),
  ),
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    rpc: mocks.rpc,
    from: vi.fn((table: string) => ({
      update: (payload: Record<string, unknown>) => ({
        eq: (column: string, value: unknown) => mocks.update(table, payload, column, value),
      }),
    })),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.update.mockResolvedValue({ data: null, error: null });
});

describe("fetchProfileSocialSummary", () => {
  it("maps the RPC row into camelCase counters and preview entries", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          follower_count: 12,
          following_count: 5,
          mutual_total: 2,
          mutual_preview: [
            { profile_id: "p1", display_name: "Marco Rossi", avatar_url: "https://cdn.test/p1.jpg" },
            { profile_id: "p2", display_name: "Luca Bianchi", avatar_url: null },
          ],
        },
      ],
      error: null,
    });

    const result = await fetchProfileSocialSummary("target-1");

    expect(mocks.rpc).toHaveBeenCalledWith("fetch_profile_social_summary", {
      target_profile_id: "target-1",
    });
    expect(result).toEqual({
      followerCount: 12,
      followingCount: 5,
      mutualTotal: 2,
      mutualPreview: [
        { profileId: "p1", displayName: "Marco Rossi", avatarUrl: "https://cdn.test/p1.jpg" },
        { profileId: "p2", displayName: "Luca Bianchi", avatarUrl: null },
      ],
    });
  });

  it("falls back to zero counts and an empty preview when the RPC returns nothing", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });

    const result = await fetchProfileSocialSummary("target-1");

    expect(result).toEqual({
      followerCount: 0,
      followingCount: 0,
      mutualTotal: 0,
      mutualPreview: [],
    });
  });

  it("handles a single-row object response (non-array) the same way", async () => {
    mocks.rpc.mockResolvedValue({
      data: { follower_count: "3", following_count: "1", mutual_total: "0", mutual_preview: [] },
      error: null,
    });

    const result = await fetchProfileSocialSummary("target-1");

    expect(result.followerCount).toBe(3);
    expect(result.followingCount).toBe(1);
    expect(result.mutualTotal).toBe(0);
  });

  it("throws on RPC error", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("boom") });

    await expect(fetchProfileSocialSummary("target-1")).rejects.toThrow("boom");
  });
});

describe("fetchProfileFollowers", () => {
  it("forwards target id and pagination params to the RPC and maps rows", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        { profile_id: "p1", display_name: "Marco Rossi", avatar_url: null, role_label: "player" },
      ],
      error: null,
    });

    const result = await fetchProfileFollowers("target-1", { limit: 20, offset: 40 });

    expect(mocks.rpc).toHaveBeenCalledWith("fetch_profile_followers", {
      target_profile_id: "target-1",
      page_limit: 20,
      page_offset: 40,
    });
    expect(result).toEqual([
      { profileId: "p1", displayName: "Marco Rossi", avatarUrl: null, roleLabel: "player" },
    ]);
  });

  it("passes through an over-limit page size unchanged (clamping is enforced server-side)", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    await fetchProfileFollowers("target-1", { limit: 500, offset: 0 });

    expect(mocks.rpc).toHaveBeenCalledWith("fetch_profile_followers", {
      target_profile_id: "target-1",
      page_limit: 500,
      page_offset: 0,
    });
  });

  it("returns an empty array when data is null", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });

    await expect(fetchProfileFollowers("target-1", { limit: 20, offset: 0 })).resolves.toEqual([]);
  });

  it("throws on RPC error", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("boom") });

    await expect(
      fetchProfileFollowers("target-1", { limit: 20, offset: 0 }),
    ).rejects.toThrow("boom");
  });
});

describe("fetchProfileMutualConnections", () => {
  it("forwards target id and pagination params to the RPC and maps rows", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        { profile_id: "p2", display_name: "Luca Bianchi", avatar_url: "https://cdn.test/p2.jpg", role_label: "coach" },
      ],
      error: null,
    });

    const result = await fetchProfileMutualConnections("target-1", { limit: 10, offset: 0 });

    expect(mocks.rpc).toHaveBeenCalledWith("fetch_profile_mutual_connections", {
      target_profile_id: "target-1",
      page_limit: 10,
      page_offset: 0,
    });
    expect(result).toEqual([
      {
        profileId: "p2",
        displayName: "Luca Bianchi",
        avatarUrl: "https://cdn.test/p2.jpg",
        roleLabel: "coach",
      },
    ]);
  });

  it("throws on RPC error", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("boom") });

    await expect(
      fetchProfileMutualConnections("target-1", { limit: 10, offset: 0 }),
    ).rejects.toThrow("boom");
  });
});

describe("updateProfileCoverUrl", () => {
  it("updates only cover_url for the given profile id", async () => {
    await updateProfileCoverUrl("profile-1", "https://cdn.test/cover.jpg");

    expect(mocks.update).toHaveBeenCalledWith(
      "profiles",
      { cover_url: "https://cdn.test/cover.jpg" },
      "id",
      "profile-1",
    );
  });

  it("supports clearing the cover with null", async () => {
    await updateProfileCoverUrl("profile-1", null);

    expect(mocks.update).toHaveBeenCalledWith("profiles", { cover_url: null }, "id", "profile-1");
  });

  it("throws on update error", async () => {
    mocks.update.mockResolvedValueOnce({ data: null, error: new Error("boom") });

    await expect(updateProfileCoverUrl("profile-1", "https://cdn.test/cover.jpg")).rejects.toThrow(
      "boom",
    );
  });
});

describe("updateProfileAvatarUrl", () => {
  it("updates only avatar_url for the given profile id", async () => {
    await updateProfileAvatarUrl("profile-1", "https://cdn.test/avatar.jpg");

    expect(mocks.update).toHaveBeenCalledWith(
      "profiles",
      { avatar_url: "https://cdn.test/avatar.jpg" },
      "id",
      "profile-1",
    );
  });

  it("throws on update error", async () => {
    mocks.update.mockResolvedValueOnce({ data: null, error: new Error("boom") });

    await expect(
      updateProfileAvatarUrl("profile-1", "https://cdn.test/avatar.jpg"),
    ).rejects.toThrow("boom");
  });
});
