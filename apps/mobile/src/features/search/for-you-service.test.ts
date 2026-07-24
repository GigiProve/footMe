import { beforeEach, describe, expect, it, vi } from "vitest";

import { getForYouSuggestions } from "./for-you-service";

type MockResponse = { data: unknown; error: unknown };
type RecordedCall = { table: string; steps: [string, unknown[]][] };

const mocks = vi.hoisted(() => {
  const queues = new Map<string, MockResponse[]>();
  const calls: RecordedCall[] = [];

  const from = vi.fn((table: string) => {
    const call: RecordedCall = { steps: [], table };
    calls.push(call);

    const respond = (): Promise<MockResponse> => {
      const queue = queues.get(table);
      return Promise.resolve(queue?.shift() ?? { data: [], error: null });
    };

    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "neq", "in", "not", "order", "limit"]) {
      builder[method] = vi.fn((...args: unknown[]) => {
        call.steps.push([method, args]);
        return builder;
      });
    }
    builder.maybeSingle = vi.fn(() => {
      call.steps.push(["maybeSingle", []]);
      return respond();
    });
    builder.then = (
      resolve: (value: MockResponse) => unknown,
      reject: (reason: unknown) => unknown,
    ) => respond().then(resolve, reject);

    return builder;
  });

  return { calls, from, queues };
});

vi.mock("../../lib/supabase", () => ({
  supabase: { from: mocks.from },
}));

function enqueue(table: string, response: MockResponse) {
  const queue = mocks.queues.get(table) ?? [];
  queue.push(response);
  mocks.queues.set(table, queue);
}

function callsFor(table: string): RecordedCall[] {
  return mocks.calls.filter((call) => call.table === table);
}

function hasStep(call: RecordedCall, method: string, args: unknown[]): boolean {
  return call.steps.some(
    ([name, stepArgs]) =>
      name === method && JSON.stringify(stepArgs) === JSON.stringify(args),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.queues.clear();
  mocks.calls.length = 0;
});

describe("getForYouSuggestions", () => {
  it("hides the section for fan, media and unknown roles", async () => {
    await expect(
      getForYouSuggestions({ id: "u1", region: null, role: "fan" }),
    ).resolves.toEqual({ kind: "hidden" });
    await expect(
      getForYouSuggestions({ id: "u1", region: null, role: "media" }),
    ).resolves.toEqual({ kind: "hidden" });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("returns compatible positions and clubs to follow for players", async () => {
    enqueue("player_profiles", {
      data: { primary_position: "striker" },
      error: null,
    });
    enqueue("recruiting_ads", {
      data: [
        {
          category: "Serie D",
          club_teams: { name: "Prima squadra" },
          clubs: { name: "AC Como" },
          deadline: "2026-08-15",
          id: "ad1",
          region: "Lombardia",
          title: "AC Como cerca Attaccante",
        },
      ],
      error: null,
    });
    enqueue("club_follows", {
      data: [{ club_id: "c9" }],
      error: null,
    });
    enqueue("clubs", {
      data: [
        {
          category: "Eccellenza",
          city: "Varese",
          id: "c1",
          logo_url: null,
          name: "Varese Calcio",
          region: "Lombardia",
        },
      ],
      error: null,
    });

    const result = await getForYouSuggestions({
      id: "u1",
      region: "Lombardia",
      role: "player",
    });

    expect(result).toEqual({
      clubsToFollow: [
        {
          category: "Eccellenza",
          city: "Varese",
          club_id: "c1",
          logo_url: null,
          name: "Varese Calcio",
          region: "Lombardia",
        },
      ],
      kind: "player",
      positions: [
        {
          ad_id: "ad1",
          category: "Serie D",
          club_name: "AC Como",
          deadline: "2026-08-15",
          region: "Lombardia",
          team_name: "Prima squadra",
          title: "AC Como cerca Attaccante",
        },
      ],
    });

    const adsCall = callsFor("recruiting_ads")[0];
    expect(adsCall).toBeDefined();
    expect(hasStep(adsCall!, "eq", ["status", "published"])).toBe(true);
    expect(hasStep(adsCall!, "eq", ["role_required", "striker"])).toBe(true);
    expect(hasStep(adsCall!, "limit", [3])).toBe(true);

    const clubsCall = callsFor("clubs")[0];
    expect(clubsCall).toBeDefined();
    expect(hasStep(clubsCall!, "eq", ["region", "Lombardia"])).toBe(true);
    expect(hasStep(clubsCall!, "not", ["id", "in", "(c9)"])).toBe(true);
    expect(hasStep(clubsCall!, "limit", [3])).toBe(true);
  });

  it("skips the positions query when the player has no primary position", async () => {
    enqueue("player_profiles", { data: null, error: null });

    const result = await getForYouSuggestions({
      id: "u1",
      region: null,
      role: "player",
    });

    expect(result.kind).toBe("player");
    if (result.kind === "player") {
      expect(result.positions).toEqual([]);
    }
    expect(callsFor("recruiting_ads")).toHaveLength(0);
  });

  it("returns nearby available and recently updated profiles for scouting roles", async () => {
    const result = await getForYouSuggestions({
      id: "scout-1",
      region: "Lombardia",
      role: "club_admin",
    });

    expect(result.kind).toBe("scout");

    const profileCalls = callsFor("profiles");
    expect(profileCalls).toHaveLength(2);

    const [nearbyCall, recentCall] = profileCalls;
    expect(hasStep(nearbyCall!, "eq", ["is_available", true])).toBe(true);
    expect(hasStep(nearbyCall!, "eq", ["region", "Lombardia"])).toBe(true);
    expect(hasStep(nearbyCall!, "neq", ["id", "scout-1"])).toBe(true);
    expect(
      hasStep(nearbyCall!, "in", ["role", ["player", "coach", "staff"]]),
    ).toBe(true);

    expect(hasStep(recentCall!, "eq", ["is_available", true])).toBe(false);
    expect(hasStep(recentCall!, "neq", ["id", "scout-1"])).toBe(true);
    expect(hasStep(recentCall!, "limit", [3])).toBe(true);
  });

  it("returns only clubs to follow for coach and staff", async () => {
    const result = await getForYouSuggestions({
      id: "u1",
      region: null,
      role: "coach",
    });

    expect(result.kind).toBe("follow-only");
    expect(callsFor("club_follows")).toHaveLength(1);
    expect(callsFor("clubs")).toHaveLength(1);
    expect(callsFor("recruiting_ads")).toHaveLength(0);
    expect(callsFor("profiles")).toHaveLength(0);

    const clubsCall = callsFor("clubs")[0];
    const hasRegionFilter = clubsCall!.steps.some(
      ([name, args]) => name === "eq" && args[0] === "region",
    );
    expect(hasRegionFilter).toBe(false);
  });

  it("propagates query errors", async () => {
    enqueue("player_profiles", { data: null, error: new Error("boom") });

    await expect(
      getForYouSuggestions({ id: "u1", region: null, role: "player" }),
    ).rejects.toThrow("boom");
  });
});
