import { describe, expect, it } from "vitest";

import { makePostPayload } from "./feed-post-fixtures";
import {
  cachedForYouPage,
  dedupeByUnitId,
  FEED_SESSION_RESUME_MAX_AGE_MS,
  firstPageParamFor,
  isFeedSessionExpired,
  isFirstParamStale,
  newForYouPageParam,
  nextForYouPageParam,
  resumableSession,
  unitTypeOf,
  withSessionIdentity,
} from "./feed-session-presentation";
import type { FeedItem, FeedPage } from "./feed-types";

const SESSION = "11111111-1111-4111-8111-111111111111";
const NOW = Date.parse("2026-11-16T12:00:00.000Z");
const FRESH = new Date(NOW - 60_000).toISOString();

function envelope(id: string, rank: number, sessionId?: string) {
  return {
    id,
    rank,
    version: 1,
    layoutHint: "standard" as const,
    publishedAt: "2026-11-16T10:00:00.000Z",
    author: null,
    reasonKey: null,
    reasonLabel: null,
    isSeen: false,
    isSaved: false,
    isFollowingAuthor: false,
    nav: null,
    ...(sessionId ? { feedSessionId: sessionId } : {}),
  };
}

function post(id: string, rank: number, sessionId?: string): FeedItem {
  return {
    ...envelope(id, rank, sessionId),
    type: "post",
    title: null,
    payload: makePostPayload({ postId: id, text: "Testo" }),
  };
}

function page(overrides: Partial<FeedPage> = {}): FeedPage {
  return {
    asOf: FRESH,
    isLastPage: false,
    items: [],
    nextCursor: null,
    pageIndex: 0,
    session: {
      feedSessionId: SESSION,
      isNew: false,
      limit: 10,
      nextPosition: 10,
      rankingVersion: "v1",
    },
    ...overrides,
  };
}

describe("isFeedSessionExpired (HOM-13 contratto §1)", () => {
  it("riconosce errcode P0002", () => {
    expect(isFeedSessionExpired({ code: "P0002", message: "x" })).toBe(true);
  });

  it("riconosce l'hint feed_session_expired", () => {
    expect(isFeedSessionExpired({ hint: "feed_session_expired" })).toBe(true);
  });

  it("riconosce il messaggio del server", () => {
    expect(isFeedSessionExpired({ message: "Sessione Feed non valida o scaduta" })).toBe(true);
  });

  it("non confonde gli altri errori", () => {
    expect(isFeedSessionExpired(new Error("Authentication required"))).toBe(false);
    expect(isFeedSessionExpired({ code: "42501" })).toBe(false);
    expect(isFeedSessionExpired(null)).toBe(false);
    expect(isFeedSessionExpired("P0002")).toBe(false);
  });
});

describe("parametri di pagina", () => {
  it("la sessione nuova non ha id né posizione e porta l'identità", () => {
    expect(newForYouPageParam({ id: "c1", type: "society" })).toEqual({
      cursor: null,
      pageIndex: 0,
      session: { afterPosition: null, identity: { id: "c1", type: "society" }, sessionId: null },
    });
  });

  it("la pagina successiva è sessione + next_position, mai un numero di pagina (§95–§97)", () => {
    const next = nextForYouPageParam(page({ pageIndex: 2 }), null);

    expect(next?.session).toEqual({ afterPosition: 10, identity: null, sessionId: SESSION });
  });

  it("l'ultima pagina o la posizione nulla chiudono la paginazione", () => {
    expect(nextForYouPageParam(page({ isLastPage: true }), null)).toBeUndefined();
    expect(
      nextForYouPageParam(
        page({ session: { feedSessionId: SESSION, isNew: false, limit: 10, nextPosition: null, rankingVersion: null } }),
        null,
      ),
    ).toBeUndefined();
    expect(nextForYouPageParam(page({ session: null }), null)).toBeUndefined();
  });

  it("l'identità si applica solo a una sessione nuova che non la porta già", () => {
    const identity = { id: "p1", type: "person" as const };

    expect(withSessionIdentity(newForYouPageParam(null), identity).session?.identity).toEqual(identity);
    expect(
      withSessionIdentity(newForYouPageParam({ id: "x", type: "media" }), identity).session?.identity,
    ).toEqual({ id: "x", type: "media" });
    expect(withSessionIdentity({ cursor: null, pageIndex: 0 }, identity).session).toBeUndefined();
  });
});

