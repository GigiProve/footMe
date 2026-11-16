import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchHomeForYouPage, mapFeedRow, mapForYouPage } from "./feed-service";
import type { FeedForYouRow } from "./feed-types";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("../../lib/supabase", () => ({ supabase: { rpc: mocks.rpc } }));

const SESSION = "11111111-1111-4111-8111-111111111111";
const NEW_SESSION = "22222222-2222-4222-8222-222222222222";

function makeRow(overrides: Partial<FeedForYouRow> = {}): FeedForYouRow {
  return {
    author_avatar_url: null,
    author_id: "club-1",
    author_is_verified: false,
    author_kind: "club",
    author_name: "Como 1907",
    author_source_kind: "ufficiale",
    component_version: 1,
    data: {
      content_type: "club_media",
      is_truncated: false,
      kind_label: "Highlights",
      post_id: "post-1",
    },
    excerpt: "Estratto",
    feed_session_id: SESSION,
    feed_unit_id: "club_media:post-1",
    is_last_page: false,
    is_saved: false,
    is_seen: false,
    is_following_author: false,
    item_type: "post",
    item_uid: "club_media:post-1",
    layout_hint: "standard",
    nav_kind: "content",
    nav_params: { content_type: "club_media", post_id: "post-1" },
    next_position: 10,
    published_at: "2026-11-16T10:00:00.000Z",
    rank_bucket: 0,
    rank_position: 1,
    ranking_version: "v1",
    suggestion_reason_key: null,
    suggestion_reason_label: null,
    thumbnail_url: null,
    title: "Titolo",
    unit_type: "CONTENT",
    ...overrides,
  };
}

const IDENTITY = { id: "club-9", type: "society" } as const;

beforeEach(() => {
  mocks.rpc.mockReset();
});

describe("fetchHomeForYouPage — sessione (HOM-13 §81–§97)", () => {
  it("una sessione nuova manda p_session_id nullo e l'identità attiva", async () => {
    mocks.rpc.mockResolvedValue({ data: [makeRow()], error: null });

    await fetchHomeForYouPage({
      pageParam: {
        cursor: null,
        pageIndex: 0,
        session: { afterPosition: null, identity: IDENTITY, sessionId: null },
      },
    });

    expect(mocks.rpc).toHaveBeenCalledWith("fetch_home_for_you_page", {
      p_after_position: null,
      p_identity_id: "club-9",
      p_identity_type: "society",
      p_limit: 10,
      p_session_id: null,
    });
  });

  it("la pagina successiva usa sessione + posizione e NON ripassa l'identità", async () => {
    mocks.rpc.mockResolvedValue({ data: [makeRow()], error: null });

    await fetchHomeForYouPage({
      pageParam: {
        cursor: null,
        pageIndex: 1,
        session: { afterPosition: 10, identity: IDENTITY, sessionId: SESSION },
      },
    });

    expect(mocks.rpc).toHaveBeenCalledWith("fetch_home_for_you_page", {
      p_after_position: 10,
      p_identity_id: null,
      p_identity_type: null,
      p_limit: 10,
      p_session_id: SESSION,
    });
  });

  it("il revalidate dalla cache chiede la stessa ampiezza già mostrata", async () => {
    mocks.rpc.mockResolvedValue({ data: [makeRow()], error: null });

    await fetchHomeForYouPage({
      pageParam: {
        cursor: null,
        pageIndex: 0,
        session: { afterPosition: null, limit: 30, sessionId: SESSION },
      },
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "fetch_home_for_you_page",
      expect.objectContaining({ p_limit: 30, p_session_id: SESSION }),
    );
  });

  it("P0002 / feed_session_expired riparte con una sessione nuova, in modo trasparente", async () => {
    mocks.rpc
      .mockResolvedValueOnce({
        data: null,
        error: { code: "P0002", hint: "feed_session_expired", message: "Sessione Feed non valida o scaduta" },
      })
      .mockResolvedValueOnce({
        data: [makeRow({ feed_session_id: NEW_SESSION, next_position: 10 })],
        error: null,
      });

    const page = await fetchHomeForYouPage({
      pageParam: {
        cursor: null,
        pageIndex: 2,
        session: { afterPosition: 20, identity: IDENTITY, sessionId: SESSION },
      },
    });

    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.rpc).toHaveBeenLastCalledWith("fetch_home_for_you_page", {
      p_after_position: null,
      p_identity_id: "club-9",
      p_identity_type: "society",
      p_limit: 10,
      p_session_id: null,
    });
    expect(page.session).toMatchObject({ feedSessionId: NEW_SESSION, isNew: true, nextPosition: 10 });
    expect(page.items.map((item) => item.feedSessionId)).toEqual([NEW_SESSION]);
  });

  it("non ritenta all'infinito: una seconda scadenza si propaga", async () => {
    const expired = { code: "P0002", hint: "feed_session_expired", message: "scaduta" };
    mocks.rpc.mockResolvedValue({ data: null, error: expired });

    await expect(
      fetchHomeForYouPage({
        pageParam: {
          cursor: null,
          pageIndex: 1,
          session: { afterPosition: 5, sessionId: SESSION },
        },
      }),
    ).rejects.toBe(expired);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });

  it("un errore diverso dalla scadenza si propaga senza ripartire", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("boom") });

    await expect(
      fetchHomeForYouPage({
        pageParam: {
          cursor: null,
          pageIndex: 1,
          session: { afterPosition: 5, sessionId: SESSION },
        },
      }),
    ).rejects.toThrow("boom");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
});

