import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchClubPermissionMembers,
  fetchMyShortlistPermissions,
  grantClubPermission,
  revokeClubPermission,
  SHORTLIST_PERMISSION_LABELS,
  type ShortlistPermissionKey,
} from "./shortlist-permissions-service";

const mocks = vi.hoisted(() => {
  function makeChain() {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.not = vi.fn(() => chain);
    chain.delete = vi.fn(() => chain);
    chain.upsert = vi.fn(() => Promise.resolve({ error: null }));
    chain.then = vi.fn((resolve: (value: unknown) => unknown) =>
      resolve({ data: [], error: null }),
    );
    return chain;
  }

  const membersChain = makeChain();
  const permissionsChain = makeChain();

  return {
    from: vi.fn((table: string) => {
      if (table === "club_members") {
        return membersChain;
      }
      if (table === "club_member_permissions") {
        return permissionsChain;
      }
      return makeChain();
    }),
    membersChain,
    permissionsChain,
    rpc: vi.fn(),
  };
});

vi.mock("../../lib/supabase", () => ({
  supabase: { from: mocks.from, rpc: mocks.rpc },
}));

function resetChain(chain: Record<string, unknown>) {
  (chain.select as ReturnType<typeof vi.fn>).mockImplementation(() => chain);
  (chain.eq as ReturnType<typeof vi.fn>).mockImplementation(() => chain);
  (chain.not as ReturnType<typeof vi.fn>).mockImplementation(() => chain);
  (chain.delete as ReturnType<typeof vi.fn>).mockImplementation(() => chain);
  (chain.upsert as ReturnType<typeof vi.fn>).mockImplementation(() =>
    Promise.resolve({ error: null }),
  );
  (chain.then as ReturnType<typeof vi.fn>).mockImplementation(
    (resolve: (value: unknown) => unknown) => resolve({ data: [], error: null }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  resetChain(mocks.membersChain);
  resetChain(mocks.permissionsChain);
});

describe("fetchMyShortlistPermissions", () => {
  it("returns the first row when the rpc has results", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          can_add_notes: true,
          can_add_profiles: true,
          can_create_lists: true,
          can_edit_status: true,
          can_remove_profiles: true,
          can_view: true,
          club_id: "club-1",
          club_name: "AC Como",
          is_owner: true,
        },
      ],
      error: null,
    });

    const result = await fetchMyShortlistPermissions();
    expect(result).toEqual({
      can_add_notes: true,
      can_add_profiles: true,
      can_create_lists: true,
      can_edit_status: true,
      can_remove_profiles: true,
      can_view: true,
      club_id: "club-1",
      club_name: "AC Como",
      is_owner: true,
    });
  });

  it("returns null when the rpc result is empty", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    const result = await fetchMyShortlistPermissions();
    expect(result).toBeNull();
  });

  it("returns null when the rpc returns no data at all", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    const result = await fetchMyShortlistPermissions();
    expect(result).toBeNull();
  });

  it("throws when the rpc errors", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("Authentication required") });
    await expect(fetchMyShortlistPermissions()).rejects.toThrow("Authentication required");
  });
});