describe("ripresa dalla cache (§227–§228)", () => {
  it("riprende la sessione dell'ultimo elemento, dalla sua posizione", () => {
    const items = [post("a", 1, SESSION), post("b", 7, SESSION)];

    expect(resumableSession(items, FRESH, NOW)).toEqual({ feedSessionId: SESSION, lastPosition: 7 });
  });

  it("non riprende una cache senza sessione (pre-HOM-13 o Seguiti)", () => {
    expect(resumableSession([post("a", 1)], FRESH, NOW)).toBeNull();
    expect(resumableSession([], FRESH, NOW)).toBeNull();
  });

  it("non riprende una sessione troppo vecchia, ma la cache si mostra", () => {
    const old = new Date(NOW - FEED_SESSION_RESUME_MAX_AGE_MS - 1).toISOString();
    const items = [post("a", 1, SESSION)];

    expect(resumableSession(items, old, NOW)).toBeNull();
    const cached = cachedForYouPage(items, old, NOW);
    expect(cached.items).toBe(items);
    expect(cached.session).toBeNull();
  });

  it("la pagina in cache porta il cursore e l'ampiezza già mostrata", () => {
    const items = [post("a", 1, SESSION), post("b", 2, SESSION)];

    const cached = cachedForYouPage(items, FRESH, NOW);

    expect(cached.session).toEqual({
      feedSessionId: SESSION,
      isNew: false,
      limit: 2,
      nextPosition: 2,
      rankingVersion: null,
    });
  });

  it("il revalidate rilegge la STESSA sessione dall'inizio (stesso ordine, §83)", () => {
    const cached = cachedForYouPage([post("a", 1, SESSION), post("b", 2, SESSION)], FRESH, NOW);

    expect(firstPageParamFor(cached, null)).toEqual({
      cursor: null,
      pageIndex: 0,
      session: { afterPosition: null, identity: null, limit: 2, sessionId: SESSION },
    });
  });

  it("senza sessione ripresa il revalidate crea una sessione nuova", () => {
    const stale = cachedForYouPage([post("a", 1)], FRESH, NOW);

    expect(firstPageParamFor(stale, null).session?.sessionId).toBeNull();
  });
});

describe("riallineamento del pageParam dopo un refresh", () => {
  it("è obsoleto quando descrive «sessione nuova» ma la pagina ha già una sessione", () => {
    expect(isFirstParamStale(newForYouPageParam(null), page())).toBe(true);
  });

  it("non lo è quando coincide con la sessione della pagina", () => {
    expect(isFirstParamStale(firstPageParamFor(page(), null), page())).toBe(false);
  });

  it("non lo è senza sessione di pagina (Seguiti, Feed vuoto)", () => {
    expect(isFirstParamStale(undefined, page({ session: null }))).toBe(false);
    expect(isFirstParamStale(undefined, undefined)).toBe(false);
  });
});

describe("unitTypeOf (§222)", () => {
  it("distingue i quattro tipi di unit", () => {
    const position = {
      ...envelope("recruiting_ad:1", 1),
      type: "suggested_position",
      payload: {} as never,
    } as FeedItem;
    const profiles = {
      ...envelope("module:suggested_profiles:0", 1),
      type: "suggested_profiles",
      payload: { identityId: null, identityType: null, moduleIndex: 0, moduleKey: "suggested_profiles", moduleLimit: 3 },
    } as FeedItem;
    const clubs = {
      ...envelope("module:suggested_clubs:0", 1),
      type: "suggested_clubs",
      payload: { identityId: null, identityType: null, moduleIndex: 0, moduleKey: "suggested_clubs", moduleLimit: 6 },
    } as FeedItem;
    const repost = {
      ...post("repost:p:1", 1),
      repost: {
        additionalCount: 0,
        reposter: { avatarUrl: null, identityId: "x", identityType: "person", isVerified: false, name: "X" },
      },
    } as FeedItem;

    expect(unitTypeOf(post("a", 1))).toBe("CONTENT");
    expect(unitTypeOf(repost)).toBe("SIMPLE_REPOST");
    expect(unitTypeOf(position)).toBe("OPPORTUNITY");
    expect(unitTypeOf(profiles)).toBe("SUGGESTED_PROFILES");
    // §222: il carosello Società è un'unit SUGGESTED_PROFILES.
    expect(unitTypeOf(clubs)).toBe("SUGGESTED_PROFILES");
  });
});

describe("dedupeByUnitId", () => {
  it("vince la prima occorrenza e non riordina", () => {
    const first = post("dup", 1);

    const result = dedupeByUnitId([first, post("a", 2), post("dup", 3)]);

    expect(result.map((item) => item.id)).toEqual(["dup", "a"]);
    expect(result[0]).toBe(first);
  });
});
