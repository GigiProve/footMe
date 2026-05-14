import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchClubFollowState,
  fetchPublicClubHeaderStats,
  fetchPublicClubProfile,
  followClub,
  unfollowClub,
} from "./club-service";

const mocks = vi.hoisted(() => {
  type Filter = {
    column: string;
    value: unknown;
  };

  type Operation = {
    action: string | null;
    filters: Filter[];
    inFilters: Filter[];
    options: unknown;
    payload: unknown;
    selectArgs: unknown[];
    table: string;
  };

  const operations: Operation[] = [];
  const responses: unknown[] = [];

  function nextResponse() {
    return responses.shift() ?? { data: null, error: null };
  }

  function createBuilder(table: string) {
    const operation: Operation = {
      action: null,
      filters: [],
      inFilters: [],
      options: null,
      payload: null,
      selectArgs: [],
      table,
    };
    operations.push(operation);

    const builder = {
      delete: vi.fn(() => {
        operation.action = "delete";
        return builder;
      }),
      eq: vi.fn((column: string, value: unknown) => {
        operation.filters.push({ column, value });
        return builder;
      }),
      in: vi.fn((column: string, value: unknown) => {
        operation.inFilters.push({ column, value });
        return builder;
      }),
      insert: vi.fn((payload: unknown) => {
        operation.action = "insert";
        operation.payload = payload;
        return builder;
      }),
      maybeSingle: vi.fn(async () => nextResponse()),
      select: vi.fn((...args: unknown[]) => {
        operation.action = "select";
        operation.selectArgs = args;
        return builder;
      }),
      then: (
        resolve: (value: unknown) => unknown,
        reject: (reason: unknown) => unknown,
      ) => Promise.resolve(nextResponse()).then(resolve, reject),
      upsert: vi.fn((payload: unknown, options: unknown) => {
        operation.action = "upsert";
        operation.payload = payload;
        operation.options = options;
        return builder;
      }),
    };

    return builder;
  }

  return {
    fromMock: vi.fn((table: string) => createBuilder(table)),
    operations,
    queueResponses: (...nextResponses: unknown[]) => {
      responses.push(...nextResponses);
    },
    reset: () => {
      operations.length = 0;
      responses.length = 0;
    },
  };
});

vi.mock("../../lib/supabase", () => ({
  supabase: {
    from: mocks.fromMock,
  },
}));

describe("club-service", () => {
  beforeEach(() => {
    mocks.reset();
    mocks.fromMock.mockClear();
  });

  it("fetches the public club profile fields needed by the header", async () => {
    mocks.queueResponses(
      {
        data: {
          category: "Serie D",
          city: "Como",
          club_colors: null,
          club_email: "info@club.test",
          club_phone: null,
          country: "IT",
          description: null,
          field_address: null,
          founding_year: 1907,
          headquarters_address: null,
          id: "club-1",
          league: "LND",
          logo_url: null,
          name: "AC Como",
          owner_profile_id: "owner-1",
          region: "Lombardia",
          stadium: "Sinigaglia",
          verification_status: "verified",
          website_url: null,
        },
        error: null,
      },
      {
        data: { full_name: "Owner Name" },
        error: null,
      },
    );

    const profile = await fetchPublicClubProfile("club-1");

    expect(profile).toEqual(
      expect.objectContaining({
        category: "Serie D",
        league: "LND",
        owner_full_name: "Owner Name",
        stadium: "Sinigaglia",
      }),
    );
    expect(mocks.operations[0].selectArgs[0]).toContain("category");
    expect(mocks.operations[0].selectArgs[0]).toContain("stadium");
  });

  it("counts active teams, players, and staff for the public header", async () => {
    mocks.queueResponses(
      { count: 5, data: null, error: null },
      { count: 142, data: null, error: null },
      { count: 28, data: null, error: null },
    );

    const stats = await fetchPublicClubHeaderStats("club-1");

    expect(stats).toEqual({
      activeTeamsCount: 5,
      playersCount: 142,
      staffCount: 28,
    });
    expect(mocks.operations[0]).toEqual(
      expect.objectContaining({ action: "select", table: "club_teams" }),
    );
    expect(mocks.operations[1].filters).toEqual(
      expect.arrayContaining([
        { column: "club_id", value: "club-1" },
        { column: "status", value: "active" },
        { column: "member_role", value: "player" },
      ]),
    );
    expect(mocks.operations[2].inFilters).toEqual([
      { column: "member_role", value: ["staff", "coach", "director"] },
    ]);
  });

  it("reads whether the current profile follows the club", async () => {
    mocks.queueResponses({
      data: { profile_id: "profile-1" },
      error: null,
    });

    await expect(fetchClubFollowState("profile-1", "club-1")).resolves.toBe(
      true,
    );
    expect(mocks.operations[0].filters).toEqual([
      { column: "profile_id", value: "profile-1" },
      { column: "club_id", value: "club-1" },
    ]);
  });

  it("upserts and deletes club follows", async () => {
    mocks.queueResponses({ error: null }, { error: null });

    await followClub("profile-1", "club-1");
    await unfollowClub("profile-1", "club-1");

    expect(mocks.operations[0]).toEqual(
      expect.objectContaining({
        action: "upsert",
        options: { ignoreDuplicates: true, onConflict: "profile_id,club_id" },
        payload: { club_id: "club-1", profile_id: "profile-1" },
        table: "club_follows",
      }),
    );
    expect(mocks.operations[1]).toEqual(
      expect.objectContaining({
        action: "delete",
        filters: [
          { column: "profile_id", value: "profile-1" },
          { column: "club_id", value: "club-1" },
        ],
        table: "club_follows",
      }),
    );
  });
});
