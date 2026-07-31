import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchHomeFeedPage,
  mapFeedRow,
  resolveFeedAuthorHref,
  resolveFeedItemHref,
} from "./feed-service";
import type { FeedItemRow } from "./feed-types";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("../../lib/supabase", () => ({
  supabase: { rpc: mocks.rpc },
}));

const AS_OF = "2026-07-31T12:00:00.000Z";

function makeRow(overrides: Partial<FeedItemRow> = {}): FeedItemRow {
  return {
    item_uid: "club_media:post-1",
    item_type: "post",
    rank_position: 1,
    rank_bucket: 5,
    layout_hint: "tall",
    component_version: 1,
    title: "Titolo",
    excerpt: "Estratto",
    thumbnail_url: "https://example.test/img.jpg",
    published_at: "2026-07-31T10:00:00.000Z",
    author_kind: "club",
    author_id: "club-1",
    author_name: "Como 1907",
    author_avatar_url: "https://example.test/logo.png",
    author_source_kind: "ufficiale",
    author_is_verified: true,
    is_seen: false,
    is_saved: false,
    is_following_author: true,
    suggestion_reason_key: "followed_club_publisher",
    suggestion_reason_label: "Dalla società che segui",
    nav_kind: "content",
    nav_params: { content_type: "club_media", post_id: "post-1" },
    data: {
      content_type: "club_media",
      post_id: "post-1",
      kind: "highlights",
      kind_label: "Highlights",
      content_format: "post",
      media_type: "image",
      duration_seconds: null,
      is_truncated: false,
    },
    as_of: AS_OF,
    next_cursor_bucket: 5,
    next_cursor_published_at: "2026-07-31T09:00:00.000Z",
    next_cursor_uid: "club_media:post-9",
    is_last_page: false,
    ...overrides,
  };
}

beforeEach(() => {
  mocks.rpc.mockReset();
});

describe("mapFeedRow", () => {
  it("mappa un post con envelope, autore e payload", () => {
    const item = mapFeedRow(makeRow());

    expect(item).not.toBeNull();
    expect(item?.id).toBe("club_media:post-1");
    expect(item?.type).toBe("post");
    expect(item?.rank).toBe(1);
    expect(item?.layoutHint).toBe("tall");
    expect(item?.author).toEqual({
      kind: "club",
      id: "club-1",
      name: "Como 1907",
      avatarUrl: "https://example.test/logo.png",
      sourceKind: "ufficiale",
      isVerified: true,
    });
    expect(item?.reasonKey).toBe("followed_club_publisher");
    expect(item?.nav).toEqual({
      kind: "content",
      params: { content_type: "club_media", post_id: "post-1" },
    });
  });

  it("scarta i tipi sconosciuti invece di sollevare", () => {
    // Un client vecchio davanti a un server nuovo deve degradare, non crashare.
    expect(mapFeedRow(makeRow({ item_type: "tipo_dal_futuro" }))).toBeNull();
  });

  it("scarta un contenuto senza post_id, che non sarebbe apribile", () => {
    expect(mapFeedRow(makeRow({ data: { content_type: "club_media" } }))).toBeNull();
  });

  it("scarta una posizione senza ad_id", () => {
    const row = makeRow({
      data: { club_id: "club-1" },
      item_type: "suggested_position",
      nav_kind: "position",
    });

    expect(mapFeedRow(row)).toBeNull();
  });

  it("usa un layout hint di riserva quando il server ne manda uno ignoto", () => {
    expect(mapFeedRow(makeRow({ layout_hint: "gigante" }))?.layoutHint).toBe("standard");
  });

  it("ignora una chiave di motivo non riconosciuta", () => {
    expect(mapFeedRow(makeRow({ suggestion_reason_key: "boh" }))?.reasonKey).toBeNull();
  });

  it("mappa un articolo con introduzione e miniatura", () => {
    const item = mapFeedRow(
      makeRow({
        data: {
          content_type: "media_profile",
          post_id: "art-1",
          kind_label: "Articolo",
          duration_seconds: null,
        },
        item_type: "article",
      }),
    );

    expect(item?.type).toBe("article");
    expect(item?.type === "article" ? item.payload.intro : null).toBe("Estratto");
    expect(item?.type === "article" ? item.payload.thumbnailUrl : null).toBe(
      "https://example.test/img.jpg",
    );
  });

  it("mappa un video conservando la durata", () => {
    const item = mapFeedRow(
      makeRow({
        data: {
          content_type: "club_media",
          post_id: "vid-1",
          duration_seconds: 95,
        },
        item_type: "video",
      }),
    );

    expect(item?.type === "video" ? item.payload.durationSeconds : null).toBe(95);
  });

  it("mappa una posizione senza esporre scadenza né compatibilità", () => {
    const item = mapFeedRow(
      makeRow({
        data: {
          ad_id: "ad-1",
          club_id: "club-1",
          club_name: "Como 1907",
          role_required: "center_back",
          category: "Serie B",
          city: "Como",
          region: "Lombardia",
          target_role: "player",
          is_secondary_match: false,
        },
        item_type: "suggested_position",
        nav_kind: "position",
        nav_params: { ad_id: "ad-1" },
      }),
    );

    expect(item?.type).toBe("suggested_position");
    const payload = item?.type === "suggested_position" ? item.payload : null;
    expect(payload?.adId).toBe("ad-1");
    // §9: questi campi non devono nemmeno esistere nel payload.
    expect(payload).not.toHaveProperty("deadline");
    expect(payload).not.toHaveProperty("matchPercentage");
    expect(payload).not.toHaveProperty("description");
  });

  it("mappa un modulo discovery senza autore e senza navigazione", () => {
    const item = mapFeedRow(
      makeRow({
        author_id: null,
        author_kind: null,
        author_name: null,
        data: { module_key: "suggested_profiles", module_limit: 6 },
        item_type: "suggested_profiles",
        nav_kind: null,
        nav_params: null,
      }),
    );

    expect(item?.type).toBe("suggested_profiles");
    expect(item?.author).toBeNull();
    expect(item?.nav).toBeNull();
  });

  it("tratta fan_media, che non ha titolo, come post con testo", () => {
    const item = mapFeedRow(
      makeRow({
        data: { content_type: "fan_media", post_id: "fan-1" },
        excerpt: "Che atmosfera allo stadio!",
        title: null,
      }),
    );

    expect(item?.type === "post" ? item.title : "x").toBeNull();
    expect(item?.type === "post" ? item.payload.text : null).toBe(
      "Che atmosfera allo stadio!",
    );
  });
});

