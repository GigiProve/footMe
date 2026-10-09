import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchPositionDetail } from "./position-detail-service";

type MockResponse = { data: unknown; error: unknown };

const mocks = vi.hoisted(() => {
  const queues = new Map<string, MockResponse[]>();
  // DAS-REV-03 §17: il dettaglio chiede anche l'action state, che è una RPC.
  const rpc = vi.fn(() =>
    Promise.resolve({ data: null, error: null } as MockResponse),
  );
  const calls: { table: string; steps: [string, unknown[]][] }[] = [];

  const from = vi.fn((table: string) => {
    const call = { steps: [] as [string, unknown[]][], table };
    calls.push(call);

    const respond = (): Promise<MockResponse> => {
      const queue = queues.get(table);
      return Promise.resolve(queue?.shift() ?? { data: null, error: null });
    };

    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "in"]) {
      builder[method] = vi.fn((...args: unknown[]) => {
        call.steps.push([method, args]);
        return builder;
      });
    }
    builder.maybeSingle = vi.fn(() => respond());

    return builder;
  });

  return { calls, from, queues, rpc };
});

vi.mock("../../lib/supabase", () => ({
  supabase: { from: mocks.from, rpc: mocks.rpc },
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
  mocks.rpc.mockResolvedValue({ data: null, error: null });
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
      // §17: con una RPC senza risposta l'azione è "none" — il dettaglio non
      // inventa un'eligibility che il backend non ha confermato.
      action: {
        action_type: "none",
        already_applied: false,
        can_apply: false,
        deadline_at: null,
        deadline_timezone: null,
        is_open: true,
        reason: null,
      },
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
    expect(adCall?.steps).toContainEqual(["eq", ["id", "ad1"]]);
  });

  /**
   * DAS-REV-05 §16: il dettaglio storico di una posizione chiusa deve
   * aprirsi, quindi il filtro passa da "published" a "published | closed".
   * Una bozza o una posizione ritirata resta esclusa: è ciò che rende non
   * navigabile la row storica.
   */
  it("reads the historical detail too, draft excluded", async () => {
    enqueue("recruiting_ads", { data: null, error: null });
    enqueue("saved_ads", { data: null, error: null });

    await fetchPositionDetail("u1", "ad1");

    const adCall = mocks.calls.find((call) => call.table === "recruiting_ads");
    const statusStep = adCall?.steps.find(([method]) => method === "in");

    expect(statusStep?.[1]).toEqual(["status", ["published", "closed"]]);
  });

  it("returns null for missing or unreadable ads", async () => {
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