describe("fetchClubPermissionMembers", () => {
  it("merges active members with their permission grants, defaulting to an empty array", async () => {
    (mocks.membersChain.then as ReturnType<typeof vi.fn>).mockImplementation(
      (resolve: (value: unknown) => unknown) =>
        resolve({
          data: [
            {
              id: "member-1",
              member_role: "staff",
              profile_id: "profile-1",
              profiles: { avatar_url: "https://a", full_name: "Mario Rossi" },
            },
            {
              id: "member-2",
              member_role: "coach",
              profile_id: "profile-2",
              profiles: { avatar_url: null, full_name: "Luca Bianchi" },
            },
          ],
          error: null,
        }),
    );

    (mocks.permissionsChain.then as ReturnType<typeof vi.fn>).mockImplementation(
      (resolve: (value: unknown) => unknown) =>
        resolve({
          data: [
            { permission_key: "shortlist_view", profile_id: "profile-1" },
            { permission_key: "shortlist_add_profiles", profile_id: "profile-1" },
          ],
          error: null,
        }),
    );

    const result = await fetchClubPermissionMembers("club-1");

    expect(result).toEqual([
      {
        avatar_url: "https://a",
        full_name: "Mario Rossi",
        member_id: "member-1",
        member_role: "staff",
        permissions: ["shortlist_view", "shortlist_add_profiles"],
        profile_id: "profile-1",
      },
      {
        avatar_url: null,
        full_name: "Luca Bianchi",
        member_id: "member-2",
        member_role: "coach",
        permissions: [],
        profile_id: "profile-2",
      },
    ]);
  });

  it("filters active members with a linked account", async () => {
    await fetchClubPermissionMembers("club-1");

    expect(mocks.from).toHaveBeenCalledWith("club_members");
    expect(mocks.membersChain.eq).toHaveBeenCalledWith("club_id", "club-1");
    expect(mocks.membersChain.eq).toHaveBeenCalledWith("status", "active");
    expect(mocks.membersChain.not).toHaveBeenCalledWith("profile_id", "is", null);
  });

  it("throws when the members query errors", async () => {
    (mocks.membersChain.then as ReturnType<typeof vi.fn>).mockImplementation(
      (resolve: (value: unknown) => unknown) =>
        resolve({ data: null, error: new Error("boom") }),
    );

    await expect(fetchClubPermissionMembers("club-1")).rejects.toThrow("boom");
  });

  it("throws when the permissions query errors", async () => {
    (mocks.permissionsChain.then as ReturnType<typeof vi.fn>).mockImplementation(
      (resolve: (value: unknown) => unknown) =>
        resolve({ data: null, error: new Error("boom") }),
    );

    await expect(fetchClubPermissionMembers("club-1")).rejects.toThrow("boom");
  });
});

describe("grantClubPermission", () => {
  it("upserts a grant ignoring duplicates on the composite key", async () => {
    await grantClubPermission("club-1", "profile-1", "shortlist_view", "owner-1");

    expect(mocks.from).toHaveBeenCalledWith("club_member_permissions");
    expect(mocks.permissionsChain.upsert).toHaveBeenCalledWith(
      {
        club_id: "club-1",
        granted_by_profile_id: "owner-1",
        permission_key: "shortlist_view",
        profile_id: "profile-1",
      },
      {
        ignoreDuplicates: true,
        onConflict: "club_id,profile_id,permission_key",
      },
    );
  });
});

describe("revokeClubPermission", () => {
  it("deletes the grant by club, profile, and permission key", async () => {
    await revokeClubPermission("club-1", "profile-1", "shortlist_view");

    expect(mocks.from).toHaveBeenCalledWith("club_member_permissions");
    expect(mocks.permissionsChain.delete).toHaveBeenCalled();
    expect(mocks.permissionsChain.eq).toHaveBeenCalledWith("club_id", "club-1");
    expect(mocks.permissionsChain.eq).toHaveBeenCalledWith("profile_id", "profile-1");
    expect(mocks.permissionsChain.eq).toHaveBeenCalledWith("permission_key", "shortlist_view");
  });
});

describe("SHORTLIST_PERMISSION_LABELS", () => {
  it("has an Italian label for every permission key", () => {
    const expected: Record<ShortlistPermissionKey, string> = {
      shortlist_add_notes: "Aggiungere note interne",
      shortlist_add_profiles: "Aggiungere profili",
      shortlist_create_lists: "Creare liste",
      shortlist_edit_status: "Modificare stato valutazione",
      shortlist_remove_profiles: "Rimuovere profili",
      shortlist_view: "Vedere shortlist",
    };

    expect(SHORTLIST_PERMISSION_LABELS).toEqual(expected);
  });
});
