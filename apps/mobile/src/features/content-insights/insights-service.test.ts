import { beforeEach, describe, expect, it, vi } from "vitest";

import { ContentPermissionError, isContentPermissionError } from "../feed/content-manage-service";
import { makeInsights } from "./insights-fixtures";
import {
  fetchContentInsights,
  fetchContentInsightsTrend,
  parseContentInsights,
  parseContentInsightsTrend,
} from "./insights-service";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("../../lib/supabase", () => ({ supabase: { rpc: mocks.rpc } }));

beforeEach(() => {
  mocks.rpc.mockReset();
});

describe("parseContentInsights", () => {
  it("unavailable è una risposta definitiva", () => {
    expect(parseContentInsights({ status: "unavailable" })).toEqual({ status: "unavailable" });
    expect(parseContentInsights([{ status: "unavailable" }])).toEqual({ status: "unavailable" });
  });

  it("ok: conserva null (riga nascosta) e zero (dato reale)", () => {
    const parsed = parseContentInsights(
      makeInsights({ engagement: { comments: 0, likes: 5, reposts: null, saves: null, shares: null } }),
    );

    expect(parsed.status).toBe("ok");
    if (parsed.status === "ok") {
      expect(parsed.engagement?.comments).toBe(0);
      expect(parsed.engagement?.reposts).toBeNull();
    }
  });

  it("blocchi opzionali assenti → null, liste assenti → vuote", () => {
    const parsed = parseContentInsights({
      ...makeInsights(),
      article_insights: undefined,
      periods: undefined,
      professional_actions: undefined,
      traffic_sources: undefined,
      video_insights: undefined,
    });

    expect(parsed.status).toBe("ok");
    if (parsed.status === "ok") {
      expect(parsed.video_insights).toBeNull();
      expect(parsed.article_insights).toBeNull();
      expect(parsed.professional_actions).toBeNull();
      expect(parsed.periods).toEqual([]);
      expect(parsed.traffic_sources).toEqual([]);
    }
  });

  it("una risposta senza stato o malformata è un errore, non «nessuna statistica» (§136)", () => {
    expect(() => parseContentInsights(null)).toThrow();
    expect(() => parseContentInsights({})).toThrow();
    expect(() => parseContentInsights({ status: "ok" })).toThrow();
    expect(() => parseContentInsights({ status: "boh" })).toThrow();
  });
});

describe("parseContentInsightsTrend", () => {
  it("ok: scarta i punti non numerici; sufficient assente = falso (§75)", () => {
    const parsed = parseContentInsightsTrend({
      interval: "day",
      metric: "views",
      period: "7d",
      points: [
        { ts: "a", value: 1 },
        { ts: "b", value: "x" },
        { ts: "c", value: 3 },
      ],
      status: "ok",
    });

    expect(parsed.status).toBe("ok");
    if (parsed.status === "ok") {
      expect(parsed.points).toHaveLength(2);
      expect(parsed.sufficient).toBe(false);
      expect(parsed.timezone).toBe("UTC");
    }
  });

  it("senza stato → errore", () => {
    expect(() => parseContentInsightsTrend(undefined)).toThrow();
  });
});

describe("fetchContentInsights", () => {
  it("chiama fetch_content_insights con tipo e id", async () => {
    mocks.rpc.mockResolvedValue({ data: makeInsights(), error: null });

    const result = await fetchContentInsights("profile_post", "p1");

    expect(result.status).toBe("ok");
    expect(mocks.rpc).toHaveBeenCalledWith("fetch_content_insights", {
      p_content_type: "profile_post",
      p_post_id: "p1",
    });
  });

  it("{status:'unavailable'} → unavailable", async () => {
    mocks.rpc.mockResolvedValue({ data: { status: "unavailable" }, error: null });

    await expect(fetchContentInsights("club_media", "p1")).resolves.toEqual({ status: "unavailable" });
  });

  it("errcode 42501 → errore di permesso revocato", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "denied" } });

    const error = await fetchContentInsights("club_media", "p1").catch((caught) => caught);

    expect(error).toBeInstanceOf(ContentPermissionError);
    expect(isContentPermissionError(error)).toBe(true);
  });

  it("ogni altro errore (rete) resta un errore generico", async () => {
    const failure = { code: "08006", message: "connection" };
    mocks.rpc.mockResolvedValue({ data: null, error: failure });

    const error = await fetchContentInsights("club_media", "p1").catch((caught) => caught);

    expect(error).toBe(failure);
    expect(isContentPermissionError(error)).toBe(false);
  });
});

describe("fetchContentInsightsTrend", () => {
  it("chiama fetch_content_insights_trend con metrica, periodo e fuso", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        cumulative: true,
        interval: "day",
        metric: "views",
        period: "7d",
        points: [],
        status: "ok",
        sufficient: false,
        timezone: "Europe/Rome",
      },
      error: null,
    });

    const result = await fetchContentInsightsTrend("profile_post", "p1", "views", "7d", "Europe/Rome");

    expect(result.status).toBe("ok");
    expect(mocks.rpc).toHaveBeenCalledWith("fetch_content_insights_trend", {
      p_content_type: "profile_post",
      p_metric: "views",
      p_period: "7d",
      p_post_id: "p1",
      p_timezone: "Europe/Rome",
    });
  });

  it("42501 → permesso revocato", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "denied" } });

    const error = await fetchContentInsightsTrend("profile_post", "p1", "reach", "24h", "UTC").catch(
      (caught) => caught,
    );

    expect(isContentPermissionError(error)).toBe(true);
  });
});