describe("resolveFeedItemHref", () => {
  it("risolve il dettaglio contenuto", () => {
    const item = mapFeedRow(makeRow());

    expect(resolveFeedItemHref(item!)).toBe("/content/club_media/post-1");
  });

  it("risolve il dettaglio posizione", () => {
    const item = mapFeedRow(
      makeRow({
        data: { ad_id: "ad-1", club_id: "club-1" },
        item_type: "suggested_position",
        nav_kind: "position",
        nav_params: { ad_id: "ad-1" },
      }),
    );

    expect(resolveFeedItemHref(item!)).toBe("/position/ad-1");
  });

  it("restituisce null per un modulo discovery", () => {
    const item = mapFeedRow(
      makeRow({
        data: { module_key: "suggested_clubs" },
        item_type: "suggested_clubs",
        nav_kind: null,
        nav_params: null,
      }),
    );

    expect(resolveFeedItemHref(item!)).toBeNull();
  });
});

describe("resolveFeedAuthorHref", () => {
  it("porta alla scheda società per un autore club", () => {
    expect(resolveFeedAuthorHref(mapFeedRow(makeRow())!)).toBe("/club/club-1");
  });

  it("porta al profilo pubblico per un autore profilo", () => {
    const item = mapFeedRow(makeRow({ author_kind: "profile", author_id: "p-1" }));

    expect(resolveFeedAuthorHref(item!)).toBe("/profile/p-1");
  });
});

describe("fetchHomeFeedPage", () => {
  it("passa il cursore e l'as_of della sessione all'RPC", async () => {
    mocks.rpc.mockResolvedValue({ data: [makeRow()], error: null });

    await fetchHomeFeedPage({
      pageParam: {
        cursor: {
          asOf: AS_OF,
          bucket: 4,
          publishedAt: "2026-07-31T08:00:00.000Z",
          uid: "club_media:post-5",
        },
        pageIndex: 1,
      },
      scope: "seguiti",
    });

    expect(mocks.rpc).toHaveBeenCalledWith("fetch_home_feed_page", {
      p_as_of: AS_OF,
      p_cursor_bucket: 4,
      p_cursor_published_at: "2026-07-31T08:00:00.000Z",
      p_cursor_uid: "club_media:post-5",
      p_limit: 10,
      p_page_index: 1,
      p_tab: "seguiti",
    });
  });

  it("manda un cursore vuoto sulla prima pagina", async () => {
    mocks.rpc.mockResolvedValue({ data: [makeRow()], error: null });

    await fetchHomeFeedPage({
      pageParam: { cursor: null, pageIndex: 0 },
      scope: "per_te",
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "fetch_home_feed_page",
      expect.objectContaining({
        p_as_of: null,
        p_cursor_bucket: null,
        p_cursor_published_at: null,
        p_cursor_uid: null,
      }),
    );
  });

  it("estrae il cursore successivo dalla prima riga", async () => {
    mocks.rpc.mockResolvedValue({ data: [makeRow()], error: null });

    const page = await fetchHomeFeedPage({
      pageParam: { cursor: null, pageIndex: 0 },
      scope: "per_te",
    });

    expect(page.asOf).toBe(AS_OF);
    expect(page.isLastPage).toBe(false);
    expect(page.nextCursor).toEqual({
      asOf: AS_OF,
      bucket: 5,
      publishedAt: "2026-07-31T09:00:00.000Z",
      uid: "club_media:post-9",
    });
  });

  it("non produce cursore sull'ultima pagina", async () => {
    mocks.rpc.mockResolvedValue({
      data: [makeRow({ is_last_page: true })],
      error: null,
    });

    const page = await fetchHomeFeedPage({
      pageParam: { cursor: null, pageIndex: 0 },
      scope: "per_te",
    });

    expect(page.isLastPage).toBe(true);
    expect(page.nextCursor).toBeNull();
  });

  it("una pagina vuota è l'ultima e non ha cursore", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    const page = await fetchHomeFeedPage({
      pageParam: { cursor: null, pageIndex: 0 },
      scope: "per_te",
    });

    expect(page.items).toEqual([]);
    expect(page.isLastPage).toBe(true);
    expect(page.nextCursor).toBeNull();
  });

  it("filtra le righe non renderizzabili senza perdere le altre", async () => {
    mocks.rpc.mockResolvedValue({
      data: [makeRow(), makeRow({ item_type: "ignoto", item_uid: "x" })],
      error: null,
    });

    const page = await fetchHomeFeedPage({
      pageParam: { cursor: null, pageIndex: 0 },
      scope: "per_te",
    });

    expect(page.items.map((item) => item.id)).toEqual(["club_media:post-1"]);
  });

  it("propaga l'errore dell'RPC", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("boom") });

    await expect(
      fetchHomeFeedPage({ pageParam: { cursor: null, pageIndex: 0 }, scope: "per_te" }),
    ).rejects.toThrow("boom");
  });
});
