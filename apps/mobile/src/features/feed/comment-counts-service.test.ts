import { beforeEach, describe, expect, it, vi } from "vitest";

import { commentCountStore } from "../comments/comment-count-store";
import { COMMENT_COUNTS_BATCH, fetchCommentCounts } from "./comment-counts-service";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("../../lib/supabase", () => ({ supabase: { rpc: mocks.rpc } }));

beforeEach(() => {
  mocks.rpc.mockReset();
  commentCountStore.clear();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("fetchCommentCounts (HOM-08 §210–§214)", () => {
  it("una chiamata per tipo; un id assente vale 0; semina lo store", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ comments_count: 4, content_id: "a" }],
      error: null,
    });

    const counts = await fetchCommentCounts("fan_tribuna", ["a", "b", "a"]);

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("fetch_comment_counts", {
      p_content_ids: ["a", "b"],
      p_content_type: "fan_tribuna",
    });
    expect(counts.get("a")).toBe(4);
    expect(counts.get("b")).toBe(0);
    expect(commentCountStore.get("fan_tribuna:a")).toBe(4);
    expect(commentCountStore.get("fan_tribuna:b")).toBe(0);
  });

  it("spezza oltre 100 id in blocchi", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    const ids = Array.from({ length: COMMENT_COUNTS_BATCH + 1 }, (_, i) => `id-${i}`);

    await fetchCommentCounts("media_tribuna", ids);

    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.rpc.mock.calls[0][1].p_content_ids).toHaveLength(COMMENT_COUNTS_BATCH);
    expect(mocks.rpc.mock.calls[1][1].p_content_ids).toHaveLength(1);
  });

  it("un guasto non solleva: mappa vuota e nessun seme", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("rete") });

    const counts = await fetchCommentCounts("media_profile", ["a"]);

    expect(counts.size).toBe(0);
    expect(commentCountStore.get("media_profile:a")).toBeUndefined();
  });

  it("se lo store viene svuotato durante la richiesta (cambio utente) non semina", async () => {
    mocks.rpc.mockImplementation(async () => {
      commentCountStore.clear();
      return { data: [{ comments_count: 9, content_id: "a" }], error: null };
    });

    const counts = await fetchCommentCounts("fan_media", ["a"]);

    expect(counts.size).toBe(0);
    expect(commentCountStore.get("fan_media:a")).toBeUndefined();
  });

  it("nessun id, nessuna chiamata", async () => {
    await fetchCommentCounts("club_media", []);

    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
