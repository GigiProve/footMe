import { beforeEach, describe, expect, it, vi } from "vitest";

import { LIKES_PAGE_SIZE, fetchContentLikers, mapLikerRow } from "./likes-service";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("../../lib/supabase", () => ({ supabase: { rpc: mocks.rpc } }));

const PERSON = {
  actor_id: "p-1",
  actor_type: "person",
  avatar_url: "https://x.test/a.png",
  club_category: null,
  club_name: "AC Como",
  is_following: true,
  is_self: false,
  is_verified: true,
  media_kind: null,
  name: "Marco Bianchi",
  next_cursor: null,
  primary_position: null,
  role: "coach",
  team_label: null,
};

const SOCIETY = {
  ...PERSON,
  actor_id: "c-1",
  actor_type: "society",
  club_category: "Serie D",
  club_name: null,
  is_following: false,
  name: "Varese Calcio",
  role: null,
};

beforeEach(() => mocks.rpc.mockReset());

describe("mapLikerRow", () => {
  it("passa da snake_case a camelCase con chiave `<tipo>:<id>`", () => {
    expect(mapLikerRow(PERSON)).toEqual({
      actorId: "p-1",
      actorType: "person",
      avatarUrl: "https://x.test/a.png",
      clubCategory: null,
      clubName: "AC Como",
      isFollowing: true,
      isSelf: false,
      isVerified: true,
      key: "person:p-1",
      mediaKind: null,
      name: "Marco Bianchi",
      primaryPosition: null,
      role: "coach",
      teamLabel: null,
    });
  });

  it("scarta una riga con tipo o id sconosciuti", () => {
    expect(mapLikerRow({ ...PERSON, actor_type: "robot" })).toBeNull();
    expect(mapLikerRow({ ...PERSON, actor_id: undefined })).toBeNull();
  });

  it("i campi mancanti diventano null/false, mai valori inventati", () => {
    expect(mapLikerRow({ actor_id: "m-1", actor_type: "media" })).toMatchObject({
      avatarUrl: null,
      isFollowing: false,
      isSelf: false,
      isVerified: false,
      role: null,
    });
  });
});

describe("fetchContentLikers — §60–§61", () => {
  it("chiede una pagina col cursore ricevuto e prende il prossimo cursore dall'ultima riga", async () => {
    const cursor = { b: 0, id: "p-0", t: "person", ts: "2026-11-14T10:00:00Z" };
    const next = { b: 1, id: "c-1", t: "society", ts: "2026-11-14T09:00:00Z" };
    mocks.rpc.mockResolvedValue({ data: [PERSON, { ...SOCIETY, next_cursor: next }], error: null });

    const page = await fetchContentLikers("club_media", "post-1", cursor);

    expect(mocks.rpc).toHaveBeenCalledWith("list_content_likers", {
      p_content_type: "club_media",
      p_cursor: cursor,
      p_limit: LIKES_PAGE_SIZE,
      p_post_id: "post-1",
    });
    expect(page.items.map((item) => item.key)).toEqual(["person:p-1", "society:c-1"]);
    expect(page.nextCursor).toEqual(next);
  });

  it("lista finita: nessun cursore", async () => {
    mocks.rpc.mockResolvedValue({ data: [PERSON], error: null });

    await expect(fetchContentLikers("club_media", "post-1", null)).resolves.toMatchObject({
      nextCursor: null,
    });
  });

  it("nessun Mi piace: pagina vuota, senza errore", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    await expect(fetchContentLikers("club_media", "post-1", null)).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
  });

  it("propaga l'errore (content_unavailable incluso)", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "content_unavailable" } });

    await expect(fetchContentLikers("club_media", "post-1", null)).rejects.toMatchObject({
      message: "content_unavailable",
    });
  });
});