describe("mapForYouPage", () => {
  const context = {
    fetchedAt: Date.parse("2026-11-16T12:00:00.000Z"),
    limit: 10,
    pageIndex: 0,
    requestedSessionId: null,
    startedNew: true,
  };

  it("porta sessione, cursore di posizione e versione di ranking", () => {
    const page = mapForYouPage([makeRow({ next_position: 10 })], context);

    expect(page.session).toEqual({
      feedSessionId: SESSION,
      isNew: true,
      limit: 10,
      nextPosition: 10,
      rankingVersion: "v1",
    });
    expect(page.isLastPage).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it("l'ultima pagina non ha posizione successiva", () => {
    const page = mapForYouPage([makeRow({ is_last_page: true, next_position: null })], context);

    expect(page.isLastPage).toBe(true);
    expect(page.session?.nextPosition).toBeNull();
  });

  it("una sessione nuova senza righe è un Feed davvero vuoto, senza sessione", () => {
    const page = mapForYouPage([], context);

    expect(page.items).toEqual([]);
    expect(page.isLastPage).toBe(true);
    expect(page.session).toBeNull();
  });

  it("una sessione esistente senza righe conserva l'id e chiude la lista", () => {
    const page = mapForYouPage([], { ...context, requestedSessionId: SESSION, startedNew: false });

    expect(page.session).toMatchObject({ feedSessionId: SESSION, nextPosition: null });
    expect(page.isLastPage).toBe(true);
  });

  it("usa feed_unit_id come chiave e marca la sessione su ogni elemento (§224, §227)", () => {
    const page = mapForYouPage(
      [makeRow({ feed_unit_id: "repost:club_media:post-1", item_uid: "x", rank_position: 3 })],
      context,
    );

    expect(page.items[0].id).toBe("repost:club_media:post-1");
    expect(page.items[0].feedSessionId).toBe(SESSION);
    expect(page.items[0].rank).toBe(3);
  });

  it("deduplica per feed_unit_id dentro la pagina (§98–§99)", () => {
    const page = mapForYouPage([makeRow(), makeRow()], context);

    expect(page.items).toHaveLength(1);
  });

  it("scarta le righe non renderizzabili senza perdere le altre", () => {
    const page = mapForYouPage(
      [makeRow({ item_type: "ignoto", feed_unit_id: "x" }), makeRow()],
      context,
    );

    expect(page.items.map((item) => item.id)).toEqual(["club_media:post-1"]);
  });

  it("con reason nulla non c'è alcuna etichetta di motivo (§214–§216)", () => {
    const item = mapForYouPage([makeRow()], context).items[0];

    expect(item.reasonKey).toBeNull();
    expect(item.reasonLabel).toBeNull();
  });

  it("un'Opportunity è una unit suggested_position con la sola etichetta ammessa (§281)", () => {
    const row = makeRow({
      data: { ad_id: "ad-1", club_id: "club-1", club_name: "Parma" },
      feed_unit_id: "recruiting_ad:ad-1",
      item_type: "suggested_position",
      item_uid: "recruiting_ad:ad-1",
      nav_kind: "position",
      nav_params: { ad_id: "ad-1" },
      suggestion_reason_key: "open_position_match",
      suggestion_reason_label: "In base al tuo profilo",
      unit_type: "OPPORTUNITY",
    });

    const item = mapForYouPage([row], context).items[0];

    expect(item.type).toBe("suggested_position");
    expect(item.id).toBe("recruiting_ad:ad-1");
  });

  it("i moduli suggeriti portano l'indice di modulo e al massimo 3 righe (§4)", () => {
    const row = makeRow({
      data: {
        identity_id: "club-9",
        identity_type: "society",
        module_index: 1,
        module_key: "suggested_profiles",
        module_limit: 3,
      },
      feed_unit_id: "module:suggested_profiles:1",
      item_type: "suggested_profiles",
      item_uid: "module:suggested_profiles:1",
      nav_kind: null,
      nav_params: null,
      unit_type: "SUGGESTED_PROFILES",
    });

    const item = mapForYouPage([row], context).items[0];

    expect(item.type).toBe("suggested_profiles");
    // HOM-13 D3: il modulo si riempie con l'identità della sessione che lo ha inserito.
    expect(item.payload).toEqual({
      identityId: "club-9",
      identityType: "society",
      moduleIndex: 1,
      moduleKey: "suggested_profiles",
      moduleLimit: 3,
    });
  });

  it("il carosello Società resta un modulo con item_type suggested_clubs", () => {
    const row = makeRow({
      data: { module_limit: 6 },
      feed_unit_id: "module:suggested_clubs:0",
      item_type: "suggested_clubs",
      item_uid: "module:suggested_clubs:0",
      nav_kind: null,
      nav_params: null,
      unit_type: "SUGGESTED_PROFILES",
    });

    const item = mapForYouPage([row], context).items[0];

    expect(item.type).toBe("suggested_clubs");
    expect(item.id).toBe("module:suggested_clubs:0");
  });
});

describe("mapFeedRow — retrocompatibilità", () => {
  it("senza opzioni l'id resta item_uid e non c'è sessione (Seguiti)", () => {
    // Le colonne extra della riga Per te si ignorano: conta solo cosa passa `options`.
    const item = mapFeedRow(makeRow());

    expect(item?.id).toBe("club_media:post-1");
    expect(item?.feedSessionId).toBeUndefined();
  });
});
