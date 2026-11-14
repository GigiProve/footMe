import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchContentSaveState,
  fetchSavedPage,
  fetchSavedProfileIds,
  setSavedRemote,
} from "./saved-service";

const mocks = vi.hoisted(() => {
  const builder: Record<string, unknown> = {};
  builder.upsert = vi.fn(() => Promise.resolve({ error: null }));
  builder.delete = vi.fn(() => builder);
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.in = vi.fn(() => Promise.resolve({ data: [], error: null }));
  builder.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
  builder.then = (resolve: (value: unknown) => unknown) =>
    resolve({ error: null });

  return {
    builder,
    from: vi.fn(() => builder),
    rpc: vi.fn(),
  };
});

vi.mock("../../lib/supabase", () => ({
  supabase: { from: mocks.from, rpc: mocks.rpc },
}));
beforeEach(() => {
  vi.clearAllMocks();
});

describe("setSavedRemote — HOM-07 §166–§167", () => {
  it("una sola RPC con target_type e target_id espliciti; il content_type solo per i contenuti", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ is_saved: true }], error: null });

    await setSavedRemote({ contentType: "club_media", id: "p1", type: "content" }, true);
    await setSavedRemote({ id: "u1", type: "profile" }, false);
    await setSavedRemote({ id: "c1", type: "society" }, true);
    await setSavedRemote({ id: "t1", type: "team" }, true);
    await setSavedRemote({ id: "a1", type: "position" }, true);

    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "set_saved", {
      p_content_type: "club_media",
      p_saved: true,
      p_target_id: "p1",
      p_target_type: "content",
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "set_saved", {
      p_content_type: null,
      p_saved: false,
      p_target_id: "u1",
      p_target_type: "profile",
    });
    expect(mocks.rpc.mock.calls.map((call) => call[1].p_target_type)).toEqual([
      "content",
      "profile",
      "society",
      "team",
      "position",
    ]);
  });

  it("legge is_saved dalla riga, o ricade sul valore richiesto", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [{ is_saved: false }], error: null });
    expect(await setSavedRemote({ id: "u1", type: "profile" }, true)).toBe(false);

    mocks.rpc.mockResolvedValueOnce({ data: [], error: null });
    expect(await setSavedRemote({ id: "u1", type: "profile" }, true)).toBe(true);
  });

  it("l'errore del server risale: è il rollback a doverlo gestire", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("content_unavailable") });

    await expect(setSavedRemote({ id: "u1", type: "profile" }, true)).rejects.toThrow(
      "content_unavailable",
    );
  });
});

describe("fetchSavedPage — HOM-07 §120–§121, §160", () => {
  it("passa categoria, cursore keyset e limite; ritorna righe tipizzate e il cursore", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          content_type: null,
          next_cursor: { k: "profile:u2", ts: "2026-11-14T09:00:00Z" },
          payload: { name: "Cesc Fàbregas", role: "coach", club_name: "AC Como" },
          saved_at: "2026-11-14T09:00:00Z",
          target_id: "u2",
          target_type: "profile",
        },
      ],
      error: null,
    });

    const page = await fetchSavedPage("profile", { k: "profile:u1", ts: "2026-11-14T10:00:00Z" }, 20);

    expect(mocks.rpc).toHaveBeenCalledWith("list_saved", {
      p_category: "profile",
      p_cursor: { k: "profile:u1", ts: "2026-11-14T10:00:00Z" },
      p_limit: 20,
    });
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0]).toMatchObject({ kind: "profile", target: { id: "u2", type: "profile" } });
    expect(page.nextCursor).toEqual({ k: "profile:u2", ts: "2026-11-14T09:00:00Z" });
  });

  it("la prima pagina parte senza cursore", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    const page = await fetchSavedPage("content", null);

    expect(mocks.rpc).toHaveBeenCalledWith("list_saved", {
      p_category: "content",
      p_cursor: null,
      p_limit: 20,
    });
    expect(page).toEqual({ fetchedAt: expect.any(Number), nextCursor: null, rows: [] });
  });
});

describe("fetchContentSaveState", () => {
  it("legge can_save e is_saved dalla RPC di stato; senza can_save non si salva", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [{ can_save: true, is_saved: true }], error: null });
    expect(await fetchContentSaveState("club_media", "p1")).toEqual({
      canSave: true,
      fetchedAt: expect.any(Number),
      isSaved: true,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("fetch_content_interaction_state", {
      p_content_type: "club_media",
      p_post_id: "p1",
    });

    mocks.rpc.mockResolvedValueOnce({ data: [{ likes_count: 3 }], error: null });
    expect(await fetchContentSaveState("club_media", "p1")).toEqual({
      canSave: false,
      fetchedAt: expect.any(Number),
      isSaved: false,
    });

    mocks.rpc.mockResolvedValueOnce({ data: [], error: null });
    expect(await fetchContentSaveState("club_media", "p1")).toBeNull();
  });
});

describe("fetchSavedProfileIds", () => {
  it("short-circuits on an empty input without querying supabase", async () => {
    const result = await fetchSavedProfileIds("owner-1", []);

    expect(result).toEqual(new Set());
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("returns the saved subset as a Set", async () => {
    (mocks.builder.in as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ target_profile_id: "p1" }, { target_profile_id: "p3" }],
      error: null,
    });

    const result = await fetchSavedProfileIds("owner-1", ["p1", "p2", "p3"]);

    expect(mocks.from).toHaveBeenCalledWith("saved_profiles");
    expect(mocks.builder.eq).toHaveBeenCalledWith("owner_profile_id", "owner-1");
    expect(mocks.builder.in).toHaveBeenCalledWith("target_profile_id", [
      "p1",
      "p2",
      "p3",
    ]);
    expect(result).toEqual(new Set(["p1", "p3"]));
  });

  it("propagates errors", async () => {
    (mocks.builder.in as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
      error: new Error("boom"),
    });

    await expect(fetchSavedProfileIds("owner-1", ["p1"])).rejects.toThrow("boom");
  });
});
