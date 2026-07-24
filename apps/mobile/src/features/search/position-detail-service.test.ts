import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchPositionDetail } from "./position-detail-service";

type MockResponse = { data: unknown; error: unknown };

const mocks = vi.hoisted(() => {
  const queues = new Map<string, MockResponse[]>();
  const calls: { table: string; steps: [string, unknown[]][] }[] = [];

  const from = vi.fn((table: string) => {
    const call = { steps: [] as [string, unknown[]][], table };
    calls.push(call);

    const respond = (): Promise<MockResponse> => {
      const queue = queues.get(table);
      return Promise.resolve(queue?.shift() ?? { data: null, error: null });
    };

    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq"]) {
      builder[method] = vi.fn((...args: unknown[]) => {
        call.steps.push([method, args]);
        return builder;
      });
    }
    builder.maybeSingle = vi.fn(() => respond());

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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.queues.clear();
  mocks.calls.length = 0;
});

describe("fetchPositionDetail", () => {
  it("maps the ad with its club, team and saved state", async () => {
    enqueue("recruiting_ads", {
      data: {
        category: "Serie D",
        club_id: "c1",
        club_teams: { name: "Prima squadra" },
        clubs: { id: "c1", logo_url: "logo.png", name: "AC Como" },
        compensation_summary: null,
        deadline: "2026-08-15",
        description: "Cerchiamo un attaccante.",
        id: "ad1",
        published_at: "2026-07-01T00:00:00Z",
        region: "Lombardia",
        title: "AC Como cerca Attaccante",
      },
      error: null,
    });
    enqueue("saved_ads", { data: { ad_id: "ad1" }, error: null });

    const detail = await fetchPositionDetail("u1", "ad1");

    expect(detail).toEqual({
      ad_id: "ad1",
      category: "Serie D",
      club_id: "c1",
      club_logo_url: "logo.png",
      club_name: "AC Como",
      compensation_summary: null,
      deadline: "2026-08-15",
      description: "Cerchiamo un attaccante.",
      is_saved: true,
      published_at: "2026-07-01T00:00:00Z",
      region: "Lombardia",
      team_name: "Prima squadra",
      title: "AC Como cerca Attaccante",
    });

    const adCall = mocks.calls.find((call) => call.table === "recruiting_ads");
    expect(adCall?.steps).toContainEqual(["eq", ["status", "published"]]);
    expect(adCall?.steps).toContainEqual(["eq", ["id", "ad1"]]);
  });

  it("returns null for missing or unpublished ads", async () => {
    enqueue("recruiting_ads", { data: null, error: null });
    enqueue("saved_ads", { data: null, error: null });

    await expect(fetchPositionDetail("u1", "missing")).resolves.toBeNull();
  });

  it("propagates query errors", async () => {
    enqueue("recruiting_ads", { data: null, error: new Error("boom") });
    enqueue("saved_ads", { data: null, error: null });

    await expect(fetchPositionDetail("u1", "ad1")).rejects.toThrow("boom");
  });
});
