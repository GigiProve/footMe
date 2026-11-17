import { describe, expect, it, vi } from "vitest";

import { parseCareerMediaInteractions } from "./career-media-service";

vi.mock("../../../lib/supabase", () => ({ supabase: { rpc: vi.fn() } }));

describe("parseCareerMediaInteractions (HOM-15 §174–§175)", () => {
  it("indicizza per item_key con uuid, conteggio, liked_as e stato Salvato", () => {
    const parsed = parseCareerMediaInteractions(
      [
        {
          can_like: true,
          can_save: true,
          is_saved: true,
          item_key: "a1",
          liked_as: [{ id: "me", type: "person" }, { id: "x", type: "boh" }],
          likes_count: 3,
          media_id: "m-1",
        },
      ],
      42,
    );

    expect(parsed.fetchedAt).toBe(42);
    expect(parsed.byItemKey.get("a1")).toEqual({
      canLike: true,
      canSave: true,
      isSaved: true,
      itemKey: "a1",
      likedAs: [{ id: "me", type: "person" }],
      likesCount: 3,
      mediaId: "m-1",
    });
  });

  it("scarta righe senza chiave o uuid e non inventa conteggi", () => {
    const parsed = parseCareerMediaInteractions(
      [
        { item_key: "", media_id: "m" },
        { item_key: "k", media_id: null },
        { item_key: "ok", likes_count: "boh", media_id: "m-2" },
        null,
      ],
      0,
    );

    expect([...parsed.byItemKey.keys()]).toEqual(["ok"]);
    expect(parsed.byItemKey.get("ok")).toMatchObject({
      canLike: false,
      canSave: false,
      isSaved: false,
      likedAs: [],
      likesCount: 0,
    });
    expect(parseCareerMediaInteractions(null, 0).byItemKey.size).toBe(0);
  });
});
